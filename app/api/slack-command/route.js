// ═══════════════════════════════════════════════════════════════════════════
// /api/slack-command — Handles slash commands
//   /applyleave (+ aliases)  → full / half-day leave modal (day-based types)
//   /shortleave (+ aliases)  → hours-based short-leave modal (date + time window)
// Opens the relevant Slack modal. Submissions are handled by the interactivity
// route (callback_id: 'leave_request_submit' and 'short_leave_submit').
// FIX: awaits views.open before returning (serverless was killing the async call)
// ═══════════════════════════════════════════════════════════════════════════

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

const LEAVE_CMDS = ['/leave', '/applyleave', '/apply-leave', '/leaverequest', '/timeoff', '/holiday'];
const SHORT_CMDS = ['/shortleave', '/short-leave', '/short', '/shortleaverequest'];
const BAL_CMDS = ['/leavebalance', '/leavebalances', '/balance', '/mybalance'];
const LEAVE_APPROVER_EMAILS = ['nil@attimo.com', 'laraib@attimo.com', 'efehan@attimo.com'];

// Build OWN balance blocks — 3 parallel queries, computed in memory (fast, well under Slack's 3s)
async function ownBalanceBlocks(email) {
  const year = new Date().getFullYear();
  const mm = `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [balsRes, typesRes, apprRes] = await Promise.all([
    supabase.from('leave_balances').select('*').ilike('email', email).eq('year', year),
    supabase.from('leave_types').select('*').order('sort_order'),
    supabase.from('leaves').select('leave_type,half_day,days,start_date').ilike('email', email).eq('status', 'approved')
  ]);
  const bals = balsRes.data || [], types = typesRes.data || [], appr = apprRes.data || [];
  const sum = (key, prefix) => appr.filter(l => l.leave_type === key && String(l.start_date || '').startsWith(prefix)).reduce((s, l) => s + (l.half_day ? 0.5 : Number(l.days || 0)), 0);
  const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: `*Your leave balances for ${year}*` } }, { type: 'divider' }];
  for (const t of types) {
    const b = bals.find(x => x.leave_type === t.key) || {};
    const allowance = b.allowance_override != null ? Number(b.allowance_override) : t.annual_allowance;
    const spent = sum(t.key, `${year}`);
    const available = allowance != null ? Math.max(0, allowance - spent) : null;
    const monthlyLimit = t.monthly_limit;
    const spentMonth = monthlyLimit != null ? sum(t.key, mm) : 0;
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*${t.display_name}*\nSpent: *${spent}* · Allowance: *${allowance ?? '∞'}* · Available: *${available ?? '∞'}*` + (monthlyLimit != null ? `\n_This month:_ ${spentMonth}/${monthlyLimit} used` : '') } });
  }
  return blocks;
}

