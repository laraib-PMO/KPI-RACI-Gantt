// ═══════════════════════════════════════════════════════════════════════════
// /api/slack-interactive — Handles ALL Slack interactions
// • Leave approve/reject buttons (from manager DM)
// • Leave request modal submission (from /leave command or Home tab button)
// • Home tab buttons (My Balances, My Leave, Holidays, Policy, etc.)
// • Auto-risk dismiss buttons
// ═══════════════════════════════════════════════════════════════════════════

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

const SLACK_API = 'https://slack.com/api';
const TOKEN = process.env.SLACK_BOT_TOKEN;

function verifySlackSignature(rawBody, timestamp, signature) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) {
    console.warn('[slack-interactive] SLACK_SIGNING_SECRET not set — skipping verification');
    return true; // Allow in dev if secret missing, but log it
  }
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    console.warn('[slack-interactive] Timestamp too old:', timestamp);
    return false;
  }
  const base = `v0:${timestamp}:${rawBody}`;
  const computed = 'v0=' + crypto.createHmac('sha256', secret).update(base).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature)); }
  catch { return false; }
}

async function slackAPI(method, body) {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return await res.json();
}

async function lookupUser(email) {
  if (!email) return null;
  try {
    const res = await fetch(`${SLACK_API}/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const d = await res.json();
    return d.user?.id || null;
  } catch { return null; }
}

// Robust DM: open the IM channel first, then post to the returned channel ID.
// Posting to a bare user ID is unreliable — this is the correct pattern.
async function dmUser(userId, message) {
  if (!userId) return { ok: false, error: 'no_user_id' };
  try {
    const open = await slackAPI('conversations.open', { users: userId });
    if (!open.ok || !open.channel?.id) {
      console.error('[dm] conversations.open failed:', open.error);
      return { ok: false, error: open.error };
    }
    const result = await slackAPI('chat.postMessage', { channel: open.channel.id, ...message });
    if (!result.ok) console.error('[dm] postMessage failed:', result.error);
    return result;
  } catch (e) {
    console.error('[dm] error:', e.message);
    return { ok: false, error: e.message };
  }
}

function isoToDateLabel(d) {
  if (!d) return '';
  const date = new Date(d + 'T00:00:00');
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

const isShort = (l) => l && l.leave_type === 'short';
const shortWindow = (l) => `${l.start_time || '?'}–${l.end_time || '?'}${l.hours ? ` (${l.hours}h)` : ''}`;

function buildCalendarUrls(leave) {
  const title = encodeURIComponent(`${isShort(leave) ? 'Short Leave' : leave.leave_type} — ${leave.person}`);
  const desc = encodeURIComponent(`Leave: ${leave.leave_type}${leave.half_day ? ' (half day)' : ''}${leave.reason ? '\nReason: ' + leave.reason : ''}\nApproved via Attimo PMO Bot`);
  if (isShort(leave) && leave.start_time && leave.end_time) {
    const dt = leave.start_date.replace(/-/g, '');
    const st = leave.start_time.replace(':', '') + '00';
    const et = leave.end_time.replace(':', '') + '00';
    return {
      google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dt}T${st}/${dt}T${et}&details=${desc}`,
      outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&body=${desc}&startdt=${leave.start_date}T${leave.start_time}:00&enddt=${leave.start_date}T${leave.end_time}:00`,
      office365: `https://outlook.office.com/calendar/0/deeplink/compose?subject=${title}&body=${desc}&startdt=${leave.start_date}T${leave.start_time}:00&enddt=${leave.start_date}T${leave.end_time}:00`
    };
  }
  const sd = leave.start_date.replace(/-/g, '');
  const endD = new Date(leave.end_date + 'T00:00:00');
  endD.setDate(endD.getDate() + 1);
  const ed = endD.toISOString().split('T')[0].replace(/-/g, '');
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${sd}/${ed}&details=${desc}`;
  const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&body=${desc}&startdt=${leave.start_date}T00:00:00&enddt=${leave.end_date}T23:59:59&allday=true`;
  const office365 = `https://outlook.office.com/calendar/0/deeplink/compose?subject=${title}&body=${desc}&startdt=${leave.start_date}T00:00:00&enddt=${leave.end_date}T23:59:59&allday=true`;
  return { google, outlook, office365 };
}

