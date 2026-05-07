// ─── Name Resolution (consistent with page.jsx and digest) ───────────────────
const E2N = {
  'burak':'Burak Çetin','talha':'Talha Mubeen','laraib':'Laraib Haider',
  'murat':'Murat Tut','sooling':'Soo Ling Lim','soo ling':'Soo Ling Lim',
  'gamze':'Gamze Savaş','claire':'Claire Eskander','mesude':'Mesude Gökpınar',
  'suche':'Suche Coşkun','efehan':'Efehan Maleri','syed':'Syed Osama Ali',
  'tunc':'Tunç Karadağ','tunch':'Tunç Karadağ',
  'burak çetin':'Burak Çetin','burak cetin':'Burak Çetin',
  'talha mubeen':'Talha Mubeen','murat tut':'Murat Tut',
  'soo ling lim':'Soo Ling Lim','gamze savaş':'Gamze Savaş','gamze savas':'Gamze Savaş',
  'claire eskander':'Claire Eskander','mesude gökpınar':'Mesude Gökpınar','mesude gokpinar':'Mesude Gökpınar',
  'suche coşkun':'Suche Coşkun','suche coskun':'Suche Coşkun',
  'efehan maleri':'Efehan Maleri','syed osama ali':'Syed Osama Ali',
  'tunç karadağ':'Tunç Karadağ','tunc karadag':'Tunç Karadağ',
};
function rN(raw) {
  if (!raw || raw === 'Unassigned') return 'Unassigned';
  return E2N[raw.toLowerCase().trim()] || raw;
}

// ─── Linear: paginated fetch (handles 250+ tickets) ─────────────────────────
async function fetchAllLinearIssues(key) {
  const all = [];
  let cursor = null;
  let hasMore = true;

  while (hasMore) {
    const afterClause = cursor ? `,after:"${cursor}"` : '';
    const query = `{
      issues(first:250${afterClause},filter:{
        state:{type:{nin:["canceled","triage"]}},
        project:{null:false}
      }){
        pageInfo { hasNextPage endCursor }
        nodes {
          id title
          assignee { name }
          state { name type }
          dueDate startedAt priority
          project { name }
        }
      }
    }`;

    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { 'Authorization': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    const issues = data?.data?.issues;
    if (!issues) break;

    all.push(...(issues.nodes || []));
    hasMore = issues.pageInfo?.hasNextPage || false;
    cursor = issues.pageInfo?.endCursor || null;
  }

  return all;
}

export async function GET() {
  const today = new Date().toISOString().split('T')[0];
  const byProject = {};

  // ═══ FETCH LINEAR (all projects except Operations & PMO) ═══
  const linearKey = process.env.LINEAR_API_KEY;
  if (linearKey) {
    try {
      const issues = await fetchAllLinearIssues(linearKey);

      issues.forEach(i => {
        const proj = i.project?.name || 'Other';

        // Exclude Operations & PMO (internal board, not product work)
        if (proj.toLowerCase().includes('pmo') || proj.toLowerCase().includes('operations')) return;

        if (!byProject[proj]) byProject[proj] = { source: 'Linear', tasks: [] };

        // Status mapping from Linear state types
        let status = 'To Do';
        if (i.state?.type === 'started') status = 'Doing';
        if (i.state?.type === 'completed') status = 'Done';
        // 'unstarted' stays as 'To Do', 'backlog' stays as 'To Do'

        byProject[proj].tasks.push({
          id: i.id,
          title: i.title,
          person: rN(i.assignee?.name),
          status,
          dueDate: i.dueDate || null,
          startDate: i.startedAt ? i.startedAt.split('T')[0] : null,
          priority: i.priority,
          isOverdue: i.dueDate && i.dueDate < today && status !== 'Done',
          source: 'Linear'
        });
      });
    } catch (e) { console.error('Linear error:', e); }
  }

  // ═══ FETCH ASANA (Marketing + Design) ═══
  const asanaToken = process.env.ASANA_TOKEN;
  if (asanaToken) {
    const asanaProjects = {
      'Marketing Department': '1214432966703164',
      'Design Department': '1214434740066912'
    };

    for (const [dept, projGid] of Object.entries(asanaProjects)) {
      try {
        const res = await fetch(
          `https://app.asana.com/api/1.0/tasks?project=${projGid}&opt_fields=name,assignee.name,completed,due_on,start_on,resource_subtype&limit=100`,
          { headers: { 'Authorization': `Bearer ${asanaToken}` } }
        );
        const data = await res.json();
        if (data.errors) continue;
        const tasks = data?.data || [];
        if (tasks.length === 0) continue;

        if (!byProject[dept]) byProject[dept] = { source: 'Asana', tasks: [] };

        tasks.forEach(t => {
          // Skip section headers (resource_subtype=section) and empty names
          if (!t.name || t.resource_subtype === 'section') return;
          // Also skip old-style section headers ending with ":"
          if (t.name.endsWith(':')) return;

          const status = t.completed ? 'Done' : (t.due_on ? 'Doing' : 'To Do');

          byProject[dept].tasks.push({
            id: t.gid,
            title: t.name,
            person: rN(t.assignee?.name),
            status,
            dueDate: t.due_on || null,
            startDate: t.start_on || null,
            isOverdue: t.due_on && t.due_on < today && !t.completed,
            source: 'Asana'
          });
        });
      } catch (e) { console.error('Asana error:', e); }
    }
  }

  // ═══ RESPONSE ═══
  const total = Object.values(byProject).reduce((sum, p) => sum + p.tasks.length, 0);

  return Response.json({
    projects: Object.fromEntries(
      Object.entries(byProject).map(([k, v]) => [k, v.tasks])
    ),
    sources: Object.fromEntries(
      Object.entries(byProject).map(([k, v]) => [k, v.source])
    ),
    total
  });
}
