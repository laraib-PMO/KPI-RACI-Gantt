import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_KEY);

async function fetchLinear() {
  const key = process.env.LINEAR_API_KEY;
  if (!key) return { done: [], active: [], source: 'Linear', error: 'No key' };
  try {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const soon = new Date(); soon.setDate(soon.getDate() + 3);
    const soonStr = soon.toISOString().split('T')[0];

    // Get completed yesterday
    const doneRes = await fetch('https://api.linear.app/graphql', {
      method: 'POST', headers: { 'Authorization': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{issues(first:100,filter:{completedAt:{gte:"${yStr}T00:00:00Z",lt:"${today}T23:59:59Z"}}){nodes{id title assignee{name}completedAt description}}}` })
    });
    const doneData = await doneRes.json();
    const done = (doneData?.data?.issues?.nodes || []).map(i => ({
      title: i.title, person: i.assignee?.name || 'Unassigned', desc: (i.description || '').slice(0, 100)
    }));

    // Get active (in progress + todo with due dates)
    const activeRes = await fetch('https://api.linear.app/graphql', {
      method: 'POST', headers: { 'Authorization': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{issues(first:100,filter:{state:{type:{in:["started","unstarted"]}}}){nodes{id title assignee{name}state{name type}dueDate priority startedAt}}}` })
    });
    const activeData = await activeRes.json();
    const active = (activeData?.data?.issues?.nodes || []).map(i => ({
      title: i.title, person: i.assignee?.name || 'Unassigned',
      state: i.state?.type, stateName: i.state?.name,
      dueDate: i.dueDate, priority: i.priority,
      isOverdue: i.dueDate && i.dueDate < today,
      isDueSoon: i.dueDate && i.dueDate >= today && i.dueDate <= soonStr,
      isInProgress: i.state?.type === 'started'
    }));

    return { done, active, source: 'Linear', error: null };
  } catch (e) { return { done: [], active: [], source: 'Linear', error: e.message }; }
}