async function sendApprovalDecision(leave, decision, approver) {
  const _ = decision;
  const short = isShort(leave);
  const typeStr = short ? 'Short Leave' : leave.leave_type;
  const whenStr = short
    ? `${isoToDateLabel(leave.start_date)} · ${shortWindow(leave)}`
    : `${isoToDateLabel(leave.start_date)}${leave.start_date !== leave.end_date ? ` → ${isoToDateLabel(leave.end_date)}` : ''}`;
  const durStr = short ? `${leave.hours || ''}h` : (leave.half_day ? '0.5 day' : `${leave.days} day${leave.days > 1 ? 's' : ''}`);
  const cal = decision === 'approved' ? buildCalendarUrls(leave) : null;
  const requesterId = await lookupUser(leave.email);

  if (requesterId) {
    const blocks = [
      { type: 'header', text: { type: 'plain_text', text: `Leave request has been ${decision}` } },
      { type: 'section', text: { type: 'mrkdwn', text: `*${approver.name}* has ${decision} your ${short ? 'short leave' : 'leave'} request:` } },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Who:*\n${leave.person}` },
          { type: 'mrkdwn', text: `*Leave type:*\n${typeStr}` },
          { type: 'mrkdwn', text: `*When:*\n${whenStr}` },
          { type: 'mrkdwn', text: `*Duration:*\n${durStr}` },
          { type: 'mrkdwn', text: `*Status:*\n${decision === 'approved' ? 'Approved' : 'Rejected'}` },
          { type: 'mrkdwn', text: `*${decision === 'approved' ? 'Approved' : 'Rejected'} by:*\n${approver.name}` }
        ]
      }
    ];
    if (cal) {
      blocks.push({ type: 'divider' });
      blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '*Add leave to your calendar:*' } });
      blocks.push({
        type: 'actions',
        elements: [
          { type: 'button', text: { type: 'plain_text', text: 'Google Calendar' }, url: cal.google, action_id: 'add_google_cal' },
          { type: 'button', text: { type: 'plain_text', text: 'Outlook Calendar' }, url: cal.outlook, action_id: 'add_outlook_cal' },
          { type: 'button', text: { type: 'plain_text', text: 'Office 365 Calendar' }, url: cal.office365, action_id: 'add_o365_cal' }
        ]
      });
    }
    await dmUser(requesterId, { blocks, text: `Your leave was ${decision}` });
  }

  const efehanId = await lookupUser('efehan@attimo.com');
  if (efehanId) {
    await dmUser(efehanId, {
      text: `${leave.person}'s ${typeStr} (${whenStr}) ${decision} by ${approver.name}.`
    });
  }

  if (decision === 'approved') {
    await slackAPI('chat.postMessage', {
      channel: '#general',
      text: short
        ? `*${leave.person}* will be on short leave ${whenStr}.`
        : `*${leave.person}* will be off ${whenStr} (${leave.leave_type}${leave.half_day ? ', half day' : ''}).`
    });
  }
}
async function openBalancesModal(trigger_id, email) {
  const year = new Date().getFullYear();
  const { data: bals } = await supabase.from('leave_balances').select('*').ilike('email', email).eq('year', year);
  const { data: types } = await supabase.from('leave_types').select('*').order('sort_order');
  const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: `*Your leave balances for ${year}*` } }, { type: 'divider' }];
  for (const t of (types || [])) {
    const b = (bals || []).find(x => x.leave_type === t.key) || {};
    const allowance = b.allowance_override != null ? Number(b.allowance_override) : t.annual_allowance;
    const spent = Number(b.spent || 0);
    const available = allowance != null ? Math.max(0, allowance - spent) : null;
    const monthlyLimit = t.monthly_limit;
    const spentMonth = Number(b.spent_this_month || 0);
    const monthAvail = monthlyLimit != null ? Math.max(0, monthlyLimit - spentMonth) : null;
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn',
        text: `${t.emoji || ''} *${t.display_name}*\n` +
              `Spent: *${spent}* · Allowance: *${allowance ?? '∞'}* · Available: *${available ?? '∞'}*\n` +
              (monthlyLimit != null ? `_This month:_ ${spentMonth}/${monthlyLimit} used · ${monthAvail} available` : '_No monthly cap_')
      }
    });
  }
  await slackAPI('views.open', {
    trigger_id, view: { type: 'modal', callback_id: 'balances_view', title: { type: 'plain_text', text: 'My Balances' }, close: { type: 'plain_text', text: 'Close' }, blocks }
  });
}

