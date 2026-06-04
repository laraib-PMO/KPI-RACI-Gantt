// ═══════════════════════════════════════════════════════════════════════════
// /api/leave-digest — Daily 8am Istanbul digest to #general
// Posts "Out today" message to #general. Auto-clears expired Slack statuses.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

const SLACK_API = 'https://slack.com/api';

async function slackPost(channel, blocks, fallback) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { ok: false };
  const res = await fetch(`${SLACK_API}/chat.postMessage`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, blocks, text: fallback, unfurl_links: false })
  });
  return await res.json();
}

function dateLabel(d) {
  const date = new Date(d + 'T00:00:00');
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

export async function GET(req) {
  // Auth: allow Vercel cron OR CRON_SECRET header
  const auth = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}` && !req.headers.get('x-vercel-cron')) {
    if (cronSecret) return new Response('Unauthorized', { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  // People on leave today
  const { data: todayLeaves } = await supabase
    .from('leaves')
    .select('person, leave_type, half_day, start_date, end_date')
    .eq('status', 'approved')
    .lte('start_date', today)
    .gte('end_date', today)
    .order('person');

  // People back tomorrow
  const { data: backTomorrow } = await supabase
    .from('leaves')
    .select('person, leave_type, end_date')
    .eq('status', 'approved')
    .eq('end_date', today);

  // People starting leave tomorrow
  const { data: startingTomorrow } = await supabase
    .from('leaves')
    .select('person, leave_type, half_day, start_date, end_date')
    .eq('status', 'approved')
    .eq('start_date', tomorrow);

  const blocks = [];
  blocks.push({ type: 'header', text: { type: 'plain_text', text: `🌅 Daily Leave Digest · ${dateLabel(today)}` } });

  if ((todayLeaves || []).length === 0) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '_Everyone is in today! 💪_' } });
  } else {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '*On leave today:*' } });
    for (const l of todayLeaves) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `🌴 *${l.person}* → ${l.leave_type}${l.half_day ? ' (half day)' : ''}${l.end_date !== today ? ` _(back ${dateLabel(new Date(new Date(l.end_date + 'T00:00:00').getTime() + 86400000).toISOString().split('T')[0])})_` : ' _(back tomorrow)_'}` }
      });
    }
  }

  if ((startingTomorrow || []).length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '*Starting leave tomorrow:*' } });
    for (const l of startingTomorrow) {
      blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `→ *${l.person}* (${l.leave_type})` } });
    }
  }

  if ((backTomorrow || []).length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '*Back tomorrow:*' } });
    for (const l of backTomorrow) {
      blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `← *${l.person}*` } });
    }
  }

  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: '_Sent by Attimo PMO Bot · Use `/leave` to request time off_' }] });

  const fallback = (todayLeaves || []).length === 0
    ? `Everyone is in today!`
    : `On leave today: ${todayLeaves.map(l => l.person).join(', ')}`;

  const result = await slackPost('#general', blocks, fallback);
  return Response.json({
    ok: true,
    posted_to: '#general',
    on_leave_today: (todayLeaves || []).length,
    starting_tomorrow: (startingTomorrow || []).length,
    back_tomorrow: (backTomorrow || []).length,
    slack_ok: result.ok,
    slack_error: result.error
  });
}
