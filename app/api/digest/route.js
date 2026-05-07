import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_KEY);

const ASANA_PROJECTS = {
  'Marketing Department Task Tracker': '1214432966703164',
  'Design Department Task Tracker': '1214434740066912'
};

function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  catch { return d; }
}

function trtTime() {
  return new Date().toLocaleString('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
}

async function fetchLinear() {
  const key = process.env.LINEAR_API_KEY;
  if (!key) return { done: [], active: [], error: 'No key' };
  try {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const soon = new Date(); soon.setDate(soon.getDate() + 3);
    const soonStr = soon.toISOString().split('T')[0];

    const doneRes = await fetch('https://api.linear.app/graphql', {
      method: 'POST', headers: { 'Authorization': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{issues(first:100,filter:{completedAt:{gte:"${yStr}T00:00:00Z"}}){nodes{title assignee{name}project{name}}}}` })
    });
    const doneData = await doneRes.json();
    const done = (doneData?.data?.issues?.nodes || []).map(i => ({
      title: i.title, person: i.assignee?.name || 'Unassigned', dept: 'Development', project: i.project?.name || ''
    }));

    const activeRes = await fetch('https://api.linear.app/graphql', {
      method: 'POST', headers: { 'Authorization': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{issues(first:150,filter:{state:{type:{in:["started","unstarted"]}}}){nodes{title assignee{name}state{name type}dueDate priority project{name}}}}` })
    });
    const activeData = await activeRes.json();
    const active = (activeData?.data?.issues?.nodes || []).map(i => ({
      title: i.title, person: i.assignee?.name || 'Unassigned', dept: 'Development',
      project: i.project?.name || '', state: i.state?.type, dueDate: i.dueDate,
      isOverdue: i.dueDate && i.dueDate < today,
      isDueSoon: i.dueDate && i.dueDate >= today && i.dueDate <= soonStr,
      isInProgress: i.state?.type === 'started'
    }));

    return { done, active, error: null };
  } catch (e) { return { done: [], active: [], error: e.message }; }
}

