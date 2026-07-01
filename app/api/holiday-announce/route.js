// ─── Holiday Approver — requests approval before any holiday is announced ─────
// Reads the public-holiday feed (/api/holidays) + manual corrections, finds any
// holiday happening TOMORROW, and DMs the approvers (Efehan + Laraib) an
// Approve/Reject request. Nothing is posted to #general until it's approved
// (the approval + announcement happen in /api/slack-interactive). De-duped per
// (date, country) via the holiday_requests table. GET (cron) and POST both work.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

const SLACK_API = 'https://slack.com/api';
const CHANNEL = '#general';
const TZ_BY_COUNTRY = { TR: 'Europe/Istanbul', PK: 'Asia/Karachi', UK: 'Europe/London', GB: 'Europe/London' };
const COUNTRY_LABEL = { TR: 'Turkey', PK: 'Pakistan', UK: 'United Kingdom', GB: 'United Kingdom' };

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

const HOL_APPROVER_EMAILS = ['efehan@attimo.com', 'laraib@attimo.com'];

async function slackAPI(method, body) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { ok: false, error: 'No SLACK_BOT_TOKEN' };
  const res = await fetch(`${SLACK_API}/${method}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.json();
}
async function lookupByEmail(email) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;
  try { const r = await fetch(`${SLACK_API}/users.lookupByEmail?email=${encodeURIComponent(email)}`, { headers: { 'Authorization': `Bearer ${token}` } }); const d = await r.json(); return d.ok ? d.user.id : null; } catch { return null; }
}
async function dmUser(email, blocks, text) {
  const id = await lookupByEmail(email);
  if (!id) return { ok: false, error: 'no_user:' + email };
  const o = await slackAPI('conversations.open', { users: id });
  if (!o.ok || !o.channel?.id) return { ok: false, error: o.error };
  return slackAPI('chat.postMessage', { channel: o.channel.id, blocks, text, unfurl_links: false });
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

  // Confirmed / corrected dates. Moon-sighted holidays (Ashura, Eid, etc.) are
  // often wrong in Google's calendar; a manual entry here OVERRIDES the feed for
  // that exact date. Add confirmed dates as your moon-sighting committee announces.
  const MANUAL = [
    // Pakistan — moon-sighted (corrected vs Google)
    { d: "2026-06-25", l: "9 Muharram", c: "PK" },
    { d: "2026-06-26", l: "Ashura (10 Muharram)", c: "PK" },
    // United Kingdom — fixed bank holidays 2026 (gov.uk, England & Wales)
    { d: "2026-01-01", l: "New Year's Day", c: "UK" },
    { d: "2026-04-03", l: "Good Friday", c: "UK" },
    { d: "2026-04-06", l: "Easter Monday", c: "UK" },
    { d: "2026-05-04", l: "Early May bank holiday", c: "UK" },
    { d: "2026-05-25", l: "Spring bank holiday", c: "UK" },
    { d: "2026-08-31", l: "Summer bank holiday", c: "UK" },
    { d: "2026-12-25", l: "Christmas Day", c: "UK" },
    { d: "2026-12-28", l: "Boxing Day (substitute)", c: "UK" },
  ];

  // Reuse the existing holidays feed (Google Calendar API + fallback)
  let holidays = [];
  try {
    const res = await fetch(`${baseUrl(req)}/api/holidays`);
    const d = await res.json();
    holidays = d.holidays || [];
  } catch (e) { holidays = []; }

  // Additive merge: manual entries are added; for any country a manual entry
  // covers tomorrow, the feed's entries for that same country are dropped
  // (manual wins) so corrections replace and additions don't duplicate.
  const manualTomorrow = MANUAL.filter(m => m.d === tom.full);
  const manualCountries = new Set(manualTomorrow.map(m => (m.c || '').toUpperCase()));
  const feedTomorrow = holidays.filter(h =>
    (h.d || h.date) === tom.full &&
    !(h.c || h.country || '').toUpperCase().split(',').some(c => manualCountries.has(c.trim()))
  );
  const tomorrowHolidays = [...manualTomorrow, ...feedTomorrow];
  if (tomorrowHolidays.length === 0) {
    return { ok: true, date: tom.full, matched: 0, note: 'no_holiday_tomorrow' };
  }

  const requested = [];
  const skipped = [];
  const errors = [];
  for (const h of tomorrowHolidays) {
    const country = (h.c || h.country || '').toUpperCase();
    const name = h.l || h.name || 'Public Holiday';
    // Already asked/decided for this date+country? Don't ask again.
    const { data: existing } = await supabase.from('holiday_requests').select('id,status').eq('hol_date', tom.full).eq('country', country).maybeSingle();
    if (existing) { skipped.push({ name, country, status: existing.status }); continue; }

    const { data: row, error: insErr } = await supabase.from('holiday_requests').insert({ hol_date: tom.full, country, name, status: 'pending' }).select().single();
    if (insErr || !row) { errors.push({ name, error: insErr?.message || 'insert_failed' }); continue; }

    const label = country.split(',').map(c => COUNTRY_LABEL[c.trim()] || c.trim()).join(' & ') || 'Public';
    const card = [
      { type: 'header', text: { type: 'plain_text', text: 'Public Holiday — Approval Needed' } },
      { type: 'section', text: { type: 'mrkdwn', text: `Tomorrow (${tom.label}) is *${name}* — a public holiday in ${label}.\n\nApprove to announce it in #general and mark the team off. Reject to skip it.` } },
      { type: 'actions', elements: [
        { type: 'button', text: { type: 'plain_text', text: 'Approve' }, style: 'primary', action_id: `holiday_approve_${row.id}`, value: String(row.id) },
        { type: 'button', text: { type: 'plain_text', text: 'Reject' }, style: 'danger', action_id: `holiday_reject_${row.id}`, value: String(row.id) }
      ] }
    ];
    const refs = [];
    for (const email of HOL_APPROVER_EMAILS) {
      const r = await dmUser(email, card, `Approval needed: ${name} (${label}) tomorrow`);
      if (r?.ok && r.channel && r.ts) refs.push({ channel: r.channel, ts: r.ts });
    }
    if (refs.length) await supabase.from('holiday_requests').update({ msgs: refs }).eq('id', row.id);
    requested.push({ name, country });
  }

  return { ok: true, date: tom.full, requested: requested.length, requestedItems: requested, skipped, errors };
}

export async function GET(req) {
  const _a = req.headers.get('authorization') || '';
  if (process.env.CRON_SECRET && _a !== `Bearer ${process.env.CRON_SECRET}` && !req.headers.get('x-vercel-cron')) return new Response('Unauthorized', { status: 401 });
  try { return Response.json(await run(req)); }
  catch (e) { return Response.json({ ok: false, error: e.message }); }
}
export async function POST(req) {
  const _a = req.headers.get('authorization') || '';
  if (process.env.CRON_SECRET && _a !== `Bearer ${process.env.CRON_SECRET}` && !req.headers.get('x-vercel-cron')) return new Response('Unauthorized', { status: 401 });
  try { return Response.json(await run(req)); }
  catch (e) { return Response.json({ ok: false, error: e.message }); }
}
