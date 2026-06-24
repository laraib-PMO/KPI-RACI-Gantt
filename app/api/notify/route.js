// ─── Slack Notify Route — Block Kit messages with Approve/Reject buttons ─────
// Posts proper Slack cards (not text strings) when leave/changes happen.
// For leave: posts to #hr-module with Approve/Reject buttons + DMs all approvers.
// Short leave (leave_type === 'short') is formatted distinctly: single date + a
// time window in hours, never days.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

const SLACK_API = 'https://slack.com/api';

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

// Short-leave helpers
const isShort = (l) => l && l.leave_type === 'short';
const shortWindow = (l) => `${l.start_time || '?'}–${l.end_time || '?'}${l.hours ? ` (${l.hours}h)` : ''}`;

function leaveRequestBlocks(leave) {
  // ── Short leave: hours-based, single date ──
  if (isShort(leave)) {
    return [
      { type: 'header', text: { type: 'plain_text', text: 'New Short Leave Request' } },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Requester:*\n${leave.person}` },
          { type: 'mrkdwn', text: `*Type:*\nShort Leave (hours)` },
          { type: 'mrkdwn', text: `*Date:*\n${leave.start_date}` },
          { type: 'mrkdwn', text: `*Time:*\n${shortWindow(leave)}` }
        ]
      },
      ...(leave.reason ? [{ type: 'section', text: { type: 'mrkdwn', text: `*Reason:*\n${leave.reason}` } }] : []),
      {
        type: 'actions',
        elements: [
          { type: 'button', text: { type: 'plain_text', text: 'Approve' }, style: 'primary', action_id: `approve_leave_${leave.id}`, value: String(leave.id) },
          { type: 'button', text: { type: 'plain_text', text: 'Reject' }, style: 'danger', action_id: `reject_leave_${leave.id}`, value: String(leave.id) }
        ]
      },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `Approvers: Nil, Laraib, Efehan · Only one needs to act · Counted in hours, not days` }] }
    ];
  }

  // ── Standard day-based leave ──
  const dateRange = leave.start_date === leave.end_date
    ? leave.start_date
    : `${leave.start_date} → ${leave.end_date}`;
  return [
    { type: 'header', text: { type: 'plain_text', text: `New Leave Request` } },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Requester:*\n${leave.person}` },
        { type: 'mrkdwn', text: `*Type:*\n${leave.leave_type}${leave.half_day ? ' (half day)' : ''}` },
        { type: 'mrkdwn', text: `*Dates:*\n${dateRange}` },
        { type: 'mrkdwn', text: `*Days:*\n${leave.half_day ? '0.5' : leave.days}` }
      ]
    },
    ...(leave.reason ? [{ type: 'section', text: { type: 'mrkdwn', text: `*Reason:*\n${leave.reason}` } }] : []),
    {
      type: 'actions',
      elements: [
        { type: 'button', text: { type: 'plain_text', text: 'Approve' }, style: 'primary', action_id: `approve_leave_${leave.id}`, value: String(leave.id) },
        { type: 'button', text: { type: 'plain_text', text: 'Reject' }, style: 'danger', action_id: `reject_leave_${leave.id}`, value: String(leave.id) }
      ]
    },
    { type: 'context', elements: [{ type: 'mrkdwn', text: `Approvers: Nil, Laraib, Efehan · Only one needs to act` }] }
  ];
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { user, action, table, detail, leave } = body;

    // ─── Leave request — approval card ─────────────────────────────────
    if (table === 'leave' && action === 'requested' && leave?.id) {
      const blocks = leaveRequestBlocks(leave);
      const fallback = isShort(leave)
        ? `${leave.person} requested short leave on ${leave.start_date} (${shortWindow(leave)})`
        : `${leave.person} requested ${leave.leave_type} leave for ${leave.start_date}`;
      await slackPost('#hr-module', blocks, fallback);

      const { data: approvers } = await supabase
        .from('approvers')
        .select('approver_email')
        .eq('approval_type', 'leave');
      for (const a of approvers || []) {
        const userId = await lookupSlackUser(a.approver_email);
        if (userId) await slackPost(userId, blocks, fallback);
      }
      return Response.json({ ok: true, posted: 'leave_request' });
    }

    // ─── Leave decision update (admin acted in dashboard or Slack) ─────
    if (table === 'leave' && (action === 'approved' || action === 'rejected') && leave?.id) {
      const short = isShort(leave);
      const dateRange = short
        ? `${leave.start_date} · ${shortWindow(leave)}`
        : (leave.start_date === leave.end_date ? leave.start_date : `${leave.start_date} → ${leave.end_date}`);
      const typeLabel = short ? 'Short Leave' : leave.leave_type;
      const blocks = [
        { type: 'header', text: { type: 'plain_text', text: `Leave ${action}` } },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Requester:*\n${leave.person}` },
            { type: 'mrkdwn', text: `*Type:*\n${typeLabel}` },
            { type: 'mrkdwn', text: short ? `*When:*\n${dateRange}` : `*Dates:*\n${dateRange}` }
          ]
        },
        { type: 'context', elements: [{ type: 'mrkdwn', text: `${action.toUpperCase()} by ${user || 'admin'}` }] }
      ];
      await slackPost('#hr-module', blocks, `${leave.person}'s leave ${action}`);

      // DM the employee
      const empId = await lookupSlackUser(leave.email);
      if (empId) {
        const msg = short
          ? `Your *Short Leave* on ${leave.start_date} (${shortWindow(leave)}) was *${action}* by ${user || 'admin'}.`
          : `Your *${leave.leave_type}* leave for ${dateRange} was *${action}* by ${user || 'admin'}.`;
        await slackPost(empId, [{ type: 'section', text: { type: 'mrkdwn', text: msg } }], `Leave ${action}`);
      }

      // Announce in #general if approved AND the leave has not already passed
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
      const refDate = short ? leave.start_date : leave.end_date;
      if (action === 'approved' && refDate && refDate >= todayStr) {
        const ann = short
          ? `*${leave.person}* will be on short leave on ${leave.start_date}, ${shortWindow(leave)}.`
          : `*${leave.person}* will be off on ${dateRange} (${leave.leave_type}${leave.half_day ? ', half day' : ''}).`;
        await slackPost('#general', [{ type: 'section', text: { type: 'mrkdwn', text: ann } }], `${leave.person} ${dateRange}`);
      }

      // Blank the Approve/Reject buttons on the original request copies (manager DM + #hr-module)
      const msgs = Array.isArray(leave.approver_msgs) ? leave.approver_msgs : [];
      if (msgs.length) {
        const updBlocks = [
          { type: 'header', text: { type: 'plain_text', text: `Leave ${action.toUpperCase()}` } },
          { type: 'section', fields: [
            { type: 'mrkdwn', text: `*Requester:*\n${leave.person}` },
            { type: 'mrkdwn', text: `*Type:*\n${typeLabel}` },
            { type: 'mrkdwn', text: short ? `*When:*\n${dateRange}` : `*Dates:*\n${dateRange}` }
          ]},
          { type: 'context', elements: [{ type: 'mrkdwn', text: `Decision: *${action.toUpperCase()}* by ${user || 'admin'}` }] }
        ];
        const token = process.env.SLACK_BOT_TOKEN;
        if (token) await Promise.all(msgs.map(m => fetch(`${SLACK_API}/chat.update`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: m.channel, ts: m.ts, blocks: updBlocks, text: `Leave ${action} for ${leave.person}` }) }).catch(() => {})));
      }
      return Response.json({ ok: true, posted: 'leave_decision' });
    }

    // ─── Generic edit notification (light-touch) ────────────────────────
    if (action && table) {
      const text = `*${user || 'Someone'}* ${action} ${table}${detail ? `: ${detail}` : ''}`;
      const webhook = process.env.SLACK_WEBHOOK_URL;
      if (webhook) {
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
      }
      return Response.json({ ok: true, posted: 'edit' });
    }

    return Response.json({ ok: false, error: 'No action recognized' });
  } catch (e) {
    return Response.json({ ok: false, error: e.message });
  }
}