async function openMyLeaveModal(trigger_id, email) {
  const today = new Date().toISOString().split('T')[0];
  const { data: leaves } = await supabase.from('leaves').select('*').ilike('email', email).order('start_date', { ascending: false }).limit(15);
  const upcoming = (leaves || []).filter(l => l.end_date >= today);
  const past = (leaves || []).filter(l => l.end_date < today);
  const fmt = l => {
    const dur = l.half_day ? '0.5 day' : `${l.days} day${l.days > 1 ? 's' : ''}`;
    const status = l.status === 'approved' ? '[APPROVED]' : l.status === 'rejected' ? '[REJECTED]' : l.status === 'pending' ? '[PENDING]' : '[CANCELLED]';
    const range = l.start_date === l.end_date ? isoToDateLabel(l.start_date) : `${isoToDateLabel(l.start_date)} → ${isoToDateLabel(l.end_date)}`;
    return `${status} *${l.leave_type}* · ${range} · ${dur}`;
  };
  const blocks = [];
  blocks.push({ type: 'header', text: { type: 'plain_text', text: 'Upcoming' } });
  blocks.push({ type: 'section', text: { type: 'mrkdwn', text: upcoming.length ? upcoming.map(fmt).join('\n') : '_No upcoming leave._' } });
  blocks.push({ type: 'divider' });
  blocks.push({ type: 'header', text: { type: 'plain_text', text: 'Past' } });
  blocks.push({ type: 'section', text: { type: 'mrkdwn', text: past.length ? past.slice(0, 10).map(fmt).join('\n') : '_No past leave._' } });
  await slackAPI('views.open', {
    trigger_id, view: { type: 'modal', callback_id: 'my_leave_view', title: { type: 'plain_text', text: 'My Leave' }, close: { type: 'plain_text', text: 'Close' }, blocks }
  });
}

