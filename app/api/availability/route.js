// Fetches Slack presence + status for all team members
// Maps to: working, meeting, break, off, offline

const E2S = {
  // Map Attimo emails to Slack display names for matching
  // This will be matched against Slack real_name or email
};

function mapStatus(presence, statusText, statusEmoji) {
  // Custom status takes priority
  const st = (statusText || '').toLowerCase();
  const em = statusEmoji || '';

  if (em === ':palm_tree:' || em === ':airplane:' || st.includes('vacation') || st.includes('leave') || st.includes('off') || st.includes('pto'))
    return 'off';
  if (em === ':calendar:' || em === ':spiral_calendar_pad:' || st.includes('meeting') || st.includes('call') || st.includes('huddle'))
    return 'meeting';
  if (em === ':coffee:' || em === ':hamburger:' || st.includes('lunch') || st.includes('break') || st.includes('brb') || st.includes('away'))
    return 'break';
  if (presence === 'active')
    return 'working';
  return 'offline';
}

export async function GET() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return Response.json({ error: 'No SLACK_BOT_TOKEN', users: [] });

  try {
    // Fetch all workspace users
    const listRes = await fetch('https://slack.com/api/users.list?limit=100', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const listData = await listRes.json();
    if (!listData.ok) return Response.json({ error: listData.error, users: [] });

    const members = (listData.members || []).filter(m => !m.is_bot && !m.deleted && m.id !== 'USLACKBOT');

    // Fetch presence for each user (parallel, batched)
    const results = await Promise.all(members.map(async m => {
      try {
        const presRes = await fetch(`https://slack.com/api/users.getPresence?user=${m.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const presData = await presRes.json();

        const status = mapStatus(
          presData.presence || 'away',
          m.profile?.status_text || '',
          m.profile?.status_emoji || ''
        );

        return {
          slack_id: m.id,
          name: m.real_name || m.name,
          email: m.profile?.email || '',
          avatar: m.profile?.image_72 || '',
          presence: presData.presence || 'away',
          status_text: m.profile?.status_text || '',
          status_emoji: m.profile?.status_emoji || '',
          mapped_status: status
        };
      } catch {
        return {
          slack_id: m.id,
          name: m.real_name || m.name,
          email: m.profile?.email || '',
          avatar: '',
          presence: 'away',
          status_text: '',
          status_emoji: '',
          mapped_status: 'offline'
        };
      }
    }));

    return Response.json({ users: results, timestamp: new Date().toISOString() });
  } catch (e) {
    return Response.json({ error: e.message, users: [] });
  }
}
