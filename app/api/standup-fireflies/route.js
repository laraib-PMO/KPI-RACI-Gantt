// app/api/standup-fireflies/route.js
// Pulls the daily standup transcript from Fireflies, splits it per person into
// completed / tomorrow / blockers (one line per distinct task), and writes it into
// the standups table (source='fireflies'). Runs on a Vercel cron and is also
// callable manually. The dashboard cards split each field on newlines, so returning
// per-task line items renders them as separate bullets.

import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY;
const FIREFLIES_API_KEY = process.env.FIREFLIES_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const FIREFLIES_URL = 'https://api.fireflies.ai/graphql';
const TITLE_MATCH = 'standup';        // case-insensitive substring on the meeting title
const TIMEZONE = 'Europe/Istanbul';   // the app computes "today" in Istanbul
const EXCLUDE_EMAILS = ['efehan@attimo.com'];
const EXCLUDE_NAME_HINTS = ['efehan']; // Efehan is excluded from standups

// Common ASR / nickname garbles seen in the transcripts -> canonical fragment.
const ALIASES = {
  lareep: 'laraib', larv: 'laraib', larib: 'laraib', lareb: 'laraib',
  suling: 'soo ling', zuling: 'soo ling', suvik: 'soo ling', sage: 'soo ling',
  saeed: 'syed', seyd: 'syed', osama: 'syed osama',
  ifehan: 'efehan',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Accepts an array (one entry per task) or a string; returns newline-joined text so
// the dashboard renders one bullet per line.
function toLines(x) {
  if (Array.isArray(x)) return x.map((s) => String(s).trim()).filter(Boolean).join('\n');
  return String(x || '').trim();
}

// Turkish-safe, accent-insensitive normaliser.
function normalize(s) {
  return (s || '')
    .toString()
    .replace(/İ/g, 'I').replace(/ı/g, 'i') // dotted/dotless i (NFD won't fold these)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')       // strip remaining diacritics (ş ç ğ ö ü ...)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function applyAlias(nrm) {
  for (const k of Object.keys(ALIASES)) {
    if (nrm === k || nrm.split(' ').includes(k)) return ALIASES[k];
  }
  return nrm;
}

// Match a spoken/summarised name to a user_roles person. Fuzzy tiers only accept
// unique matches so we never mis-assign someone else's update.
function matchPerson(rawName, roles) {
  const nrm = applyAlias(normalize(rawName));
  if (!nrm) return null;
  if (EXCLUDE_NAME_HINTS.some((h) => nrm.includes(h))) return null;
  const tokens = nrm.split(' ').filter(Boolean);

  // 1. exact full-name
  let hit = roles.find((r) => r.nrmName === nrm);
  if (hit) return hit;

  // 2. all tokens of the shorter name contained in the longer
  hit = roles.find((r) => {
    const rt = r.nrmName.split(' ').filter(Boolean);
    const short = tokens.length <= rt.length ? tokens : rt;
    const long = tokens.length <= rt.length ? rt : tokens;
    return short.length > 0 && short.every((t) => long.includes(t));
  });
  if (hit) return hit;

  // 3. unique first-name
  const first = tokens[0];
  const firstHits = roles.filter((r) => r.nrmName.split(' ')[0] === first);
  if (firstHits.length === 1) return firstHits[0];

  // 4. unique surname
  const last = tokens[tokens.length - 1];
  const lastHits = roles.filter((r) => r.nrmName.split(' ').includes(last));
  if (lastHits.length === 1) return lastHits[0];

  return null;
}

async function fireflies(query) {
  const res = await fetch(FIREFLIES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${FIREFLIES_API_KEY}`,
    },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (data.errors) throw new Error('Fireflies API: ' + JSON.stringify(data.errors));
  return data.data;
}

// Istanbul YYYY-MM-DD for a unix-ms timestamp.
function istanbulDay(ms) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(Number(ms)));
}

// Turn sentences into speaker-labelled text for the model.
function buildTranscriptText(sentences) {
  if (!Array.isArray(sentences) || sentences.length === 0) return '';
  const lines = [];
  let last = null;
  for (const s of sentences) {
    const spk = s.speaker_name || 'Unknown';
    const txt = (s.text || '').trim();
    if (!txt) continue;
    if (spk !== last) { lines.push(`\n${spk}: ${txt}`); last = spk; }
    else lines.push(txt);
  }
  return lines.join(' ').trim().slice(0, 100000);
}

// Fallback: Fireflies' own per-person action items -> one "tomorrow" line each.
// Format is "**Name**\nline (mm:ss)\nline\n**Name2**\n...".
function parseActionItems(ai) {
  const out = {};
  if (!ai) return out;
  const parts = ai.split(/\*\*/).map((s) => s.trim()).filter(Boolean);
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const name = parts[i].replace(/[:*]/g, '').trim();
    const lines = parts[i + 1]
      .split('\n')
      .map((l) => l.replace(/\(\d{1,2}:\d{2}\)/g, '').trim())
      .filter(Boolean);
    if (name && lines.length) out[name] = { done: [], tomorrow: lines, blockers: [] };
  }
  return out;
}

async function gemini(transcriptText, nameHints) {
  const prompt =
    'You are parsing a daily engineering standup transcript. For each person who ' +
    'spoke, extract what THEY said into three lists:\n' +
    '- "done": each distinct thing they completed or worked on recently\n' +
    '- "tomorrow": each distinct thing they plan to do next\n' +
    '- "blockers": each blocker, or an empty list if none\n\n' +
    'Split multiple items into SEPARATE list entries — one short line per task, never ' +
    'one combined run-on sentence. Keep each entry to a single concise line with no ' +
    'leading bullet character or numbering. Return ONLY valid JSON (no markdown, no ' +
    "commentary): an object mapping each person's spoken name to " +
    '{"done":["..."],"tomorrow":["..."],"blockers":["..."]}. Omit anyone who only ' +
    'greeted or said nothing substantive. When a speaker matches one of these team ' +
    'members, use that exact name: ' + nameHints.join(', ') + '.\n\nTRANSCRIPT:\n' + transcriptText;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error('Gemini API: ' + (data.error.message || 'unknown'));
  const text =
    (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('') || '';
  const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(clean);
}

async function run(request) {
  // Inbound auth: if CRON_SECRET is set, require it (Vercel cron sends it as a
  // Bearer header). A ?key= param is accepted for manual runs.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization') || '';
    const key = new URL(request.url).searchParams.get('key') || '';
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }
  }

  if (!FIREFLIES_API_KEY) return json({ ok: false, error: 'FIREFLIES_API_KEY not set' }, 500);
  if (!SUPABASE_URL || !SUPABASE_KEY) return json({ ok: false, error: 'Supabase env not set' }, 500);

  // 1. Find the most recent standup, deduping the double-capture (same day ->
  //    keep the longest recording).
  const list =
    (await fireflies(
      'query { transcripts(limit: 25) { id title date duration } }'
    )).transcripts || [];
  const standups = list.filter((t) => (t.title || '').toLowerCase().includes(TITLE_MATCH));
  if (standups.length === 0) {
    return json({ ok: true, message: 'No standup transcript found', people_written: 0 });
  }
  standups.sort((a, b) => Number(b.date) - Number(a.date));
  const day = istanbulDay(standups[0].date);
  const sameDay = standups.filter((t) => istanbulDay(t.date) === day);
  sameDay.sort((a, b) => (Number(b.duration) || 0) - (Number(a.duration) || 0));
  const chosen = sameDay[0];

  // 2. Fetch the chosen transcript in full.
  const t = (await fireflies(
    `query { transcript(id: "${chosen.id}") {
        id title date duration
        summary { action_items overview short_summary }
        sentences { speaker_name text }
      } }`
  )).transcript;
  if (!t) return json({ ok: false, error: 'Transcript fetch returned empty' }, 500);

  // 3. Load the directory (drop Efehan up front).
  const supa = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data: rolesRaw, error: rErr } = await supa
    .from('user_roles')
    .select('name,email,dept');
  if (rErr) throw new Error('Supabase user_roles: ' + rErr.message);
  const roles = (rolesRaw || [])
    .filter((r) => !EXCLUDE_EMAILS.includes((r.email || '').toLowerCase()))
    .map((r) => ({ ...r, nrmName: normalize(r.name) }));

  // 4. Structure the transcript. Gemini first (clean per-task line items), with the
  //    action-items fallback if there's no key, the call fails, or it comes back empty.
  let method = 'action_items';
  let geminiError = null;
  let parsed = {};
  const transcriptText = buildTranscriptText(t.sentences);

  if (GEMINI_API_KEY && transcriptText) {
    try {
      parsed = await gemini(transcriptText, roles.map((r) => r.name));
      method = 'gemini';
      if (!parsed || Object.keys(parsed).length === 0) {
        parsed = parseActionItems(t.summary && t.summary.action_items);
        method = 'action_items_fallback_empty';
      }
    } catch (e) {
      geminiError = e.message;
      parsed = parseActionItems(t.summary && t.summary.action_items);
      method = 'action_items_fallback_error';
    }
  } else {
    parsed = parseActionItems(t.summary && t.summary.action_items);
  }

  // 5. Map to canonical people, merging any duplicate name -> same person.
  const rows = [];
  const matched = [];
  const unmatched = [];
  for (const [rawName, v] of Object.entries(parsed || {})) {
    const person = matchPerson(rawName, roles);
    if (!person) { unmatched.push(rawName); continue; }
    const done = toLines(v && (v.done || v.completed));
    const tomorrow = toLines(v && v.tomorrow);
    const blockers = toLines(v && v.blockers);
    const existing = rows.find((r) => r.person === person.name);
    if (existing) {
      existing.completed = [existing.completed, done].filter(Boolean).join('\n');
      existing.tomorrow = [existing.tomorrow, tomorrow].filter(Boolean).join('\n');
      existing.blockers = [existing.blockers, blockers].filter(Boolean).join('\n');
    } else {
      rows.push({
        person: person.name,
        completed: done,
        tomorrow,
        blockers,
        standup_date: day,
        source: 'fireflies',
      });
      matched.push(person.name);
    }
  }

  // 6. Idempotent write: clear this day's fireflies rows, then insert fresh.
  if (rows.length > 0) {
    const { error: delErr } = await supa
      .from('standups')
      .delete()
      .eq('standup_date', day)
      .eq('source', 'fireflies');
    if (delErr) throw new Error('Supabase delete: ' + delErr.message);
    const { error: insErr } = await supa.from('standups').insert(rows);
    if (insErr) throw new Error('Supabase insert: ' + insErr.message);
  }

  return json({
    ok: true,
    standup_date: day,
    transcript_id: chosen.id,
    duration_min: chosen.duration,
    method,
    gemini_model: method === 'gemini' ? GEMINI_MODEL : undefined,
    gemini_error: geminiError || undefined,
    people_written: rows.length,
    matched,
    unmatched,
  });
}

export async function GET(request) {
  try {
    return await run(request);
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

export async function POST(request) {
  try {
    return await run(request);
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}
