// ─── Push Task API — write status/dates from the PMO Hub BACK to Linear/Asana ─
// The companion to /api/sync (which reads Linear/Asana → Hub). This pushes a
// Hub edit OUT to the linked Linear issue or Asana task, so the next sync reads
// the same value back and the two stay in agreement instead of reverting.
// Only works for TASK-linked rows (a single Linear issue / Asana task). Project-
// rollup rows (% calculated from sub-issues) can't be pushed and are skipped.

// Hub status  ->  Linear workflow-state TYPE
const LINEAR_TYPE = { 'Done': 'completed', 'Doing': 'started', 'To Do': 'unstarted' };

async function pushLinear(url, status, end_date) {
  const key = process.env.LINEAR_API_KEY;
  if (!key) return { ok: false, error: 'No LINEAR_API_KEY' };
  const m = url.match(/ATT-(\d+)/i);
  if (!m) return { ok: false, error: 'No ATT-number in Linear URL' };
  const num = parseInt(m[1]);

  // Find the issue + its team's workflow states (state IDs are workspace-specific)
  const q = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'Authorization': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `{ issues(filter:{number:{eq:${num}}},first:1){ nodes{ id team{ states{ nodes{ id type name } } } } } }`
    })
  });
  const d = await q.json();
  const issue = d?.data?.issues?.nodes?.[0];
  if (!issue) return { ok: false, error: `ATT-${num} not found in Linear` };

  const input = {};
  if (status && LINEAR_TYPE[status]) {
    const want = LINEAR_TYPE[status];
    const states = issue.team?.states?.nodes || [];
    let st = states.find(s => s.type === want);
    if (!st && want === 'unstarted') st = states.find(s => s.type === 'backlog');
    if (st) input.stateId = st.id;
  }
  if (end_date) input.dueDate = end_date; // Linear issues have no settable start date

  if (Object.keys(input).length === 0) return { ok: true, skipped: 'nothing_to_push' };

  const up = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'Authorization': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `mutation Upd($id:String!,$input:IssueUpdateInput!){ issueUpdate(id:$id,input:$input){ success } }`,
      variables: { id: issue.id, input }
    })
  });
  const ud = await up.json();
  return { ok: !!ud?.data?.issueUpdate?.success, target: 'linear', details: ud?.errors || undefined };
}

async function pushAsana(url, status, start_date, end_date) {
  const token = process.env.ASANA_TOKEN;
  if (!token) return { ok: false, error: 'No ASANA_TOKEN' };
  const segs = url.split(/[/?#]/).filter(s => /^\d+$/.test(s));
  const gid = segs[segs.length - 1];
  if (!gid) return { ok: false, error: 'No task GID in Asana URL' };

  const data = {};
  if (status) data.completed = (status === 'Done'); // Asana has no "Doing" — only complete/incomplete
  if (end_date) data.due_on = end_date;
  if (start_date) data.start_on = start_date;
  if (Object.keys(data).length === 0) return { ok: true, skipped: 'nothing_to_push' };

  const up = await fetch(`https://app.asana.com/api/1.0/tasks/${gid}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data })
  });
  const ud = await up.json();
  return { ok: !!ud?.data?.gid, target: 'asana', details: ud?.errors || undefined };
}

export async function POST(req) {
  try {
    const { linked_task_url, status, start_date, end_date } = await req.json();
    if (!linked_task_url) return Response.json({ ok: false, error: 'No linked_task_url — not a task-linked row' });
    if (linked_task_url.includes('linear.app')) return Response.json(await pushLinear(linked_task_url, status, end_date));
    if (linked_task_url.includes('asana.com')) return Response.json(await pushAsana(linked_task_url, status, start_date, end_date));
    return Response.json({ ok: false, error: 'Unrecognized link type' });
  } catch (e) {
    return Response.json({ ok: false, error: e.message });
  }
}
