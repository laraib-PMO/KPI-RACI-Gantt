// ═══════════════════════════════════════════════════════════════════════════
// /api/fireflies-sync — Pulls recent MOMs from Fireflies
//
// Returns last 10 meetings: title, date, duration, AI summary, action items,
// participants, and a direct link to the full transcript in Fireflies.
//
// Requires FIREFLIES_API_KEY in Vercel env vars.
// Get it from: fireflies.ai > Settings > Developer Settings > API Key
// ═══════════════════════════════════════════════════════════════════════════

const FF_API = 'https://api.fireflies.ai/graphql';

export async function GET() {
  try {
    const key = process.env.FIREFLIES_API_KEY;
    if (!key) {
      return Response.json({
        ok: false,
        meetings: [],
        error: 'FIREFLIES_API_KEY not set. Add it in Vercel env vars (fireflies.ai > Settings > Developer Settings).',
      });
    }

    const query = `
      query Transcripts($limit: Int) {
        transcripts(limit: $limit) {
          id
          title
          date
          duration
          transcript_url
          organizer_email
          participants
          summary {
            overview
            action_items
            shorthand_bullet
          }
        }
      }
    `;

    const res = await fetch(FF_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: { limit: 10 } }),
    });

    const json = await res.json();

    if (json.errors) {
      console.error('[fireflies-sync] GraphQL errors:', JSON.stringify(json.errors));
      return Response.json({ ok: false, meetings: [], error: json.errors[0]?.message || 'Fireflies API error' });
    }

    const transcripts = json.data?.transcripts || [];

    const meetings = transcripts.map(t => {
      // Action items come back as one text block; split into lines
      const rawActions = t.summary?.action_items || '';
      const actionItems = rawActions
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 2)
        .map(l => {
          // Fireflies formats lines like "**Name** task text" or "- task text"
          const m = l.match(/^\*\*(.+?)\*\*\s*(.*)$/);
          if (m) return { speaker: m[1], text: m[2] || m[1] };
          return { speaker: '', text: l.replace(/^[-*•]\s*/, '') };
        })
        .filter(a => a.text);

      let dateStr = '';
      try {
        dateStr = new Date(Number(t.date) || t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      } catch { dateStr = String(t.date); }

      const durMin = t.duration ? Math.round(Number(t.duration)) : null;

      return {
        id: t.id,
        title: t.title || 'Untitled meeting',
        date: dateStr,
        duration: durMin ? `${durMin} min` : '',
        speakers: t.participants || [],
        summary: t.summary?.overview || t.summary?.shorthand_bullet || '',
        actionItems,
        firefliesUrl: t.transcript_url || `https://app.fireflies.ai/view/${t.id}`,
        organizer: t.organizer_email || '',
      };
    });

    return Response.json({ ok: true, meetings, count: meetings.length });
  } catch (err) {
    console.error('[fireflies-sync] Error:', err);
    return Response.json({ ok: false, meetings: [], error: 'Failed to reach Fireflies API' }, { status: 500 });
  }
}