async function openHolidaysModal(trigger_id) {
  let holidays = [];
  try {
    const res = await fetch('https://attimo-ops.vercel.app/api/holidays');
    const d = await res.json();
    holidays = d.holidays || [];
  } catch { holidays = []; }
  const today = new Date().toISOString().split('T')[0];
  const upcoming = holidays.filter(h => h.date >= today).slice(0, 20);
  const blocks = [{ type: 'header', text: { type: 'plain_text', text: 'Public Holidays' } }];
  if (upcoming.length === 0) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '_No upcoming holidays._' } });
  else for (const h of upcoming) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*${isoToDateLabel(h.date)}* · ${h.name} _(${h.country || 'TR/PK'})_` } });
  await slackAPI('views.open', {
    trigger_id, view: { type: 'modal', callback_id: 'holidays_view', title: { type: 'plain_text', text: 'Public Holidays' }, close: { type: 'plain_text', text: 'Close' }, blocks }
  });
}

async function openPolicyModal(trigger_id) {
  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: 'Leave Policy' } },
    { type: 'section', text: { type: 'mrkdwn', text: '*Annual Leave* — 14 days/year. Max 5 days/request. Half-day available.\n*Sick Leave* — 8 days/year. No monthly cap. No half-day.\n*Casual Leave* — 12 days/year. 1/month limit. Half-day available.\n*WFH* — Unlimited. No monthly cap. No half-day.\n*Personal Leave* — 5 days/year. 2/month limit. Half-day available.' } },
    { type: 'divider' },
    { type: 'section', text: { type: 'mrkdwn', text: '*Approval:* Your direct manager approves. If manager is on leave, Efehan approves.\n*Notice:* Submit at least 2 days before start date (recommended).\n*Dashboard:* <https://attimo-ops.vercel.app|Attimo Ops Hub>' } }
  ];
  await slackAPI('views.open', {
    trigger_id, view: { type: 'modal', callback_id: 'policy_view', title: { type: 'plain_text', text: 'Leave Policy' }, close: { type: 'plain_text', text: 'Close' }, blocks }
  });
}

async function handleLeaveSubmit(payload) {
  const v = payload.view.state?.values || {};
  const meta = JSON.parse(payload.view.private_metadata || '{}');
  const email = (meta.email || '').toLowerCase();
  const userId = payload.user?.id;
  const leave_type = v.leave_type?.value?.selected_option?.value;
  const start_date = v.start_date?.value?.selected_date;
  const end_date = v.end_date?.value?.selected_date;
  const half_day = !!(v.half_day?.value?.selected_options?.length);
  const reason = v.reason?.value?.value || '';
  // A half day is always a single day — the end date is meaningless for it.
  const effEnd = half_day ? start_date : end_date;

  if (!leave_type || !start_date || (!half_day && !end_date)) return { response_action: 'errors', errors: { start_date: 'All fields required' } };
  if (!half_day && end_date < start_date) return { response_action: 'errors', errors: { end_date: 'End must be on/after start' } };
  const todayIso = new Date().toISOString().split('T')[0];
  if (start_date < todayIso) return { response_action: 'errors', errors: { start_date: 'Cannot book leave starting in the past' } };

  const { data: typeRow } = await supabase.from('leave_types').select('*').eq('key', leave_type).maybeSingle();
  // Policy: half day is allowed ONLY for Annual and Casual. Enforced in code,
  // not from the DB column (which can be misconfigured per-type).
  const halfAllowed = ['annual', 'casual'].includes(leave_type);
  if (half_day && !halfAllowed) return { response_action: 'errors', errors: { half_day: 'Half day not allowed for this type' } };

  const d1 = new Date(start_date + 'T00:00:00');
  const d2 = new Date(effEnd + 'T00:00:00');
  const days = half_day ? 0.5 : Math.max(1, Math.round((d2 - d1) / 86400000) + 1);

  const { data: requester } = await supabase.from('user_roles').select('*').ilike('email', email).maybeSingle();
  if (!requester) return { response_action: 'errors', errors: { leave_type: 'Account not in roster — contact Laraib' } };

  const { data: inserted } = await supabase.from('leaves').insert({
    person: requester.name, email, leave_type, half_day,
    start_date, end_date: effEnd, days, reason, status: 'pending'
  }).select().single();
  if (!inserted) return { response_action: 'errors', errors: { leave_type: 'Save failed' } };

  let managerEmail = requester.manager_email || 'efehan@attimo.com';
  const today = new Date().toISOString().split('T')[0];
  const { data: managerOnLeave } = await supabase.from('leaves')
    .select('id').eq('email', managerEmail).eq('status', 'approved')
    .lte('start_date', today).gte('end_date', today).maybeSingle();
  if (managerOnLeave && managerEmail !== 'efehan@attimo.com') managerEmail = 'efehan@attimo.com';

  const card = [
    { type: 'header', text: { type: 'plain_text', text: 'New Leave Request' } },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Requester:*\n${requester.name}` },
        { type: 'mrkdwn', text: `*Type:*\n${typeRow?.emoji || ''} ${typeRow?.display_name || leave_type}` },
        { type: 'mrkdwn', text: `*Dates:*\n${isoToDateLabel(start_date)}${start_date !== effEnd ? ` → ${isoToDateLabel(effEnd)}` : ''}${half_day ? ' (half day)' : ''}` },
        { type: 'mrkdwn', text: `*Duration:*\n${half_day ? '0.5 day' : `${days} day${days > 1 ? 's' : ''}`}` }
      ]
    }
  ];
  if (reason) card.push({ type: 'section', text: { type: 'mrkdwn', text: `*Reason:* ${reason}` } });
  card.push({
    type: 'actions',
    elements: [
      { type: 'button', text: { type: 'plain_text', text: 'Approve' }, style: 'primary', action_id: `approve_leave_${inserted.id}`, value: String(inserted.id) },
      { type: 'button', text: { type: 'plain_text', text: 'Reject' }, style: 'danger', action_id: `reject_leave_${inserted.id}`, value: String(inserted.id) }
    ]
  });

  // Fire all notifications in parallel — sequential awaits blew Slack's 3s
  // view_submission budget and caused "We had some trouble connecting".
  const notifyTasks = [];
  notifyTasks.push((async () => {
    const managerId = await lookupUser(managerEmail);
    if (managerId) await dmUser(managerId, { blocks: card, text: `${requester.name} requested leave` });
  })());
  if (managerEmail !== 'efehan@attimo.com') {
    notifyTasks.push((async () => {
      const efehanId = await lookupUser('efehan@attimo.com');
      if (efehanId) await dmUser(efehanId, {
        text: `FYI: *${requester.name}* requested ${typeRow?.display_name || leave_type} for ${isoToDateLabel(start_date)}${start_date !== end_date ? ` → ${isoToDateLabel(end_date)}` : ''}. Awaiting approval from manager.`
      });
    })());
  }
  notifyTasks.push(slackAPI('chat.postMessage', { channel: '#hr-module', blocks: card, text: `${requester.name} requested leave` }));
  if (userId) notifyTasks.push(dmUser(userId, { text: 'Leave request submitted. Awaiting approval from your manager.' }));
  await Promise.all(notifyTasks);

  return { response_action: 'clear' };
}

