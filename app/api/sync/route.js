import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

const ASANA_PROJECTS = {
  'Marketing Department Task Tracker': '1214432966703164',
  'Design Department Task Tracker': '1214434740066912'
};

// ─── Check Linear connectivity ───────────────────────────────────────────────
async function checkLinear() {
  const key = process.env.LINEAR_API_KEY;
  if (!key) return { source: 'Linear', status: 'skipped', reason: 'No API key', count: 0 };
  try {
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { 'Authorization': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ issues(first: 50, filter: { state: { type: { nin: ["canceled"] } } }) {
          nodes { id title state { name } assignee { name } startedAt dueDate priority labels { nodes { name } } }
        }}`
      })
    });
    const data = await res.json();
    const issues = data?.data?.issues?.nodes || [];
    return { source: 'Linear', status: 'ok', count: issues.length };
  } catch (e) {
    return { source: 'Linear', status: 'error', error: e.message, count: 0 };
  }
}

// ─── Check Asana connectivity ────────────────────────────────────────────────
async function checkAsana() {
  const token = process.env.ASANA_TOKEN;
  if (!token) return { source: 'Asana', status: 'skipped', reason: 'No token', count: 0 };
  try {
    let total = 0;
    for (const [name, gid] of Object.entries(ASANA_PROJECTS)) {
      const res = await fetch(
        `https://app.asana.com/api/1.0/tasks?project=${gid}&opt_fields=name,completed&limit=100`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!data.errors) total += (data?.data?.length || 0);
    }
    return { source: 'Asana', status: 'ok', count: total };
  } catch (e) {
    return { source: 'Asana', status: 'error', error: e.message, count: 0 };
  }
}

