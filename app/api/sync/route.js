import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
);

async function syncLinear() {
  const key = process.env.LINEAR_API_KEY;
  if (!key) return { source: 'Linear', status: 'skipped', reason: 'No API key' };
  
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
    return { source: 'Linear', status: 'ok', count: issues.length, data: issues };
  } catch (e) {
    return { source: 'Linear', status: 'error', error: e.message };
  }
}

async function syncAsana() {
  const token = process.env.ASANA_TOKEN;
  if (!token) return { source: 'Asana', status: 'skipped', reason: 'No token' };
  
  try {
    const res = await fetch('https://app.asana.com/api/1.0/tasks?opt_fields=name,assignee.name,due_on,start_on,completed,custom_fields&limit=50', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    return { source: 'Asana', status: 'ok', count: data?.data?.length || 0, data: data?.data || [] };
  } catch (e) {
    return { source: 'Asana', status: 'error', error: e.message };
  }
}

async function syncClickUp() {
  const token = process.env.CLICKUP_TOKEN;
  if (!token) return { source: 'ClickUp', status: 'skipped', reason: 'No token' };
  
  try {
    // Get teams first, then tasks
    const teamsRes = await fetch('https://api.clickup.com/api/v2/team', {
      headers: { 'Authorization': token }
    });
    const teams = await teamsRes.json();
    const teamId = teams?.teams?.[0]?.id;
    if (!teamId) return { source: 'ClickUp', status: 'error', error: 'No team found' };
    
    const tasksRes = await fetch(`https://api.clickup.com/api/v2/team/${teamId}/task?subtasks=true&include_closed=false`, {
      headers: { 'Authorization': token }
    });
    const data = await tasksRes.json();
    return { source: 'ClickUp', status: 'ok', count: data?.tasks?.length || 0, data: data?.tasks || [] };
  } catch (e) {
    return { source: 'ClickUp', status: 'error', error: e.message };
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
  } catch (e) {
    console.error('Slack post failed:', e);
  }
}

export async function POST() {
  const results = await Promise.all([syncLinear(), syncAsana(), syncClickUp()]);
  
  // Post summary to Slack
  const summary = results.map(r => `${r.source}: ${r.status} (${r.count || 0} items)`).join('\n');
  await postToSlack(`PMO Dashboard Sync Complete:\n${summary}`);
  
  return Response.json({
    timestamp: new Date().toISOString(),
    results: results.map(({ data, ...rest }) => rest), // Don't send raw data to client
    message: 'Sync complete'
  });
}
