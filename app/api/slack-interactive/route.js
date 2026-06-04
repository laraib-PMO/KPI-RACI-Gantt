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
  if (!secret) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
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

function isoToDateLabel(d) {
  if (!d) return '';
  const date = new Date(d + 'T00:00:00');
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

function buildCalendarUrls(leave) {
  const title = encodeURIComponent(`${leave.leave_type} — ${leave.person}`);
  const desc = encodeURIComponent(`Leave: ${leave.leave_type}${leave.half_day ? ' (half day)' : ''}${leave.reason ? '\nReason: ' + leave.reason : ''}\nApproved via Attimo PMO Bot`);
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
  const emoji = decision === 'approved' ? '✅' : '❌';
  const cal = decision === 'approved' ? buildCalendarUrls(leave) : null;
  const requesterId = await lookupUser(leave.email);

  if (requesterId) {
    const blocks = [
      { type: 'header', text: { type: 'plain_text', text: `${emoji} Leave request has been ${decision}` } },
      { type: 'section', text: { type: 'mrkdwn', text: `*${approver.name}* has ${decision} your leave request:` } },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Who:*\n${leave.person}` },
          { type: 'mrkdwn', text: `*Leave type:*\n${leave.leave_type}` },
          { type: 'mrkdwn', text: `*When:*\n${isoToDateLabel(leave.start_date)}${leave.start_date !== leave.end_date ? ` → ${isoToDateLabel(leave.end_date)}` : ''}` },
          { type: 'mrkdwn', text: `*Duration:*\n${leave.half_day ? '0.5 day' : `${leave.days} day${leave.days > 1 ? 's' : ''}`}` },
          { type: 'mrkdwn', text: `*Status:*\n${decision === 'approved' ? 'Approved' : 'Rejected'}` },
          { type: 'mrkdwn', text: `*${decision === 'approved' ? 'Approved' : 'Rejected'} by:*\n${approver.name}` }
        ]
      }
    ];
    if (cal) {
      blocks.push({ type: 'divider' });
      blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '📅 *Add leave to your calendar:*' } });
      blocks.push({
        type: 'actions',
        elements: [
          { type: 'button', text: { type: 'plain_text', text: 'Google Calendar' }, url: cal.google, action_id: 'add_google_cal' },
          { type: 'button', text: { type: 'plain_text', text: 'Outlook Calendar' }, url: cal.outlook, action_id: 'add_outlook_cal' },
          { type: 'button', text: { type: 'plain_text', text: 'Office 365 Calendar' }, url: cal.office365, action_id: 'add_o365_cal' }
        ]
      });
    }
    await slackAPI('chat.postMessage', { channel: requesterId, blocks, text: `Your leave was ${decision}` });
  }

  // Efehan FYI
  const efehanId = await lookupUser('efehan@attimo.com');
  if (efehanId) {
    await slackAPI('chat.postMessage', {
      channel: efehanId,
      text: `${emoji} ${leave.person}'s ${leave.leave_type} (${isoToDateLabel(leave.start_date)}) ${decision} by ${approver.name}.`
    });
  }

  if (decision === 'approved') {
    await slackAPI('chat.postMessage', {
      channel: '#general',
      text: `🌴 *${leave.person}* will be off ${isoToDateLabel(leave.start_date)}${leave.start_date !== leave.end_date ? ` → ${isoToDateLabel(leave.end_date)}` : ''} (${leave.leave_type}${leave.half_day ? ', half day' : ''}).`
    });
    const { data: ur } = await supabase.from('user_roles').select('allow_status_update').eq('email', leave.email).maybeSingle();
    if (ur?.allow_status_update && requesterId) {
      try {
        await slackAPI('users.profile.set', {
          user: requesterId,
          profile: {
            status_text: `On ${leave.leave_type}`,
            status_emoji: ':palm_tree:',
            status_expiration: Math.floor(new Date(leave.end_date + 'T23:59:59').getTime() / 1000)
          }
        });
      } catch (e) { console.error('Status set failed:', e); }
    }
  }
}

