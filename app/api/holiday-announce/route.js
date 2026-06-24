// ─── Holiday Announcer — posts a day-before heads-up to #general ──────────────
// Reads the SAME public-holiday feed the dashboard uses (/api/holidays, which
// pulls from the Google Calendar API), finds any holiday happening TOMORROW,
// and names the teammates in that country who will be off (TR = Istanbul tz,
// PK = Karachi tz). Once-per-day guard via the `config` table, same as the
// birthday bot. GET (cron) and POST (in-app) both work.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

const SLACK_API = 'https://slack.com/api';
const CHANNEL = '#general';
const TZ_BY_COUNTRY = { TR: 'Europe/Istanbul', PK: 'Asia/Karachi' };
const COUNTRY_LABEL = { TR: 'Turkey', PK: 'Pakistan' };

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

// Date in the company's home timezone, offset by N days (1 = tomorrow).
function istanbulYMD(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(d);
  const y = p.find(x => x.type === 'year').value;
  const m = p.find(x => x.type === 'month').value;
  const dd = p.find(x => x.type === 'day').value;
  const full = `${y}-${m}-${dd}`;
  let label = full;
  try { label = new Date(full + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); } catch {}
  return { full, label };
}

function baseUrl(req) {
  try { return new URL(req.url).origin; } catch {}
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  return '';
}

async function run(req) {
  const tom = istanbulYMD(1);

  // Once-per-target-day guard
  const { data: cfg } = await supabase.from('config').select('value').eq('key', 'last_holiday_announce');
  if (cfg?.[0]?.value === tom.full) {
    return { ok: true, skipped: 'already_announced', date: tom.full };
  }

  // Confirmed / corrected dates. Moon-sighted holidays (Ashura, Eid, etc.) are
  // often wrong in Google's calendar; a manual entry here OVERRIDES the feed for
  // that exact date. Add confirmed dates as your moon-sighting committee announces.
  const MANUAL = [
    { d: "2026-06-25", l: "9 Muharram", c: "PK" },
    { d: "2026-06-26", l: "Ashura (10 Muharram)", c: "PK" },
  ];

  // Reuse the existing holidays feed (Google Calendar API + fallback)
  let holidays = [];
  try {
    const res = await fetch(`${baseUrl(req)}/api/holidays`);
    const d = await res.json();
    holidays = d.holidays || [];
  } catch (e) { holidays = []; }

  const manualTomorrow = MANUAL.filter(m => m.d === tom.full);
  const feedTomorrow = holidays.filter(h => (h.d || h.date) === tom.full);
  const tomorrowHolidays = manualTomorrow.length ? manualTomorrow : feedTomorrow;
  if (tomorrowHolidays.length === 0) {
    return { ok: true, date: tom.full, matched: 0, note: 'no_holiday_tomorrow' };
  }

  const { data: people } = await supabase.from('user_roles').select('name,email,timezone');

  const posted = [];
  const errors = [];
  for (const h of tomorrowHolidays) {
    const country = (h.c || h.country || '').toUpperCase();
    const tz = TZ_BY_COUNTRY[country];
    const label = COUNTRY_LABEL[country] || country || 'Public';
    const name = h.l || h.name || 'Public Holiday';
    const affected = (people || []).filter(p => tz && p.timezone === tz).map(p => p.name).filter(Boolean);
    const whoLine = affected.length
      ? `\n\nOff for the day: ${affected.join(', ')}. Please plan around their availability.`
      : `\n\nTeammates in ${label} will be off.`;
    const blocks = [
      { type: 'header', text: { type: 'plain_text', text: 'Public Holiday — Tomorrow' } },
      { type: 'section', text: { type: 'mrkdwn', text: `Tomorrow (${tom.label}) is *${name}* — a public holiday in ${label}.${whoLine}` } }
    ];
    const res = await slackPost(CHANNEL, blocks, `Public holiday tomorrow: ${name} (${label})`);
    if (res && res.ok) posted.push(name);
    else errors.push({ name, error: (res && res.error) || 'unknown' });
  }

  // If there were holidays but nothing posted, don't mark done — allow a retry.
  if (tomorrowHolidays.length > 0 && posted.length === 0) {
    return { ok: false, date: tom.full, matched: tomorrowHolidays.length, posted: 0, errors };
  }

  await supabase.from('config').upsert({ key: 'last_holiday_announce', value: tom.full }, { onConflict: 'key' });
  return { ok: true, date: tom.full, matched: tomorrowHolidays.length, posted: posted.length, names: posted, errors };
}

export async function GET(req) {
  try { return Response.json(await run(req)); }
  catch (e) { return Response.json({ ok: false, error: e.message }); }
}
export async function POST(req) {
  try { return Response.json(await run(req)); }
  catch (e) { return Response.json({ ok: false, error: e.message }); }
}
