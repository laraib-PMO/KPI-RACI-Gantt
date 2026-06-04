// ═══════════════════════════════════════════════════════════════════════════
// /api/slack-command — Handles /leave slash command
// Opens Slack modal for leave request (Spock-style)
// Configure in Slack: api.slack.com → your app → Slash Commands → New
//   Command: /leave
//   Request URL: https://attimo-ops.vercel.app/api/slack-command
// ═══════════════════════════════════════════════════════════════════════════

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

function verifySlackSignature(rawBody, timestamp, signature) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const base = `v0:${timestamp}:${rawBody}`;
  const computed = 'v0=' + crypto.createHmac('sha256', secret).update(base).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature)); }
  catch { return false; }
}

async function openLeaveModal(trigger_id, userEmail) {
  // Fetch leave types from DB so options stay in sync
  const { data: types } = await supabase.from('leave_types').select('*').order('sort_order');

  const today = new Date().toISOString().split('T')[0];

  const view = {
    type: 'modal',
    callback_id: 'leave_request_submit',
    title: { type: 'plain_text', text: 'Request Leave' },
    submit: { type: 'plain_text', text: 'Submit' },
    close: { type: 'plain_text', text: 'Cancel' },
    private_metadata: JSON.stringify({ email: userEmail }),
    blocks: [
      {
        type: 'input',
        block_id: 'leave_type',
        label: { type: 'plain_text', text: 'Leave Type' },
        element: {
          type: 'static_select',
          action_id: 'value',
          placeholder: { type: 'plain_text', text: 'Pick one' },
          options: (types || []).map(t => ({
            text: { type: 'plain_text', text: t.display_name },
            value: t.key
          }))
        }
      },
      {
        type: 'input',
        block_id: 'start_date',
        label: { type: 'plain_text', text: 'Start date' },
        element: { type: 'datepicker', action_id: 'value', initial_date: today }
      },
      {
        type: 'input',
        block_id: 'end_date',
        label: { type: 'plain_text', text: 'End date' },
        element: { type: 'datepicker', action_id: 'value', initial_date: today }
      },
      {
        type: 'input',
        block_id: 'half_day',
        optional: true,
        label: { type: 'plain_text', text: 'Half day?' },
        element: {
          type: 'checkboxes',
          action_id: 'value',
          options: [{
            text: { type: 'plain_text', text: 'This is a half-day request (Annual / Casual / Personal only)' },
            value: 'half'
          }]
        }
      },
      {
        type: 'input',
        block_id: 'reason',
        optional: true,
        label: { type: 'plain_text', text: 'Reason (optional)' },
        element: {
          type: 'plain_text_input',
          action_id: 'value',
          multiline: true,
          placeholder: { type: 'plain_text', text: 'Anything your manager should know?' }
        }
      }
    ]
  };

  const res = await fetch('https://slack.com/api/views.open', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ trigger_id, view })
  });
  return await res.json();
}

export async function POST(req) {
  const rawBody = await req.text();
  const ts = req.headers.get('x-slack-request-timestamp');
  const sig = req.headers.get('x-slack-signature');
  if (!verifySlackSignature(rawBody, ts, sig)) return new Response('Unauthorized', { status: 401 });

  const params = new URLSearchParams(rawBody);
  const command = params.get('command');
  const trigger_id = params.get('trigger_id');
  const userId = params.get('user_id');

  if (['/leave', '/applyleave', '/apply-leave', '/leaverequest', '/timeoff', '/holiday'].includes(command)) {
    // Look up the user's email from their Slack ID
    const lookupRes = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
      headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}` }
    });
    const lookup = await lookupRes.json();
    const email = lookup.user?.profile?.email || '';

    // Block Efehan (excluded from leave)
    if (email.toLowerCase() === 'efehan@attimo.com') {
      return Response.json({ response_type: 'ephemeral', text: 'The CEO is excluded from leave requests.' });
    }

    // Acknowledge immediately, then open modal asynchronously
    openLeaveModal(trigger_id, email).catch(e => console.error('Modal open failed:', e));
    return new Response('', { status: 200 });
  }

  return Response.json({ response_type: 'ephemeral', text: `Unknown command: ${command}` });
}
