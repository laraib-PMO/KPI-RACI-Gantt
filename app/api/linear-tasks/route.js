export async function GET() {
  const today = new Date().toISOString().split('T')[0];
  const byProject = {};

  // ═══ FETCH LINEAR (Development, AI/Science, Architecture) ═══
  const linearKey = process.env.LINEAR_API_KEY;
  if (linearKey) {
    try {
      const res = await fetch('https://api.linear.app/graphql', {
        method: 'POST', headers: { 'Authorization': linearKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `{issues(first:200,filter:{state:{type:{nin:["canceled","backlog"]}},project:{null:false}}){nodes{id title assignee{name}state{name type}dueDate startedAt priority project{name}}}}` })
      });
      const data = await res.json();
      (data?.data?.issues?.nodes || []).forEach(i => {
        const proj = i.project?.name || 'Other';
        if (proj.toLowerCase().includes('pmo') || proj.toLowerCase().includes('operations')) return;
        if (!byProject[proj]) byProject[proj] = { source: 'Linear', tasks: [] };
        let status = 'To Do';
        if (i.state?.type === 'started') status = 'Doing';
        if (i.state?.type === 'completed') status = 'Done';
        byProject[proj].tasks.push({
          id: i.id, title: i.title, person: i.assignee?.name || 'Unassigned',
          status, dueDate: i.dueDate, priority: i.priority,
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
      'Marketing': '1214432966703164',
      'Design': '1214434740066912'
    };

    for (const [dept, projGid] of Object.entries(asanaProjects)) {
      try {
        const res = await fetch(`https://app.asana.com/api/1.0/tasks?project=${projGid}&opt_fields=name,assignee.name,completed,due_on&limit=100`, {
          headers: { 'Authorization': `Bearer ${asanaToken}` }
        });
        const data = await res.json();
        if (data.errors) continue;
        const tasks = data?.data || [];
        if (tasks.length === 0) continue;

        const projName = dept + ' Department';
        if (!byProject[projName]) byProject[projName] = { source: 'Asana', tasks: [] };

        tasks.forEach(t => {
          if (!t.name || t.name.includes(':')) return;
          const status = t.completed ? 'Done' : 'Doing';
          byProject[projName].tasks.push({
            id: t.gid, title: t.name, person: t.assignee?.name || 'Unassigned',
            status, dueDate: t.due_on,
            isOverdue: t.due_on && t.due_on < today && !t.completed,
            source: 'Asana'
          });
        });
      } catch (e) { console.error('Asana error:', e); }
    }
  }

  const total = Object.values(byProject).reduce((sum, p) => sum + p.tasks.length, 0);
  return Response.json({ projects: Object.fromEntries(Object.entries(byProject).map(([k, v]) => [k, v.tasks])), sources: Object.fromEntries(Object.entries(byProject).map(([k, v]) => [k, v.source])), total });
}
