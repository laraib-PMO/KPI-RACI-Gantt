const ADMIN_SLACK_ID = 'U0B04DHD1S8'; // Efehan
// Add Laraib and Nil Slack IDs here once known:
// const LARAIB_SLACK_ID = 'UXXXXXXXX';
// const NIL_SLACK_ID = 'UXXXXXXXX';

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

    // ─── HR-MODULE: Leave notifications go to #hr-module channel ───
    if (botToken && table === 'leave') {
      // Find #hr-module channel
      try {
        const chRes = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200', {
          headers: { 'Authorization': `Bearer ${botToken}` }
        });
        const chData = await chRes.json();
        const hrChannel = chData.channels?.find(c => c.name === 'hr-module');

        if (hrChannel) {
          const leaveText = `*Leave ${action}*\n*${user}* ${action} ${table}: ${detail || ''}\n\n<https://attimo-ops.vercel.app|Open Dashboard> → Leave tab to review.`;
          await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${botToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel: hrChannel.id, text: leaveText, unfurl_links: false })
          }).catch(() => {});
        }
      } catch {}

      // DM Efehan for leave requests
      const dmText = `*${user}* has ${action} ${table}: ${detail || ''}\n\n<https://attimo-ops.vercel.app|Open Dashboard> → Leave tab to review.`;
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${botToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: ADMIN_SLACK_ID, text: dmText, unfurl_links: false })
      }).catch(() => {});

      // DM the EMPLOYEE when their leave is approved or rejected
      if (action === 'approved' || action === 'rejected') {
        try {
          // detail contains "PersonName — approved/rejected"
          const personName = (detail || '').split(' — ')[0].trim();
          if (personName) {
            // Look up employee's Slack ID by name
            const listRes = await fetch('https://slack.com/api/users.list?limit=100', {
              headers: { 'Authorization': `Bearer ${botToken}` }
            });
            const listData = await listRes.json();
            const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ü/g, 'u');
            const member = (listData.members || []).find(m => {
              const rn = norm(m.real_name || '');
              const pn = norm(personName);
              return rn === pn || rn.includes(pn) || pn.includes(rn);
            });
            if (member) {
              const emoji = action === 'approved' ? '✅' : '❌';
              const empMsg = `${emoji} Your leave request has been *${action}* by ${user}.\n\n<https://attimo-ops.vercel.app|View in Dashboard>`;
              await fetch('https://slack.com/api/chat.postMessage', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${botToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel: member.id, text: empMsg, unfurl_links: false })
              }).catch(() => {});
            }
          }
        } catch {}
      }

      // DM Laraib and Nil too (uncomment when IDs are set):
      // for (const id of [LARAIB_SLACK_ID, NIL_SLACK_ID].filter(Boolean)) {
      //   await fetch('https://slack.com/api/chat.postMessage', {
      //     method: 'POST',
      //     headers: { 'Authorization': `Bearer ${botToken}`, 'Content-Type': 'application/json' },
      //     body: JSON.stringify({ channel: id, text: dmText, unfurl_links: false })
      //   }).catch(() => {});
      // }
    }

    // DM Efehan for working hours requests
    if (botToken && table === 'working hours') {
      const dmText = `*${user}* has requested new working hours: ${detail || 'check dashboard'}\n\n<https://attimo-ops.vercel.app|Open Dashboard> → Settings (gear icon) to approve or reject.`;
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${botToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: ADMIN_SLACK_ID, text: dmText, unfurl_links: false })
      }).catch(() => {});
    }

    // DM Efehan for profile edit requests
    if (botToken && table === 'profile edit') {
      const dmText = `*${user}* has requested a profile edit: ${detail || ''}\n\n<https://attimo-ops.vercel.app|Open Dashboard> → Settings to update.`;
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${botToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: ADMIN_SLACK_ID, text: dmText, unfurl_links: false })
      }).catch(() => {});
    }

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message });
  }
}
