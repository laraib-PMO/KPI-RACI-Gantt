// Fetches full Slack profiles + presence for team availability + profile cards

export async function GET() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return Response.json({ error: 'No SLACK_BOT_TOKEN', users: [] });

  try {
    const listRes = await fetch('https://slack.com/api/users.list?limit=100', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const listData = await listRes.json();
    if (!listData.ok) return Response.json({ error: listData.error, users: [] });

    const members = (listData.members || []).filter(m => !m.is_bot && !m.deleted && m.id !== 'USLACKBOT');

    const results = await Promise.all(members.map(async m => {
      try {
        const presRes = await fetch(`https://slack.com/api/users.getPresence?user=${m.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const presData = await presRes.json();

        const st = (m.profile?.status_text || '').toLowerCase();
        const em = m.profile?.status_emoji || '';
        let mapped = 'offline';
        if (em === ':palm_tree:' || em === ':airplane:' || st.includes('vacation') || st.includes('leave') || st.includes('off') || st.includes('pto'))
          mapped = 'off';
        else if (em === ':calendar:' || em === ':spiral_calendar_pad:' || st.includes('meeting') || st.includes('call') || st.includes('huddle'))
          mapped = 'meeting';
        else if (em === ':coffee:' || em === ':hamburger:' || st.includes('lunch') || st.includes('break') || st.includes('brb') || st.includes('away'))
          mapped = 'break';
        else if (presData.presence === 'active')
          mapped = 'working';

        return {
          slack_id: m.id,
          name: m.real_name || m.profile?.real_name || m.name,
          email: m.profile?.email || '',
          phone: m.profile?.phone || '',
          title: m.profile?.title || '',
          avatar: m.profile?.image_192 || m.profile?.image_72 || '',
          avatar_lg: m.profile?.image_512 || m.profile?.image_192 || '',
          presence: presData.presence || 'away',
          status_text: m.profile?.status_text || '',
          status_emoji: m.profile?.status_emoji || '',
          mapped_status: mapped,
          tz: m.tz || '',
          tz_label: m.tz_label || '',
          tz_offset: m.tz_offset || 0,
          display_name: m.profile?.display_name || '',
          start_date: m.profile?.start_date || '',
          skype: m.profile?.skype || '',
        };
      } catch {
        return {
          slack_id: m.id, name: m.real_name || m.name, email: '', phone: '', title: '',
          avatar: '', avatar_lg: '', presence: 'away', status_text: '', status_emoji: '',
          mapped_status: 'offline', tz: '', tz_label: '', tz_offset: 0, display_name: '', start_date: '', skype: ''
        };
      }
    }));

    return Response.json({ users: results, timestamp: new Date().toISOString() });
  } catch (e) {
    return Response.json({ error: e.message, users: [] });
  }
}
