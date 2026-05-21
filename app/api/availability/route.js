// ─── Team Availability API ───────────────────────────────────────────────────
// Fetches Slack user profiles: avatar, timezone, status, presence

export async function GET() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return Response.json({ users: [], error: 'No SLACK_BOT_TOKEN' });

  try {
    // Fetch all workspace members
    const res = await fetch('https://slack.com/api/users.list?limit=200', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.ok) return Response.json({ users: [], error: data.error });

    const users = (data.members || [])
      .filter(m => !m.deleted && !m.is_bot && m.id !== 'USLACKBOT')
      .map(m => {
        const p = m.profile || {};
        return {
          id: m.id,
          email: p.email || '',
          name: m.real_name || p.real_name || p.display_name || '',
          display_name: p.display_name || '',
          // Avatar: try largest first, fall back to smaller
          avatar: p.image_192 || p.image_72 || p.image_512 || p.image_48 || p.image_24 || '',
          avatar_original: p.image_original || p.image_512 || '',
          tz: m.tz || 'UTC',
          tz_label: m.tz_label || '',
          tz_offset: m.tz_offset || 0,
          status_text: p.status_text || '',
          status_emoji: p.status_emoji || '',
          title: p.title || '',
          phone: p.phone || '',
          is_admin: m.is_admin || false,
          updated: m.updated || 0,
          // Map presence/status
          presence: m.presence || 'away',
          mapped_status: p.status_emoji === ':palm_tree:' ? 'off'
            : p.status_emoji === ':coffee:' ? 'break'
            : p.status_emoji === ':calendar:' || p.status_text?.toLowerCase().includes('meeting') ? 'meeting'
            : (p.status_text || '').toLowerCase().includes('focus') ? 'working'
            : 'working'
        };
      });

    return Response.json({ users, count: users.length, timestamp: new Date().toISOString() });
  } catch (e) {
    return Response.json({ users: [], error: e.message });
  }
}
