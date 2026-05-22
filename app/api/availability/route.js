// ─── Team Availability API ───────────────────────────────────────────────────
// Fetches Slack user profiles + REAL presence (online/away)

export async function GET() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return Response.json({ users: [], error: 'No SLACK_BOT_TOKEN' });

  try {
    // Step 1: Get all workspace members
    const res = await fetch('https://slack.com/api/users.list?limit=200', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.ok) return Response.json({ users: [], error: data.error });

    const members = (data.members || [])
      .filter(m => !m.deleted && !m.is_bot && m.id !== 'USLACKBOT');

    // Step 2: Get real presence for each user (batch, max 20 concurrent)
    const presenceMap = {};
    const chunks = [];
    for (let i = 0; i < members.length; i += 10) {
      chunks.push(members.slice(i, i + 10));
    }
    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(async m => {
          try {
            const pr = await fetch(`https://slack.com/api/users.getPresence?user=${m.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const pd = await pr.json();
            return { id: m.id, presence: pd.presence || 'away', online: pd.online || false };
          } catch {
            return { id: m.id, presence: 'away', online: false };
          }
        })
      );
      results.forEach(r => {
        if (r.status === 'fulfilled') presenceMap[r.value.id] = r.value;
      });
    }

    // Step 3: Build user list with accurate status
    const users = members.map(m => {
      const p = m.profile || {};
      const pres = presenceMap[m.id] || { presence: 'away', online: false };
      const isActive = pres.presence === 'active';
      const statusText = (p.status_text || '').toLowerCase();
      const statusEmoji = p.status_emoji || '';

      // Determine mapped status based on:
      // 1. Explicit status emoji (palm_tree=off, coffee=break, calendar=meeting)
      // 2. Status text keywords
      // 3. Actual Slack presence (active vs away)
      let mapped_status;
      if (statusEmoji === ':palm_tree:' || statusEmoji === ':desert_island:' || statusText.includes('vacation') || statusText.includes('leave') || statusText.includes('off')) {
        mapped_status = 'off';
      } else if (statusEmoji === ':coffee:' || statusEmoji === ':tea:' || statusText.includes('lunch') || statusText.includes('break') || statusText.includes('brb')) {
        mapped_status = 'break';
      } else if (statusEmoji === ':calendar:' || statusEmoji === ':spiral_calendar_pad:' || statusText.includes('meeting') || statusText.includes('call') || statusText.includes('huddle')) {
        mapped_status = 'meeting';
      } else if (isActive) {
        mapped_status = 'working';
      } else {
        mapped_status = 'offline';
      }

      return {
        id: m.id,
        email: p.email || '',
        name: m.real_name || p.real_name || p.display_name || '',
        display_name: p.display_name || '',
        avatar: p.image_192 || p.image_72 || p.image_512 || p.image_48 || '',
        tz: m.tz || 'UTC',
        tz_label: m.tz_label || '',
        tz_offset: m.tz_offset || 0,
        status_text: p.status_text || '',
        status_emoji: p.status_emoji || '',
        title: p.title || '',
        phone: p.phone || '',
        is_admin: m.is_admin || false,
        presence: pres.presence,
        is_online: isActive,
        mapped_status,
      };
    });

    return Response.json({ users, count: users.length, timestamp: new Date().toISOString() });
  } catch (e) {
    return Response.json({ users: [], error: e.message });
  }
}