async function openBalancesModal(trigger_id, email) {
  const year = new Date().getFullYear();
  const { data: bals } = await supabase.from('leave_balances').select('*').eq('email', email).eq('year', year);
  const { data: types } = await supabase.from('leave_types').select('*').order('sort_order');
  const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: `*Your leave balances for ${year}*` } }, { type: 'divider' }];
  for (const t of (types || [])) {
    const b = (bals || []).find(x => x.leave_type === t.key) || { spent: 0, allowance: t.annual_allowance, spent_this_month: 0, monthly_limit: t.monthly_limit };
    const available = b.allowance != null ? Math.max(0, b.allowance - (b.spent || 0)) : null;
    const monthAvail = b.monthly_limit != null ? Math.max(0, b.monthly_limit - (b.spent_this_month || 0)) : null;
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn',
        text: `${t.emoji || ''} *${t.display_name}*\n` +
              `Spent: *${b.spent || 0}* · Allowance: *${b.allowance ?? '∞'}* · Available: *${available ?? '∞'}*\n` +
              (b.monthly_limit != null ? `_This month:_ ${b.spent_this_month || 0}/${b.monthly_limit} used · ${monthAvail} available` : '_No monthly cap_')
      }
    });
  }
  await slackAPI('views.open', {
    trigger_id, view: { type: 'modal', callback_id: 'balances_view', title: { type: 'plain_text', text: 'My Balances' }, close: { type: 'plain_text', text: 'Close' }, blocks }
  });
}

