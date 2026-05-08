import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

const ASANA_PROJECTS = {
  'Marketing Department Task Tracker': '1214432966703164',
  'Design Department Task Tracker': '1214434740066912'
};

// Check Linear connectivity + return count of active issues
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

// Check Asana connectivity using actual project GIDs (fixes "0 items" bug)
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

// Scrape #daily-standup messages and save to Supabase standups table
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

    // Resolve all user names in parallel (fixes timeout on sequential calls)
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

export async function POST() {
  const results = await Promise.all([checkLinear(), checkAsana(), syncSlackStandups()]);

  // No Slack post — digest route handles all Slack reporting.
  return Response.json({
    timestamp: new Date().toISOString(),
    results,
    message: 'Sync complete'
  });
}
