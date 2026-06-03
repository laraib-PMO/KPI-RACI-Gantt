// ─── Meeting Reminder Route — DM all attendees a Slack reminder ─────────────
// POST /api/meeting-reminder
// Body: { meeting_id, meeting_name, when, duration, location, calendar_link, attendees_emails:[] }

const SLACK_API = 'https://slack.com/api';

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

async function slackDM(userId, blocks, fallback) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token || !userId) return { ok: false };
  const res = await fetch(`${SLACK_API}/chat.postMessage`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: userId, blocks, text: fallback, unfurl_links: false })
  });
  return await res.json();
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { meeting_name, when, duration, location, calendar_link, attendees_emails } = body;

    if (!attendees_emails || attendees_emails.length === 0) {
      return Response.json({ ok: false, error: 'No attendees' });
    }

    const fallback = `📅 Reminder: ${meeting_name} ${when ? `(${when})` : ''}`;
    const blocks = [
      { type: 'header', text: { type: 'plain_text', text: `📅 ${meeting_name || 'Meeting Reminder'}` } },
      {
        type: 'section',
        fields: [
          ...(when ? [{ type: 'mrkdwn', text: `*When:*\n${when}` }] : []),
          ...(duration ? [{ type: 'mrkdwn', text: `*Duration:*\n${duration}` }] : []),
          ...(location ? [{ type: 'mrkdwn', text: `*Where:*\n${location}` }] : [])
        ]
      },
      ...(calendar_link ? [{
        type: 'actions',
        elements: [{
          type: 'button',
          text: { type: 'plain_text', text: '📅 Open in Calendar' },
          url: calendar_link,
          action_id: 'open_calendar'
        }]
      }] : []),
      { type: 'context', elements: [{ type: 'mrkdwn', text: `Reminder sent via Attimo PMO` }] }
    ];

    const results = [];
    for (const email of attendees_emails) {
      const userId = await lookupSlackUser(email);
      if (userId) {
        const res = await slackDM(userId, blocks, fallback);
        results.push({ email, ok: res.ok, error: res.error });
      } else {
        results.push({ email, ok: false, error: 'No Slack user found' });
      }
    }

    return Response.json({ ok: true, sent: results.filter(r => r.ok).length, total: attendees_emails.length, results });
  } catch (e) {
    return Response.json({ ok: false, error: e.message });
  }
}
