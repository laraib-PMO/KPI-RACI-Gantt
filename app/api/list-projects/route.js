// ─── List Projects API — fetches live Linear projects + Asana boards ────────
// Used by the Add Task modal to show current projects/boards per source
// GET /api/list-projects → { linear: [...], asana: [...] }

export async function GET() {
  const result = { linear: [], asana: [] };

  // ─── Linear projects ──────────────────────────────────────────────────────
  const linearKey = process.env.LINEAR_API_KEY;
  if (linearKey) {
    try {
      const res = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: { 'Authorization': linearKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{ projects(first: 50) { nodes { id name state } } }`
        })
      });
      const data = await res.json();
      const projects = data?.data?.projects?.nodes || [];
      result.linear = projects
        .filter(p => p.state !== 'canceled' && p.state !== 'completed')
        .map(p => ({ id: p.id, name: p.name }));
    } catch (e) {
      console.error('Linear projects fetch error:', e);
    }
  }

  // ─── Asana projects/boards ──────────────────────────────────────────────────
  const asanaToken = process.env.ASANA_TOKEN;
  if (asanaToken) {
    try {
      // Get the workspace first
      const wsRes = await fetch('https://app.asana.com/api/1.0/workspaces', {
        headers: { 'Authorization': `Bearer ${asanaToken}` }
      });
      const wsData = await wsRes.json();
      const workspaceGid = wsData?.data?.[0]?.gid;

      if (workspaceGid) {
        const projRes = await fetch(
          `https://app.asana.com/api/1.0/projects?workspace=${workspaceGid}&opt_fields=name,archived&limit=50`,
          { headers: { 'Authorization': `Bearer ${asanaToken}` } }
        );
        const projData = await projRes.json();
        result.asana = (projData?.data || [])
          .filter(p => !p.archived)
          .map(p => ({ id: p.gid, name: p.name }));
      }
    } catch (e) {
      console.error('Asana projects fetch error:', e);
    }
  }

  // Fallback: hardcoded known projects if API returns nothing
  if (result.linear.length === 0) {
    result.linear = [
      { id: 'f9120c24-38ed-426b-8a9d-478da9c6eafe', name: 'Attimo-Core' },
      { id: 'eaa29270-0b10-4b94-832a-2bfd6bf7319f', name: 'Phase 0' },
      { id: 'a193eb61-5968-4c4d-8baf-5317d261eada', name: 'Phase 1' },
      { id: '9f7337f1-0b9e-4599-a2c7-a25541231854', name: 'Ops & PMO' }
    ];
  }
  if (result.asana.length === 0) {
    result.asana = [
      { id: '1214432966703164', name: 'Marketing Department Task Tracker' },
      { id: '1214434740066912', name: 'Design Department Task Tracker' }
    ];
  }

  return Response.json({ ok: true, ...result, timestamp: new Date().toISOString() });
}
