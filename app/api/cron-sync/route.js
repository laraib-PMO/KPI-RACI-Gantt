// ─── Cron Sync — Vercel Cron Job Entry Point ────────────────────────────────
// Runs every 15 minutes via vercel.json cron config
// Secured with CRON_SECRET to prevent unauthorized access
//
// This is a GET endpoint (Vercel cron only sends GET requests)
// It calls the same sync logic as /api/sync but adds CRON_SECRET auth

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

const ASANA_PROJECTS = {
  'Marketing Department Task Tracker': '1214432966703164',
  'Design Department Task Tracker': '1214434740066912'
};

// ─── Sync linked project progress + dates (Linear projects) ─────────────────
async function syncLinearProjects(key) {
  const { data: linkedTasks } = await supabase
    .from('tasks').select('*')
    .not('linked_project', 'is', null)
    .eq('linked_source', 'linear');

  let updated = 0;
  const log = [];

  for (const task of (linkedTasks || [])) {
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
      if (!project) { log.push({ task: task.name, err: 'project not found' }); continue; }

      const issues = project.issues?.nodes || [];
      if (!issues.length) continue;

      const done = issues.filter(i => i.state?.type === 'completed').length;
      const started = issues.filter(i => i.state?.type === 'started').length;
      const progress = Math.round((done / issues.length) * 100);
      const status = progress === 100 ? 'Done' : (done > 0 || started > 0) ? 'Doing' : 'To Do';

      const upd = { progress, status };
      if (project.startDate) upd.start_date = project.startDate;
      if (project.targetDate) upd.end_date = project.targetDate;

      // Derive dates from issues if project-level dates missing
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
      log.push({ task: task.name, progress, status, start: upd.start_date, end: upd.end_date });
    } catch (e) {
      log.push({ task: task.name, err: e.message });
    }
  }
  return { updated, log };
}

