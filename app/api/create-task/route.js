// ─── Create Task API — Push to Linear or Asana from PMO Dashboard ───────────
// Now accepts explicit source + projectId (chosen in the guided modal)
// Marketing/Design → Asana | PMO/Leadership/AI-Science/Development → Linear

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

const DEPT_SOURCE = {
  'Marketing': 'asana',
  'Design': 'asana',
  'PMO': 'linear',
  'Leadership': 'linear',
  'AI/Science': 'linear',
  'Development': 'linear'
};

const LINEAR_PRIORITY = { 'High': 2, 'Medium': 3, 'Low': 4 };

export async function POST(req) {
  try {
    const { name, dept, owner, priority, start_date, end_date, description, source, projectId } = await req.json();
    if (!name || !dept) return Response.json({ ok: false, error: 'Name and dept required' });

    const src = source || DEPT_SOURCE[dept] || 'linear';
    let linked_task_url = null;

    // ─── Linear ───────────────────────────────────────────────────────
    if (src === 'linear') {
      const key = process.env.LINEAR_API_KEY;
      if (!key) return Response.json({ ok: false, error: 'No LINEAR_API_KEY configured' });

      const teamRes = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: { 'Authorization': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `{ teams(first:1) { nodes { id } } }` })
      });
      const teamData = await teamRes.json();
      const teamId = teamData?.data?.teams?.nodes?.[0]?.id;
      if (!teamId) return Response.json({ ok: false, error: 'No Linear team found', details: teamData });

      const input = {
        title: name,
        teamId,
        priority: LINEAR_PRIORITY[priority] || 0,
        ...(description && { description }),
        ...(end_date && { dueDate: end_date }),
        ...(projectId && { projectId })
      };

      const createRes = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: { 'Authorization': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation Create($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }`,
          variables: { input }
        })
      });
      const createData = await createRes.json();
      const issue = createData?.data?.issueCreate?.issue;
      if (!issue) return Response.json({ ok: false, error: 'Linear create failed', details: createData });
      linked_task_url = issue.url;

    // ─── Asana ────────────────────────────────────────────────────────
    } else if (src === 'asana') {
      const token = process.env.ASANA_TOKEN;
      if (!token) return Response.json({ ok: false, error: 'No ASANA_TOKEN configured' });
      if (!projectId) return Response.json({ ok: false, error: 'Asana requires a board selection' });

      const taskData = {
        name,
        projects: [projectId],
        ...(description && { notes: description }),
        ...(end_date && { due_on: end_date }),
        ...(start_date && { start_on: start_date })
      };

      if (owner) {
        try {
          const wsRes = await fetch('https://app.asana.com/api/1.0/workspaces', { headers: { 'Authorization': `Bearer ${token}` } });
          const wsData = await wsRes.json();
          const wsGid = wsData?.data?.[0]?.gid;
          if (wsGid) {
            const usersRes = await fetch(`https://app.asana.com/api/1.0/users?workspace=${wsGid}&opt_fields=name`, { headers: { 'Authorization': `Bearer ${token}` } });
            const usersData = await usersRes.json();
            const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const match = (usersData?.data || []).find(u => norm(u.name).includes(norm(owner.split(' ')[0])));
            if (match) taskData.assignee = match.gid;
          }
        } catch {}
      }

      const createRes = await fetch('https://app.asana.com/api/1.0/tasks', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: taskData })
      });
      const createData = await createRes.json();
      if (!createData?.data?.gid) return Response.json({ ok: false, error: 'Asana create failed', details: createData });
      linked_task_url = `https://app.asana.com/0/${projectId}/${createData.data.gid}`;
    }

    // ─── Save to Supabase ─────────────────────────────────────────────
    const { data: newTask, error: dbErr } = await supabase.from('tasks').insert({
      name, dept,
      owner: owner || null,
      priority: priority || 'Medium',
      status: 'To Do',
      progress: 0,
      risk: 'On track',
      start_date: start_date || null,
      end_date: end_date || null,
      linked_source: src,
      linked_task_url,
      linked_project: src === 'linear' ? (projectId || null) : null
    }).select().single();

    if (dbErr) return Response.json({ ok: false, error: 'DB insert failed', details: dbErr.message, external_created: true, linked_task_url });

    return Response.json({ ok: true, task: newTask, source: src, linked_task_url, message: `Created in ${src === 'linear' ? 'Linear' : 'Asana'}` });

  } catch (e) {
    return Response.json({ ok: false, error: e.message });
  }
}
