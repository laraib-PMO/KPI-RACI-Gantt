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

// Map IANA timezone -> holiday-list country code (matches the dashboard)
const tzToCountry = tz => tz === 'Europe/Istanbul' ? 'TR' : tz === 'Asia/Karachi' ? 'PK' : tz === 'Europe/London' ? 'UK' : null;
// UK bank holidays 2026 (gov.uk). The /api/holidays feed only covers TR + PK,
// so UK is supplied here for the leave-day exclusion.
const UK_HOLIDAYS_2026 = ['2026-01-01','2026-04-03','2026-04-06','2026-05-04','2026-05-25','2026-08-31','2026-12-25','2026-12-28'];

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
    if (decision === 'rejected' && leave.reject_reason) {
      blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Reason for rejection:*\n${leave.reject_reason}` } });
    }
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

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
  const refDate = short ? leave.start_date : leave.end_date;
  if (decision === 'approved' && refDate && refDate >= todayStr) {
    await slackAPI('chat.postMessage', {
      channel: '#general',
      text: short
        ? `*${leave.person}* will be on short leave ${whenStr}.`
        : `*${leave.person}* will be off ${whenStr} (${leave.leave_type}${leave.half_day ? ', half day' : ''}).`
    });
  }
}

// Replace the original request message(s) (manager DM + #hr-module) so the
// Approve/Reject buttons disappear once a decision is made anywhere.
async function clearApproverButtons(leave, decision, approverName) {
  const msgs = Array.isArray(leave?.approver_msgs) ? leave.approver_msgs : [];
  if (!msgs.length) return;
  const short = isShort(leave);
  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: `Leave ${String(decision).toUpperCase()}` } },
    { type: 'section', fields: [
      { type: 'mrkdwn', text: `*Requester:*\n${leave.person}` },
      { type: 'mrkdwn', text: `*Type:*\n${leave.leave_type}` },
      { type: 'mrkdwn', text: `*${short ? 'When' : 'Dates'}:*\n${short ? `${isoToDateLabel(leave.start_date)} · ${shortWindow(leave)}` : `${isoToDateLabel(leave.start_date)}${leave.start_date !== leave.end_date ? ` → ${isoToDateLabel(leave.end_date)}` : ''}`}` }
    ]},
    { type: 'context', elements: [{ type: 'mrkdwn', text: `Decision: *${String(decision).toUpperCase()}*${approverName ? ` by ${approverName}` : ''}` }] }
  ];
  await Promise.all(msgs.map(m =>
    slackAPI('chat.update', { channel: m.channel, ts: m.ts, blocks, text: `Leave ${decision} for ${leave.person}` }).catch(() => {})
  ));
}

// ─── Holiday approval helpers ────────────────────────────────────────────────
const HOL_TZ = { TR: 'Europe/Istanbul', PK: 'Asia/Karachi', UK: 'Europe/London', GB: 'Europe/London' };
const HOL_LBL = { TR: 'Turkey', PK: 'Pakistan', UK: 'United Kingdom', GB: 'United Kingdom' };

// Post the public-holiday announcement to #general once approved (names the team off)
async function announceHoliday(hr) {
  const countries = String(hr.country || '').toUpperCase().split(',').map(s => s.trim()).filter(Boolean);
  const tzs = countries.map(c => HOL_TZ[c]).filter(Boolean);
  const label = countries.map(c => HOL_LBL[c] || c).join(' & ') || 'Public';
  const { data: people } = await supabase.from('user_roles').select('name,timezone');
  const names = (people || []).filter(p => tzs.includes(p.timezone)).map(p => p.name).filter(Boolean);
  const who = names.length
    ? `\n\nOff for the day: ${names.join(', ')}. Please plan around their availability.`
    : `\n\nTeammates in ${label} will be off.`;
  await slackAPI('chat.postMessage', {
    channel: '#general',
    text: `Public holiday: ${hr.name} (${label})`,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'Public Holiday' } },
      { type: 'section', text: { type: 'mrkdwn', text: `*${hr.name}* — a public holiday in ${label} on ${isoToDateLabel(hr.hol_date)}.${who}` } }
    ]
  });
}

// Blank the Approve/Reject buttons on the holiday-approval message(s)
async function clearHolidayButtons(hr, decision, approverName) {
  const msgs = Array.isArray(hr.msgs) ? hr.msgs : [];
  if (!msgs.length) return;
  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: `Holiday ${String(decision).toUpperCase()}` } },
    { type: 'section', text: { type: 'mrkdwn', text: `*${hr.name}* (${hr.country}) on ${isoToDateLabel(hr.hol_date)}` } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: `${decision === 'approved' ? 'Approved — announced in #general' : 'Rejected — not announced'}${approverName ? ` by ${approverName}` : ''}` }] }
  ];
  await Promise.all(msgs.map(m =>
    slackAPI('chat.update', { channel: m.channel, ts: m.ts, blocks, text: `Holiday ${decision}` }).catch(() => {})
  ));
}

// Modal submit: reject a leave WITH a reason, notify the requester, clear buttons
async function handleRejectReason(payload) {
  const meta = JSON.parse(payload.view.private_metadata || '{}');
  const leaveId = meta.leaveId;
  const approverName = meta.approverName || payload.user?.name || payload.user?.username || '';
  const approverEmail = meta.approverEmail || '';
  const reason = payload.view.state?.values?.rr?.value?.value || '';
  const { data: leave } = await supabase.from('leaves').select('*').eq('id', leaveId).single();
  if (!leave) return { response_action: 'clear' };
  await supabase.from('leaves').update({ status: 'rejected', reject_reason: reason, approved_by: approverName, approved_by_email: approverEmail }).eq('id', leaveId);
  const updated = { ...leave, reject_reason: reason };
  try { await sendApprovalDecision(updated, 'rejected', { email: approverEmail, name: approverName }); } catch (e) { console.error('[reject] decision err', e); }
  try { await clearApproverButtons(updated, 'rejected', approverName); } catch (e) { console.error('[reject] clear err', e); }
  // Always blank the buttons on the exact message that was clicked (works even
  // without stored approver_msgs / for older leaves) via Slack's response_url.
  if (meta.responseUrl) {
    try {
      await fetch(meta.responseUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replace_original: true,
          blocks: [
            { type: 'header', text: { type: 'plain_text', text: 'Leave REJECTED' } },
            { type: 'section', fields: [
              { type: 'mrkdwn', text: `*Requester:*\n${leave.person}` },
              { type: 'mrkdwn', text: `*Type:*\n${leave.leave_type}` }
            ] },
            ...(reason ? [{ type: 'section', text: { type: 'mrkdwn', text: `*Reason:*\n${reason}` } }] : []),
            { type: 'context', elements: [{ type: 'mrkdwn', text: `Decision: *REJECTED* by ${approverName}` }] }
          ]
        })
      });
    } catch (e) { console.error('[reject] response_url err', e); }
  }
  return { response_action: 'clear' };
}

// Live-computed spent: sum approved leave days for an email + type in a year (optionally a month)
async function computeSpent(email, typeKey, year, month) {
  const prefix = month ? `${year}-${month}` : `${year}`;
  const { data } = await supabase.from('leaves').select('half_day,days,start_date')
    .ilike('email', email).eq('leave_type', typeKey).eq('status', 'approved');
  return (data || [])
    .filter(l => String(l.start_date || '').startsWith(prefix))
    .reduce((s, l) => s + (l.half_day ? 0.5 : Number(l.days || 0)), 0);
}

async function openBalancesModal(trigger_id, email) {
  const year = new Date().getFullYear();
  const mm = String(new Date().getMonth() + 1).padStart(2, '0');
  const { data: bals } = await supabase.from('leave_balances').select('*').ilike('email', email).eq('year', year);
  const { data: types } = await supabase.from('leave_types').select('*').order('sort_order');
  const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: `*Your leave balances for ${year}*` } }, { type: 'divider' }];
  for (const t of (types || [])) {
    const b = (bals || []).find(x => x.leave_type === t.key) || {};
    const allowance = b.allowance_override != null ? Number(b.allowance_override) : t.annual_allowance;
    const spent = await computeSpent(email, t.key, year);
    const available = allowance != null ? Math.max(0, allowance - spent) : null;
    const monthlyLimit = t.monthly_limit;
    const spentMonth = monthlyLimit != null ? await computeSpent(email, t.key, year, mm) : 0;
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

// Admin-only: everyone's balances at a glance (Annual / Sick / Casual), live-computed
async function openTeamBalancesModal(trigger_id) {
  const year = new Date().getFullYear();
  const { data: users } = await supabase.from('user_roles').select('name,email').order('name');
  const { data: types } = await supabase.from('leave_types').select('*').order('sort_order');
  const { data: bals } = await supabase.from('leave_balances').select('*').eq('year', year);
  const dayTypes = (types || []).filter(t => t.key !== 'short');
  const { data: approved } = await supabase.from('leaves').select('email,leave_type,half_day,days,start_date,status').eq('status', 'approved');
  const spentOf = (email, key) => (approved || [])
    .filter(l => (l.email || '').toLowerCase() === (email || '').toLowerCase() && l.leave_type === key && String(l.start_date || '').startsWith(`${year}`))
    .reduce((s, l) => s + (l.half_day ? 0.5 : Number(l.days || 0)), 0);
  const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: `*Team leave balances — ${year}*` } }, { type: 'divider' }];
  for (const u of (users || [])) {
    if (u.email === 'efehan@attimo.com') continue; // CEO excluded from leave
    const parts = dayTypes.map(t => {
      const b = (bals || []).find(x => (x.email || '').toLowerCase() === (u.email || '').toLowerCase() && x.leave_type === t.key);
      const allow = b?.allowance_override != null ? Number(b.allowance_override) : t.annual_allowance;
      const spent = spentOf(u.email, t.key);
      const avail = allow != null ? Math.max(0, allow - spent) : '∞';
      return `${t.display_name}: *${avail}* left (${spent}/${allow ?? '∞'})`;
    });
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*${u.name}*\n${parts.join('  ·  ')}` } });
  }
  await slackAPI('views.open', {
    trigger_id, view: { type: 'modal', callback_id: 'team_balances_view', title: { type: 'plain_text', text: 'Team Balances' }, close: { type: 'plain_text', text: 'Close' }, blocks }
  });
}


