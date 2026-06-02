// ─── Create Task API — Push tasks to Linear or Asana from PMO Dashboard ─────
// Dev/AI/PMO tasks → Linear
// Marketing/Design tasks → Asana
// Also creates the task in Supabase with the link back

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

// Department → source mapping
const DEPT_SOURCE = {
  'Development': 'linear',
  'AI/Science': 'linear',
  'PMO': 'linear',
  'Leadership': 'linear',
  'Marketing': 'asana',
  'Design': 'asana'
};

// Linear project IDs per department
const LINEAR_PROJECTS = {
  'Development': 'f9120c24-38ed-426b-8a9d-478da9c6eafe', // Attimo-Core
  'AI/Science': 'f9120c24-38ed-426b-8a9d-478da9c6eafe',
  'PMO': '9f7337f1-0b9e-4599-a2c7-a25541231854', // Ops&PMO
  'Leadership': '9f7337f1-0b9e-4599-a2c7-a25541231854'
};

// Asana project GIDs per department
const ASANA_PROJECTS = {
  'Marketing': '1214432966703164',
  'Design': '1214434740066912'
};

// Linear priority: 0=none, 1=urgent, 2=high, 3=medium, 4=low
const LINEAR_PRIORITY = { 'High': 2, 'Medium': 3, 'Low': 4 };

export async function POST(req) {
  try {
    const { name, dept, owner, priority, start_date, end_date, description } = await req.json();
    if (!name || !dept) return Response.json({ ok: false, error: 'Name and dept required' });

    const source = DEPT_SOURCE[dept] || 'linear';
    let linked_task_url = null;
    let linked_project = null;
    let linked_source = source;

    // ─── Create in Linear ──────────────────────────────────────────────
    if (source === 'linear') {
      const key = process.env.LINEAR_API_KEY;
      if (!key) return Response.json({ ok: false, error: 'No LINEAR_API_KEY configured' });

      const projectId = LINEAR_PROJECTS[dept];
      const teamRes = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: { 'Authorization': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `{ teams(first:1) { nodes { id } } }` })
      });
      const teamData = await teamRes.json();
      const teamId = teamData?.data?.teams?.nodes?.[0]?.id;
      if (!teamId) return Response.json({ ok: false, error: 'No Linear team found' });

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
          query: `mutation CreateIssue($input: IssueCreateInput!) {
            issueCreate(input: $input) {
              success
              issue { id identifier url }
            }
          }`,
          variables: { input }
        })
      });
      const createData = await createRes.json();
      const issue = createData?.data?.issueCreate?.issue;
      if (issue) {
        linked_task_url = issue.url;
      } else {
        return Response.json({ ok: false, error: 'Linear create failed', details: createData });
      }

    // ─── Create in Asana ───────────────────────────────────────────────
    } else if (source === 'asana') {
      const token = process.env.ASANA_TOKEN;
      if (!token) return Response.json({ ok: false, error: 'No ASANA_TOKEN configured' });

      const projectGid = ASANA_PROJECTS[dept];
      if (!projectGid) return Response.json({ ok: false, error: `No Asana project for ${dept}` });

      const taskData = {
        name,
        projects: [projectGid],
        ...(description && { notes: description }),
        ...(end_date && { due_on: end_date }),
        ...(start_date && { start_on: start_date })
      };

      // If owner specified, try to find their Asana user
      if (owner) {
        try {
          const usersRes = await fetch(
            `https://app.asana.com/api/1.0/users?workspace=1214432966636169&opt_fields=name,email`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          const usersData = await usersRes.json();
          const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const match = (usersData?.data || []).find(u => norm(u.name).includes(norm(owner)));
          if (match) taskData.assignee = match.gid;
        } catch {} // Skip assignee if lookup fails
      }

      const createRes = await fetch('https://app.asana.com/api/1.0/tasks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data: taskData })
      });
      const createData = await createRes.json();
      if (createData?.data?.gid) {
        linked_task_url = `https://app.asana.com/0/${projectGid}/${createData.data.gid}`;
      } else {
        return Response.json({ ok: false, error: 'Asana create failed', details: createData });
      }
    }

    // ─── Create in Supabase (tasks table) with link back ───────────────
    const { data: newTask, error: dbErr } = await supabase.from('tasks').insert({
      name,
      dept,
      owner: owner || null,
      priority: priority || 'Medium',
      status: 'To Do',
      progress: 0,
      risk: 'On track',
      start_date: start_date || null,
      end_date: end_date || null,
      linked_source: source,
      linked_task_url,
      linked_project: (source === 'linear' ? LINEAR_PROJECTS[dept] : ASANA_PROJECTS[dept]) || null
    }).select().single();

    if (dbErr) {
      return Response.json({ ok: false, error: 'DB insert failed', details: dbErr.message, external_created: true, linked_task_url });
    }

    return Response.json({
      ok: true,
      task: newTask,
      source,
      linked_task_url,
      message: `Task created in ${source === 'linear' ? 'Linear' : 'Asana'} and synced to dashboard`
    });

  } catch (e) {
    return Response.json({ ok: false, error: e.message });
  }
}
