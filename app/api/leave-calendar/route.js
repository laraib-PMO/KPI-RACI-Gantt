// ─── /api/leave-calendar — ICS feed of all approved leave ──────────────────
// Subscribe once (Google/Apple/Outlook) and every approved leave appears
// automatically. Served as text/calendar so calendar apps can poll it.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

function fold(line) {
  // ICS lines should not exceed 75 octets; fold long ones
  if (line.length <= 73) return line;
  const parts = [];
  let s = line;
  parts.push(s.slice(0, 73));
  s = s.slice(73);
  while (s.length > 72) { parts.push(' ' + s.slice(0, 72)); s = s.slice(72); }
  if (s.length) parts.push(' ' + s);
  return parts.join('\r\n');
}

function esc(text) {
  return String(text || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function ymd(dateStr) {
  return dateStr.replace(/-/g, '');
}

function plusOneDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0].replace(/-/g, '');
}

export async function GET() {
  let leaves = [];
  try {
    const { data } = await supabase
      .from('leaves')
      .select('id, person, leave_type, half_day, start_date, end_date, reason, status')
      .eq('status', 'approved')
      .order('start_date', { ascending: true });
    leaves = data || [];
  } catch (e) {
    console.error('[leave-calendar] query failed:', e.message);
  }

  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Attimo//PMO Leave//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Attimo Team Leave',
    'X-WR-TIMEZONE:Europe/Istanbul',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H'
  ];

  for (const l of leaves) {
    const summary = `${l.person} — ${l.leave_type}${l.half_day ? ' (half day)' : ''}`;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:leave-${l.id}@attimo-ops.vercel.app`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART;VALUE=DATE:${ymd(l.start_date)}`);
    lines.push(`DTEND;VALUE=DATE:${plusOneDay(l.end_date)}`); // DTEND is exclusive for all-day
    lines.push(fold(`SUMMARY:${esc(summary)}`));
    if (l.reason) lines.push(fold(`DESCRIPTION:${esc(l.reason)}`));
    lines.push('TRANSP:TRANSPARENT');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  const body = lines.join('\r\n');

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="attimo-leave.ics"',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
