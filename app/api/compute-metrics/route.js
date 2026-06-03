// ─── Compute Metrics — Velocity + Acceleration per Department ───────────────
// Runs daily via cron. Computes weekly velocity (tasks done/week) per dept,
// compares against prior period to get acceleration %, stores in metrics table.
// Auto-creates/closes "velocity declining" risks based on acceleration.
//
// Foundation for Vitals tab.
// GET /api/compute-metrics  (auth via CRON_SECRET header)

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

const DEPTS = ['Development', 'AI/Science', 'Design', 'Marketing', 'PMO', 'Leadership'];

// Map of dept → Linear/Asana project IDs/names (for direct counting from source)
const DEPT_LINEAR_PROJECTS = {
  'Development': ['Attimo-Core', 'Phase 0', 'Phase 1', 'Phase 2', 'Phase 3', 'Phase 4'],
  'AI/Science': ['AI Research', 'Phase 0', 'Phase 1'],
  'PMO': ['Ops & PMO'],
  'Leadership': ['Ops & PMO']
};
const DEPT_ASANA_PROJECTS = {
  'Marketing': ['1214432966703164'],
  'Design': ['1214434740066912']
};

function isoDate(d) { return d.toISOString().split('T')[0]; }

// Count tasks marked Done within a window, for a given dept
// Source of truth: Supabase tasks table (which is synced from Linear/Asana)
async function countDeptCompletions(dept, fromDate, toDate) {
  const { data, count } = await supabase
    .from('tasks')
    .select('id', { count: 'exact' })
    .eq('dept', dept)
    .eq('status', 'Done')
    .gte('end_date', fromDate)
    .lte('end_date', toDate);
  return count || 0;
}

// Auto-derive risk: dept velocity declining
async function syncVelocityRisks(dept, accelPct, velocity, periodLabel) {
  const description = `${dept} velocity declining`;
  const { data: existing } = await supabase
    .from('risks')
    .select('*')
    .eq('description', description)
    .maybeSingle();

  if (accelPct < -10) {
    // Decelerating — create or refresh
    const impact = accelPct < -25 ? 'HIGH' : 'MEDIUM';
    const mitigation = `Acceleration ${accelPct}% ${periodLabel}. Current velocity: ${velocity.toFixed(1)} tasks/week. Review capacity and blockers.`;
    if (!existing) {
      await supabase.from('risks').insert({
        description,
        impact,
        status: 'ACTIVE',
        owner: dept === 'Development' ? 'Syed Osama Ali' :
               dept === 'Design' ? 'Tunç Karadağ' :
               dept === 'AI/Science' ? 'Soo Ling Lim' :
               dept === 'Marketing' ? 'Claire Eskander' :
               dept === 'PMO' ? 'Laraib Haider' :
               'Efehan Maleri',
        mitigation,
        mitigation_status: 'identified',
        created_date: isoDate(new Date()),
        linked_to: 'auto-velocity-metric'
      });
    } else if (existing.status === 'CLOSED') {
      // Reopen if previously closed
      await supabase.from('risks').update({
        status: 'ACTIVE',
        impact,
        mitigation
      }).eq('id', existing.id);
    } else {
      // Just refresh the mitigation note
      await supabase.from('risks').update({ mitigation, impact }).eq('id', existing.id);
    }
  } else if (accelPct >= 0 && existing && existing.status === 'ACTIVE') {
    // Recovered — auto-close
    await supabase.from('risks').update({
      status: 'CLOSED',
      mitigation_status: 'resolved',
      mitigation: `${existing.mitigation || ''}\n✅ Auto-resolved: acceleration recovered to ${accelPct}%.`
    }).eq('id', existing.id);
  }
}

export async function GET(req) {
  // Auth check (allow Vercel cron, or with CRON_SECRET, or unauthenticated for the cron)
  const auth = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}` && !req.headers.get('x-vercel-cron')) {
    // Allow unauth if no secret set (dev mode)
    if (cronSecret) return new Response('Unauthorized', { status: 401 });
  }

  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
  const fourWeeksAgo = new Date(now.getTime() - 28 * 86400000);
  const oneDayBeforeTwoWeeks = new Date(twoWeeksAgo.getTime() - 86400000);

  const results = {};
  const errors = [];

  for (const dept of DEPTS) {
    try {
      // Current 2 weeks: tasks completed
      const current = await countDeptCompletions(dept, isoDate(twoWeeksAgo), isoDate(now));
      // Prior 2 weeks: tasks completed
      const prior = await countDeptCompletions(dept, isoDate(fourWeeksAgo), isoDate(oneDayBeforeTwoWeeks));

      const velocity = current / 2;        // per week, current period
      const priorVelocity = prior / 2;     // per week, prior period
      const acceleration = priorVelocity === 0
        ? (velocity > 0 ? 100 : 0)
        : Math.round(((velocity - priorVelocity) / priorVelocity) * 100);

      const direction = acceleration > 5 ? 'accelerating' :
                        acceleration < -5 ? 'decelerating' : 'steady';

      results[dept] = {
        velocity: Math.round(velocity * 10) / 10,
        prior_velocity: Math.round(priorVelocity * 10) / 10,
        acceleration_pct: acceleration,
        direction,
        tasks_current: current,
        tasks_prior: prior
      };

      // Upsert into metrics table (one row per dept per period)
      await supabase.from('metrics').upsert({
        dept,
        period_start: isoDate(twoWeeksAgo),
        period_end: isoDate(now),
        velocity,
        prior_velocity: priorVelocity,
        acceleration_pct: acceleration,
        tasks_current: current,
        tasks_prior: prior,
        computed_at: now.toISOString()
      }, { onConflict: 'dept,period_start' });

      // Auto-derive risks
      await syncVelocityRisks(dept, acceleration, velocity, 'this fortnight vs prior');
    } catch (e) {
      errors.push({ dept, error: e.message });
    }
  }

  // Company-level rollup
  const totalCurrent = Object.values(results).reduce((s, d) => s + d.tasks_current, 0);
  const totalPrior = Object.values(results).reduce((s, d) => s + d.tasks_prior, 0);
  const companyAccel = totalPrior === 0 ? (totalCurrent > 0 ? 100 : 0)
    : Math.round(((totalCurrent - totalPrior) / totalPrior) * 100);

  return Response.json({
    ok: true,
    computed_at: now.toISOString(),
    period: { current_start: isoDate(twoWeeksAgo), current_end: isoDate(now) },
    company_acceleration_pct: companyAccel,
    departments: results,
    errors
  });
}
