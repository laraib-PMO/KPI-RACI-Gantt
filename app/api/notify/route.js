import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY);

export async function POST(req) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  const botToken = process.env.SLACK_BOT_TOKEN;
  try {
    const { user, action, table, detail } = await req.json();
    if (!user || !action || !table) return Response.json({ ok: false });
    const text = `[${action === 'added' ? '+' : action === 'deleted' ? 'x' : '~'}] *${user}* ${action} in *${table}*${detail ? ': ' + String(detail).slice(0, 100) : ''}`;
    if (webhookUrl) await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }).catch(() => {});
    if (!botToken) return Response.json({ ok: true });

    const aType = table === 'leave' ? 'leave' : table === 'working hours' ? 'hours' : table === 'profile edit' ? 'profile' : null;
    let approverIds = [];
    if (aType) {
      const { data: ap } = await supabase.from('approvers').select('*').eq('approval_type', aType);
      for (const a of (ap || [])) {
        if (a.approver_slack_id) { approverIds.push(a.approver_slack_id); }
        else {
          try { const r = await fetch('https://slack.com/api/users.lookupByEmail?email=' + encodeURIComponent(a.approver_email), { headers: { 'Authorization': 'Bearer ' + botToken } }); const d = await r.json(); if (d.ok) { approverIds.push(d.user.id); await supabase.from('approvers').update({ approver_slack_id: d.user.id }).eq('id', a.id); } } catch {}
        }
      }
    }

    if (table === 'leave') {
      try { const ch = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200', { headers: { 'Authorization': 'Bearer ' + botToken } }); const cd = await ch.json(); const hr = cd.channels?.find(c => c.name === 'hr-module'); if (hr) await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { 'Authorization': 'Bearer ' + botToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: hr.id, text: '*Leave ' + action + '*\n*' + user + '* ' + action + ' leave: ' + (detail || '') + '\n\n<https://attimo-ops.vercel.app|Dashboard>', unfurl_links: false }) }).catch(() => {}); } catch {}
      for (const id of approverIds) { await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { 'Authorization': 'Bearer ' + botToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: id, text: '*' + user + '* ' + action + ' leave: ' + (detail || '') + '\n<https://attimo-ops.vercel.app|Review>', unfurl_links: false }) }).catch(() => {}); }
      if (action === 'approved' || action === 'rejected') {
        try { const pn = (detail || '').split(' — ')[0].trim(); if (pn) { const r = await fetch('https://slack.com/api/users.list?limit=100', { headers: { 'Authorization': 'Bearer ' + botToken } }); const d = await r.json(); const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[ışçğöü]/g, c => ({ 'ı': 'i', 'ş': 's', 'ç': 'c', 'ğ': 'g', 'ö': 'o', 'ü': 'u' })[c] || c); const m = (d.members || []).find(m => norm(m.real_name || '').includes(norm(pn))); if (m) await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { 'Authorization': 'Bearer ' + botToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: m.id, text: 'Your leave has been *' + action + '* by ' + user + '.\n<https://attimo-ops.vercel.app|View>', unfurl_links: false }) }).catch(() => {}); } } catch {}
      }
    }
    if (table === 'working hours') { for (const id of approverIds) { await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { 'Authorization': 'Bearer ' + botToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: id, text: '*' + user + '* requested new working hours: ' + (detail || '') + '\n<https://attimo-ops.vercel.app|Review>', unfurl_links: false }) }).catch(() => {}); } }
    if (table === 'profile edit') { for (const id of approverIds) { await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { 'Authorization': 'Bearer ' + botToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: id, text: '*' + user + '* requested profile edit: ' + (detail || '') + '\n<https://attimo-ops.vercel.app|Review>', unfurl_links: false }) }).catch(() => {}); } }
    return Response.json({ ok: true });
  } catch (e) { return Response.json({ ok: false, error: e.message }); }
}
