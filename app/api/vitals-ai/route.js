// ═══════════════════════════════════════════════════════════════════════════
// /api/vitals-ai — Vitals AI assistant (Gemini 3.5 Flash)
// POST { question, context, history } -> { ok, answer }
// GET -> { ok, configured, model }
// Notes:
//  - Gemini 3 enables "thinking" by default and thinking tokens are charged
//    against maxOutputTokens (a COMBINED budget). Low limits => answers get
//    truncated mid-sentence (finishReason MAX_TOKENS). We keep thinking LOW and
//    give a generous output budget so the full answer always fits.
//  - Degrades gracefully when GEMINI_API_KEY is absent.
// ═══════════════════════════════════════════════════════════════════════════

const MODEL = 'gemini-3.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM = `You are the operations analyst for Attimo, an early-stage AEC-AI startup building Panovia. You answer questions for the PMO and leadership using ONLY the operational data in the DATA block provided in the user's message (team, tasks, risks, leaves, decisions, KPIs, open roles, department velocity, per-person performance, and cash on hand).

Rules:
- Base every statement strictly on the DATA. If the data does not contain the answer, say so plainly in one line. Never invent names, numbers, dates, or facts.
- Be concise and direct, like a chief-of-staff briefing.
- Format with clean Markdown: short **bold** labels or "##" sub-headings, tight bullet lists ("- item"), and short paragraphs. Do not write huge walls of text.
- When naming a top performer or ranking people, use the performance figures provided and state the metric you used (e.g. completed count, on-time rate). Make clear these are current standings from tracked Linear/Asana work, not a formal review, and that task sizes and roles differ.
- No emojis.
- If asked something outside the data (general advice or knowledge), answer briefly but flag that it is outside the platform data.`;

export async function GET() {
  return Response.json({ ok: true, configured: !!process.env.GEMINI_API_KEY, model: MODEL });
}

export async function POST(req) {
  try {
    const { question, context, history } = await req.json();

    if (!question || !String(question).trim()) {
      return Response.json({ ok: false, error: 'Please type a question.' }, { status: 200 });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return Response.json({
        ok: false,
        notConfigured: true,
        answer: 'The assistant is not switched on yet. Add GEMINI_API_KEY in Vercel (Settings -> Environment Variables), redeploy, and it will start answering from your live platform data.'
      }, { status: 200 });
    }

    const ctxStr = typeof context === 'string' ? context : JSON.stringify(context || {});
    const priorTurns = Array.isArray(history)
      ? history.slice(-6).map(h => `${h.role === 'user' ? 'Q' : 'A'}: ${h.text}`).join('\n')
      : '';

    const userText = `=== DATA (current platform snapshot) ===
${ctxStr}
=== END DATA ===
${priorTurns ? `\nRecent conversation:\n${priorTurns}\n` : ''}
Question: ${question}`;

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          // Keep thinking minimal so it does not eat the answer budget (Gemini 3 default is HIGH).
          thinkingConfig: { thinkingLevel: 'LOW', includeThoughts: false }
        }
      })
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data?.error?.message || `Gemini returned status ${res.status}.`;
      return Response.json({ ok: false, error: msg }, { status: 200 });
    }

    const cand = data?.candidates?.[0];
    const answer = (cand?.content?.parts || [])
      .map(p => p.text)
      .filter(Boolean)
      .join('')
      .trim();

    if (!answer) {
      const reason = cand?.finishReason;
      const blocked = data?.promptFeedback?.blockReason;
      if (reason === 'MAX_TOKENS') {
        return Response.json({ ok: false, error: 'The answer was too long to finish. Try a more specific question.' }, { status: 200 });
      }
      return Response.json({
        ok: false,
        error: blocked ? `The request was blocked (${blocked}). Try rephrasing.` : 'No answer was returned. Try rephrasing.'
      }, { status: 200 });
    }

    return Response.json({ ok: true, answer });
  } catch (e) {
    return Response.json({ ok: false, error: e.message || 'Unexpected error.' }, { status: 200 });
  }
}
