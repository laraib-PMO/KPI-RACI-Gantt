// ─── /api/slack-test — One-time diagnostic ─────────────────────────────────
// Hit GET in browser to test: bot posting, signing secret, token validity
// DELETE THIS ROUTE after confirming everything works

export async function GET(req) {
  const TOKEN = process.env.SLACK_BOT_TOKEN;
  const SECRET = process.env.SLACK_SIGNING_SECRET;
  const results = {
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // 1. Token exists
  results.checks.token_set = !!TOKEN;
  results.checks.token_prefix = TOKEN ? TOKEN.substring(0, 8) + '...' : 'MISSING';
  results.checks.signing_secret_set = !!SECRET;
  results.checks.signing_secret_length = SECRET ? SECRET.length : 0;

  // 2. Test auth.test — confirms token is valid and shows which app/bot it belongs to
  if (TOKEN) {
    try {
      const res = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: '{}'
      });
      const d = await res.json();
      results.checks.auth_test = {
        ok: d.ok,
        team: d.team,
        bot_id: d.bot_id,
        user_id: d.user_id,
        app_id: d.app_id || 'unknown',
        error: d.error || null
      };
    } catch (e) {
      results.checks.auth_test = { ok: false, error: e.message };
    }
  }

  // 3. Test posting to #hr-module (C0B3BA4TL2V)
  if (TOKEN) {
    try {
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'C0B3BA4TL2V',
          text: 'Attimo PMO Bot diagnostic test — if you see this, the bot can post to #hr-module. Safe to delete.'
        })
      });
      const d = await res.json();
      results.checks.post_hr_module = { ok: d.ok, error: d.error || null, ts: d.ts || null };
    } catch (e) {
      results.checks.post_hr_module = { ok: false, error: e.message };
    }
  }

  // 4. Test DM to Laraib (U0B04H52KLL)
  if (TOKEN) {
    try {
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'U0B04H52KLL',
          text: 'Attimo PMO Bot diagnostic — DM delivery works. Safe to ignore.'
        })
      });
      const d = await res.json();
      results.checks.dm_laraib = { ok: d.ok, error: d.error || null };
    } catch (e) {
      results.checks.dm_laraib = { ok: false, error: e.message };
    }
  }

  // 5. Check bot scopes
  if (TOKEN) {
    try {
      const res = await fetch('https://slack.com/api/auth.test', {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
      });
      const headers = Object.fromEntries(res.headers.entries());
      results.checks.scopes = headers['x-oauth-scopes'] || 'not returned';
    } catch {}
  }

  return Response.json(results, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
