// ─── Team Availability API ───────────────────────────────────────────────────
// Fetches Slack user profiles + REAL presence (online/away)
// AUTO-JOIN: new Slack members are auto-inserted into user_roles on every load

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

// Default manager by dept (matches 03-leave-module-spock.sql logic)
const DEPT_MANAGERS = {
  'Development': 'syed.ali@attimo.com',
  'AI/Science': 'soo.ling@attimo.com',
  'Design': 'tunc@attimo.com',
  'Marketing': 'claire@attimo.com',
  'PMO': 'laraib@attimo.com',
  'Leadership': 'efehan@attimo.com',
};

// Title → dept heuristic for auto-join
function guessDept(title) {
  if (!title) return 'Development';
  const t = title.toLowerCase();
  if (t.includes('design') || t.includes('ui') || t.includes('ux') || t.includes('graphic')) return 'Design';
  if (t.includes('ai') || t.includes('machine learning') || t.includes('data') || t.includes('science')) return 'AI/Science';
  if (t.includes('market') || t.includes('growth') || t.includes('seo') || t.includes('content') || t.includes('social')) return 'Marketing';
  if (t.includes('pmo') || t.includes('program') || t.includes('project') || t.includes('operations') || t.includes('hr')) return 'PMO';
  if (t.includes('ceo') || t.includes('cto') || t.includes('coo') || t.includes('founder') || t.includes('chief')) return 'Leadership';
  return 'Development';
}

// Title → employment type heuristic
function guessEmployment(title) {
  if (!title) return 'full_time';
  const t = title.toLowerCase();
  if (t.includes('intern')) return 'intern';
  if (t.includes('contractor') || t.includes('consultant') || t.includes('freelance')) return 'contractor';
  return 'full_time';
}

export async function GET() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return Response.json({ users: [], error: 'No SLACK_BOT_TOKEN' });

  try {
    // Step 1: Get all workspace members
    const res = await fetch('https://slack.com/api/users.list?limit=200', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.ok) return Response.json({ users: [], error: data.error });

    const members = (data.members || [])
      .filter(m => !m.deleted && !m.is_bot && m.id !== 'USLACKBOT');

    // Step 2: Auto-join — check for new Slack members not in user_roles
    let autoJoined = [];
    try {
      const { data: existing } = await supabase.from('user_roles').select('email');
      const knownEmails = new Set((existing || []).map(r => r.email?.toLowerCase()));

      const newMembers = members.filter(m => {
        const email = m.profile?.email;
        return email
          && !knownEmails.has(email.toLowerCase())
          && !email.includes('bot')
          && !email.includes('slackbot');
      });

      if (newMembers.length > 0) {
        const inserts = newMembers.map(m => {
          const p = m.profile || {};
          const title = p.title || '';
          const dept = guessDept(title);
          return {
            email: p.email.toLowerCase(),
            name: m.real_name || p.real_name || p.display_name || p.email.split('@')[0],
            role: 'viewer',
            dept,
            timezone: m.tz || 'Europe/Istanbul',
            work_start: '09:00',
            work_end: '18:00',
            employment_type: guessEmployment(title),
            avatar_url: p.image_192 || p.image_72 || '',
            slack_user_id: m.id,
            manager_email: DEPT_MANAGERS[dept] || 'efehan@attimo.com',
            allow_status_update: true,
          };
        });

        const { data: inserted, error: insertErr } = await supabase
          .from('user_roles')
          .upsert(inserts, { onConflict: 'email', ignoreDuplicates: true })
          .select('name, email, dept');

        if (inserted && inserted.length > 0) {
          autoJoined = inserted.map(r => ({ name: r.name, email: r.email, dept: r.dept }));
          console.log('[auto-join]', autoJoined.length, 'new members added:', autoJoined.map(r => r.name).join(', '));
        }
        if (insertErr) console.error('[auto-join] insert error:', insertErr.message);
      }

      // Also backfill slack_user_id for existing members who are missing it
      for (const m of members) {
        const email = m.profile?.email?.toLowerCase();
        if (!email || !knownEmails.has(email)) continue;
        const match = (existing || []).find(r => r.email?.toLowerCase() === email);
        if (match) {
          // Update slack_user_id + avatar in background (don't await)
          supabase.from('user_roles')
            .update({
              slack_user_id: m.id,
              avatar_url: m.profile?.image_192 || m.profile?.image_72 || undefined,
            })
            .eq('email', email)
            .then(() => {});
        }
      }
    } catch (joinErr) {
      console.error('[auto-join] error:', joinErr.message);
    }

    // Step 3: Get real presence for each user (batch, max 10 concurrent)
    const presenceMap = {};
    const chunks = [];
    for (let i = 0; i < members.length; i += 10) {
      chunks.push(members.slice(i, i + 10));
    }
    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(async m => {
          try {
            const pr = await fetch(`https://slack.com/api/users.getPresence?user=${m.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const pd = await pr.json();
            return { id: m.id, presence: pd.presence || 'away', online: pd.online || false };
          } catch {
            return { id: m.id, presence: 'away', online: false };
          }
        })
      );
      results.forEach(r => {
        if (r.status === 'fulfilled') presenceMap[r.value.id] = r.value;
      });
    }

    // Step 4: Build user list with accurate status
    const users = members.map(m => {
      const p = m.profile || {};
      const pres = presenceMap[m.id] || { presence: 'away', online: false };
      const isActive = pres.presence === 'active';
      const statusText = (p.status_text || '').toLowerCase();
      const statusEmoji = p.status_emoji || '';

      let mapped_status;
      let status_detail = '';
      if (statusEmoji === ':palm_tree:' || statusEmoji === ':desert_island:' || statusText.includes('vacation') || statusText.includes('leave') || statusText.includes('off')) {
        mapped_status = 'off';
        status_detail = p.status_text || 'Away';
      } else if (statusEmoji === ':coffee:' || statusEmoji === ':tea:' || statusText.includes('lunch') || statusText.includes('break') || statusText.includes('brb')) {
        mapped_status = 'break';
        status_detail = p.status_text || 'On break';
      } else if (statusEmoji === ':calendar:' || statusEmoji === ':spiral_calendar_pad:' || statusText.includes('meeting') || statusText.includes('call') || statusText.includes('huddle')) {
        mapped_status = 'working';
        status_detail = p.status_text || 'In a meeting';
      } else if (isActive) {
        mapped_status = 'working';
        status_detail = p.status_text || '';
      } else {
        mapped_status = 'offline';
        status_detail = '';
      }

      return {
        id: m.id,
        email: p.email || '',
        name: m.real_name || p.real_name || p.display_name || '',
        display_name: p.display_name || '',
        avatar: p.image_192 || p.image_72 || p.image_512 || p.image_48 || '',
        tz: m.tz || 'UTC',
        tz_label: m.tz_label || '',
        tz_offset: m.tz_offset || 0,
        status_text: p.status_text || '',
        status_emoji: p.status_emoji || '',
        title: p.title || '',
        phone: p.phone || '',
        is_admin: m.is_admin || false,
        presence: pres.presence,
        is_online: isActive,
        mapped_status,
        status_detail,
      };
    });

    return Response.json({
      users,
      count: users.length,
      auto_joined: autoJoined,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    return Response.json({ users: [], error: e.message });
  }
}
