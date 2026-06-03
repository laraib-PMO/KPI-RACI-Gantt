// ─── Cron Sync — Vercel Cron Job (every 15 min) ─────────────────────────────
// Syncs: Linear + Asana tasks/dates/status, Slack standups,
//        Auto-generates risks from deadlines, Auto-fills open roles

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

// ─── Linear: project-level sync ─────────────────────────────────────────────
async function syncLinearProjects(key) {
  const { data: tasks } = await supabase.from('tasks').select('*')
    .not('linked_project', 'is', null).eq('linked_source', 'linear');
  let updated = 0;
  for (const task of (tasks || [])) {
    try {
      const res = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: { 'Authorization': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{ project(id:"${task.linked_project}") {
            name startDate targetDate
            issues { nodes { state { type } dueDate startedAt } }
          }}`
        })
      });
      const data = await res.json();
      const project = data?.data?.project;
      if (!project) continue;
      const issues = project.issues?.nodes || [];
      if (!issues.length) continue;
      const done = issues.filter(i => i.state?.type === 'completed').length;
      const started = issues.filter(i => i.state?.type === 'started').length;
      const progress = Math.round((done / issues.length) * 100);
      const status = progress === 100 ? 'Done' : (done > 0 || started > 0) ? 'Doing' : 'To Do';
      const upd = { progress, status };
      if (project.startDate) upd.start_date = project.startDate;
      if (project.targetDate) upd.end_date = project.targetDate;
      if (!upd.start_date) {
        const starts = issues.map(i => i.startedAt?.split('T')[0]).filter(Boolean).sort();
        if (starts.length) upd.start_date = starts[0];
      }
      if (!upd.end_date) {
        const dues = issues.map(i => i.dueDate).filter(Boolean).sort();
        if (dues.length) upd.end_date = dues[dues.length - 1];
      }
      await supabase.from('tasks').update(upd).eq('id', task.id);
      updated++;
    } catch (e) { console.error('Linear project sync:', task.name, e.message); }
  }
  return { updated };
}

// ─── Linear: single issue URL sync ──────────────────────────────────────────
async function syncLinearTaskUrls(key) {
  const { data: tasks } = await supabase.from('tasks').select('*')
    .not('linked_task_url', 'is', null).like('linked_task_url', '%linear.app%');
  let updated = 0;
  for (const task of (tasks || [])) {
    try {
      const match = task.linked_task_url.match(/ATT-(\d+)/);
      if (!match) continue;
      const res = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: { 'Authorization': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{ issues(filter:{number:{eq:${parseInt(match[1])}}},first:1) {
            nodes { state { type } dueDate startedAt completedAt }
          }}`
        })
      });
      const data = await res.json();
      const issue = data?.data?.issues?.nodes?.[0];
      if (!issue) continue;
      const st = issue.state?.type;
      const upd = {};
      if (st === 'completed' && task.status !== 'Done') { upd.status = 'Done'; upd.progress = 100; }
      else if (st === 'started' && task.status !== 'Doing') { upd.status = 'Doing'; if (task.progress === 100) upd.progress = 50; }
      else if ((st === 'unstarted' || st === 'backlog') && task.status !== 'To Do') { upd.status = 'To Do'; upd.progress = 0; }
      if (issue.dueDate) upd.end_date = issue.dueDate;
      if (issue.startedAt) upd.start_date = issue.startedAt.split('T')[0];
      if (Object.keys(upd).length) {
        await supabase.from('tasks').update(upd).eq('id', task.id);
        updated++;
      }
    } catch (e) { console.error('Linear task sync:', task.name, e.message); }
  }
  return { updated };
}

// ─── Asana: project-level sync ──────────────────────────────────────────────
async function syncAsanaProjects(token) {
  const { data: tasks } = await supabase.from('tasks').select('*')
    .not('linked_project', 'is', null).eq('linked_source', 'asana');
  let updated = 0;
  for (const task of (tasks || [])) {
    try {
      const res = await fetch(
        `https://app.asana.com/api/1.0/tasks?project=${task.linked_project}&opt_fields=completed,due_on,start_on&limit=100`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.errors) continue;
      const list = data?.data || [];
      if (!list.length) continue;
      const done = list.filter(t => t.completed).length;
      const progress = Math.round((done / list.length) * 100);
      const status = progress === 100 ? 'Done' : progress > 0 ? 'Doing' : 'To Do';
      const upd = { progress, status };
      const dues = list.map(t => t.due_on).filter(Boolean).sort();
      if (dues.length) upd.end_date = dues[dues.length - 1];
      const starts = list.map(t => t.start_on).filter(Boolean).sort();
      if (starts.length) upd.start_date = starts[0];
      await supabase.from('tasks').update(upd).eq('id', task.id);
      updated++;
    } catch (e) { console.error('Asana project sync:', task.name, e.message); }
  }
  return { updated };
}

