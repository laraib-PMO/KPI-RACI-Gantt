import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
);

async function syncLinear() {
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

async function syncAsana() {
  const token = process.env.ASANA_TOKEN;
  if (!token) return { source: 'Asana', status: 'skipped', reason: 'No token', count: 0 };
  try {
    const res = await fetch('https://app.asana.com/api/1.0/tasks?opt_fields=name,assignee.name,due_on,start_on,completed,custom_fields&limit=50', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    return { source: 'Asana', status: 'ok', count: data?.data?.length || 0 };
  } catch (e) {
    return { source: 'Asana', status: 'error', error: e.message, count: 0 };
  }
}

async function syncSlackStandups() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { source: 'Slack Standups', status: 'skipped', reason: 'No bot token (add SLACK_BOT_TOKEN)', count: 0 };
  try {
    // Find #daily-standup channel
    const chRes = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const chData = await chRes.json();
    const channel = chData.channels?.find(c => c.name === 'daily-standup');
    if (!channel) return { source: 'Slack Standups', status: 'error', error: 'Channel #daily-standup not found', count: 0 };

    // Read last 24 hours of messages
    const yesterday = Math.floor(Date.now() / 1000) - 86400;
    const msgRes = await fetch(`https://slack.com/api/conversations.history?channel=${channel.id}&oldest=${yesterday}&limit=50`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const msgData = await msgRes.json();
    const messages = msgData.messages?.filter(m => !m.bot_id && m.text && m.text.length > 10) || [];

    // Parse standup messages and save to Supabase
    let saved = 0;
    const today = new Date().toISOString().split('T')[0];
    for (const msg of messages) {
      // Get user info
      const userRes = await fetch(`https://slack.com/api/users.info?user=${msg.user}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userData = await userRes.json();
      const name = userData.user?.real_name || userData.user?.name || 'Unknown';

      // Check if already saved today for this person
      const { data: existing } = await supabase.from('standups')
        .select('id').eq('person', name).eq('standup_date', today).eq('source', 'slack');
      if (existing && existing.length > 0) continue;

      // Parse message — look for completed/tomorrow/blockers sections
      const text = msg.text;
      let completed = text, tomorrow = '', blockers = 'None';

      // Try to parse structured format
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

async function postToSlack(message) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message })
    });
  } catch (e) { console.error('Slack post failed:', e); }
}

export async function POST() {
  const results = await Promise.all([syncLinear(), syncAsana(), syncSlackStandups()]);

  const summary = results.map(r => `${r.source}: ${r.status} (${r.count} items)`).join('\n');
  await postToSlack(`PMO Dashboard Sync Complete:\n${summary}`);

  return Response.json({
    timestamp: new Date().toISOString(),
    results,
    message: 'Sync complete'
  });
}
