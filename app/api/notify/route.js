export async function POST(req) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return Response.json({ ok: false, reason: 'No webhook' });

  try {
    const { user, action, table, detail } = await req.json();
    if (!user || !action || !table) return Response.json({ ok: false });

    const emoji = action === 'added' ? '+' : action === 'deleted' ? 'x' : '~';
    const text = `[${emoji}] *${user}* ${action} a record in *${table}*${detail ? ': ' + String(detail).slice(0, 100) : ''}`;

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message });
  }
}