async function fetchAsana() {
  const token = process.env.ASANA_TOKEN;
  if (!token) return { done: [], active: [], error: 'No token' };
  try {
    const today = new Date().toISOString().split('T')[0];
    const soon = new Date(); soon.setDate(soon.getDate() + 3);
    const soonStr = soon.toISOString().split('T')[0];
    let allDone = [], allActive = [];

    for (const [projName, projGid] of Object.entries(ASANA_PROJECTS)) {
      const dept = projName.includes('Marketing') ? 'Marketing' : 'Design';
      const res = await fetch(`https://app.asana.com/api/1.0/tasks?project=${projGid}&opt_fields=name,assignee.name,completed,completed_at,due_on&limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.errors) continue;
      const tasks = data?.data || [];

      tasks.forEach(t => {
        if (t.completed) {
          allDone.push({ title: t.name, person: t.assignee?.name || 'Unassigned', dept, project: projName });
        } else {
          allActive.push({
            title: t.name, person: t.assignee?.name || 'Unassigned', dept,
            project: projName, dueDate: t.due_on,
            isOverdue: t.due_on && t.due_on < today,
            isDueSoon: t.due_on && t.due_on >= today && t.due_on <= soonStr,
            isInProgress: true
          });
        }
      });
    }

    return { done: allDone, active: allActive, error: null };
  } catch (e) { return { done: [], active: [], error: e.message }; }
}

function buildSlackBlocks(people, dayName, totals, errors) {
  const blocks = [];
  blocks.push({ type: "header", text: { type: "plain_text", text: "PMO Daily Digest  —  " + dayName } });

  let summaryText = `*${totals.done} completed*  |  *${totals.active} in progress*  |  *${totals.overdue} overdue*`;
  if (errors.length > 0) summaryText += `\n_${errors.join(' | ')}_`;
  blocks.push({ type: "section", text: { type: "mrkdwn", text: summaryText } });
  blocks.push({ type: "divider" });

  const sorted = Object.entries(people)
    .filter(([p]) => p !== 'Unassigned')
    .sort((a, b) => b[1].overdue.length - a[1].overdue.length);

  for (const [person, data] of sorted) {
    const hasContent = data.done.length || data.inProgress.length || data.dueSoon.length || data.overdue.length;
    if (!hasContent) continue;

    let text = `*${person}*  _(${data.dept || 'Team'})_\n`;

    if (data.overdue.length > 0) {
      text += `\n*Overdue (${data.overdue.length})*\n`;
      data.overdue.slice(0, 3).forEach(t => { text += `  •  ${t.title}  _(was due ${fmtDate(t.dueDate)})_\n`; });
      if (data.overdue.length > 3) text += `  _...and ${data.overdue.length - 3} more_\n`;
    }

    if (data.dueSoon.length > 0) {
      text += `\n*Due Soon (${data.dueSoon.length})*\n`;
      data.dueSoon.slice(0, 3).forEach(t => { text += `  •  ${t.title}  _(due ${fmtDate(t.dueDate)})_\n`; });
      if (data.dueSoon.length > 3) text += `  _...and ${data.dueSoon.length - 3} more_\n`;
    }

    if (data.done.length > 0) {
      text += `\n*Done Yesterday (${data.done.length})*\n`;
      data.done.slice(0, 5).forEach(t => { text += `  •  ${t.title}\n`; });
      if (data.done.length > 5) text += `  _...and ${data.done.length - 5} more_\n`;
    }

    if (data.inProgress.length > 0) {
      text += `\n*In Progress (${data.inProgress.length})*\n`;
      data.inProgress.slice(0, 5).forEach(t => { text += `  •  ${t.title}\n`; });
      if (data.inProgress.length > 5) text += `  _...and ${data.inProgress.length - 5} more_\n`;
    }

    blocks.push({ type: "section", text: { type: "mrkdwn", text } });
    blocks.push({ type: "divider" });
  }

  blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `<https://attimo-ops.vercel.app|Open Dashboard>  |  Auto-generated at ${trtTime()} TRT` }] });

  return blocks;
}

async function saveToSupabase(people, today) {
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];
  await supabase.from('standups').delete().lt('standup_date', weekAgoStr);

  for (const [person, data] of Object.entries(people)) {
    if (person === 'Unassigned') continue;
    const hasContent = data.done.length || data.inProgress.length || data.dueSoon.length || data.overdue.length;
    if (!hasContent) continue;

    const completed = data.done.length > 0
      ? data.done.slice(0, 5).map(t => t.title).join('\n') + (data.done.length > 5 ? `\n+${data.done.length - 5} more` : '')
      : 'No completions yesterday';

    const tomorrow = data.inProgress.length > 0
      ? data.inProgress.slice(0, 5).map(t => t.title).join('\n') + (data.inProgress.length > 5 ? `\n+${data.inProgress.length - 5} more` : '')
      : 'No active tasks';

    const parts = [];
    if (data.overdue.length > 0) parts.push(`OVERDUE (${data.overdue.length}): ${data.overdue.slice(0, 3).map(t => t.title).join(', ')}`);
    if (data.dueSoon.length > 0) parts.push(`DUE SOON (${data.dueSoon.length}): ${data.dueSoon.slice(0, 3).map(t => t.title).join(', ')}`);
    const blockers = parts.length > 0 ? parts.join('\n') : 'None';

    const { data: existing } = await supabase.from('standups').select('id').eq('person', person).eq('standup_date', today).eq('source', 'auto-digest');
    if (existing && existing.length > 0) {
      await supabase.from('standups').update({ completed, tomorrow, blockers }).eq('id', existing[0].id);
    } else {
      await supabase.from('standups').insert({ person, completed, tomorrow, blockers, standup_date: today, source: 'auto-digest' });
    }
  }
}

async function postToSlack(blocks) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks })
  }).catch(() => {});
}

export async function POST() {
  const today = new Date().toISOString().split('T')[0];
  const dayName = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const [linear, asana] = await Promise.all([fetchLinear(), fetchAsana()]);

  const allDone = [...linear.done, ...asana.done];
  const allActive = [...linear.active, ...asana.active];

  const people = {};
  const add = (n, dept) => { if (!people[n]) people[n] = { done: [], inProgress: [], dueSoon: [], overdue: [], dept }; };

  allDone.forEach(t => { add(t.person, t.dept); people[t.person].done.push(t); });
  allActive.forEach(t => {
    add(t.person, t.dept);
    if (t.isOverdue) people[t.person].overdue.push(t);
    else if (t.isDueSoon) people[t.person].dueSoon.push(t);
    else if (t.isInProgress) people[t.person].inProgress.push(t);
  });

  const totals = {
    done: allDone.length,
    active: allActive.filter(t => t.isInProgress).length,
    overdue: allActive.filter(t => t.isOverdue).length
  };

  const errors = [];
  if (linear.error) errors.push('Linear: ' + linear.error);
  if (asana.error) errors.push('Asana: ' + asana.error);

  const blocks = buildSlackBlocks(people, dayName, totals, errors);
  await saveToSupabase(people, today);
  await postToSlack(blocks);

  return Response.json({
    timestamp: new Date().toISOString(),
    day: dayName,
    totalDone: totals.done,
    totalActive: totals.active,
    totalOverdue: totals.overdue,
    people: Object.keys(people).filter(p => p !== 'Unassigned').length,
    linearError: linear.error,
    asanaError: asana.error,
    message: 'Digest complete'
  });
}

export async function GET() { return POST(); }
