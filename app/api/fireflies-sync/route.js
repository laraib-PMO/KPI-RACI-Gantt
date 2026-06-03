// ─── Fireflies Sync API — Pulls meeting notes into dashboard ─────────────────
// Fetches transcripts, summaries, action items from Fireflies GraphQL API
// ENV: FIREFLIES_API_KEY (get from Fireflies → Settings → Developer API)
//
// Called by: cron job + manual "Sync" button
// Returns: recent meeting notes with summaries and action items

export async function GET(req) {
  const apiKey = process.env.FIREFLIES_API_KEY;
  if (!apiKey) {
    return Response.json({
      ok: false,
      error: 'No FIREFLIES_API_KEY configured',
      meetings: []
    });
  }

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const days = parseInt(searchParams.get('days') || '7');

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  try {
    // Fetch recent transcripts
    const res = await fetch('https://api.fireflies.ai/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `{
          transcripts(limit: ${limit}) {
            id
            title
            dateString
            duration
            privacy
            host_email
            organizer_email
            speakers {
              id
              name
            }
            sentences {
              speaker_name
              text
              ai_filters {
                task
                question
              }
            }
          }
        }`
      })
    });

    const data = await res.json();
    const transcripts = data?.data?.transcripts || [];

    // Process each transcript into a clean meeting note
    const meetings = transcripts.map(t => {
      const sentences = t.sentences || [];
      const speakers = t.speakers || [];

      // Extract action items (sentences flagged as tasks)
      const actionItems = sentences
        .filter(s => s.ai_filters?.task)
        .map(s => ({ speaker: s.speaker_name, text: s.text }));

      // Extract questions raised
      const questions = sentences
        .filter(s => s.ai_filters?.question)
        .map(s => ({ speaker: s.speaker_name, text: s.text }));

      // Speaker talk time (rough estimate by sentence count)
      const speakerCounts = {};
      sentences.forEach(s => {
        speakerCounts[s.speaker_name] = (speakerCounts[s.speaker_name] || 0) + 1;
      });
      const totalSentences = sentences.length || 1;
      const speakerBreakdown = Object.entries(speakerCounts).map(([name, count]) => ({
        name,
        sentences: count,
        percentage: Math.round((count / totalSentences) * 100)
      })).sort((a, b) => b.sentences - a.sentences);

      // Build a brief summary from first 5 sentences
      const summaryText = sentences.slice(0, 5).map(s => s.text).join(' ').slice(0, 300);

      return {
        id: t.id,
        title: t.title,
        date: t.dateString,
        duration: t.duration ? Math.round(t.duration / 60) + ' min' : 'Unknown',
        host: t.host_email || t.organizer_email || 'Unknown',
        privacy: t.privacy,
        speakers: speakers.map(s => s.name),
        speakerBreakdown,
        actionItems,
        questions,
        summary: summaryText,
        totalSentences: sentences.length,
        firefliesUrl: `https://app.fireflies.ai/view/${t.id}`
      };
    });

    return Response.json({
      ok: true,
      meetings,
      count: meetings.length,
      timestamp: new Date().toISOString()
    });

  } catch (e) {
    return Response.json({
      ok: false,
      error: e.message,
      meetings: []
    });
  }
}