async function handleShortLeaveSubmit(payload) {
  const v = payload.view.state?.values || {};
  const meta = JSON.parse(payload.view.private_metadata || '{}');
  const email = (meta.email || '').toLowerCase();
  const userId = payload.user?.id;
  const date = v.sl_date?.value?.selected_date;
  const start_time = v.sl_start?.value?.selected_time;
  const end_time = v.sl_end?.value?.selected_time;
  const reason = v.sl_reason?.value?.value || '';

  if (!date || !start_time || !end_time) return { response_action: 'errors', errors: { sl_date: 'Date and both times are required' } };
  if (end_time <= start_time) return { response_action: 'errors', errors: { sl_end: 'End time must be after start time' } };
  const todayIso = new Date().toISOString().split('T')[0];
  if (date < todayIso) return { response_action: 'errors', errors: { sl_date: 'Cannot book short leave in the past' } };

  const [sh, sm] = start_time.split(':').map(Number);
  const [eh, em] = end_time.split(':').map(Number);
  const hours = Math.round((((eh * 60 + em) - (sh * 60 + sm)) / 60) * 10) / 10;

  const { data: requester } = await supabase.from('user_roles').select('*').ilike('email', email).maybeSingle();
  if (!requester) return { response_action: 'errors', errors: { sl_date: 'Account not in roster — contact Laraib' } };

  const { data: inserted } = await supabase.from('leaves').insert({
    person: requester.name, email, leave_type: 'short', half_day: false,
    start_date: date, end_date: date, days: 0,
    start_time, end_time, hours, reason, status: 'pending'
  }).select().single();
  if (!inserted) return { response_action: 'errors', errors: { sl_date: 'Save failed' } };

  let managerEmail = requester.manager_email || 'efehan@attimo.com';
  const today = new Date().toISOString().split('T')[0];
  const { data: managerOnLeave } = await supabase.from('leaves')
    .select('id').eq('email', managerEmail).eq('status', 'approved')
    .lte('start_date', today).gte('end_date', today).maybeSingle();
  if (managerOnLeave && managerEmail !== 'efehan@attimo.com') managerEmail = 'efehan@attimo.com';

  const card = [
    { type: 'header', text: { type: 'plain_text', text: 'New Short Leave Request' } },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Requester:*\n${requester.name}` },
        { type: 'mrkdwn', text: `*Type:*\nShort Leave (hours)` },
        { type: 'mrkdwn', text: `*Date:*\n${isoToDateLabel(date)}` },
        { type: 'mrkdwn', text: `*Time:*\n${start_time}–${end_time} (${hours}h)` }
      ]
    }
  ];
  if (reason) card.push({ type: 'section', text: { type: 'mrkdwn', text: `*Reason:* ${reason}` } });
  card.push({
    type: 'actions',
    elements: [
      { type: 'button', text: { type: 'plain_text', text: 'Approve' }, style: 'primary', action_id: `approve_leave_${inserted.id}`, value: String(inserted.id) },
      { type: 'button', text: { type: 'plain_text', text: 'Reject' }, style: 'danger', action_id: `reject_leave_${inserted.id}`, value: String(inserted.id) }
    ]
  });

  const notifyTasks = [];
  notifyTasks.push((async () => {
    const managerId = await lookupUser(managerEmail);
    if (managerId) await dmUser(managerId, { blocks: card, text: `${requester.name} requested short leave` });
  })());
  if (managerEmail !== 'efehan@attimo.com') {
    notifyTasks.push((async () => {
      const efehanId = await lookupUser('efehan@attimo.com');
      if (efehanId) await dmUser(efehanId, { text: `FYI: *${requester.name}* requested short leave on ${isoToDateLabel(date)} (${start_time}–${end_time}, ${hours}h). Awaiting approval.` });
    })());
  }
  notifyTasks.push(slackAPI('chat.postMessage', { channel: '#hr-module', blocks: card, text: `${requester.name} requested short leave` }));
  if (userId) notifyTasks.push(dmUser(userId, { text: 'Short leave request submitted. Awaiting approval from your manager.' }));
  await Promise.all(notifyTasks);

  return { response_action: 'clear' };
}

async function handleHomeAction(payload, action) {
  const userId = payload.user?.id;
  const trigger_id = payload.trigger_id;
  let email = '';
  try {
    const lookup = await fetch(`${SLACK_API}/users.info?user=${userId}`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
    email = ((await lookup.json()).user?.profile?.email || '').toLowerCase();
  } catch {}

  switch (action.action_id) {
    case 'home_request_leave': {
      if (email.toLowerCase() === 'efehan@attimo.com') {
        await dmUser(userId, { text: 'The CEO is excluded from leave requests.' });
        return;
      }
      const { data: types } = await supabase.from('leave_types').select('*').order('sort_order');
      const today = new Date().toISOString().split('T')[0];
      await slackAPI('views.open', {
        trigger_id,
        view: {
          type: 'modal', callback_id: 'leave_request_submit',
          title: { type: 'plain_text', text: 'Request Leave' },
          submit: { type: 'plain_text', text: 'Submit' }, close: { type: 'plain_text', text: 'Cancel' },
          private_metadata: JSON.stringify({ email }),
          blocks: [
            { type: 'input', block_id: 'leave_type', label: { type: 'plain_text', text: 'Leave Type' },
              element: { type: 'static_select', action_id: 'value',
                options: (types || []).filter(t => t.key !== 'short').map(t => ({ text: { type: 'plain_text', text: t.display_name }, value: t.key })) } },
            { type: 'input', block_id: 'start_date', label: { type: 'plain_text', text: 'Start date' },
              element: { type: 'datepicker', action_id: 'value', initial_date: today } },
            { type: 'input', block_id: 'end_date', label: { type: 'plain_text', text: 'End date' },
              element: { type: 'datepicker', action_id: 'value', initial_date: today } },
            { type: 'input', block_id: 'half_day', optional: true, label: { type: 'plain_text', text: 'Half day?' },
              element: { type: 'checkboxes', action_id: 'value', options: [{ text: { type: 'plain_text', text: 'Half day request' }, value: 'half' }] } },
            { type: 'input', block_id: 'reason', optional: true, label: { type: 'plain_text', text: 'Reason' },
              element: { type: 'plain_text_input', action_id: 'value', multiline: true } }
          ]
        }
      });
      break;
    }
    case 'home_my_balances': await openBalancesModal(trigger_id, email); break;
    case 'home_my_leave': await openMyLeaveModal(trigger_id, email); break;
    case 'home_holidays': await openHolidaysModal(trigger_id); break;
    case 'home_policy': await openPolicyModal(trigger_id); break;
    case 'home_subscribe': {
      const ics = 'attimo-ops.vercel.app/api/leave-calendar';
      const googleAdd = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent('webcal://' + ics)}`;
      await slackAPI('views.open', {
        trigger_id,
        view: {
          type: 'modal', callback_id: 'subscribe_view',
          title: { type: 'plain_text', text: 'Subscribe to Leave' },
          close: { type: 'plain_text', text: 'Close' },
          blocks: [
            { type: 'section', text: { type: 'mrkdwn', text: '*Team Leave Calendar*\nSubscribe once and every approved leave shows up automatically in your calendar.' } },
            { type: 'divider' },
            { type: 'section', text: { type: 'mrkdwn', text: '*Google Calendar*\nOpen Settings > Add calendar > From URL, and paste:\n`https://' + ics + '`' } },
            { type: 'section', text: { type: 'mrkdwn', text: '*Apple / Outlook*\nAdd a subscription calendar with:\n`webcal://' + ics + '`' } },
            { type: 'actions', elements: [
              { type: 'button', text: { type: 'plain_text', text: 'Add to Google Calendar' }, url: googleAdd, action_id: 'sub_google' },
              { type: 'button', text: { type: 'plain_text', text: 'Open Dashboard' }, url: 'https://attimo-ops.vercel.app', action_id: 'sub_dash' }
            ] }
          ]
        }
      });
      break;
    }
    case 'home_help':
      await dmUser(userId, { text: '*How to use Attimo PMO Bot:*\n- Type `/applyleave` or click *+ Request Leave* to request leave\n- *My Balances* shows your remaining days\n- *My Leave* lists your upcoming and past leave\n- *Subscribe Calendar* adds all team leave to your calendar\n- Full dashboard: https://attimo-ops.vercel.app\n- Issues: message Laraib' });
      break;
    case 'home_bulk_request':
      await dmUser(userId, { text: 'Bulk leave requests are coming soon. For now, submit each request via *+ Request Leave*.' });
      break;
    case 'home_birthdays':
      await dmUser(userId, { text: 'Birthdays and anniversaries are coming soon.' });
      break;
  }
}

