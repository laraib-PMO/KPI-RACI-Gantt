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

// ─── NEW: Sync linked project progress ───────────────────────────────────────
async function syncLinkedProjects() {
  const key = process.env.LINEAR_API_KEY;
  const asanaToken = process.env.ASANA_TOKEN;

  // Get all tasks with linked_project
  const { data: linkedTasks } = await supabase.from('tasks').select('*').not('linked_project', 'is', null);
  if (!linkedTasks || linkedTasks.length === 0) return { source: 'Linked Projects', status: 'ok', count: 0, detail: 'No linked tasks' };

  let updated = 0;

  for (const task of linkedTasks) {
    try {
      if (task.linked_source === 'linear' && key) {
        // Fetch project issues from Linear
        const res = await fetch('https://api.linear.app/graphql', {
          method: 'POST',
          headers: { 'Authorization': key, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `{ project(id:"${task.linked_project}") { name issues { nodes { state { type } } } } }`
          })
        });
        const data = await res.json();
        const issues = data?.data?.project?.issues?.nodes || [];
        if (issues.length === 0) continue;

        const total = issues.length;
        const done = issues.filter(i => i.state?.type === 'completed').length;
        const progress = Math.round((done / total) * 100);
        const newStatus = progress === 100 ? 'Done' : progress > 0 ? 'Doing' : 'To Do';

        await supabase.from('tasks').update({ progress, status: newStatus }).eq('id', task.id);
        updated++;

      } else if (task.linked_source === 'asana' && asanaToken) {
        // Fetch project tasks from Asana
        const res = await fetch(
          `https://app.asana.com/api/1.0/tasks?project=${task.linked_project}&opt_fields=completed&limit=100`,
          { headers: { 'Authorization': `Bearer ${asanaToken}` } }
        );
        const data = await res.json();
        const tasks_list = data?.data || [];
        if (tasks_list.length === 0) continue;

        const total = tasks_list.length;
        const done = tasks_list.filter(t => t.completed).length;
        const progress = Math.round((done / total) * 100);
        const newStatus = progress === 100 ? 'Done' : progress > 0 ? 'Doing' : 'To Do';

        await supabase.from('tasks').update({ progress, status: newStatus }).eq('id', task.id);
        updated++;
      }
    } catch (e) {
      console.error('Linked project sync error for task', task.id, e);
    }
  }

  // Also check linked_task_url (binary done/not-done for specific tasks)
  const { data: linkedUrlTasks } = await supabase.from('tasks').select('*').not('linked_task_url', 'is', null);
  if (linkedUrlTasks) {
    for (const task of linkedUrlTasks) {
      try {
        if (task.linked_task_url?.includes('linear.app') && key) {
          // Extract issue identifier from URL
          const match = task.linked_task_url.match(/\/issue\/([A-Z]+-\d+)/);
          if (match) {
            const res = await fetch('https://api.linear.app/graphql', {
              method: 'POST',
              headers: { 'Authorization': key, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: `{ issueSearch(filter:{number:{eq:${parseInt(match[1].split('-')[1])}}},first:1) { nodes { state { type } } } }`
              })
            });
            const data = await res.json();
            const issue = data?.data?.issueSearch?.nodes?.[0];
            if (issue) {
              const isDone = issue.state?.type === 'completed';
              if (isDone && task.status !== 'Done') {
                await supabase.from('tasks').update({ status: 'Done', progress: 100 }).eq('id', task.id);
                updated++;
              }
            }
          }
        } else if (task.linked_task_url?.includes('asana.com') && asanaToken) {
          const match = task.linked_task_url.match(/\/(\d+)$/);
          if (match) {
            const res = await fetch(
              `https://app.asana.com/api/1.0/tasks/${match[1]}?opt_fields=completed`,
              { headers: { 'Authorization': `Bearer ${asanaToken}` } }
            );
            const data = await res.json();
            if (data?.data?.completed && task.status !== 'Done') {
              await supabase.from('tasks').update({ status: 'Done', progress: 100 }).eq('id', task.id);
              updated++;
            }
          }
        }
      } catch (e) {
        console.error('Linked task URL sync error', task.id, e);
      }
    }
  }

  return { source: 'Linked Projects', status: 'ok', count: updated };
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
