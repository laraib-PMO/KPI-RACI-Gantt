// ═══════════════════════════════════════════════════════════════════════════
// /api/slack-app-home — Renders the Spock-style Home tab
// Subscribe to event in Slack: api.slack.com → your app → Event Subscriptions
//   Request URL: https://attimo-ops.vercel.app/api/slack-app-home
//   Subscribe to bot event: app_home_opened
//   OAuth scopes needed: chat:write, commands, users:read, users:read.email,
//                        users.profile:read, views:open, im:write
// ═══════════════════════════════════════════════════════════════════════════

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

function verifySlackSignature(rawBody, timestamp, signature) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const base = `v0:${timestamp}:${rawBody}`;
  const computed = 'v0=' + crypto.createHmac('sha256', secret).update(base).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature)); }
  catch { return false; }
}

function fmtDate(d) {
  const date = new Date(d + 'T00:00:00');
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

async function buildHomeView(userEmail, userName) {
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  // Approved leaves overlapping next 7 days
  const { data: upcoming } = await supabase
    .from('leaves')
    .select('person, email, leave_type, start_date, end_date, half_day')
    .eq('status', 'approved')
    .lte('start_date', nextWeek)
    .gte('end_date', today)
    .order('start_date');

  // Build "Who's on leave" for next 7 days
  const blocks = [];
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: `Hi *${userName || 'there'}*, welcome to *Attimo PMO Bot*` }
  });
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: 'Register leave, see who is out, keep your team informed in real time.' }]
  });

  // Top action row
  blocks.push({
    type: 'actions',
    elements: [
      { type: 'button', text: { type: 'plain_text', text: '+ Request Leave' }, style: 'primary', action_id: 'home_request_leave' },
      { type: 'button', text: { type: 'plain_text', text: 'My Balances' }, action_id: 'home_my_balances' },
      { type: 'button', text: { type: 'plain_text', text: 'My Leave' }, action_id: 'home_my_leave' },
      { type: 'button', text: { type: 'plain_text', text: 'Bulk Request' }, action_id: 'home_bulk_request' }
    ]
  });

  blocks.push({ type: 'divider' });
  blocks.push({ type: 'header', text: { type: 'plain_text', text: "Who's on leave" } });

  // Day-by-day for the next 7 days
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() + i * 86400000).toISOString().split('T')[0];
    const onLeave = (upcoming || []).filter(l => d >= l.start_date && d <= l.end_date);
    const label = i === 0 ? 'Today' : fmtDate(d);
    let text = `*${label}, ${fmtDate(d).split(', ')[1]}:*\n`;
    if (onLeave.length === 0) {
      text += '_No leave._';
    } else {
      text += onLeave.map(l => `• *${l.person}* → ${l.leave_type}${l.half_day ? ' (half day)' : ''}`).join('\n');
    }
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text } });
  }

  blocks.push({ type: 'divider' });

  // Bottom row 1
  blocks.push({
    type: 'actions',
    elements: [
      { type: 'button', text: { type: 'plain_text', text: 'Public Holidays' }, action_id: 'home_holidays' },
      { type: 'button', text: { type: 'plain_text', text: 'Leave Policy' }, action_id: 'home_policy' },
      { type: 'button', text: { type: 'plain_text', text: 'Birthdays & Anniversaries' }, action_id: 'home_birthdays' }
    ]
  });

  // Bottom row 2
  blocks.push({
    type: 'actions',
    elements: [
      { type: 'button', text: { type: 'plain_text', text: 'Dashboard' }, url: 'https://attimo-ops.vercel.app', action_id: 'home_dashboard' },
      { type: 'button', text: { type: 'plain_text', text: 'Help' }, action_id: 'home_help' },
      { type: 'button', text: { type: 'plain_text', text: 'Auto Status Update' }, action_id: 'home_status_toggle' },
      { type: 'button', text: { type: 'plain_text', text: 'Subscribe Calendar' }, action_id: 'home_subscribe' }
    ]
  });

  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: '_Help · Settings · Support · Built for Attimo by the PMO_' }]
  });

  return { type: 'home', blocks };
}

async function publishHome(userId, userEmail, userName) {
  const view = await buildHomeView(userEmail, userName);
  const res = await fetch('https://slack.com/api/views.publish', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, view })
  });
  return await res.json();
}

export async function POST(req) {
  const rawBody = await req.text();

  // Slack URL verification challenge (one-time setup)
  let body;
  try { body = JSON.parse(rawBody); } catch { body = {}; }
  if (body.type === 'url_verification') {
    return Response.json({ challenge: body.challenge });
  }

  // Verify signature for all real events
  const ts = req.headers.get('x-slack-request-timestamp');
  const sig = req.headers.get('x-slack-signature');
  if (!verifySlackSignature(rawBody, ts, sig)) return new Response('Unauthorized', { status: 401 });

  // app_home_opened event
  if (body.event?.type === 'app_home_opened' && body.event.tab === 'home') {
    const userId = body.event.user;
    // Get user's profile from Slack
    try {
      const lookupRes = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
        headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}` }
      });
      const lookup = await lookupRes.json();
      const email = lookup.user?.profile?.email || '';
      const name = lookup.user?.profile?.real_name || lookup.user?.real_name || 'there';
      publishHome(userId, email, name).catch(e => console.error('publishHome failed:', e));
    } catch (e) { console.error('Home opened error:', e); }
  }

  return new Response('', { status: 200 });
}

// Export for re-use by interactive endpoint (button clicks refresh the home)
export { buildHomeView, publishHome };
