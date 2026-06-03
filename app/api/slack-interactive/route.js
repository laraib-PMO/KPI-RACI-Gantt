// ─── Slack Interactive Components Endpoint ──────────────────────────────────
// Handles button clicks from Slack (Approve/Reject leave buttons)
// Configure in Slack App settings → Interactivity → Request URL:
//   https://attimo-ops.vercel.app/api/slack-interactive
// Requires env: SLACK_SIGNING_SECRET, SLACK_BOT_TOKEN, SUPABASE_SERVICE_KEY

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

const LEAVE_APPROVERS = ['nil@attimo.com', 'laraib@attimo.com', 'efehan@attimo.com'];

// Verify the request came from Slack (signature check)
function verifySlackSignature(rawBody, timestamp, signature) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return false;
  // Reject requests older than 5 minutes
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const base = `v0:${timestamp}:${rawBody}`;
  const computed = 'v0=' + crypto.createHmac('sha256', secret).update(base).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch { return false; }
}

export async function POST(req) {
  const rawBody = await req.text();
  const timestamp = req.headers.get('x-slack-request-timestamp');
  const signature = req.headers.get('x-slack-signature');

  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Slack sends form-urlencoded with a `payload` field containing JSON
  const params = new URLSearchParams(rawBody);
  const payload = JSON.parse(params.get('payload') || '{}');

  const action = payload.actions?.[0];
  if (!action) return Response.json({ text: 'No action' });

  // action_id format: "approve_leave_123" or "reject_leave_123" or "dismiss_risk_45"
  const leaveMatch = action.action_id?.match(/^(approve|reject)_leave_(\d+)$/);
  const riskMatch = action.action_id?.match(/^(confirm|dismiss)_risk_(\d+)$/);

  // ─── Leave approval / rejection ──────────────────────────────────────
  if (leaveMatch) {
    const [, decision, leaveId] = leaveMatch;
    const approverEmail = payload.user?.profile?.email || payload.user?.email || '';
    const approverName = payload.user?.name || payload.user?.username || '';

    // Only approved emails can act
    if (!LEAVE_APPROVERS.includes(approverEmail.toLowerCase())) {
      return Response.json({
        response_type: 'ephemeral',
        text: '❌ Only Nil, Laraib, or Efehan can approve leave requests.'
      });
    }

    // Fetch the leave record
    const { data: leave } = await supabase.from('leaves').select('*').eq('id', leaveId).single();
    if (!leave) return Response.json({ text: 'Leave not found' });

    const newStatus = decision === 'approve' ? 'approved' : 'rejected';
    await supabase.from('leaves').update({
      status: newStatus,
      approved_by: approverName,
      approved_by_email: approverEmail
    }).eq('id', leaveId);

    // DM the employee with the decision
    if (leave.email && process.env.SLACK_BOT_TOKEN) {
      try {
        const lookupRes = await fetch(`https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(leave.email)}`, {
          headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}` }
        });
        const lookup = await lookupRes.json();
        if (lookup.user?.id) {
          const emoji = newStatus === 'approved' ? '✅' : '❌';
          await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channel: lookup.user.id,
              text: `${emoji} Your ${leave.leave_type} leave for ${leave.start_date}${leave.start_date !== leave.end_date ? ` to ${leave.end_date}` : ''} has been *${newStatus}* by ${approverName}.`
            })
          });
        }
      } catch (e) { console.error('DM employee error:', e); }
    }

    // Announce in #general if approved
    if (newStatus === 'approved' && process.env.SLACK_BOT_TOKEN) {
      try {
        await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: '#general',
            text: `🌿 *${leave.person}* will be off on ${leave.start_date}${leave.start_date !== leave.end_date ? ` through ${leave.end_date}` : ''} (${leave.leave_type}${leave.half_day ? ', half day' : ''}).`
          })
        });
      } catch (e) { console.error('General announce error:', e); }
    }

    // Update the original Slack message to show the decision (replaces buttons)
    const decisionEmoji = newStatus === 'approved' ? '✅' : '❌';
    return Response.json({
      replace_original: true,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `${decisionEmoji} Leave ${newStatus}` }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Requester:*\n${leave.person}` },
            { type: 'mrkdwn', text: `*Type:*\n${leave.leave_type}` },
            { type: 'mrkdwn', text: `*Dates:*\n${leave.start_date}${leave.start_date !== leave.end_date ? ` → ${leave.end_date}` : ''}` },
            { type: 'mrkdwn', text: `*Days:*\n${leave.half_day ? '0.5' : leave.days}` }
          ]
        },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `${decisionEmoji} *${newStatus.toUpperCase()}* by ${approverName} · ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/Istanbul' })}` }]
        }
      ]
    });
  }

  // ─── Auto-risk confirmation / dismissal ─────────────────────────────────
  if (riskMatch) {
    const [, decision, riskId] = riskMatch;
    const approverName = payload.user?.name || payload.user?.username || '';

    if (decision === 'dismiss') {
      await supabase.from('risks').update({ status: 'CLOSED', notes: `Dismissed by ${approverName}` }).eq('id', riskId);
      return Response.json({
        replace_original: true,
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `🚫 Risk dismissed by *${approverName}*.` } }]
      });
    } else {
      await supabase.from('risks').update({ status: 'ACTIVE' }).eq('id', riskId);
      return Response.json({
        replace_original: true,
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `⚠️ Risk confirmed by *${approverName}* — now active in the dashboard.` } }]
      });
    }
  }

  return Response.json({ text: 'Action processed' });
}
