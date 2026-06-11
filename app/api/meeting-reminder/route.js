// ═══════════════════════════════════════════════════════════════════════════
// /api/meeting-reminder — DMs every attendee of an existing meeting on Slack
// Used by the "Remind" button in the Meetings tab.
// ═══════════════════════════════════════════════════════════════════════════

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;

async function lookupSlackId(email) {
  try {
    const res = await fetch(`https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
      headers: { 'Authorization': `Bearer ${SLACK_TOKEN}` },
    });
    const data = await res.json();
    return data.ok ? data.user.id : null;
  } catch { return null; }
}

export async function POST(req) {
  try {
    if (!SLACK_TOKEN) {
      return Response.json({ ok: false, error: 'SLACK_BOT_TOKEN not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { meeting_name, when, duration, location, calendar_link, attendees_emails = [] } = body;

    if (!meeting_name || attendees_emails.length === 0) {
      return Response.json({ ok: false, error: 'Missing meeting_name or attendees' }, { status: 400 });
    }

    let sent = 0;
    const failed = [];

    const detailLines = [
      when ? `When: ${when}` : null,
      duration ? `Duration: ${duration}` : null,
      location ? `Location: ${location}` : null,
      calendar_link ? `Calendar: ${calendar_link}` : null,
    ].filter(Boolean).join('\n');

    for (const email of attendees_emails) {
      const cleanEmail = (email || '').trim();
      if (!cleanEmail) continue;
      const slackId = await lookupSlackId(cleanEmail);
      if (!slackId) { failed.push(cleanEmail); continue; }

      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SLACK_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: slackId,
          text: `Meeting reminder: ${meeting_name}`,
          blocks: [
            { type: 'section', text: { type: 'mrkdwn', text: `*[MEETING REMINDER]*\n*${meeting_name}*` } },
            { type: 'section', text: { type: 'mrkdwn', text: detailLines || 'See the Ops Hub for details.' } },
            { type: 'context', elements: [{ type: 'mrkdwn', text: 'Sent from Attimo Ops Hub' }] },
          ],
        }),
      });
      const data = await res.json();
      if (data.ok) sent++;
      else failed.push(cleanEmail);
    }

    return Response.json({ ok: true, sent, failed });
  } catch (err) {
    console.error('[meeting-reminder] Error:', err);
    return Response.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
