// ═══════════════════════════════════════════════════════════════════════════
// /api/slack-command — Handles /applyleave (and aliases) slash command
// Opens the Leave Request modal
// FIX: awaits views.open before returning (serverless was killing the async call)
// ═══════════════════════════════════════════════════════════════════════════

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

function verifySlackSignature(rawBody, timestamp, signature) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) {
    console.warn('[slack-command] SLACK_SIGNING_SECRET not set');
    return false;
  }
  if (!timestamp || !signature) {
    console.warn('[slack-command] Missing timestamp or signature header');
    return false;
  }
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    console.warn('[slack-command] Timestamp too old');
    return false;
  }
  const base = `v0:${timestamp}:${rawBody}`;
  const computed = 'v0=' + crypto.createHmac('sha256', secret).update(base).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature)); }
  catch { return false; }
}

async function openLeaveModal(trigger_id, userEmail) {
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
        type: 'input', block_id: 'leave_type',
        label: { type: 'plain_text', text: 'Leave Type' },
        element: {
          type: 'static_select', action_id: 'value',
          placeholder: { type: 'plain_text', text: 'Pick one' },
          options: (types || []).map(t => ({
            text: { type: 'plain_text', text: t.display_name }, value: t.key
          }))
        }
      },
      {
        type: 'input', block_id: 'start_date',
        label: { type: 'plain_text', text: 'Start date' },
        element: { type: 'datepicker', action_id: 'value', initial_date: today }
      },
      {
        type: 'input', block_id: 'end_date',
        label: { type: 'plain_text', text: 'End date' },
        element: { type: 'datepicker', action_id: 'value', initial_date: today }
      },
      {
        type: 'input', block_id: 'half_day', optional: true,
        label: { type: 'plain_text', text: 'Half day?' },
        element: {
          type: 'checkboxes', action_id: 'value',
          options: [{
            text: { type: 'plain_text', text: 'This is a half-day request (Annual / Casual / Personal only)' },
            value: 'half'
          }]
        }
      },
      {
        type: 'input', block_id: 'reason', optional: true,
        label: { type: 'plain_text', text: 'Reason (optional)' },
        element: {
          type: 'plain_text_input', action_id: 'value', multiline: true,
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
  const data = await res.json();
  if (!data.ok) console.error('[slack-command] views.open failed:', data.error, JSON.stringify(data.response_metadata || {}));
  else console.log('[slack-command] modal opened OK');
  return data;
}

// GET — browser diagnostic: proves the route is deployed
export async function GET() {
  return new Response(
    JSON.stringify({
      status: 'alive',
      route: '/api/slack-command',
      method: 'GET not supported — Slack sends POST',
      timestamp: new Date().toISOString()
    }),
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

  console.log('[slack-command] received:', command, 'from', userId);

  if (['/leave', '/applyleave', '/apply-leave', '/leaverequest', '/timeoff', '/holiday'].includes(command)) {
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
    const result = await openLeaveModal(trigger_id, email);

    if (!result.ok) {
      return Response.json({
        response_type: 'ephemeral',
        text: `Could not open the leave form (${result.error}). Ping Laraib.`
      });
    }
    // Modal opened — return empty 200 so Slack shows nothing extra
    return new Response('', { status: 200 });
  }

  return Response.json({ response_type: 'ephemeral', text: `Unknown command: ${command}` });
}