async function myLeaveBlocks(email) {
  const today = new Date().toISOString().split('T')[0];
  const istToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
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
  if (!upcoming.length) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '_No upcoming leave._' } });
  else for (const l of upcoming) {
    const sec = { type: 'section', text: { type: 'mrkdwn', text: fmt(l) } };
    const cancelable = (l.status === 'pending' || l.status === 'approved') && (l.start_date || '') >= istToday;
    if (cancelable) sec.accessory = {
      type: 'button', text: { type: 'plain_text', text: 'Cancel' }, style: 'danger',
      action_id: `cancel_leave_${l.id}`, value: String(l.id),
      confirm: { title: { type: 'plain_text', text: 'Cancel leave?' }, text: { type: 'mrkdwn', text: 'This cancels the request. Your approver will be notified.' }, confirm: { type: 'plain_text', text: 'Cancel leave' }, deny: { type: 'plain_text', text: 'Keep' } }
    };
    blocks.push(sec);
  }
  blocks.push({ type: 'divider' });
  blocks.push({ type: 'header', text: { type: 'plain_text', text: 'Past' } });
  blocks.push({ type: 'section', text: { type: 'mrkdwn', text: past.length ? past.slice(0, 10).map(fmt).join('\n') : '_No past leave._' } });
  return blocks;
}