// ─── GET — Diagnostic endpoint ──────────────────────────────────────────────
// Open in browser: should return 405 to prove route is deployed
export async function GET() {
  return new Response(
    JSON.stringify({
      status: 'alive',
      route: '/api/slack-interactive',
      method: 'GET not supported — Slack sends POST',
      timestamp: new Date().toISOString(),
      hint: 'If you see this, the route IS deployed. Check Slack Interactivity & Shortcuts settings: toggle ON, URL saved, app reinstalled.'
    }),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
}

// ─── POST — Main handler ────────────────────────────────────────────────────
export async function POST(req) {
  const rawBody = await req.text();

  // Handle Slack url_verification challenge (sent when saving Interactivity URL)
  try {
    const json = JSON.parse(rawBody);
    if (json.type === 'url_verification') {
      console.log('[slack-interactive] url_verification challenge received');
      return Response.json({ challenge: json.challenge });
    }
  } catch {
    // Not JSON — proceed to form-encoded payload handling
  }

  const ts = req.headers.get('x-slack-request-timestamp');
  const sig = req.headers.get('x-slack-signature');

  console.log('[slack-interactive] POST received', {
    hasTimestamp: !!ts,
    hasSignature: !!sig,
    bodyLength: rawBody.length,
    bodyPreview: rawBody.substring(0, 100)
  });

  if (!verifySlackSignature(rawBody, ts, sig)) {
    console.warn('[slack-interactive] Signature verification FAILED');
    return new Response('Unauthorized', { status: 401 });
  }

  const params = new URLSearchParams(rawBody);
  const payload = JSON.parse(params.get('payload') || '{}');

  console.log('[slack-interactive] Payload type:', payload.type, 'actions:', payload.actions?.map(a => a.action_id));

  if (payload.type === 'view_submission' && payload.view.callback_id === 'leave_request_submit') {
    const result = await handleLeaveSubmit(payload);
    return Response.json(result);
  }

  if (payload.type === 'view_submission' && payload.view.callback_id === 'short_leave_submit') {
    const result = await handleShortLeaveSubmit(payload);
    return Response.json(result);
  }

  // Close modal views that don't need processing
  if (payload.type === 'view_submission' && ['balances_view', 'my_leave_view', 'holidays_view', 'policy_view', 'subscribe_view'].includes(payload.view?.callback_id)) {
    return Response.json({ response_action: 'clear' });
  }

  if (payload.type === 'block_actions') {
    const action = payload.actions?.[0];
    if (!action) return Response.json({});

    console.log('[slack-interactive] block_action:', action.action_id);

    if (action.action_id?.startsWith('home_')) {
      // MUST await — serverless kills the function once the response returns
      try { await handleHomeAction(payload, action); }
      catch (e) { console.error('[slack-interactive] Home action err:', e); }
      return Response.json({});
    }

    if (action.action_id?.startsWith('add_') && action.action_id?.endsWith('_cal')) {
      return Response.json({});
    }

    const leaveMatch = action.action_id?.match(/^(approve|reject)_leave_(\d+)$/);
    if (leaveMatch) {
      const [, decision, leaveId] = leaveMatch;
      const approverEmail = payload.user?.profile?.email || payload.user?.email || '';
      const approverName = payload.user?.name || payload.user?.username || '';

      // Try to get email from users.info if not in payload
      let finalEmail = approverEmail;
      if (!finalEmail && payload.user?.id) {
        try {
          const res = await fetch(`${SLACK_API}/users.info?user=${payload.user.id}`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
          });
          const d = await res.json();
          finalEmail = d.user?.profile?.email || '';
        } catch {}
      }

      const { data: leave } = await supabase.from('leaves').select('*').eq('id', leaveId).single();
      if (!leave) return Response.json({ response_type: 'ephemeral', text: 'Leave not found' });

      const { data: requester } = await supabase.from('user_roles').select('manager_email').ilike('email', leave.email).maybeSingle();
      const allowedApprovers = [requester?.manager_email, 'efehan@attimo.com'].filter(Boolean).map(e => e.toLowerCase());
      if (finalEmail && !allowedApprovers.includes(finalEmail.toLowerCase())) {
        return Response.json({ response_type: 'ephemeral', text: 'Only the manager or Efehan can act on this.' });
      }

      const newStatus = decision === 'approve' ? 'approved' : 'rejected';
      await supabase.from('leaves').update({
        status: newStatus, approved_by: approverName, approved_by_email: finalEmail
      }).eq('id', leaveId);

      // MUST await — these DMs + #general post die if left to run after return
      try { await sendApprovalDecision(leave, newStatus, { email: finalEmail, name: approverName }); }
      catch (e) { console.error('[slack-interactive] Approval decision err:', e); }

      return Response.json({
        replace_original: true,
        blocks: [
          { type: 'header', text: { type: 'plain_text', text: `Leave ${newStatus.toUpperCase()}` } },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Requester:*\n${leave.person}` },
              { type: 'mrkdwn', text: `*Type:*\n${leave.leave_type}` },
              { type: 'mrkdwn', text: `*${isShort(leave) ? 'When' : 'Dates'}:*\n${isShort(leave) ? `${isoToDateLabel(leave.start_date)} · ${shortWindow(leave)}` : `${isoToDateLabel(leave.start_date)}${leave.start_date !== leave.end_date ? ` → ${isoToDateLabel(leave.end_date)}` : ''}`}` }
            ]
          },
          { type: 'context', elements: [{ type: 'mrkdwn', text: `Decision: *${newStatus.toUpperCase()}* by ${approverName}` }] }
        ]
      });
    }

    const riskMatch = action.action_id?.match(/^(confirm|dismiss)_risk_(\d+)$/);
    if (riskMatch) {
      const [, decision, riskId] = riskMatch;
      const approverName = payload.user?.name || payload.user?.username || '';
      if (decision === 'dismiss') {
        await supabase.from('risks').update({ status: 'CLOSED', notes: `Dismissed by ${approverName}` }).eq('id', riskId);
      } else {
        await supabase.from('risks').update({ status: 'ACTIVE' }).eq('id', riskId);
      }
      return Response.json({
        replace_original: true,
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `${decision === 'dismiss' ? 'Risk dismissed' : 'Risk confirmed'} by *${approverName}*` } }]
      });
    }
  }

  return Response.json({});
}