async function fetchAsana() {
  const token = process.env.ASANA_TOKEN;
  if (!token) return { done: [], active: [], source: 'Asana', error: 'No token' };
  try {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const soon = new Date(); soon.setDate(soon.getDate() + 3);
    const soonStr = soon.toISOString().split('T')[0];

    const res = await fetch('https://app.asana.com/api/1.0/tasks?opt_fields=name,assignee.name,completed,completed_at,due_on,notes&limit=100', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const tasks = data?.data || [];

    const done = tasks.filter(t => t.completed && t.completed_at && t.completed_at >= yStr).map(t => ({
      title: t.name, person: t.assignee?.name || 'Unassigned', desc: (t.notes || '').slice(0, 100)
    }));

    const active = tasks.filter(t => !t.completed).map(t => ({
      title: t.name, person: t.assignee?.name || 'Unassigned',
      dueDate: t.due_on, isOverdue: t.due_on && t.due_on < today,
      isDueSoon: t.due_on && t.due_on >= today && t.due_on <= soonStr,
      isInProgress: true
    }));

    return { done, active, source: 'Asana', error: null };
  } catch (e) { return { done: [], active: [], source: 'Asana', error: e.message }; }
}

function buildDigest(linear, asana) {
  const today = new Date().toISOString().split('T')[0];
  const dayName = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  // Combine all data
  const allDone = [...linear.done, ...asana.done];
  const allActive = [...linear.active, ...asana.active];

  // Group by person
  const people = {};
  const addPerson = (name) => { if (!people[name]) people[name] = { done: [], inProgress: [], dueSoon: [], overdue: [] }; };

  allDone.forEach(t => { addPerson(t.person); people[t.person].done.push(t); });
  allActive.forEach(t => {
    addPerson(t.person);
    if (t.isOverdue) people[t.person].overdue.push(t);
    else if (t.isDueSoon) people[t.person].dueSoon.push(t);
    else if (t.isInProgress) people[t.person].inProgress.push(t);
  });

  // Build Slack message (clean, max 5 per section)
  let slack = `PMO Daily Digest — ${dayName}\n`;
  let totalDone = 0, totalOverdue = 0, totalActive = 0;

  const sortedPeople = Object.entries(people).sort((a, b) => {
    const aUrgent = a[1].overdue.length; const bUrgent = b[1].overdue.length;
    return bUrgent - aUrgent; // People with overdue items first
  });

  for (const [person, data] of sortedPeople) {
    if (person === 'Unassigned') continue;
    const hasContent = data.done.length || data.inProgress.length || data.dueSoon.length || data.overdue.length;
    if (!hasContent) continue;

    slack += `\n${person}\n`;

    if (data.overdue.length > 0) {
      slack += `  OVERDUE (${data.overdue.length})\n`;
      data.overdue.slice(0, 3).forEach(t => { slack += `  - ${t.title}${t.dueDate ? ' (was due ' + t.dueDate + ')' : ''}\n`; });
      if (data.overdue.length > 3) slack += `  ...and ${data.overdue.length - 3} more overdue\n`;
      totalOverdue += data.overdue.length;
    }

    if (data.dueSoon.length > 0) {
      slack += `  DUE SOON (${data.dueSoon.length})\n`;
      data.dueSoon.slice(0, 3).forEach(t => { slack += `  - ${t.title} (due ${t.dueDate})\n`; });
      if (data.dueSoon.length > 3) slack += `  ...and ${data.dueSoon.length - 3} more due soon\n`;
    }

    if (data.done.length > 0) {
      slack += `  DONE YESTERDAY (${data.done.length})\n`;
      data.done.slice(0, 5).forEach(t => { slack += `  - ${t.title}\n`; });
      if (data.done.length > 5) slack += `  ...and ${data.done.length - 5} more completed\n`;
      totalDone += data.done.length;
    }

    if (data.inProgress.length > 0) {
      slack += `  IN PROGRESS (${data.inProgress.length})\n`;
      data.inProgress.slice(0, 5).forEach(t => { slack += `  - ${t.title}\n`; });
      if (data.inProgress.length > 5) slack += `  ...and ${data.inProgress.length - 5} more in progress\n`;
      totalActive += data.inProgress.length;
    }
  }

  slack += `\n---\nSummary: ${totalDone} done | ${totalActive} in progress | ${totalOverdue} overdue\nDashboard: https://attimo-ops.vercel.app`;

  return { slack, people, totalDone, totalOverdue, totalActive, dayName, today };
}

async function saveToSupabase(people, today) {
  for (const [person, data] of Object.entries(people)) {
    if (person === 'Unassigned') continue;
    const hasContent = data.done.length || data.inProgress.length || data.dueSoon.length || data.overdue.length;
    if (!hasContent) continue;

    const completed = data.done.length > 0
      ? data.done.slice(0, 5).map(t => t.title).join('; ') + (data.done.length > 5 ? ` (+${data.done.length - 5} more)` : '')
      : 'No completions yesterday';

    const tomorrow = data.inProgress.length > 0
      ? data.inProgress.slice(0, 5).map(t => t.title).join('; ') + (data.inProgress.length > 5 ? ` (+${data.inProgress.length - 5} more)` : '')
      : 'No active tasks';

    const blockerParts = [];
    if (data.overdue.length > 0) blockerParts.push(`${data.overdue.length} overdue: ${data.overdue.slice(0, 3).map(t => t.title).join(', ')}`);
    if (data.dueSoon.length > 0) blockerParts.push(`${data.dueSoon.length} due soon: ${data.dueSoon.slice(0, 3).map(t => t.title).join(', ')}`);
    const blockers = blockerParts.length > 0 ? blockerParts.join(' | ') : 'None';

    // Check if already saved today for this person
    const { data: existing } = await supabase.from('standups')
      .select('id').eq('person', person).eq('standup_date', today).eq('source', 'auto-digest');
    if (existing && existing.length > 0) {
      await supabase.from('standups').update({ completed, tomorrow, blockers }).eq('id', existing[0].id);
    } else {
      await supabase.from('standups').insert({ person, completed, tomorrow, blockers, standup_date: today, source: 'auto-digest' });
    }
  }
}

async function postToSlack(message) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: message }) }).catch(() => {});
}

export async function POST() {
  const [linear, asana] = await Promise.all([fetchLinear(), fetchAsana()]);
  const digest = buildDigest(linear, asana);

  await saveToSupabase(digest.people, digest.today);
  await postToSlack(digest.slack);

  return Response.json({
    timestamp: new Date().toISOString(),
    day: digest.dayName,
    totalDone: digest.totalDone,
    totalActive: digest.totalActive,
    totalOverdue: digest.totalOverdue,
    people: Object.keys(digest.people).filter(p => p !== 'Unassigned').length,
    linearError: linear.error,
    asanaError: asana.error,
    message: 'Digest complete'
  });
}

export async function GET() { return POST(); }
