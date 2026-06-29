// ═══════════════════════════════════════════════════════════════════════════
// /api/cancel-leave — Employee self-cancel of their OWN leave
//   POST { id, email }
//   Rules: caller must own the leave (email match); leave must be pending or
//   approved; leave must not have started yet (Istanbul date). Sets status to
//   'cancelled'. Because balances are computed live from APPROVED leaves, a
//   cancellation automatically frees the days — no ledger write needed.
//   Notifies Laraib + Efehan; if the leave was already approved, posts a short
//   retraction to #general so a prior "will be off" note isn't left standing.
// Uses the service key so it works regardless of the caller's RLS role.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

const SLACK_API = 'https://slack.com/api';

async function slackPost(channel, text) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token || !channel) return;
  try {
    await fetch(`${SLACK_API}/chat.postMessage`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, text, unfurl_links: false })
    });
  } catch {}
}

async function dm(email, text) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token || !email) return;
  try {
    const r = await fetch(`${SLACK_API}/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const d = await r.json();
    if (!d.ok) return;
    const o = await fetch(`${SLACK_API}/conversations.open`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: d.user.id })
    });
    const oj = await o.json();
    if (!oj.ok) return;
    await slackPost(oj.channel.id, text);
  } catch {}
}

export async function POST(req) {
  try {
    const { id, email } = await req.json();
    if (!id || !email) return Response.json({ ok: false, error: 'id and email required' });

    const { data: leave } = await supabase.from('leaves').select('*').eq('id', id).single();
    if (!leave) return Response.json({ ok: false, error: 'not_found' });

    if ((leave.email || '').toLowerCase() !== String(email).toLowerCase()) {
      return Response.json({ ok: false, error: 'this is not your leave' });
    }
    if (!['pending', 'approved'].includes(leave.status)) {
      return Response.json({ ok: false, error: `cannot cancel a ${leave.status} leave` });
    }

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
    if ((leave.start_date || '') < today) {
      return Response.json({ ok: false, error: 'cannot cancel leave that has already started' });
    }

    const wasApproved = leave.status === 'approved';
    const { error } = await supabase.from('leaves').update({ status: 'cancelled' }).eq('id', id);
    if (error) return Response.json({ ok: false, error: error.message });

    const range = leave.start_date === leave.end_date ? leave.start_date : `${leave.start_date} → ${leave.end_date}`;
    const typeLabel = leave.leave_type === 'short' ? 'Short Leave' : leave.leave_type;
    const note = `${leave.person} cancelled their ${typeLabel} leave (${range}).`;
    await dm('laraib@attimo.com', note);
    await dm('efehan@attimo.com', note);
    if (wasApproved) {
      await slackPost('#general', `Update: ${leave.person}'s previously-approved leave (${range}) has been cancelled.`);
    }

    return Response.json({ ok: true, cancelled: id, wasApproved });
  } catch (e) {
    return Response.json({ ok: false, error: e.message });
  }
}
