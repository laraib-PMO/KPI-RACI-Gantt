'use client';
import { useState, useRef, useEffect, useMemo } from 'react';

// Vitals AI assistant — answers from the live platform snapshot (tasks, risks,
// leaves, decisions, KPIs, roles, department velocity, per-person performance,
// cash) via /api/vitals-ai (Gemini 3.5 Flash). Plus a recognition standings panel.
export default function VitalsChat(props) {
  const {
    tasks = [], risks = [], leaves = [], decisions = [], kpis = [],
    roles = [], metricsData = {}, config = {}, perfMetrics = null,
    userRoles = [], rND
  } = props;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const today = new Date().toISOString().split('T')[0];
  const dstr = (d) => (d ? String(d).split('T')[0] : null);

  // ── Recognition standings (current, from perfMetrics) ──────────────────────
  const standings = useMemo(() => {
    if (!perfMetrics || !perfMetrics.people) return null;
    const rows = Object.entries(perfMetrics.people)
      .filter(([name]) => name !== 'Efehan Maleri')
      .map(([name, d]) => ({
        name,
        dept: rND ? String(rND(name)).replace(/^.*\(|\)$/g, '') : '',
        completed: d.completed || 0,
        onTime: d.onTime || 0,
        overdue: d.overdue || 0,
        onTimeRate: d.onTimeRate || 0,
      }))
      // needs a minimum of tracked work to be comparable
      .filter(r => r.completed > 0 || r.overdue > 0);
    // score: reward throughput, weighted by reliability
    rows.forEach(r => { r.score = r.completed * (0.5 + (r.onTimeRate / 200)); });
    rows.sort((a, b) => b.score - a.score || b.completed - a.completed);
    return rows;
  }, [perfMetrics, rND]);

  // ── Build the compact data snapshot sent to the model ──────────────────────
  function buildContext() {
    const byStatus = {};
    tasks.forEach(t => { const s = t.status || 'Unknown'; byStatus[s] = (byStatus[s] || 0) + 1; });

    const overdue = tasks
      .filter(t => t.status !== 'Done' && dstr(t.end_date) && dstr(t.end_date) < today)
      .slice(0, 25)
      .map(t => ({ task: t.name, owner: t.owner, dept: t.dept, due: dstr(t.end_date) }));

    const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const dueSoon = tasks
      .filter(t => t.status !== 'Done' && dstr(t.end_date) && dstr(t.end_date) >= today && dstr(t.end_date) <= in7)
      .slice(0, 25)
      .map(t => ({ task: t.name, owner: t.owner, dept: t.dept, due: dstr(t.end_date) }));

    const activeRisks = risks
      .filter(r => (r.status || '').toUpperCase() !== 'CLOSED')
      .slice(0, 25)
      .map(r => ({ risk: r.description, impact: r.impact, status: r.status, owner: r.owner }));

    const offNow = leaves
      .filter(l => l.status === 'approved' && dstr(l.start_date) <= today && dstr(l.end_date) >= today)
      .map(l => ({ person: l.person, type: l.leave_type, until: dstr(l.end_date) }));
    const upcoming = leaves
      .filter(l => l.status === 'approved' && dstr(l.start_date) > today)
      .slice(0, 25)
      .map(l => ({ person: l.person, type: l.leave_type, from: dstr(l.start_date), to: dstr(l.end_date) }));

    const openDecisions = decisions
      .filter(d => (d.status || 'open') === 'open')
      .slice(0, 20)
      .map(d => ({ title: d.title, owner: d.owner, priority: d.priority, due: dstr(d.due_date) }));

    const flaggedKpis = kpis
      .filter(k => k.flag && k.flag !== 'green')
      .slice(0, 20)
      .map(k => ({ kpi: k.name, dept: k.dept, current: k.current_value, target: k.target, flag: k.flag }));

    const openRoles = roles
      .filter(r => r.status && r.status !== 'Filled')
      .slice(0, 20)
      .map(r => ({ role: r.title, status: r.status }));

    const velocity = Object.entries(metricsData || {}).map(([dept, m]) => ({
      dept, velocity: m.velocity, prior: m.prior_velocity, acceleration: m.acceleration
    }));

    const performance = perfMetrics && perfMetrics.people
      ? Object.entries(perfMetrics.people)
          .filter(([n]) => n !== 'Efehan Maleri')
          .map(([name, d]) => ({
            name, assigned: d.assigned, completed: d.completed,
            onTime: d.onTime, overdue: d.overdue, onTimeRate: d.onTimeRate
          }))
      : 'not loaded';

    return {
      note: 'Efehan (CEO) is excluded from performance and leave. Performance figures are current standings across tracked Linear/Asana work (not date-windowed yet), so treat them as cumulative.',
      today,
      team: { headcount: userRoles.length },
      tasks: { total: tasks.length, byStatus, overdue, dueSoon },
      risks: activeRisks,
      leaves: { offToday: offNow, upcoming },
      decisionsOpen: openDecisions,
      kpisFlagged: flaggedKpis,
      openRoles,
      departmentVelocity: velocity,
      performance,
      cashOnHand: config?.cash_on_hand || null,
    };
  }

  async function send(qRaw) {
    const q = (qRaw != null ? qRaw : input).trim();
    if (!q || loading) return;
    setInput('');
    const history = messages.map(m => ({ role: m.role, text: m.text }));
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const res = await fetch('/api/vitals-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, context: buildContext(), history }),
      });
      const data = await res.json();
      const text = data.answer || data.error || 'No response.';
      setMessages(prev => [...prev, { role: 'assistant', text, warn: !data.ok }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Could not reach the assistant. Check your connection and try again.', warn: true }]);
    } finally {
      setLoading(false);
    }
  }

  const suggestions = [
    'What is most at risk this week?',
    'Who is carrying the most overdue work?',
    'Give me a 5-line status brief for leadership.',
    'Which departments are slowing down?',
    'Who has the strongest delivery record so far?',
  ];

  const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 };
  const fg = 'var(--fg)', fg2 = 'var(--fg2)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100, margin: '0 auto', width: '100%' }}>

      {/* Recognition standings */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: fg }}>Delivery Recognition — current standings</div>
          <div style={{ fontSize: 9, color: fg2 }}>from tracked Linear + Asana work</div>
        </div>
        <div style={{ fontSize: 10, color: fg2, marginBottom: 12 }}>
          Recognition, not a formal review — task sizes and roles differ. Week / month / year windows are coming next.
        </div>
        {!standings && <div style={{ fontSize: 11, color: fg2, padding: '10px 0' }}>Loading performance from Linear + Asana…</div>}
        {standings && standings.length === 0 && <div style={{ fontSize: 11, color: fg2, padding: '10px 0' }}>No completed work tracked yet.</div>}
        {standings && standings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {standings.slice(0, 8).map((r, i) => (
              <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, background: i === 0 ? 'var(--bg3)' : 'var(--bg2)' }}>
                <div style={{ width: 20, textAlign: 'center', fontSize: 12, fontWeight: 800, color: i === 0 ? fg : fg2 }}>{i + 1}</div>
                <div style={{ flex: 1, fontSize: 12, fontWeight: i === 0 ? 700 : 600, color: fg }}>{r.name}{r.dept ? <span style={{ color: fg2, fontWeight: 500 }}> · {r.dept}</span> : null}</div>
                <div style={{ fontSize: 10, color: fg2 }}>{r.completed} done</div>
                <div style={{ fontSize: 10, color: fg2, minWidth: 78, textAlign: 'right' }}>{r.onTimeRate}% on-time</div>
                <div style={{ fontSize: 10, color: r.overdue > 0 ? '#DC2626' : fg2, minWidth: 70, textAlign: 'right' }}>{r.overdue} overdue</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: fg }}>Ask the Ops Assistant</div>
          <div style={{ fontSize: 10, color: fg2, marginTop: 2 }}>Answers from your live platform data. It does not make up names or numbers; if the data does not cover something, it will say so.</div>
        </div>

        <div ref={scrollRef} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 220, maxHeight: 460, overflowY: 'auto' }}>
          {messages.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, color: fg2 }}>Try one of these:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {suggestions.map(s => (
                  <button key={s} onClick={() => send(s)} disabled={loading}
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: fg, borderRadius: 999, padding: '6px 12px', fontSize: 11, cursor: loading ? 'default' : 'pointer' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '82%', padding: '10px 13px', borderRadius: 12, fontSize: 12.5, lineHeight: 1.55,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                background: m.role === 'user' ? 'var(--fg)' : (m.warn ? 'rgba(220,38,38,.08)' : 'var(--bg2)'),
                color: m.role === 'user' ? 'var(--bg)' : (m.warn ? '#B91C1C' : fg),
                border: m.role === 'user' ? 'none' : '1px solid var(--border)'
              }}>{m.text}</div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ padding: '10px 13px', borderRadius: 12, fontSize: 12, color: fg2, background: 'var(--bg2)', border: '1px solid var(--border)' }}>Thinking…</div>
            </div>
          )}
        </div>

        <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask about tasks, risks, leave, performance…"
            style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: fg, outline: 'none' }}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()}
            style={{ background: 'var(--fg)', color: 'var(--bg)', border: 'none', borderRadius: 8, padding: '0 18px', fontSize: 12, fontWeight: 700, cursor: loading || !input.trim() ? 'default' : 'pointer', opacity: loading || !input.trim() ? 0.5 : 1 }}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