async function openMyLeaveModal(trigger_id, email) {
  const today = new Date().toISOString().split('T')[0];
  const { data: leaves } = await supabase.from('leaves').select('*').eq('email', email).order('start_date', { ascending: false }).limit(15);
  const upcoming = (leaves || []).filter(l => l.end_date >= today);
  const past = (leaves || []).filter(l => l.end_date < today);
  const fmt = l => {
    const dur = l.half_day ? '0.5 day' : `${l.days} day${l.days > 1 ? 's' : ''}`;
    const status = l.status === 'approved' ? '✅' : l.status === 'rejected' ? '❌' : l.status === 'pending' ? '⏳' : '🚫';
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
  const blocks = [{ type: 'header', text: { type: 'plain_text', text: '🌍 Public Holidays' } }];
  if (upcoming.length === 0) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '_No upcoming holidays._' } });
  else for (const h of upcoming) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*${isoToDateLabel(h.date)}* · ${h.name} _(${h.country || 'TR/PK'})_` } });
  await slackAPI('views.open', {
    trigger_id, view: { type: 'modal', callback_id: 'holidays_view', title: { type: 'plain_text', text: 'Public Holidays' }, close: { type: 'plain_text', text: 'Close' }, blocks }
  });
}

async function openPolicyModal(trigger_id) {
  await slackAPI('views.open', {
    trigger_id, view: {
      type: 'modal', callback_id: 'policy_view',
      title: { type: 'plain_text', text: 'Leave Policy' }, close: { type: 'plain_text', text: 'Close' },
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: '*Attimo Leave Policy (2026)*' } },
        { type: 'divider' },
        { type: 'section', text: { type: 'mrkdwn', text: '🏖️ *Annual Leave:* 14 days/year. Max 5 days per month. Half-day allowed.' } },
        { type: 'section', text: { type: 'mrkdwn', text: '🤒 *Sick Leave:* 8 days/year. No monthly cap. Doctor note for >2 consecutive days.' } },
        { type: 'section', text: { type: 'mrkdwn', text: '🌴 *Casual Leave:* 12 days/year. Max 1 per month. Half-day allowed.' } },
        { type: 'section', text: { type: 'mrkdwn', text: '🏠 *Work From Home:* Flexible. Request via /leave or dashboard.' } },
        { type: 'section', text: { type: 'mrkdwn', text: '🧘 *Personal Leave:* 5 days/year. Max 2 per month.' } },
        { type: 'divider' },
        { type: 'section', text: { type: 'mrkdwn', text: '*Approval:* Department manager approves. Efehan is notified for visibility.' } },
        { type: 'section', text: { type: 'mrkdwn', text: '*Submission window:* Request at least 2 working days in advance (except sick).' } }
      ]
    }
  });
}

async function handleLeaveSubmit(payload) {
  const v = payload.view.state.values;
  const meta = JSON.parse(payload.view.private_metadata || '{}');
  const email = meta.email || '';
  const userId = payload.user?.id;
  const leave_type = v.leave_type?.value?.selected_option?.value;
  const start_date = v.start_date?.value?.selected_date;
  const end_date = v.end_date?.value?.selected_date;
  const half_day = !!(v.half_day?.value?.selected_options?.length);
  const reason = v.reason?.value?.value || '';

  if (!leave_type || !start_date || !end_date) return { response_action: 'errors', errors: { start_date: 'All fields required' } };
  if (end_date < start_date) return { response_action: 'errors', errors: { end_date: 'End must be on/after start' } };

  const { data: typeRow } = await supabase.from('leave_types').select('*').eq('key', leave_type).maybeSingle();
  if (half_day && !typeRow?.allows_half_day) return { response_action: 'errors', errors: { half_day: 'Half day not allowed for this type' } };

  const d1 = new Date(start_date + 'T00:00:00');
  const d2 = new Date(end_date + 'T00:00:00');
  const days = half_day ? 0.5 : Math.max(1, Math.round((d2 - d1) / 86400000) + 1);

  const { data: requester } = await supabase.from('user_roles').select('*').eq('email', email).maybeSingle();
  if (!requester) return { response_action: 'errors', errors: { leave_type: 'Account not in roster — contact Laraib' } };

  const { data: inserted } = await supabase.from('leaves').insert({
    person: requester.name, email, leave_type, half_day,
    start_date, end_date: half_day ? start_date : end_date, days, reason, status: 'pending'
  }).select().single();
  if (!inserted) return { response_action: 'errors', errors: { leave_type: 'Save failed' } };

  let managerEmail = requester.manager_email || 'efehan@attimo.com';
  const today = new Date().toISOString().split('T')[0];
  const { data: managerOnLeave } = await supabase.from('leaves')
    .select('id').eq('email', managerEmail).eq('status', 'approved')
    .lte('start_date', today).gte('end_date', today).maybeSingle();
  if (managerOnLeave && managerEmail !== 'efehan@attimo.com') managerEmail = 'efehan@attimo.com';

  const card = [
    { type: 'header', text: { type: 'plain_text', text: '📝 New Leave Request' } },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Requester:*\n${requester.name}` },
        { type: 'mrkdwn', text: `*Type:*\n${typeRow?.emoji || ''} ${typeRow?.display_name || leave_type}` },
        { type: 'mrkdwn', text: `*Dates:*\n${isoToDateLabel(start_date)}${start_date !== end_date ? ` → ${isoToDateLabel(end_date)}` : ''}` },
        { type: 'mrkdwn', text: `*Duration:*\n${half_day ? '0.5 day' : `${days} day${days > 1 ? 's' : ''}`}` }
      ]
    }
  ];
  if (reason) card.push({ type: 'section', text: { type: 'mrkdwn', text: `*Reason:* ${reason}` } });
  card.push({
    type: 'actions',
    elements: [
      { type: 'button', text: { type: 'plain_text', text: '✅ Approve' }, style: 'primary', action_id: `approve_leave_${inserted.id}`, value: String(inserted.id) },
      { type: 'button', text: { type: 'plain_text', text: '❌ Reject' }, style: 'danger', action_id: `reject_leave_${inserted.id}`, value: String(inserted.id) }
    ]
  });

  const managerId = await lookupUser(managerEmail);
  if (managerId) await slackAPI('chat.postMessage', { channel: managerId, blocks: card, text: `${requester.name} requested leave` });

  if (managerEmail !== 'efehan@attimo.com') {
    const efehanId = await lookupUser('efehan@attimo.com');
    if (efehanId) await slackAPI('chat.postMessage', {
      channel: efehanId,
      text: `👀 FYI: *${requester.name}* requested ${typeRow?.display_name || leave_type} for ${isoToDateLabel(start_date)}${start_date !== end_date ? ` → ${isoToDateLabel(end_date)}` : ''}. Awaiting approval from manager.`
    });
  }

  await slackAPI('chat.postMessage', { channel: '#hr-module', blocks: card, text: `${requester.name} requested leave` });
  if (userId) await slackAPI('chat.postMessage', { channel: userId, text: '✅ Leave request submitted. Awaiting approval from your manager.' });

  return { response_action: 'clear' };
}