// Build TEAM balance blocks — 4 parallel queries, computed in memory
async function teamBalanceBlocks() {
  const year = new Date().getFullYear();
  const [usersRes, typesRes, balsRes, apprRes] = await Promise.all([
    supabase.from('user_roles').select('name,email').order('name'),
    supabase.from('leave_types').select('*').order('sort_order'),
    supabase.from('leave_balances').select('*').eq('year', year),
    supabase.from('leaves').select('email,leave_type,half_day,days,start_date').eq('status', 'approved')
  ]);
  const users = usersRes.data || [], types = typesRes.data || [], bals = balsRes.data || [], approved = apprRes.data || [];
  const dayTypes = types.filter(t => t.key !== 'short');
  const spentOf = (email, key) => approved.filter(l => (l.email || '').toLowerCase() === (email || '').toLowerCase() && l.leave_type === key && String(l.start_date || '').startsWith(`${year}`)).reduce((s, l) => s + (l.half_day ? 0.5 : Number(l.days || 0)), 0);
  const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: `*Team leave balances — ${year}*` } }, { type: 'divider' }];
  for (const u of users) {
    if (u.email === 'efehan@attimo.com') continue;
    const parts = dayTypes.map(t => { const b = bals.find(x => (x.email || '').toLowerCase() === (u.email || '').toLowerCase() && x.leave_type === t.key); const allow = b?.allowance_override != null ? Number(b.allowance_override) : t.annual_allowance; const spent = spentOf(u.email, t.key); const avail = allow != null ? Math.max(0, allow - spent) : '∞'; return `${t.display_name}: *${avail}* (${spent}/${allow ?? '∞'})`; });
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*${u.name}*\n${parts.join('  ·  ')}` } });
  }
  return blocks;
}


function verifySlackSignature(rawBody, timestamp, signature) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) { console.warn('[slack-command] SLACK_SIGNING_SECRET not set'); return false; }
  if (!timestamp || !signature) { console.warn('[slack-command] Missing timestamp or signature header'); return false; }
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) { console.warn('[slack-command] Timestamp too old'); return false; }
  const base = `v0:${timestamp}:${rawBody}`;
  const computed = 'v0=' + crypto.createHmac('sha256', secret).update(base).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature)); }
  catch { return false; }
}

async function openView(trigger_id, view, label) {
  const res = await fetch('https://slack.com/api/views.open', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ trigger_id, view })
  });
  const data = await res.json();
  if (!data.ok) console.error(`[slack-command] views.open (${label}) failed:`, data.error, JSON.stringify(data.response_metadata || {}));
  else console.log(`[slack-command] ${label} modal opened OK`);
  return data;
}

// Full / half-day leave modal — day-based types only (short is excluded; it has
// its own /shortleave command and time-window modal).
async function openLeaveModal(trigger_id, userEmail) {
  const { data: types } = await supabase.from('leave_types').select('*').order('sort_order');
  const today = new Date().toISOString().split('T')[0];
  const dayTypes = (types || []).filter(t => t.key !== 'short');

  const view = {
    type: 'modal',
    callback_id: 'leave_request_submit',
    title: { type: 'plain_text', text: 'Request Leave' },
    submit: { type: 'plain_text', text: 'Submit' },
    close: { type: 'plain_text', text: 'Cancel' },
    private_metadata: JSON.stringify({ email: userEmail }),
    blocks: [
      {
        type: 'input', block_id: 'leave_type',
        label: { type: 'plain_text', text: 'Leave Type' },
        element: {
          type: 'static_select', action_id: 'value',
          placeholder: { type: 'plain_text', text: 'Pick one' },
          options: dayTypes.map(t => ({ text: { type: 'plain_text', text: t.display_name }, value: t.key }))
        }
      },
      { type: 'input', block_id: 'start_date', label: { type: 'plain_text', text: 'Start date' },
        element: { type: 'datepicker', action_id: 'value', initial_date: today } },
      { type: 'input', block_id: 'end_date', label: { type: 'plain_text', text: 'End date' },
        element: { type: 'datepicker', action_id: 'value', initial_date: today } },
      {
        type: 'input', block_id: 'half_day', optional: true,
        label: { type: 'plain_text', text: 'Half day?' },
        element: {
          type: 'checkboxes', action_id: 'value',
          options: [{ text: { type: 'plain_text', text: 'This is a half-day request (Annual / Casual / Personal only)' }, value: 'half' }]
        }
      },
      {
        type: 'input', block_id: 'reason', optional: true,
        label: { type: 'plain_text', text: 'Reason (optional)' },
        element: { type: 'plain_text_input', action_id: 'value', multiline: true,
          placeholder: { type: 'plain_text', text: 'Anything your manager should know?' } }
      }
    ]
  };
  return openView(trigger_id, view, 'leave');
}

// Short-leave modal — single date + start/end time. Counted in hours, never days.
async function openShortLeaveModal(trigger_id, userEmail) {
  const today = new Date().toISOString().split('T')[0];
  const view = {
    type: 'modal',
    callback_id: 'short_leave_submit',
    title: { type: 'plain_text', text: 'Short Leave' },
    submit: { type: 'plain_text', text: 'Submit' },
    close: { type: 'plain_text', text: 'Cancel' },
    private_metadata: JSON.stringify({ email: userEmail }),
    blocks: [
      { type: 'context', elements: [{ type: 'mrkdwn', text: 'A few hours off — leave early, arrive late, or step out. Counted in hours, not days.' }] },
      { type: 'input', block_id: 'sl_date', label: { type: 'plain_text', text: 'Date' },
        element: { type: 'datepicker', action_id: 'value', initial_date: today } },
      { type: 'input', block_id: 'sl_start', label: { type: 'plain_text', text: 'From time' },
        element: { type: 'timepicker', action_id: 'value', initial_time: '09:00' } },
      { type: 'input', block_id: 'sl_end', label: { type: 'plain_text', text: 'To time' },
        element: { type: 'timepicker', action_id: 'value', initial_time: '11:00' } },
      { type: 'input', block_id: 'sl_reason', optional: true,
        label: { type: 'plain_text', text: 'Reason (optional)' },
        element: { type: 'plain_text_input', action_id: 'value', multiline: true,
          placeholder: { type: 'plain_text', text: 'Anything your manager should know?' } } }
    ]
  };
  return openView(trigger_id, view, 'short_leave');
}

// GET — browser diagnostic: proves the route is deployed
export async function GET() {
  return new Response(
    JSON.stringify({ status: 'alive', route: '/api/slack-command', method: 'GET not supported — Slack sends POST', timestamp: new Date().toISOString() }),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
}

export async function POST(req) {
  const rawBody = await req.text();
  const ts = req.headers.get('x-slack-request-timestamp');
  const sig = req.headers.get('x-slack-signature');

  if (!verifySlackSignature(rawBody, ts, sig)) {
    console.warn('[slack-command] Signature verification FAILED — check SLACK_SIGNING_SECRET matches the app sending the command');
    return new Response('Unauthorized', { status: 401 });
  }

  const params = new URLSearchParams(rawBody);
  const command = params.get('command');
  const trigger_id = params.get('trigger_id');
  const userId = params.get('user_id');
  const text = params.get('text') || '';

  console.log('[slack-command] received:', command, 'from', userId);

  if (BAL_CMDS.includes(command)) {
    let email = '';
    try {
      const r = await fetch(`https://slack.com/api/users.info?user=${userId}`, { headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}` } });
      const j = await r.json();
      email = j.user?.profile?.email || '';
    } catch (e) { console.error('[slack-command] users.info failed:', e.message); }
    const wantsTeam = ['team', 'all', 'everyone'].includes(text.trim().toLowerCase());
    const isApprover = LEAVE_APPROVER_EMAILS.includes(email.toLowerCase());
    try {
      const blocks = (wantsTeam && isApprover) ? await teamBalanceBlocks() : await ownBalanceBlocks(email);
      return Response.json({ response_type: 'ephemeral', blocks });
    } catch (e) {
      console.error('[slack-command] balance build failed:', e.message);
      return Response.json({ response_type: 'ephemeral', text: 'Could not load your balance just now. Try again, or check the dashboard.' });
    }
  }

  const isLeave = LEAVE_CMDS.includes(command);
  const isShort = SHORT_CMDS.includes(command);

  if (isLeave || isShort) {
    let email = '';
    try {
      const lookupRes = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
        headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}` }
      });
      const lookup = await lookupRes.json();
      email = lookup.user?.profile?.email || '';
    } catch (e) {
      console.error('[slack-command] users.info failed:', e.message);
    }

    if (email.toLowerCase() === 'efehan@attimo.com') {
      return Response.json({ response_type: 'ephemeral', text: 'The CEO is excluded from leave requests.' });
    }

    // AWAIT the modal open — do NOT fire-and-forget on serverless
    const result = isShort
      ? await openShortLeaveModal(trigger_id, email)
      : await openLeaveModal(trigger_id, email);

    if (!result.ok) {
      return Response.json({
        response_type: 'ephemeral',
        text: `Could not open the ${isShort ? 'short leave' : 'leave'} form (${result.error}). Ping Laraib.`
      });
    }
    return new Response('', { status: 200 });
  }

  return Response.json({ response_type: 'ephemeral', text: `Unknown command: ${command}` });
}
