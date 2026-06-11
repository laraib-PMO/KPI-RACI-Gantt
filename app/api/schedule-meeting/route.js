// ═══════════════════════════════════════════════════════════════════════════
// /api/schedule-meeting — Creates Google Calendar event + sends Slack DM invites
//
// 1. If GOOGLE_CALENDAR_KEY is set: creates a real Calendar event,
//    invites all attendees, adds fred@fireflies.ai when add_fireflies=true
// 2. Always: DMs every attendee on Slack with the meeting invitation
//
// Graceful degradation: if Calendar isn't configured, Slack invites still go
// out and the response includes hasCalendar:false.
// ═══════════════════════════════════════════════════════════════════════════

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;

// ─── Google Calendar via service account (JWT) ──────────────────────────
async function getGoogleAccessToken() {
  const b64 = process.env.GOOGLE_CALENDAR_KEY;
  if (!b64) return null;
  try {
    const sa = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claims = Buffer.from(JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/calendar',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })).toString('base64url');

    const crypto = await import('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${claims}`);
    const signature = sign.sign(sa.private_key, 'base64url');
    const jwt = `${header}.${claims}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    const data = await res.json();
    return data.access_token || null;
  } catch (e) {
    console.error('[schedule-meeting] Google auth failed:', e.message);
    return null;
  }
}

// ─── Slack helpers ──────────────────────────────────────────────────────
async function slackCall(method, body) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SLACK_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function lookupSlackId(email) {
  try {
    const res = await fetch(`https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
      headers: { 'Authorization': `Bearer ${SLACK_TOKEN}` },
    });
    const data = await res.json();
    return data.ok ? data.user.id : null;
  } catch { return null; }
}

function fmtWhen(start, recurrence, duration) {
  if (recurrence) return `${recurrence} | ${duration} min`;
  if (!start) return `${duration} min`;
  try {
    const d = new Date(start);
    return d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }) + ` (TRT) | ${duration} min`;
  } catch { return `${start} | ${duration} min`; }
}

// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      title, description, start, duration_minutes = 30,
      attendees = [], location, add_fireflies = false, recurrence = null,
      channel_post = false, calendar_url = '',
    } = body;

    if (!title) {
      return Response.json({ ok: false, error: 'Missing title' }, { status: 400 });
    }

    const result = { ok: true, hasCalendar: false, slackInvites: 0, slackFailed: [] };

    // ── 1. Google Calendar event (optional) ───────────────────────────
    const token = await getGoogleAccessToken();
    if (token && start) {
      try {
        const startDt = new Date(start);
        const endDt = new Date(startDt.getTime() + duration_minutes * 60000);
        const eventAttendees = attendees.map(email => ({ email }));
        if (add_fireflies) eventAttendees.push({ email: 'fred@fireflies.ai' });

        const event = {
          summary: title,
          description: description || '',
          location: location || '',
          start: { dateTime: startDt.toISOString(), timeZone: 'Europe/Istanbul' },
          end: { dateTime: endDt.toISOString(), timeZone: 'Europe/Istanbul' },
          attendees: eventAttendees,
          conferenceData: location === 'Google Meet' ? {
            createRequest: { requestId: `attimo-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } }
          } : undefined,
        };

        if (recurrence) {
          const freq = { 'Daily': 'DAILY', 'Weekly': 'WEEKLY', 'Bi-weekly': 'WEEKLY;INTERVAL=2', 'Monthly': 'MONTHLY' }[recurrence];
          if (freq) event.recurrence = [`RRULE:FREQ=${freq}`];
        }

        const calRes = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all&conferenceDataVersion=1',
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(event),
          }
        );
        const calData = await calRes.json();
        if (calData.id) {
          result.hasCalendar = true;
          result.eventId = calData.id;
          result.htmlLink = calData.htmlLink;
          result.meetLink = calData.hangoutLink || null;
        } else {
          console.error('[schedule-meeting] Calendar create failed:', calData.error?.message);
          result.calendarError = calData.error?.message || 'unknown';
        }
      } catch (e) {
        console.error('[schedule-meeting] Calendar error:', e.message);
        result.calendarError = e.message;
      }
    }

    // ── 2. Slack DM invitations to every attendee ──────────────────────
    if (SLACK_TOKEN && attendees.length > 0) {
      const when = fmtWhen(start, recurrence, duration_minutes);
      const joinLine = result.meetLink ? `\nJoin: ${result.meetLink}` : (location && location !== 'In-person' ? `\nLocation: ${location}` : location === 'In-person' ? '\nLocation: In-person' : '');
      const calLine = result.htmlLink ? `\nCalendar: ${result.htmlLink}` : (calendar_url ? `\nAdd to your calendar: ${calendar_url}` : '');
      const ffLine = add_fireflies ? '\nFireflies notetaker will join this meeting.' : '';

      for (const email of attendees) {
        const slackId = await lookupSlackId(email);
        if (!slackId) { result.slackFailed.push(email); continue; }

        const msg = await slackCall('chat.postMessage', {
          channel: slackId,
          text: `Meeting invitation: ${title}`,
          blocks: [
            { type: 'section', text: { type: 'mrkdwn', text: `*[MEETING INVITATION]*\n*${title}*` } },
            { type: 'section', text: { type: 'mrkdwn', text: `When: ${when}${joinLine}${calLine}${description ? `\n\nAgenda: ${description}` : ''}${ffLine}` } },
            { type: 'context', elements: [{ type: 'mrkdwn', text: 'Sent from Attimo Ops Hub' }] },
          ],
        });
        if (msg.ok) result.slackInvites++;
        else result.slackFailed.push(email);
      }
    }

    // ── 3. Channel announcement (#pmo) ──────────────────────────────────
    if (SLACK_TOKEN && channel_post) {
      const when = fmtWhen(start, recurrence, duration_minutes);
      const ann = await slackCall('chat.postMessage', {
        channel: '#pmo',
        text: `New meeting scheduled: ${title}`,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: `*[MEETING SCHEDULED]*\n*${title}*\nWhen: ${when}${attendees.length ? `\nAttendees: ${attendees.length} invited` : ''}` } },
          { type: 'context', elements: [{ type: 'mrkdwn', text: 'Sent from Attimo Ops Hub' }] },
        ],
      });
      result.channelPosted = !!ann.ok;
      if (!ann.ok) result.channelError = ann.error;
    }

    return Response.json(result);
  } catch (err) {
    console.error('[schedule-meeting] Error:', err);
    return Response.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
