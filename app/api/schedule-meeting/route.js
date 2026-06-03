// ─── Schedule Meeting API — Creates Google Calendar event from Dashboard ─────
// Creates a Google Calendar event with Google Meet link + attendees
// Requires GOOGLE_CALENDAR_KEY (base64 service account with calendar write scope)

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
  } catch (e) {
    console.error('Google auth error:', e);
    return null;
  }
}

export async function POST(req) {
  try {
    const { title, date, startHour, duration, attendeeEmails, description, organizer } = await req.json();

    if (!title || !date || startHour === undefined || !attendeeEmails?.length) {
      return Response.json({ ok: false, error: 'title, date, startHour, and attendeeEmails required' });
    }

    const token = await getGoogleAccessToken();
    if (!token) {
      return Response.json({ ok: false, error: 'Google Calendar not configured. Set GOOGLE_CALENDAR_KEY env var.' });
    }

    // Build start/end times
    const startTime = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00`);
    const endTime = new Date(startTime.getTime() + (duration || 60) * 60 * 1000);

    // Create the event
    const event = {
      summary: title,
      description: description || `Scheduled from PMO Dashboard by ${organizer || 'PMO'}`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'Europe/Istanbul'
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Europe/Istanbul'
      },
      attendees: attendeeEmails.map(email => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: `pmo-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 10 },
          { method: 'email', minutes: 30 }
        ]
      }
    };

    // Use the organizer's calendar (or primary)
    const calendarId = organizer || 'primary';
    const createRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      }
    );
    const created = await createRes.json();

    if (created.error) {
      return Response.json({ ok: false, error: created.error.message, details: created.error });
    }

    const meetLink = created.hangoutLink || created.conferenceData?.entryPoints?.[0]?.uri || '';

    // Also save to meetings table in Supabase
    await supabase.from('meetings').insert({
      name: title,
      type: 'Ad-hoc',
      schedule: `${date} at ${startHour}:00`,
      duration: `${duration || 60} min`,
      owner: organizer || 'PMO',
      attendees: attendeeEmails.join(', '),
      meeting_link: meetLink
    });

    return Response.json({
      ok: true,
      event: {
        id: created.id,
        title: created.summary,
        start: created.start,
        end: created.end,
        meetLink,
        htmlLink: created.htmlLink
      },
      message: 'Meeting created and calendar invites sent'
    });

  } catch (e) {
    return Response.json({ ok: false, error: e.message });
  }
}
