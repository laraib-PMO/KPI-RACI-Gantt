// ─── Slack Notify Route — Block Kit messages with Approve/Reject buttons ─────
// Posts proper Slack cards (not text strings) when leave/changes happen
// For leave: posts to #hr-module with Approve/Reject buttons + DMs all approvers

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

const LEAVE_TYPE_EMOJI = { annual: '', sick: '', personal: '', casual: '', wfh: '', other: '' };

function leaveRequestBlocks(leave) {
  const emoji = LEAVE_TYPE_EMOJI[leave.leave_type] || '';
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
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Approve' },
          style: 'primary',
          action_id: `approve_leave_${leave.id}`,
          value: String(leave.id)
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Reject' },
          style: 'danger',
          action_id: `reject_leave_${leave.id}`,
          value: String(leave.id)
        }
      ]
    },
    { type: 'context', elements: [{ type: 'mrkdwn', text: `Approvers: Nil, Laraib, Efehan · Only one needs to act` }] }
  ];
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { user, action, table, detail, leave } = body;

    // ─── Leave request — Spock-style approval card ─────────────────────
    if (table === 'leave' && action === 'requested' && leave?.id) {
      // Post to #hr-module with buttons
      const blocks = leaveRequestBlocks(leave);
      const fallback = `${leave.person} requested ${leave.leave_type} leave for ${leave.start_date}`;
      await slackPost('#hr-module', blocks, fallback);

      // DM each approver as well
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

    // ─── Leave decision update (admin acted in dashboard, not Slack) ────
    if (table === 'leave' && (action === 'approved' || action === 'rejected') && leave?.id) {
      const _action = action;
      const dateRange = leave.start_date === leave.end_date
        ? leave.start_date
        : `${leave.start_date} → ${leave.end_date}`;
      const blocks = [
        { type: 'header', text: { type: 'plain_text', text: `Leave ${action}` } },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Requester:*\n${leave.person}` },
            { type: 'mrkdwn', text: `*Type:*\n${leave.leave_type}` },
            { type: 'mrkdwn', text: `*Dates:*\n${dateRange}` }
          ]
        },
        { type: 'context', elements: [{ type: 'mrkdwn', text: `${action.toUpperCase()} by ${user || 'admin'}` }] }
      ];
      await slackPost('#hr-module', blocks, `${leave.person}'s leave ${action}`);
      // DM the employee
      const empId = await lookupSlackUser(leave.email);
      if (empId) {
        await slackPost(empId, [
          { type: 'section', text: { type: 'mrkdwn', text: `Your *${leave.leave_type}* leave for ${dateRange} was *${action}* by ${user || 'admin'}.` } }
        ], `Leave ${action}`);
      }
      // Announce in #general if approved
      if (action === 'approved') {
        await slackPost('#general',
          [{ type: 'section', text: { type: 'mrkdwn', text: `*${leave.person}* will be off on ${dateRange} (${leave.leave_type}${leave.half_day ? ', half day' : ''}).` } }],
          `${leave.person} off ${dateRange}`
        );
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
