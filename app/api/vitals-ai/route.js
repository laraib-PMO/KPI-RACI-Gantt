// ═══════════════════════════════════════════════════════════════════════════
// /api/vitals-ai — Vitals AI assistant (Gemini 3.5 Flash, streaming)
// GET  -> { ok, configured, model }
// POST { question, context, history } -> streams the answer as text/plain
//        (or returns JSON { ok:false, ... } for the not-configured / error case)
// Gemini 3 charges "thinking" tokens against maxOutputTokens, so we keep
// thinking LOW and give a generous budget to avoid truncated answers.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODEL = 'gemini-3.5-flash';
const STREAM_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`;

const SYSTEM = `You are the operations analyst for Attimo, an early-stage AEC-AI startup building Panovia. You answer questions for the PMO and leadership using ONLY the operational data in the DATA block provided in the user's message (team, tasks, risks, leaves, decisions, KPIs, open roles, department velocity, per-person performance, and cash on hand).

Answer style:
- Be thorough and specific. Organise with "##" sub-headings and bullet lists. Include concrete names, numbers, and dates from the DATA, and briefly explain the "so what", not just the raw figure.
- Every sentence must carry information grounded in the DATA. No generic filler.
- If the DATA does not contain something, say so in one line rather than guessing. Never invent names, numbers, dates, or facts.
- When ranking people, state the metric you used and note these are current standings from tracked Linear/Asana work (cumulative, not a formal review; task sizes and roles differ).
- No emojis.

References (required):
- End every answer with a "## References" section — a bullet list of the exact DATA points you used, each as "- [Category] specific item — detail". For example:
  - "- [Risk] Design chain zero buffer — HIGH, owner Tunç"
  - "- [Task] Freemium scope — due 2026-07-03, owner Farman, overdue"
  - "- [Performance] Talha Mubeen — 448 completed, 96% on-time"
  - "- [Leave] Claire Eskander — annual, 2026-07-05 to 2026-07-09"
- Only list references that genuinely appear in the DATA. If you used no specific record, write "- [General] no specific records used".`;

export async function GET() {
  return Response.json({ ok: true, configured: !!process.env.GEMINI_API_KEY, model: MODEL });
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'Bad request.' }, { status: 200 }); }
  const { question, context, history } = body || {};

  if (!question || !String(question).trim()) {
    return Response.json({ ok: false, error: 'Please type a question.' }, { status: 200 });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return Response.json({
      ok: false, notConfigured: true,
      answer: 'The assistant is not switched on yet. Add GEMINI_API_KEY in Vercel (Settings -> Environment Variables), redeploy, and it will answer from your live platform data.'
    }, { status: 200 });
  }

  const ctxStr = typeof context === 'string' ? context : JSON.stringify(context || {});
  const priorTurns = Array.isArray(history)
    ? history.slice(-8).map(h => `${h.role === 'user' ? 'Q' : 'A'}: ${h.text}`).join('\n')
    : '';

  const userText = `=== DATA (current platform snapshot) ===
${ctxStr}
=== END DATA ===
${priorTurns ? `\nRecent conversation:\n${priorTurns}\n` : ''}
Question: ${question}`;

  let upstream;
  try {
    upstream = await fetch(STREAM_URL, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 4096,
          thinkingConfig: { thinkingLevel: 'LOW', includeThoughts: false }
        }
      })
    });
  } catch (e) {
    return Response.json({ ok: false, error: 'Could not reach the model: ' + (e.message || 'network error') }, { status: 200 });
  }

  if (!upstream.ok || !upstream.body) {
    let msg = `The model returned status ${upstream.status}.`;
    try { const j = await upstream.json(); msg = j?.error?.message || msg; } catch {}
    return Response.json({ ok: false, error: msg }, { status: 200 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();
  let buffer = '';

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) { controller.close(); return; }
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const obj = JSON.parse(payload);
            const text = (obj?.candidates?.[0]?.content?.parts || []).map(p => p.text).filter(Boolean).join('');
            if (text) controller.enqueue(encoder.encode(text));
          } catch { /* partial JSON split across reads — safe to skip */ }
        }
      } catch (e) {
        controller.error(e);
      }
    },
    cancel() { try { reader.cancel(); } catch {} }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no'
    }
  });
}