async function handleHomeAction(payload, action) {
  const userId = payload.user?.id;
  const trigger_id = payload.trigger_id;
  let email = '';
  try {
    const lookup = await fetch(`${SLACK_API}/users.info?user=${userId}`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
    email = (await lookup.json()).user?.profile?.email || '';
  } catch {}

  switch (action.action_id) {
    case 'home_request_leave': {
      if (email.toLowerCase() === 'efehan@attimo.com') {
        await slackAPI('chat.postMessage', { channel: userId, text: '🚫 The CEO is excluded from leave requests.' });
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
                options: (types || []).map(t => ({ text: { type: 'plain_text', text: `${t.emoji || ''} ${t.display_name}` }, value: t.key })) } },
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
    case 'home_status_toggle': {
      const { data: cur } = await supabase.from('user_roles').select('allow_status_update').eq('email', email).maybeSingle();
      const newVal = !cur?.allow_status_update;
      await supabase.from('user_roles').update({ allow_status_update: newVal }).eq('email', email);
      await slackAPI('chat.postMessage', { channel: userId, text: `Auto-status update is now *${newVal ? 'ON' : 'OFF'}*.` });
      break;
    }
    case 'home_help':
      await slackAPI('chat.postMessage', { channel: userId, text: '*How to use Attimo PMO Bot:*\n• Type `/leave` to request leave\n• Click *+ Request Leave* in Home tab\n• Visit https://attimo-ops.vercel.app for dashboard\n• Reach Laraib in #pmo for issues' });
      break;
    case 'home_bulk_request':
    case 'home_birthdays':
    case 'home_subscribe':
      await slackAPI('chat.postMessage', { channel: userId, text: '⏳ Coming soon.' });
      break;
  }
}

export async function POST(req) {
  const rawBody = await req.text();
  const ts = req.headers.get('x-slack-request-timestamp');
  const sig = req.headers.get('x-slack-signature');
  if (!verifySlackSignature(rawBody, ts, sig)) return new Response('Unauthorized', { status: 401 });

  const params = new URLSearchParams(rawBody);
  const payload = JSON.parse(params.get('payload') || '{}');

  if (payload.type === 'view_submission' && payload.view.callback_id === 'leave_request_submit') {
    const result = await handleLeaveSubmit(payload);
    return Response.json(result);
  }

  if (payload.type === 'block_actions') {
    const action = payload.actions?.[0];
    if (!action) return Response.json({});

    if (action.action_id?.startsWith('home_')) {
      handleHomeAction(payload, action).catch(e => console.error('Home action err:', e));
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
      const { data: leave } = await supabase.from('leaves').select('*').eq('id', leaveId).single();
      if (!leave) return Response.json({ response_type: 'ephemeral', text: 'Leave not found' });

      const { data: requester } = await supabase.from('user_roles').select('manager_email').eq('email', leave.email).maybeSingle();
      const allowedApprovers = [requester?.manager_email, 'efehan@attimo.com'].filter(Boolean).map(e => e.toLowerCase());
      if (!allowedApprovers.includes(approverEmail.toLowerCase())) {
        return Response.json({ response_type: 'ephemeral', text: `❌ Only the manager or Efehan can act on this.` });
      }

      const newStatus = decision === 'approve' ? 'approved' : 'rejected';
      await supabase.from('leaves').update({
        status: newStatus, approved_by: approverName, approved_by_email: approverEmail
      }).eq('id', leaveId);

      sendApprovalDecision(leave, newStatus, { email: approverEmail, name: approverName })
        .catch(e => console.error('Approval decision err:', e));

      const emoji = newStatus === 'approved' ? '✅' : '❌';
      return Response.json({
        replace_original: true,
        blocks: [
          { type: 'header', text: { type: 'plain_text', text: `${emoji} Leave ${newStatus}` } },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Requester:*\n${leave.person}` },
              { type: 'mrkdwn', text: `*Type:*\n${leave.leave_type}` },
              { type: 'mrkdwn', text: `*Dates:*\n${isoToDateLabel(leave.start_date)}${leave.start_date !== leave.end_date ? ` → ${isoToDateLabel(leave.end_date)}` : ''}` }
            ]
          },
          { type: 'context', elements: [{ type: 'mrkdwn', text: `${emoji} *${newStatus.toUpperCase()}* by ${approverName}` }] }
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
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `${decision === 'dismiss' ? '🚫 Dismissed' : '⚠️ Confirmed'} by *${approverName}*` } }]
      });
    }
  }

  return Response.json({});
}
