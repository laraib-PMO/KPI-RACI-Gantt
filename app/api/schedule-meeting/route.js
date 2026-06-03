// ─── Schedule Meeting API — Creates Google Calendar event with Meet link ─────
// Accepts the rich payload from MeetingModal in page.jsx
// Requires GOOGLE_CALENDAR_KEY (base64-encoded service account JSON)

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

async function getGoogleAccessToken() {
  const keyB64 = process.env.GOOGLE_CALENDAR_KEY;
  if (!keyB64) return null;
  try {
    const key = JSON.parse(Buffer.from(keyB64, 'base64').toString());
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claims = Buffer.from(JSON.stringify({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600
    })).toString('base64url');
    const crypto = require('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(header + '.' + claims);
    const signature = sign.sign(key.private_key, 'base64url');
    const jwt = header + '.' + claims + '.' + signature;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });
    const tokenData = await tokenRes.json();
    return tokenData.access_token || null;
  } catch (e) { console.error('Google auth error:', e); return null; }
}

const CADENCE_RRULE = {
  Daily: 'RRULE:FREQ=DAILY',
  Weekly: 'RRULE:FREQ=WEEKLY',
  'Bi-weekly': 'RRULE:FREQ=WEEKLY;INTERVAL=2',
  Monthly: 'RRULE:FREQ=MONTHLY'
};

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      title,
      description,
      start,            // ISO datetime, e.g. "2026-06-15T10:00:00"
      duration_minutes,
      attendees = [],   // array of emails
      location,
      add_fireflies,
      recurrence        // null or "Weekly" / "Bi-weekly" etc.
    } = body;

    if (!title || !start) {
      return Response.json({ ok: false, error: 'title and start required' });
    }

    const startDate = new Date(start);
    const endDate = new Date(startDate.getTime() + (duration_minutes || 30) * 60000);

    // Add Fireflies bot to attendees if requested
    const allAttendees = [...attendees];
    if (add_fireflies && !allAttendees.includes('fred@fireflies.ai')) {
      allAttendees.push('fred@fireflies.ai');
    }

    const event = {
      summary: title,
      description: description || '',
      location: location || '',
      start: { dateTime: startDate.toISOString(), timeZone: 'Europe/Istanbul' },
      end: { dateTime: endDate.toISOString(), timeZone: 'Europe/Istanbul' },
      attendees: allAttendees.map(email => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: 'mt-' + Date.now(),
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      },
      ...(recurrence && CADENCE_RRULE[recurrence] ? { recurrence: [CADENCE_RRULE[recurrence]] } : {})
    };

    const token = await getGoogleAccessToken();
    if (!token) {
      // No Google credentials — return a fallback Add-to-Calendar link
      const fallback = `https://calendar.google.com/calendar/r/eventedit?text=${encodeURIComponent(title)}&dates=${startDate.toISOString().replace(/[-:]/g,'').split('.')[0]}Z/${endDate.toISOString().replace(/[-:]/g,'').split('.')[0]}Z&details=${encodeURIComponent(description || '')}&add=${encodeURIComponent(allAttendees.join(','))}`;
      return Response.json({ ok: true, htmlLink: fallback, eventId: null, fallback: true, note: 'GOOGLE_CALENDAR_KEY not set — returning Add-to-Calendar link' });
    }

    // Use organizer's calendar (service account's primary, or domain-delegated)
    const calRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });

    const data = await calRes.json();
    if (!calRes.ok) {
      console.error('Calendar create error:', data);
      return Response.json({ ok: false, error: data.error?.message || 'Calendar create failed' });
    }

    return Response.json({
      ok: true,
      htmlLink: data.htmlLink,
      eventId: data.id,
      meetLink: data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || null
    });
  } catch (e) {
    return Response.json({ ok: false, error: e.message });
  }
}
