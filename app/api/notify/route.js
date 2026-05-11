const ADMIN_SLACK_ID = 'U0B04DHD1S8'; // Efehan

export async function POST(req) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  const botToken = process.env.SLACK_BOT_TOKEN;

  try {
    const { user, action, table, detail } = await req.json();
    if (!user || !action || !table) return Response.json({ ok: false });

    const emoji = action === 'added' ? '+' : action === 'deleted' ? 'x' : action === 'requested' ? '?' : '~';
    const text = `[${emoji}] *${user}* ${action} a record in *${table}*${detail ? ': ' + String(detail).slice(0, 100) : ''}`;

    // Post to #pmo channel via webhook
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      }).catch(() => {});
    }

    // DM Efehan directly for approval-required actions
    if (botToken && (table === 'working hours' || table === 'leave')) {
      const dmText = table === 'working hours'
        ? `*${user}* has requested new working hours: ${detail || 'check dashboard'}\n\n<https://attimo-ops.vercel.app|Open Dashboard> → Settings (gear icon) to approve or reject.`
        : `*${user}* has ${action} ${table}: ${detail || ''}\n\n<https://attimo-ops.vercel.app|Open Dashboard> → Leave tab to review.`;

      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: ADMIN_SLACK_ID,
          text: dmText,
          unfurl_links: false
        })
      }).catch(() => {});
    }

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message });
  }
}
