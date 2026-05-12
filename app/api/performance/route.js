// ─── Performance Metrics API ─────────────────────────────────────────────────
// Fetches per-person task completion data from Linear + Asana
// Returns: { people: { "Name": { assigned, completed, onTime, late, overdue, onTimeRate } } }

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
  if (!raw || raw === 'Unassigned') return null;
  return E2N[raw.toLowerCase().trim()] || raw;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || 'month'; // 'month' or 'quarter'

  const now = new Date();
  let periodStart, periodLabel;

  if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    periodStart = new Date(now.getFullYear(), q * 3, 1).toISOString().split('T')[0];
    periodLabel = `Q${q + 1} ${now.getFullYear()}`;
  } else {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    periodLabel = now.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  }

  const today = now.toISOString().split('T')[0];
  const people = {};

  const init = (name) => {
    if (!name || people[name]) return;
    people[name] = { assigned: 0, completed: 0, onTime: 0, late: 0, overdue: 0, inProgress: 0 };
  };

  // ─── LINEAR ────────────────────────────────────────────────────────────────
  const linearKey = process.env.LINEAR_API_KEY;
  if (linearKey) {
    try {
      // Fetch all assigned issues (not canceled)
      let cursor = null;
      let hasMore = true;
      const allIssues = [];

      while (hasMore) {
        const afterClause = cursor ? `,after:"${cursor}"` : '';
        const res = await fetch('https://api.linear.app/graphql', {
          method: 'POST',
          headers: { 'Authorization': linearKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `{issues(first:250${afterClause},filter:{state:{type:{nin:["canceled"]}}}){
              pageInfo{hasNextPage endCursor}
              nodes{assignee{name}state{type}dueDate completedAt createdAt}
            }}`
          })
        });
        const data = await res.json();
        const issues = data?.data?.issues;
        if (!issues) break;
        allIssues.push(...(issues.nodes || []));
        hasMore = issues.pageInfo?.hasNextPage || false;
        cursor = issues.pageInfo?.endCursor || null;
      }

      allIssues.forEach(issue => {
        const name = rN(issue.assignee?.name);
        if (!name) return;
        init(name);
        people[name].assigned++;

        if (issue.state?.type === 'completed') {
          people[name].completed++;
          const completedDate = issue.completedAt ? issue.completedAt.split('T')[0] : null;
          if (issue.dueDate && completedDate) {
            if (completedDate <= issue.dueDate) {
              people[name].onTime++;
            } else {
              people[name].late++;
            }
          } else if (!issue.dueDate) {
            // No due date = count as on time
            people[name].onTime++;
          }
        } else if (issue.state?.type === 'started') {
          people[name].inProgress++;
          if (issue.dueDate && issue.dueDate < today) {
            people[name].overdue++;
          }
        } else {
          // unstarted
          if (issue.dueDate && issue.dueDate < today) {
            people[name].overdue++;
          }
        }
      });
    } catch (e) {
      console.error('Linear perf fetch error:', e);
    }
  }

  // ─── ASANA ─────────────────────────────────────────────────────────────────
  const asanaToken = process.env.ASANA_TOKEN;
  if (asanaToken) {
    const projects = {
      'Marketing Department Task Tracker': '1214432966703164',
      'Design Department Task Tracker': '1214434740066912'
    };

    for (const [projName, projGid] of Object.entries(projects)) {
      try {
        const res = await fetch(
          `https://app.asana.com/api/1.0/tasks?project=${projGid}&opt_fields=name,assignee.name,completed,completed_at,due_on,resource_subtype&limit=100`,
          { headers: { 'Authorization': `Bearer ${asanaToken}` } }
        );
        const data = await res.json();
        if (data.errors) continue;

        (data?.data || []).forEach(task => {
          if (!task.name || task.resource_subtype === 'section' || task.name.endsWith(':')) return;
          const name = rN(task.assignee?.name);
          if (!name) return;
          init(name);
          people[name].assigned++;

          if (task.completed) {
            people[name].completed++;
            const completedDate = task.completed_at ? task.completed_at.split('T')[0] : null;
            if (task.due_on && completedDate) {
              if (completedDate <= task.due_on) {
                people[name].onTime++;
              } else {
                people[name].late++;
              }
            } else {
              people[name].onTime++;
            }
          } else {
            if (task.due_on && task.due_on < today) {
              people[name].overdue++;
            } else {
              people[name].inProgress++;
            }
          }
        });
      } catch (e) {
        console.error('Asana perf fetch error:', e);
      }
    }
  }

  // ─── Calculate rates ───────────────────────────────────────────────────────
  const result = {};
  for (const [name, d] of Object.entries(people)) {
    const completionRate = d.assigned > 0 ? Math.round((d.completed / d.assigned) * 100) : 0;
    const onTimeRate = d.completed > 0 ? Math.round((d.onTime / d.completed) * 100) : 0;
    const rating = onTimeRate >= 90 ? 'exceeds' : onTimeRate >= 70 ? 'meets' : onTimeRate >= 50 ? 'developing' : 'pending';

    result[name] = {
      ...d,
      completionRate,
      onTimeRate,
      autoRating: rating,
    };
  }

  return Response.json({
    period: periodLabel,
    periodStart,
    people: result,
    timestamp: new Date().toISOString()
  });
}
