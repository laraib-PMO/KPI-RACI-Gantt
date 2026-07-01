// ─── Birthday Bot Route — PMO bot wishes team members on their day ───────────
// Finds anyone whose birthday (MM-DD) matches today (Europe/Istanbul) and posts
// a warm wish to #general from the PMO bot. Runs once per day via a config guard,
// so it's safe to call on every dashboard load. GET and POST both work
// (GET for easy manual trigger / Vercel cron, POST for the in-app fetch).

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

const SLACK_API = 'https://slack.com/api';
const BIRTHDAY_CHANNEL = '#general';

async function slackPost(channel, blocks, fallbackText) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { ok: false, error: 'No SLACK_BOT_TOKEN' };
  const res = await fetch(`${SLACK_API}/chat.postMessage`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, blocks, text: fallbackText, unfurl_links: false })
  });
  return await res.json();
}

async function lookupSlackUser(email) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token || !email) return null;
  try {
    const res = await fetch(`${SLACK_API}/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const d = await res.json();
    return d.user?.id || null;
  } catch { return null; }
}

// "Today" is defined in the company's home timezone so the wish lands on the
// right calendar day regardless of where the server runs.
function istanbulToday() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  return { md: `${m}-${d}`, full: `${y}-${m}-${d}` };
}

async function runBirthdays() {
  const { md, full } = istanbulToday();

  // Once-per-day guard
  const { data: cfg } = await supabase.from('config').select('value').eq('key', 'last_birthday_run');
  if (cfg?.[0]?.value === full) {
    return { ok: true, skipped: 'already_run_today', date: full };
  }

  const { data: people } = await supabase
    .from('user_roles')
    .select('name,email,birthday')
    .eq('birthday', md);

  const wished = [];
  const errors = [];
  for (const p of people || []) {
    const slackId = await lookupSlackUser(p.email);
    const who = slackId ? `<@${slackId}>` : `*${p.name}*`;
    const blocks = [
      { type: 'header', text: { type: 'plain_text', text: `🎉  Happy Birthday, ${p.name}!  🎂`, emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: `Wishing you an amazing day, ${who}! 🥳\n\nThank you for everything you bring to *Attimo* — here's to a fantastic year ahead full of wins. 🎈` } },
      { type: 'divider' },
      { type: 'context', elements: [ { type: 'mrkdwn', text: `🎁  With love, from the whole Attimo team` } ] }
    ];
    const res = await slackPost(BIRTHDAY_CHANNEL, blocks, `🎉 Happy Birthday ${p.name}!`);
    if (res && res.ok) wished.push(p.name);
    else errors.push({ name: p.name, error: (res && res.error) || 'unknown' });
  }

  // If there were birthday people but NONE posted, don't mark the day done —
  // surface the error so a retry works after the cause is fixed.
  if ((people?.length || 0) > 0 && wished.length === 0) {
    return { ok: false, date: full, matched: people.length, posted: 0, errors };
  }

  await supabase.from('config').upsert({ key: 'last_birthday_run', value: full }, { onConflict: 'key' });
  return { ok: true, date: full, matched: people?.length || 0, posted: wished.length, names: wished, errors };
}

export async function GET(req) {
  const _a = req.headers.get('authorization') || '';
  if (process.env.CRON_SECRET && _a !== `Bearer ${process.env.CRON_SECRET}` && !req.headers.get('x-vercel-cron')) return new Response('Unauthorized', { status: 401 });
  try { return Response.json(await runBirthdays()); }
  catch (e) { return Response.json({ ok: false, error: e.message }); }
}

export async function POST(req) {
  const _a = req.headers.get('authorization') || '';
  if (process.env.CRON_SECRET && _a !== `Bearer ${process.env.CRON_SECRET}` && !req.headers.get('x-vercel-cron')) return new Response('Unauthorized', { status: 401 });
  try { return Response.json(await runBirthdays()); }
  catch (e) { return Response.json({ ok: false, error: e.message }); }
}