async function openMyLeaveModal(trigger_id, email) {
  const blocks = await myLeaveBlocks(email);
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
  const upcoming = holidays.filter(h => (h.d || h.date) >= today).slice(0, 20);
  const blocks = [{ type: 'header', text: { type: 'plain_text', text: 'Public Holidays' } }];
  if (upcoming.length === 0) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '_No upcoming holidays._' } });
  else for (const h of upcoming) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*${isoToDateLabel(h.d || h.date)}* · ${h.l || h.name} _(${h.c || h.country || 'TR/PK'})_` } });
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

  const { data: requester } = await supabase.from('user_roles').select('*').ilike('email', email).maybeSingle();
  if (!requester) return { response_action: 'errors', errors: { leave_type: 'Account not in roster — contact Laraib' } };

  // Build this person's public-holiday set so leave doesn't consume days they're already off for
  const cc = tzToCountry(requester.timezone);
  let holSet = new Set();
  if (cc && !half_day) {
    let feed = [];
    try { const r = await fetch('https://attimo-ops.vercel.app/api/holidays'); const fd = await r.json(); feed = fd.holidays || []; } catch {}
    const all = [...feed.map(h => ({ d: h.d || h.date, c: (h.c || h.country || '').toUpperCase() })), ...UK_HOLIDAYS_2026.map(d => ({ d, c: 'UK' }))];
    holSet = new Set(all.filter(h => h.c.split(',').map(x => x.trim()).includes(cc)).map(h => h.d));
  }

  let workDays = 0;
  { const a = new Date(start_date + 'T12:00:00'); const b = new Date(effEnd + 'T12:00:00');
    for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
      const w = d.getDay(); if (w === 0 || w === 6) continue;
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (holSet.has(iso)) continue;
      workDays++;
    } }
  const days = half_day ? 0.5 : Math.max(1, workDays);

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

  // Soft balance check — warn only, approvers still decide
  let overNote = '';
  if (!half_day) {
    const yr = new Date().getFullYear();
    const { data: balRow } = await supabase.from('leave_balances').select('allowance_override').ilike('email', email).eq('leave_type', leave_type).eq('year', yr).maybeSingle();
    const allowance = balRow?.allowance_override != null ? Number(balRow.allowance_override) : (typeRow?.annual_allowance ?? null);
    if (allowance != null) {
      const spent = await computeSpent(email, leave_type, yr);
      const remaining = allowance - spent;
      if (days > remaining) overNote = `This is ${days - remaining} day(s) over ${requester.name}'s remaining ${typeRow?.display_name || leave_type} balance (${Math.max(0, remaining)} left of ${allowance}).`;
    }
  }

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
  if (overNote) card.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `[OVER BALANCE] ${overNote}` }] });
  card.push({
    type: 'actions',
    elements: [
      { type: 'button', text: { type: 'plain_text', text: 'Approve' }, style: 'primary', action_id: `approve_leave_${inserted.id}`, value: String(inserted.id) },
      { type: 'button', text: { type: 'plain_text', text: 'Reject' }, style: 'danger', action_id: `reject_leave_${inserted.id}`, value: String(inserted.id) }
    ]
  });

  // Fire all notifications in parallel — sequential awaits blew Slack's 3s
  // view_submission budget and caused "We had some trouble connecting".
  const refs = [];
  const notifyTasks = [];
  notifyTasks.push((async () => {
    const managerId = await lookupUser(managerEmail);
    if (managerId) { const r = await dmUser(managerId, { blocks: card, text: `${requester.name} requested leave` }); if (r?.ok && r.channel && r.ts) refs.push({ channel: r.channel, ts: r.ts }); }
  })());
  if (managerEmail !== 'efehan@attimo.com') {
    notifyTasks.push((async () => {
      const efehanId = await lookupUser('efehan@attimo.com');
      if (efehanId) await dmUser(efehanId, {
        text: `FYI: *${requester.name}* requested ${typeRow?.display_name || leave_type} for ${isoToDateLabel(start_date)}${start_date !== end_date ? ` → ${isoToDateLabel(end_date)}` : ''}. Awaiting approval from manager.`
      });
    })());
  }
  notifyTasks.push((async () => { const hr = await slackAPI('chat.postMessage', { channel: '#hr-module', blocks: card, text: `${requester.name} requested leave` }); if (hr?.ok && hr.channel && hr.ts) refs.push({ channel: hr.channel, ts: hr.ts }); })());
  if (userId) notifyTasks.push(dmUser(userId, { text: 'Leave request submitted. Awaiting approval from your manager.' + (overNote ? `\n\nNote: ${overNote}` : '') }));
  await Promise.all(notifyTasks);
  if (refs.length) { try { await supabase.from('leaves').update({ approver_msgs: refs }).eq('id', inserted.id); } catch {} }

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

  const { data: inserted, error: insErr } = await supabase.from('leaves').insert({
    person: requester.name, email, leave_type: 'short', half_day: false,
    start_date: date, end_date: date, days: 0,
    start_time, end_time, hours, reason, status: 'pending'
  }).select().single();
  if (insErr || !inserted) return { response_action: 'errors', errors: { sl_date: 'Save failed: ' + (insErr?.message || 'no row returned') } };

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

  const refs = [];
  const notifyTasks = [];
  notifyTasks.push((async () => {
    const managerId = await lookupUser(managerEmail);
    if (managerId) { const r = await dmUser(managerId, { blocks: card, text: `${requester.name} requested short leave` }); if (r?.ok && r.channel && r.ts) refs.push({ channel: r.channel, ts: r.ts }); }
  })());
  if (managerEmail !== 'efehan@attimo.com') {
    notifyTasks.push((async () => {
      const efehanId = await lookupUser('efehan@attimo.com');
      if (efehanId) await dmUser(efehanId, { text: `FYI: *${requester.name}* requested short leave on ${isoToDateLabel(date)} (${start_time}–${end_time}, ${hours}h). Awaiting approval.` });
    })());
  }
  notifyTasks.push((async () => { const hr = await slackAPI('chat.postMessage', { channel: '#hr-module', blocks: card, text: `${requester.name} requested short leave` }); if (hr?.ok && hr.channel && hr.ts) refs.push({ channel: hr.channel, ts: hr.ts }); })());
  if (userId) notifyTasks.push(dmUser(userId, { text: 'Short leave request submitted. Awaiting approval from your manager.' }));
  await Promise.all(notifyTasks);
  if (refs.length) { try { await supabase.from('leaves').update({ approver_msgs: refs }).eq('id', inserted.id); } catch {} }

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
    case 'home_team_balances': {
      const LEAVE_APPROVERS = ['nil@attimo.com', 'laraib@attimo.com', 'efehan@attimo.com'];
      if (!LEAVE_APPROVERS.includes(email)) { await dmUser(userId, { text: 'Team balances are visible to leave approvers only.' }); return; }
      await openTeamBalancesModal(trigger_id);
      return;
    }
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

  if (payload.type === 'view_submission' && payload.view.callback_id === 'reject_reason_submit') {
    const result = await handleRejectReason(payload);
    return Response.json(result);
  }

  // Close modal views that don't need processing
  if (payload.type === 'view_submission' && ['balances_view', 'team_balances_view', 'my_leave_view', 'holidays_view', 'policy_view', 'subscribe_view'].includes(payload.view?.callback_id)) {
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

    const cancelMatch = action.action_id?.match(/^cancel_leave_(\d+)$/);
    if (cancelMatch) {
      const [, leaveId] = cancelMatch;
      let email = payload.user?.profile?.email || '';
      if (!email && payload.user?.id) {
        try {
          const res = await fetch(`${SLACK_API}/users.info?user=${payload.user.id}`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
          const d = await res.json();
          email = d.user?.profile?.email || '';
        } catch {}
      }
      // Reuse the same service-key endpoint the dashboard uses (ownership + future-only + notifications)
      try {
        await fetch('https://attimo-ops.vercel.app/api/cancel-leave', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: leaveId, email })
        });
      } catch (e) { console.error('[slack-interactive] cancel-leave call failed:', e); }
      // Refresh the My Leave modal in place
      if (payload.view?.id) {
        try {
          const blocks = await myLeaveBlocks(email);
          await slackAPI('views.update', { view_id: payload.view.id, view: { type: 'modal', callback_id: 'my_leave_view', title: { type: 'plain_text', text: 'My Leave' }, close: { type: 'plain_text', text: 'Close' }, blocks } });
        } catch (e) { console.error('[slack-interactive] views.update failed:', e); }
      }
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

      // Idempotency: if already decided (e.g. a stale button on an old request), do nothing but tidy the message
      if (leave.status && leave.status !== 'pending') {
        if (payload.response_url) {
          try {
            await fetch(payload.response_url, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                replace_original: true,
                blocks: [
                  { type: 'header', text: { type: 'plain_text', text: `Leave ${String(leave.status).toUpperCase()}` } },
                  { type: 'section', text: { type: 'mrkdwn', text: `*${leave.person}* — ${leave.leave_type}` } },
                  { type: 'context', elements: [{ type: 'mrkdwn', text: `Already ${leave.status}${leave.approved_by ? ` by ${leave.approved_by}` : ''} — no action taken` }] }
                ]
              })
            });
          } catch {}
        }
        return Response.json({});
      }

      const { data: requester } = await supabase.from('user_roles').select('manager_email').ilike('email', leave.email).maybeSingle();
      const allowedApprovers = [requester?.manager_email, 'efehan@attimo.com'].filter(Boolean).map(e => e.toLowerCase());
      if (finalEmail && !allowedApprovers.includes(finalEmail.toLowerCase())) {
        return Response.json({ response_type: 'ephemeral', text: 'Only the manager or Efehan can act on this.' });
      }

      // Reject → ask for a reason first (modal); the rejection is applied on submit
      if (decision === 'reject') {
        await slackAPI('views.open', {
          trigger_id: payload.trigger_id,
          view: {
            type: 'modal',
            callback_id: 'reject_reason_submit',
            private_metadata: JSON.stringify({ leaveId, approverName, approverEmail: finalEmail, responseUrl: payload.response_url }),
            title: { type: 'plain_text', text: 'Reject Leave' },
            submit: { type: 'plain_text', text: 'Reject' },
            close: { type: 'plain_text', text: 'Cancel' },
            blocks: [
              { type: 'section', text: { type: 'mrkdwn', text: `Rejecting *${leave.person}*'s ${isShort(leave) ? 'short leave' : leave.leave_type} request (${isShort(leave) ? `${isoToDateLabel(leave.start_date)} · ${shortWindow(leave)}` : `${isoToDateLabel(leave.start_date)}${leave.start_date !== leave.end_date ? ` → ${isoToDateLabel(leave.end_date)}` : ''}`}).` } },
              { type: 'input', block_id: 'rr', label: { type: 'plain_text', text: 'Reason for rejection' }, element: { type: 'plain_text_input', action_id: 'value', multiline: true, placeholder: { type: 'plain_text', text: 'Shared with the requester' } } }
            ]
          }
        });
        return Response.json({});
      }

      // Approve → immediate
      await supabase.from('leaves').update({
        status: 'approved', approved_by: approverName, approved_by_email: finalEmail
      }).eq('id', leaveId);

      // MUST await — these DMs + #general post die if left to run after return
      try { await sendApprovalDecision(leave, 'approved', { email: finalEmail, name: approverName }); }
      catch (e) { console.error('[slack-interactive] Approval decision err:', e); }

      // Blank the buttons on every copy of the request (this DM, other approvers' DMs, #hr-module)
      try { await clearApproverButtons(leave, 'approved', approverName); }
      catch (e) { console.error('[slack-interactive] clear buttons err:', e); }

      // Force-clear the clicked message via response_url too (robust to slow responses / missing stored IDs)
      if (payload.response_url) {
        try {
          await fetch(payload.response_url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              replace_original: true,
              blocks: [
                { type: 'header', text: { type: 'plain_text', text: 'Leave APPROVED' } },
                { type: 'section', fields: [
                  { type: 'mrkdwn', text: `*Requester:*\n${leave.person}` },
                  { type: 'mrkdwn', text: `*Type:*\n${leave.leave_type}` },
                  { type: 'mrkdwn', text: `*${isShort(leave) ? 'When' : 'Dates'}:*\n${isShort(leave) ? `${isoToDateLabel(leave.start_date)} · ${shortWindow(leave)}` : `${isoToDateLabel(leave.start_date)}${leave.start_date !== leave.end_date ? ` → ${isoToDateLabel(leave.end_date)}` : ''}`}` }
                ] },
                { type: 'context', elements: [{ type: 'mrkdwn', text: `Decision: *APPROVED* by ${approverName}` }] }
              ]
            })
          });
        } catch (e) { console.error('[approve] response_url err', e); }
      }

      return Response.json({
        replace_original: true,
        blocks: [
          { type: 'header', text: { type: 'plain_text', text: 'Leave APPROVED' } },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Requester:*\n${leave.person}` },
              { type: 'mrkdwn', text: `*Type:*\n${leave.leave_type}` },
              { type: 'mrkdwn', text: `*${isShort(leave) ? 'When' : 'Dates'}:*\n${isShort(leave) ? `${isoToDateLabel(leave.start_date)} · ${shortWindow(leave)}` : `${isoToDateLabel(leave.start_date)}${leave.start_date !== leave.end_date ? ` → ${isoToDateLabel(leave.end_date)}` : ''}`}` }
            ]
          },
          { type: 'context', elements: [{ type: 'mrkdwn', text: `Decision: *APPROVED* by ${approverName}` }] }
        ]
      });
    }

    const holMatch = action.action_id?.match(/^holiday_(approve|reject)_(\d+)$/);
    if (holMatch) {
      const [, decision, reqId] = holMatch;
      const approverName = payload.user?.name || payload.user?.username || '';
      let approverEmail = payload.user?.profile?.email || payload.user?.email || '';
      if (!approverEmail && payload.user?.id) {
        try {
          const res = await fetch(`${SLACK_API}/users.info?user=${payload.user.id}`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
          const d = await res.json();
          approverEmail = d.user?.profile?.email || '';
        } catch {}
      }
      const HOL_APPROVERS = ['efehan@attimo.com', 'laraib@attimo.com'];
      if (approverEmail && !HOL_APPROVERS.includes(approverEmail.toLowerCase())) {
        return Response.json({ response_type: 'ephemeral', text: 'Only Efehan or Laraib can decide public holidays.' });
      }
      const { data: hr } = await supabase.from('holiday_requests').select('*').eq('id', reqId).single();
      if (!hr) return Response.json({ response_type: 'ephemeral', text: 'Holiday request not found.' });
      if (hr.status !== 'pending') {
        return Response.json({ replace_original: true, blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `This holiday was already *${hr.status}*.` } }] });
      }
      const newStatus = decision === 'approve' ? 'approved' : 'rejected';
      await supabase.from('holiday_requests').update({ status: newStatus, decided_by: approverName }).eq('id', reqId);
      if (newStatus === 'approved') {
        try { await announceHoliday(hr); } catch (e) { console.error('[holiday] announce err', e); }
      }
      try { await clearHolidayButtons(hr, newStatus, approverName); } catch (e) { console.error('[holiday] clear err', e); }
      if (payload.response_url) {
        try {
          await fetch(payload.response_url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              replace_original: true,
              blocks: [
                { type: 'header', text: { type: 'plain_text', text: `Holiday ${newStatus.toUpperCase()}` } },
                { type: 'section', text: { type: 'mrkdwn', text: `*${hr.name}* (${hr.country}) on ${isoToDateLabel(hr.hol_date)}` } },
                { type: 'context', elements: [{ type: 'mrkdwn', text: `${newStatus === 'approved' ? 'Approved — announced in #general' : 'Rejected — not announced'} by ${approverName}` }] }
              ]
            })
          });
        } catch (e) { console.error('[holiday] response_url err', e); }
      }
      return Response.json({
        replace_original: true,
        blocks: [
          { type: 'header', text: { type: 'plain_text', text: `Holiday ${newStatus.toUpperCase()}` } },
          { type: 'section', text: { type: 'mrkdwn', text: `*${hr.name}* (${hr.country}) on ${isoToDateLabel(hr.hol_date)}` } },
          { type: 'context', elements: [{ type: 'mrkdwn', text: `${newStatus === 'approved' ? 'Approved — announced in #general' : 'Rejected — not announced'} by ${approverName}` }] }
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
