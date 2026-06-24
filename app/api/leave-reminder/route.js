// ─── Leave Reminder — daily DM to Laraib + Efehan for pending approvals ───────
// Runs once a day (Vercel cron). If any leave requests are still 'pending', it
// DMs the approvers a digest with a link to the dashboard. Silent if none.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

const SLACK_API = 'https://slack.com/api';
const APPROVERS = ['laraib@attimo.com', 'efehan@attimo.com'];

async function slackAPI(method, body) {
  const t = process.env.SLACK_BOT_TOKEN;
  if (!t) return { ok: false, error: 'no_token' };
  const r = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

async function lookupByEmail(email) {
  const t = process.env.SLACK_BOT_TOKEN;
  if (!t) return null;
  try {
    const r = await fetch(`${SLACK_API}/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
      headers: { 'Authorization': `Bearer ${t}` }
    });
    const d = await r.json();
    return d.ok ? d.user.id : null;
  } catch { return null; }
}

async function dmUser(email, blocks, text) {
  const id = await lookupByEmail(email);
  if (!id) return { ok: false, error: 'no_user:' + email };
  const o = await slackAPI('conversations.open', { users: id });
  if (!o.ok || !o.channel?.id) return { ok: false, error: o.error };
  return slackAPI('chat.postMessage', { channel: o.channel.id, blocks, text, unfurl_links: false });
}

function label(d) {
  if (!d) return '';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  catch { return d; }
}

async function run() {
  const { data: pending } = await supabase.from('leaves').select('*').eq('status', 'pending').order('start_date');
  if (!pending || pending.length === 0) return { ok: true, pending: 0, note: 'nothing_pending' };

  const lines = pending.map(l => {
    const short = l.leave_type === 'short';
    const when = short
      ? `${label(l.start_date)} · ${l.start_time || ''}–${l.end_time || ''}`
      : (l.start_date === l.end_date ? label(l.start_date) : `${label(l.start_date)} → ${label(l.end_date)}`);
    const dur = short ? `${l.hours || ''}h` : (l.half_day ? '0.5d' : `${l.days}d`);
    return `• *${l.person}* — ${short ? 'Short Leave' : l.leave_type}, ${when} (${dur})`;
  });

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: `${pending.length} Leave Request${pending.length > 1 ? 's' : ''} Awaiting Approval` } },
    { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
    { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Open Dashboard to Approve' }, url: 'https://attimo-ops.vercel.app', style: 'primary' }] }
  ];

  const results = {};
  for (const email of APPROVERS) {
    const r = await dmUser(email, blocks, `${pending.length} leave request(s) awaiting your approval`);
    results[email] = r?.ok ? 'sent' : (r?.error || 'failed');
  }
  return { ok: true, pending: pending.length, results };
}

export async function GET() { try { return Response.json(await run()); } catch (e) { return Response.json({ ok: false, error: e.message }); } }
export async function POST() { try { return Response.json(await run()); } catch (e) { return Response.json({ ok: false, error: e.message }); } }