// ─── Sync linked task URLs (Linear single issues) ───────────────────────────
async function syncLinearTaskUrls(key) {
  const { data: tasks } = await supabase
    .from('tasks').select('*')
    .not('linked_task_url', 'is', null)
    .like('linked_task_url', '%linear.app%');

  let updated = 0;
  const log = [];

  for (const task of (tasks || [])) {
    try {
      const match = task.linked_task_url.match(/ATT-(\d+)/);
      if (!match) { log.push({ task: task.name, err: 'no ATT-xxx in URL' }); continue; }

      const num = parseInt(match[1]);
      const res = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: { 'Authorization': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{ issues(filter:{number:{eq:${num}}},first:1) {
            nodes { state { type } dueDate startedAt completedAt }
          }}`
        })
      });
      const data = await res.json();
      const issue = data?.data?.issues?.nodes?.[0];
      if (!issue) { log.push({ task: task.name, err: `ATT-${num} not found` }); continue; }

      const st = issue.state?.type;
      const upd = {};

      // Bidirectional status sync
      if (st === 'completed' && task.status !== 'Done') { upd.status = 'Done'; upd.progress = 100; }
      else if (st === 'started' && task.status !== 'Doing') { upd.status = 'Doing'; if (task.progress === 100) upd.progress = 50; }
      else if ((st === 'unstarted' || st === 'backlog') && task.status !== 'To Do') { upd.status = 'To Do'; upd.progress = 0; }

      if (issue.dueDate) upd.end_date = issue.dueDate;
      if (issue.startedAt) upd.start_date = issue.startedAt.split('T')[0];

      if (Object.keys(upd).length) {
        await supabase.from('tasks').update(upd).eq('id', task.id);
        updated++;
        log.push({ task: task.name, num, upd });
      }
    } catch (e) {
      log.push({ task: task.name, err: e.message });
    }
  }
  return { updated, log };
}

// ─── Sync Asana project-level links ─────────────────────────────────────────
async function syncAsanaProjects(token) {
  const { data: tasks } = await supabase
    .from('tasks').select('*')
    .not('linked_project', 'is', null)
    .eq('linked_source', 'asana');

  let updated = 0;
  const log = [];

  for (const task of (tasks || [])) {
    try {
      const res = await fetch(
        `https://app.asana.com/api/1.0/tasks?project=${task.linked_project}&opt_fields=completed,due_on,start_on&limit=100`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.errors) { log.push({ task: task.name, err: data.errors }); continue; }

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
      log.push({ task: task.name, progress, status, start: upd.start_date, end: upd.end_date });
    } catch (e) {
      log.push({ task: task.name, err: e.message });
    }
  }
  return { updated, log };
}

// ─── Sync Asana single task URLs ─────────────────────────────────────────────
async function syncAsanaTaskUrls(token) {
  const { data: tasks } = await supabase
    .from('tasks').select('*')
    .not('linked_task_url', 'is', null)
    .like('linked_task_url', '%asana.com%');

  let updated = 0;
  const log = [];

  for (const task of (tasks || [])) {
    try {
      const match = task.linked_task_url.match(/\/(\d+)(?:\/|\?|$)/);
      if (!match) { log.push({ task: task.name, err: 'no GID in URL' }); continue; }

      const gid = match[1];
      const res = await fetch(
        `https://app.asana.com/api/1.0/tasks/${gid}?opt_fields=completed,due_on,start_on,name`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.errors || !data?.data) { log.push({ task: task.name, err: data.errors || 'no data' }); continue; }

      const a = data.data;
      const upd = {};

      // Bidirectional status sync
      if (a.completed && task.status !== 'Done') { upd.status = 'Done'; upd.progress = 100; }
      else if (!a.completed && task.status === 'Done') { upd.status = 'Doing'; upd.progress = 50; }
      else if (!a.completed && task.status === 'To Do' && (a.due_on || a.start_on)) { upd.status = 'Doing'; }

      if (a.due_on) upd.end_date = a.due_on;
      if (a.start_on) upd.start_date = a.start_on;

      if (Object.keys(upd).length) {
        await supabase.from('tasks').update(upd).eq('id', task.id);
        updated++;
        log.push({ task: task.name, gid, upd });
      }
    } catch (e) {
      log.push({ task: task.name, err: e.message });
    }
  }
  return { updated, log };
}

// ─── Sync Slack standups ─────────────────────────────────────────────────────
async function syncSlackStandups(token) {
  try {
    const chRes = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const chData = await chRes.json();
    const channel = chData.channels?.find(c => c.name === 'daily-standup');
    if (!channel) return { saved: 0, err: '#daily-standup not found' };

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
      if (lines.length >= 2) { completed = lines[0] || text; tomorrow = lines[1] || ''; blockers = lines[2] || 'None'; }
      await supabase.from('standups').insert({ person: name, completed, tomorrow, blockers, standup_date: today, source: 'slack' });
      saved++;
    }
    return { saved };
  } catch (e) {
    return { saved: 0, err: e.message };
  }
}

// ─── Main Cron Handler (GET — Vercel cron sends GET) ─────────────────────────
export async function GET(req) {
  // Auth check: Vercel sends CRON_SECRET as Authorization bearer
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const results = {};

  // Linear sync
  const linearKey = process.env.LINEAR_API_KEY;
  if (linearKey) {
    results.linearProjects = await syncLinearProjects(linearKey);
    results.linearTasks = await syncLinearTaskUrls(linearKey);
  } else {
    results.linear = { skipped: true, reason: 'No LINEAR_API_KEY' };
  }

  // Asana sync
  const asanaToken = process.env.ASANA_TOKEN;
  if (asanaToken) {
    results.asanaProjects = await syncAsanaProjects(asanaToken);
    results.asanaTasks = await syncAsanaTaskUrls(asanaToken);
  } else {
    results.asana = { skipped: true, reason: 'No ASANA_TOKEN' };
  }

  // Slack standups
  const slackToken = process.env.SLACK_BOT_TOKEN;
  if (slackToken) {
    results.standups = await syncSlackStandups(slackToken);
  } else {
    results.standups = { skipped: true, reason: 'No SLACK_BOT_TOKEN' };
  }

  const duration = Date.now() - startTime;

  return Response.json({
    ok: true,
    timestamp: new Date().toISOString(),
    durationMs: duration,
    results
  });
}
