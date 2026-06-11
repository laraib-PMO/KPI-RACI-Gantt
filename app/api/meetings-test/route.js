// ═══════════════════════════════════════════════════════════════════════════
// /api/meetings-test — Diagnostic for the Meetings module
// Open https://attimo-ops.vercel.app/api/meetings-test in the browser.
// Runs five live checks and reports exactly what is broken.
// TEMPORARY — delete after the Meetings module is confirmed working.
// ═══════════════════════════════════════════════════════════════════════════

export async function GET() {
  const checks = {};

  // ── 1. Env vars present? ────────────────────────────────────────────
  checks.env = {
    SLACK_BOT_TOKEN: !!process.env.SLACK_BOT_TOKEN,
    GOOGLE_CALENDAR_KEY: !!process.env.GOOGLE_CALENDAR_KEY,
    FIREFLIES_API_KEY: !!process.env.FIREFLIES_API_KEY,
  };

  // ── 2. Slack token valid? ───────────────────────────────────────────
  if (process.env.SLACK_BOT_TOKEN) {
    try {
      const res = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}` },
      });
      const d = await res.json();
      checks.slack_auth = d.ok ? { ok: true, bot: d.user, team: d.team } : { ok: false, error: d.error };
    } catch (e) { checks.slack_auth = { ok: false, error: e.message }; }
  } else checks.slack_auth = { ok: false, error: 'SLACK_BOT_TOKEN missing' };

  // ── 3. Slack email lookup works? (tests laraib@attimo.com) ─────────
  if (process.env.SLACK_BOT_TOKEN) {
    try {
      const res = await fetch('https://slack.com/api/users.lookupByEmail?email=laraib%40attimo.com', {
        headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}` },
      });
      const d = await res.json();
      checks.slack_email_lookup = d.ok
        ? { ok: true, found: d.user.id, note: 'DM routing will work' }
        : { ok: false, error: d.error, note: d.error === 'missing_scope' ? 'Bot needs users:read.email scope — add in Slack app OAuth settings and reinstall' : 'Email lookup failed' };
    } catch (e) { checks.slack_email_lookup = { ok: false, error: e.message }; }
  } else checks.slack_email_lookup = { ok: false, error: 'SLACK_BOT_TOKEN missing' };

  // ── 4. Can the bot post to #pmo? ────────────────────────────────────
  if (process.env.SLACK_BOT_TOKEN) {
    try {
      const res = await fetch('https://slack.com/api/conversations.list?types=public_channel&limit=200', {
        headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}` },
      });
      const d = await res.json();
      if (d.ok) {
        const pmo = (d.channels || []).find(c => c.name === 'pmo');
        checks.pmo_channel = pmo
          ? { ok: true, id: pmo.id, is_member: pmo.is_member, note: pmo.is_member ? 'Channel posts will work' : 'Bot is NOT in #pmo — run /invite @bot in the channel' }
          : { ok: false, error: '#pmo channel not found' };
      } else checks.pmo_channel = { ok: false, error: d.error };
    } catch (e) { checks.pmo_channel = { ok: false, error: e.message }; }
  } else checks.pmo_channel = { ok: false, error: 'SLACK_BOT_TOKEN missing' };

  // ── 5. Fireflies API reachable? ─────────────────────────────────────
  if (process.env.FIREFLIES_API_KEY) {
    try {
      const res = await fetch('https://api.fireflies.ai/graphql', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.FIREFLIES_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ user { name email } }' }),
      });
      const d = await res.json();
      checks.fireflies = d.data?.user
        ? { ok: true, account: d.data.user.email, note: 'MOM sync will work' }
        : { ok: false, error: d.errors?.[0]?.message || 'Invalid response' };
    } catch (e) { checks.fireflies = { ok: false, error: e.message }; }
  } else checks.fireflies = { ok: false, error: 'FIREFLIES_API_KEY missing — get it from fireflies.ai > Settings > Developer Settings' };

  // ── 6. Google Calendar service account auth? ────────────────────────
  if (process.env.GOOGLE_CALENDAR_KEY) {
    try {
      const sa = JSON.parse(Buffer.from(process.env.GOOGLE_CALENDAR_KEY, 'base64').toString('utf-8'));
      checks.google_calendar = { ok: true, service_account: sa.client_email, note: 'Key parses — server-side event creation possible' };
    } catch (e) { checks.google_calendar = { ok: false, error: 'Key set but not valid base64 service-account JSON' }; }
  } else checks.google_calendar = { ok: false, error: 'GOOGLE_CALENDAR_KEY not set — OK, the Hub falls back to opening Google Calendar pre-filled in your browser' };

  // ── Summary ─────────────────────────────────────────────────────────
  const summary = [];
  if (!checks.slack_auth.ok) summary.push('FIX: Slack token broken — DMs cannot send');
  else if (!checks.slack_email_lookup.ok) summary.push('FIX: ' + (checks.slack_email_lookup.note || 'email lookup broken — DMs cannot route'));
  else summary.push('OK: Slack DM invitations will work');
  if (checks.pmo_channel.ok && !checks.pmo_channel.is_member) summary.push('FIX: invite the bot to #pmo for channel announcements');
  if (!checks.fireflies.ok) summary.push('FIX: ' + checks.fireflies.error);
  else summary.push('OK: Fireflies MOM sync will work');
  summary.push(checks.google_calendar.ok ? 'OK: server-side calendar possible' : 'INFO: calendar uses browser prefill fallback (works fine)');

  return Response.json({ summary, checks }, { status: 200 });
}