// ─── Sync Slack standups ─────────────────────────────────────────────────────
async function syncSlackStandups() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { source: 'Slack Standups', status: 'skipped', reason: 'No bot token', count: 0 };
  try {
    const chRes = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const chData = await chRes.json();
    const channel = chData.channels?.find(c => c.name === 'daily-standup');
    if (!channel) return { source: 'Slack Standups', status: 'error', error: '#daily-standup not found', count: 0 };

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
        const r = await fetch(`https://slack.com/api/users.info?user=${uid}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
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
      if (lines.length >= 2) {
        completed = lines[0] || text;
        tomorrow = lines[1] || '';
        blockers = lines[2] || 'None';
      }
      await supabase.from('standups').insert({
        person: name, completed, tomorrow, blockers,
        standup_date: today, source: 'slack'
      });
      saved++;
    }
    return { source: 'Slack Standups', status: 'ok', count: saved };
  } catch (e) {
    return { source: 'Slack Standups', status: 'error', error: e.message, count: 0 };
  }
}

// ─── Sync linked project progress + dates ────────────────────────────────────
async function syncLinkedProjects() {
  const key = process.env.LINEAR_API_KEY;
  const asanaToken = process.env.ASANA_TOKEN;
  let updated = 0;
  const debug = []; // collect debug info for response

  // ── Part 1: Tasks with linked_project (project-level % calc) ──────────────
  const { data: linkedTasks, error: ltErr } = await supabase
    .from('tasks').select('*').not('linked_project', 'is', null);

  if (ltErr) {
    debug.push({ step: 'fetch linked_project tasks', error: ltErr.message });
  }

  if (linkedTasks && linkedTasks.length > 0) {
    debug.push({ step: 'linked_project tasks found', count: linkedTasks.length });

    for (const task of linkedTasks) {
      try {
        // ── Linear project link ──
        if (task.linked_source === 'linear' && key) {
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

          if (!project) {
            debug.push({ task: task.name, error: 'Linear project not found', id: task.linked_project });
            continue;
          }

          const issues = project.issues?.nodes || [];
          if (issues.length === 0) {
            debug.push({ task: task.name, error: 'No issues in project' });
            continue;
          }

          const total = issues.length;
          const done = issues.filter(i => i.state?.type === 'completed').length;
          const started = issues.filter(i => i.state?.type === 'started').length;
          const progress = Math.round((done / total) * 100);
          const newStatus = progress === 100 ? 'Done' : (done > 0 || started > 0) ? 'Doing' : 'To Do';

          const upd = { progress, status: newStatus };
          if (project.startDate) upd.start_date = project.startDate;
          if (project.targetDate) upd.end_date = project.targetDate;

          // Also derive dates from issues if project dates missing
          if (!upd.start_date) {
            const issueDates = issues.map(i => i.startedAt?.split('T')[0]).filter(Boolean).sort();
            if (issueDates.length) upd.start_date = issueDates[0];
          }
          if (!upd.end_date) {
            const dueDates = issues.map(i => i.dueDate).filter(Boolean).sort();
            if (dueDates.length) upd.end_date = dueDates[dueDates.length - 1];
          }

          await supabase.from('tasks').update(upd).eq('id', task.id);
          updated++;
          debug.push({ task: task.name, source: 'linear-project', progress, status: newStatus, dates: { start: upd.start_date, end: upd.end_date } });

        // ── Asana project link ──
        } else if (task.linked_source === 'asana' && asanaToken) {
          // FIX: Now fetching due_on + start_on for date sync
          const res = await fetch(
            `https://app.asana.com/api/1.0/tasks?project=${task.linked_project}&opt_fields=completed,due_on,start_on&limit=100`,
            { headers: { 'Authorization': `Bearer ${asanaToken}` } }
          );
          const data = await res.json();

          if (data.errors) {
            debug.push({ task: task.name, error: 'Asana API error', details: data.errors });
            continue;
          }

          const tasksList = data?.data || [];
          if (tasksList.length === 0) {
            debug.push({ task: task.name, error: 'No tasks in Asana project' });
            continue;
          }

          const total = tasksList.length;
          const done = tasksList.filter(t => t.completed).length;
          const progress = Math.round((done / total) * 100);
          const newStatus = progress === 100 ? 'Done' : progress > 0 ? 'Doing' : 'To Do';

          const upd = { progress, status: newStatus };

          // FIX: Derive project date range from task dates
          const dueDates = tasksList.map(t => t.due_on).filter(Boolean).sort();
          if (dueDates.length) upd.end_date = dueDates[dueDates.length - 1]; // latest due_on
          const startDates = tasksList.map(t => t.start_on).filter(Boolean).sort();
          if (startDates.length) upd.start_date = startDates[0]; // earliest start_on

          await supabase.from('tasks').update(upd).eq('id', task.id);
          updated++;
          debug.push({ task: task.name, source: 'asana-project', progress, status: newStatus, dates: { start: upd.start_date, end: upd.end_date } });
        }
      } catch (e) {
        console.error('Linked project sync error for task', task.id, e);
        debug.push({ task: task.name, error: e.message });
      }
    }
  } else {
    debug.push({ step: 'linked_project tasks', count: 0, note: 'No tasks have linked_project set' });
  }

  // ── Part 2: Tasks with linked_task_url (single issue/task) ────────────────
  const { data: linkedUrlTasks, error: luErr } = await supabase
    .from('tasks').select('*').not('linked_task_url', 'is', null);

  if (luErr) {
    debug.push({ step: 'fetch linked_task_url tasks', error: luErr.message });
  }

  if (linkedUrlTasks && linkedUrlTasks.length > 0) {
    debug.push({ step: 'linked_task_url tasks found', count: linkedUrlTasks.length });

    for (const task of linkedUrlTasks) {
      try {
        // ── Linear issue URL ──
        if (task.linked_task_url?.includes('linear.app') && key) {
          const match = task.linked_task_url.match(/ATT-(\d+)/);
          if (!match) {
            debug.push({ task: task.name, error: 'No ATT-xxx found in URL', url: task.linked_task_url });
            continue;
          }

          const issueNum = parseInt(match[1]);
          const res = await fetch('https://api.linear.app/graphql', {
            method: 'POST',
            headers: { 'Authorization': key, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: `{ issues(filter:{number:{eq:${issueNum}}},first:1) {
                nodes { state { type name } dueDate startedAt completedAt }
              }}`
            })
          });
          const data = await res.json();
          const issue = data?.data?.issues?.nodes?.[0];

          if (!issue) {
            debug.push({ task: task.name, error: `ATT-${issueNum} not found in Linear` });
            continue;
          }

          const stateType = issue.state?.type;
          const upd = {};

          // FIX: Bidirectional status sync
          if (stateType === 'completed') {
            if (task.status !== 'Done') { upd.status = 'Done'; upd.progress = 100; }
          } else if (stateType === 'started') {
            if (task.status !== 'Doing') { upd.status = 'Doing'; }
            if (task.progress === 100) { upd.progress = 50; } // was marked Done but reopened
          } else if (stateType === 'unstarted' || stateType === 'backlog') {
            if (task.status !== 'To Do') { upd.status = 'To Do'; upd.progress = 0; }
          }

          // Sync dates
          if (issue.dueDate) upd.end_date = issue.dueDate;
          if (issue.startedAt) upd.start_date = issue.startedAt.split('T')[0];

          if (Object.keys(upd).length > 0) {
            await supabase.from('tasks').update(upd).eq('id', task.id);
            updated++;
            debug.push({ task: task.name, source: `linear-ATT-${issueNum}`, updates: upd });
          } else {
            debug.push({ task: task.name, source: `linear-ATT-${issueNum}`, note: 'no changes needed' });
          }

        // ── Asana task URL ──
        } else if (task.linked_task_url?.includes('asana.com') && asanaToken) {
          // Asana URL = app.asana.com/0/{board}/{task} — TASK gid is LAST numeric segment
          const segs = task.linked_task_url.split(/[/?#]/).filter(s => /^\d+$/.test(s));
          const taskGid = segs[segs.length - 1];
          if (!taskGid) {
            debug.push({ task: task.name, error: 'No task GID found in Asana URL', url: task.linked_task_url });
            continue;
          }

          const res = await fetch(
            `https://app.asana.com/api/1.0/tasks/${taskGid}?opt_fields=completed,due_on,start_on,name`,
            { headers: { 'Authorization': `Bearer ${asanaToken}` } }
          );
          const data = await res.json();

          if (data.errors || !data?.data) {
            debug.push({ task: task.name, error: 'Asana task fetch failed', details: data.errors });
            continue;
          }

          const asanaTask = data.data;
          const upd = {};

          // FIX: Bidirectional status sync
          if (asanaTask.completed) {
            if (task.status !== 'Done') { upd.status = 'Done'; upd.progress = 100; }
          } else {
            if (task.status === 'Done') { upd.status = 'Doing'; upd.progress = 50; } // reopened
            else if (task.status === 'To Do' && (asanaTask.due_on || asanaTask.start_on)) { upd.status = 'Doing'; }
          }

          // Sync dates
          if (asanaTask.due_on) upd.end_date = asanaTask.due_on;
          if (asanaTask.start_on) upd.start_date = asanaTask.start_on;

          if (Object.keys(upd).length > 0) {
            await supabase.from('tasks').update(upd).eq('id', task.id);
            updated++;
            debug.push({ task: task.name, source: `asana-${taskGid}`, updates: upd });
          } else {
            debug.push({ task: task.name, source: `asana-${taskGid}`, note: 'no changes needed' });
          }
        }
      } catch (e) {
        console.error('Linked task URL sync error', task.id, e);
        debug.push({ task: task.name, error: e.message });
      }
    }
  } else {
    debug.push({ step: 'linked_task_url tasks', count: 0, note: 'No tasks have linked_task_url set' });
  }

  return { source: 'Linked Projects', status: 'ok', count: updated, debug };
}

// ─── Main sync handler ───────────────────────────────────────────────────────
export async function POST() {
  const results = await Promise.all([
    checkLinear(),
    checkAsana(),
    syncSlackStandups(),
    syncLinkedProjects()
  ]);

  return Response.json({
    timestamp: new Date().toISOString(),
    results,
    message: 'Sync complete'
  });
}