// ─── Asana: single task URL sync ────────────────────────────────────────────
async function syncAsanaTaskUrls(token) {
  const { data: tasks } = await supabase.from('tasks').select('*')
    .not('linked_task_url', 'is', null).like('linked_task_url', '%asana.com%');
  let updated = 0;
  for (const task of (tasks || [])) {
    try {
      // Asana URL = app.asana.com/0/{board}/{task} — the TASK gid is the LAST numeric segment
      const segs = task.linked_task_url.split(/[/?#]/).filter(s => /^\d+$/.test(s));
      const gid = segs[segs.length - 1];
      if (!gid) continue;
      const res = await fetch(
        `https://app.asana.com/api/1.0/tasks/${gid}?opt_fields=completed,due_on,start_on,name`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.errors || !data?.data) continue;
      const a = data.data;
      const upd = {};
      if (a.completed && task.status !== 'Done') { upd.status = 'Done'; upd.progress = 100; }
      else if (!a.completed && task.status === 'Done') { upd.status = 'Doing'; upd.progress = 50; }
      else if (!a.completed && task.status === 'To Do' && (a.due_on || a.start_on)) { upd.status = 'Doing'; }
      if (a.due_on) upd.end_date = a.due_on;
      if (a.start_on) upd.start_date = a.start_on;
      if (Object.keys(upd).length) {
        await supabase.from('tasks').update(upd).eq('id', task.id);
        updated++;
      }
    } catch (e) { console.error('Asana task sync:', task.name, e.message); }
  }
  return { updated };
}

// ─── Slack standups ─────────────────────────────────────────────────────────
async function syncSlackStandups(token) {
  try {
    const chRes = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const chData = await chRes.json();
    const channel = chData.channels?.find(c => c.name === 'daily-standup');
    if (!channel) return { saved: 0 };
    const yesterday = Math.floor(Date.now() / 1000) - 86400;
    const msgRes = await fetch(`https://slack.com/api/conversations.history?channel=${channel.id}&oldest=${yesterday}&limit=50`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const msgData = await msgRes.json();
    const messages = msgData.messages?.filter(m => !m.bot_id && m.text && m.text.length > 10) || [];
    const userIds = [...new Set(messages.map(m => m.user).filter(Boolean))];
    const userMap = {};
    await Promise.all(userIds.map(async uid => {
      try {
        const r = await fetch(`https://slack.com/api/users.info?user=${uid}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const d = await r.json();
        userMap[uid] = d.user?.real_name || d.user?.name || 'Unknown';
      } catch { userMap[uid] = 'Unknown'; }
    }));
    let saved = 0;
    const today = new Date().toISOString().split('T')[0];
    for (const msg of messages) {
      const name = userMap[msg.user] || 'Unknown';
      const { data: existing } = await supabase.from('standups')
        .select('id').eq('person', name).eq('standup_date', today).eq('source', 'slack');
      if (existing && existing.length > 0) continue;
      const text = msg.text;
      let completed = text, tomorrow = '', blockers = 'None';
      const lines = text.split('\n');
      if (lines.length >= 2) { completed = lines[0]; tomorrow = lines[1] || ''; blockers = lines[2] || 'None'; }
      await supabase.from('standups').insert({ person: name, completed, tomorrow, blockers, standup_date: today, source: 'slack' });
      saved++;
    }
    return { saved };
  } catch (e) { return { saved: 0, err: e.message }; }
}

// ─── AUTO-RISK DETECTION ────────────────────────────────────────────────────
// Rules:
//   - Task overdue >3 days + not Done → HIGH risk (auto)
//   - Task due within 2 days + progress <30% → MEDIUM risk (auto)
//   - Multiple tasks in same dept overdue → CRITICAL risk for dept
async function autoDetectRisks() {
  const today = new Date().toISOString().split('T')[0];
  const { data: tasks } = await supabase.from('tasks').select('*');
  if (!tasks) return { created: 0 };

  let created = 0;
  const deptOverdue = {};

  for (const task of tasks) {
    if (task.status === 'Done' || !task.end_date) continue;

    const dueDate = new Date(task.end_date);
    const now = new Date();
    const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
    const daysUntilDue = Math.floor((dueDate - now) / (1000 * 60 * 60 * 24));

    // Track dept-level overdue count
    if (daysOverdue > 0) {
      deptOverdue[task.dept] = (deptOverdue[task.dept] || 0) + 1;
    }

    // Rule 1: Overdue >3 days → HIGH
    if (daysOverdue > 3) {
      const desc = `${task.name} is ${daysOverdue} days overdue (due ${task.end_date})`;
      const { data: existing } = await supabase.from('risks').select('id')
        .ilike('description', `%${task.name}%`).eq('status', 'ACTIVE');
      if (!existing || existing.length === 0) {
        await supabase.from('risks').insert({
          description: desc,
          impact: 'HIGH',
          status: 'ACTIVE',
          owner: task.owner || 'Unassigned',
          mitigation: `Escalate with ${task.owner || 'owner'} — deadline was ${task.end_date}`,
          mitigation_status: 'identified',
          linked_to: task.name,
          created_date: today
        });
        created++;
      }
    }

    // Rule 2: Due within 2 days + progress <30% → MEDIUM
    if (daysUntilDue >= 0 && daysUntilDue <= 2 && (task.progress || 0) < 30) {
      const desc = `${task.name} due in ${daysUntilDue}d with only ${task.progress || 0}% progress`;
      const { data: existing } = await supabase.from('risks').select('id')
        .ilike('description', `%${task.name}%due in%`).eq('status', 'ACTIVE');
      if (!existing || existing.length === 0) {
        await supabase.from('risks').insert({
          description: desc,
          impact: 'MEDIUM',
          status: 'ACTIVE',
          owner: task.owner || 'Unassigned',
          mitigation: `Check progress with ${task.owner || 'owner'} before ${task.end_date}`,
          mitigation_status: 'identified',
          linked_to: task.name,
          created_date: today
        });
        created++;
      }
    }
  }

  // Rule 3: Multiple overdue in same dept → CRITICAL
  for (const [dept, count] of Object.entries(deptOverdue)) {
    if (count >= 3) {
      const desc = `${dept} has ${count} overdue tasks — department-level delivery risk`;
      const { data: existing } = await supabase.from('risks').select('id')
        .ilike('description', `%${dept}%overdue tasks%`).eq('status', 'ACTIVE');
      if (!existing || existing.length === 0) {
        await supabase.from('risks').insert({
          description: desc,
          impact: 'CRITICAL',
          status: 'ACTIVE',
          owner: dept,
          mitigation: `Leadership review needed for ${dept} workload`,
          mitigation_status: 'identified',
          linked_to: dept,
          created_date: today
        });
        created++;
      }
    }
  }

  // Auto-close risks whose tasks are now Done
  const { data: activeRisks } = await supabase.from('risks').select('*').eq('status', 'ACTIVE');
  let closed = 0;
  for (const risk of (activeRisks || [])) {
    if (!risk.linked_to) continue;
    const linkedTask = tasks.find(t => t.name === risk.linked_to && t.status === 'Done');
    if (linkedTask) {
      await supabase.from('risks').update({
        status: 'CLOSED',
        mitigation_status: 'resolved'
      }).eq('id', risk.id);
      closed++;
    }
  }

  return { created, closed };
}

// ─── OPEN ROLES AUTO-FILL DETECTION ─────────────────────────────────────────
// When someone is onboarded for a dept+title match → mark role as filled
async function autoFillRoles() {
  const { data: roles } = await supabase.from('roles').select('*').eq('status', 'Open');
  if (!roles || !roles.length) return { filled: 0 };

  const { data: users } = await supabase.from('user_roles').select('name, role, dept');
  const { data: onboarding } = await supabase.from('onboarding').select('person, status')
    .eq('status', 'done');

  let filled = 0;
  for (const role of roles) {
    // Check if anyone in user_roles matches this dept + similar title
    const match = (users || []).find(u => {
      const deptMatch = u.dept?.toLowerCase() === role.dept?.toLowerCase();
      const titleMatch = u.role?.toLowerCase().includes(role.title?.toLowerCase().split(' ')[0]) ||
                         role.title?.toLowerCase().includes(u.role?.toLowerCase().split(' ')[0]);
      return deptMatch && titleMatch;
    });

    if (match) {
      // Check if they have completed onboarding items
      const hasOnboarding = (onboarding || []).some(o => o.person === match.name);
      if (hasOnboarding) {
        await supabase.from('roles').update({ status: 'Filled' }).eq('id', role.id);
        filled++;
      }
    }

    // Flag roles open >30 days
    if (role.created_at) {
      const age = Math.floor((Date.now() - new Date(role.created_at).getTime()) / (1000 * 60 * 60 * 24));
      if (age > 30 && role.status === 'Open') {
        // Check if already flagged
        const { data: existingRisk } = await supabase.from('risks').select('id')
          .ilike('description', `%${role.title}%open >30%`).eq('status', 'ACTIVE');
        if (!existingRisk || existingRisk.length === 0) {
          await supabase.from('risks').insert({
            description: `${role.title} (${role.dept}) open >30 days`,
            impact: 'MEDIUM',
            status: 'ACTIVE',
            owner: 'HR',
            mitigation: `Review hiring pipeline for ${role.title}`,
            mitigation_status: 'identified',
            linked_to: role.title,
            created_date: new Date().toISOString().split('T')[0]
          });
        }
      }
    }
  }
  return { filled };
}

// ─── Main Cron Handler ──────────────────────────────────────────────────────
export async function GET(req) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  const results = {};

  const linearKey = process.env.LINEAR_API_KEY;
  if (linearKey) {
    results.linearProjects = await syncLinearProjects(linearKey);
    results.linearTasks = await syncLinearTaskUrls(linearKey);
  }

  const asanaToken = process.env.ASANA_TOKEN;
  if (asanaToken) {
    results.asanaProjects = await syncAsanaProjects(asanaToken);
    results.asanaTasks = await syncAsanaTaskUrls(asanaToken);
  }

  const slackToken = process.env.SLACK_BOT_TOKEN;
  if (slackToken) {
    results.standups = await syncSlackStandups(slackToken);
  }

  results.autoRisks = await autoDetectRisks();
  results.autoRoles = await autoFillRoles();

  return Response.json({
    ok: true,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - start,
    results
  });
}
