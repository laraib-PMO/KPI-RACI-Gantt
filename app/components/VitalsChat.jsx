'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// Own Supabase client (shares the logged-in session via browser storage).
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }
);

// ── Markdown renderer (no external deps) ────────────────────────────────────
function inline(s, k = 0) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_)/g;
  let last = 0, m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) out.push(<strong key={`b${k}-${m.index}`}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) out.push(<code key={`c${k}-${m.index}`} style={{ background: 'var(--bg3)', padding: '1px 5px', borderRadius: 4, fontSize: '0.92em', fontFamily: 'ui-monospace,Menlo,Consolas,monospace' }}>{t.slice(1, -1)}</code>);
    else out.push(<em key={`i${k}-${m.index}`}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

function Markdown({ text }) {
  const lines = String(text || '').split('\n');
  const blocks = [];
  let list = null;
  const flush = () => { if (list) { blocks.push(list); list = null; } };
  lines.forEach((raw) => {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { flush(); return; }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const b = /^\s*[-*]\s+(.*)$/.exec(line);
    const o = /^\s*(\d+)\.\s+(.*)$/.exec(line);
    if (h) { flush(); blocks.push({ t: 'h', level: h[1].length, text: h[2] }); }
    else if (b) { if (!list || list.t !== 'ul') { flush(); list = { t: 'ul', items: [] }; } list.items.push(b[1]); }
    else if (o) { if (!list || list.t !== 'ol') { flush(); list = { t: 'ol', items: [] }; } list.items.push(o[2]); }
    else { flush(); blocks.push({ t: 'p', text: line }); }
  });
  flush();

  let ref = false; // reference/citation styling after a "References" heading
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {blocks.map((bl, i) => {
        if (bl.t === 'h') {
          ref = /^\s*(references|sources|citations)\s*:?\s*$/i.test(bl.text);
          const size = bl.level === 1 ? 15 : bl.level === 2 ? 13.5 : 12.5;
          return (
            <div key={i} style={{ fontSize: ref ? 11 : size, fontWeight: 700, color: ref ? 'var(--fg2)' : 'var(--fg)', letterSpacing: ref ? '.04em' : 0, textTransform: ref ? 'uppercase' : 'none', marginTop: i ? (ref ? 8 : 4) : 0, paddingTop: ref ? 8 : 0, borderTop: ref ? '1px solid var(--border)' : 'none' }}>
              {ref ? 'References' : inline(bl.text, i)}
            </div>
          );
        }
        if (bl.t === 'ul' || bl.t === 'ol') {
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: ref ? 3 : 4 }}>
              {bl.items.map((it, j) => (
                <div key={j} style={{ display: 'flex', gap: 8, fontSize: ref ? 11 : 12.5, lineHeight: 1.5, color: ref ? 'var(--fg2)' : 'inherit' }}>
                  <span style={{ color: 'var(--fg2)', minWidth: 14, fontVariantNumeric: 'tabular-nums' }}>{bl.t === 'ol' ? `${j + 1}.` : '•'}</span>
                  <span style={{ flex: 1 }}>{inline(it, i * 100 + j)}</span>
                </div>
              ))}
            </div>
          );
        }
        return <div key={i} style={{ fontSize: ref ? 11 : 12.5, lineHeight: 1.6, color: ref ? 'var(--fg2)' : 'inherit' }}>{inline(bl.text, i)}</div>;
      })}
    </div>
  );
}

// ── Vitals AI assistant ─────────────────────────────────────────────────────
export default function VitalsChat(props) {
  const {
    tasks = [], risks = [], leaves = [], decisions = [], kpis = [],
    roles = [], metricsData = {}, config = {}, perfMetrics = null,
    userRoles = [], rND
  } = props;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const scrollRef = useRef(null);
  const emailRef = useRef(null);
  const currentIdRef = useRef(null);
  useEffect(() => { currentIdRef.current = currentId; }, [currentId]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, loading]);

  const loadConversations = async () => {
    const email = emailRef.current; if (!email) return;
    try {
      const { data } = await sb.from('ai_chats').select('id,title,updated_at').eq('user_email', email).order('updated_at', { ascending: false }).limit(50);
      if (data) setConversations(data);
    } catch {}
  };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await sb.auth.getSession();
        emailRef.current = data?.session?.user?.email || null;
      } catch {}
      loadConversations();
    })();
  }, []); // eslint-disable-line

  const today = new Date().toISOString().split('T')[0];
  const dstr = (d) => (d ? String(d).split('T')[0] : null);
  const deptOf = (name) => { if (!rND) return ''; const m = /\(([^)]+)\)\s*$/.exec(String(rND(name))); return m ? m[1] : ''; };

  const standings = useMemo(() => {
    if (!perfMetrics || !perfMetrics.people) return null;
    const rows = Object.entries(perfMetrics.people)
      .filter(([name]) => name !== 'Efehan Maleri')
      .map(([name, d]) => ({ name, dept: deptOf(name), completed: d.completed || 0, onTime: d.onTime || 0, overdue: d.overdue || 0, onTimeRate: d.onTimeRate || 0 }))
      .filter(r => r.completed > 0 || r.overdue > 0);
    rows.forEach(r => { r.score = r.completed * (0.5 + (r.onTimeRate / 200)); });
    rows.sort((a, b) => b.score - a.score || b.completed - a.completed);
    return rows;
  }, [perfMetrics]); // eslint-disable-line

  function buildContext() {
    const byStatus = {};
    tasks.forEach(t => { const s = t.status || 'Unknown'; byStatus[s] = (byStatus[s] || 0) + 1; });
    const overdue = tasks.filter(t => t.status !== 'Done' && dstr(t.end_date) && dstr(t.end_date) < today).slice(0, 25).map(t => ({ task: t.name, owner: t.owner, dept: t.dept, due: dstr(t.end_date) }));
    const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const dueSoon = tasks.filter(t => t.status !== 'Done' && dstr(t.end_date) && dstr(t.end_date) >= today && dstr(t.end_date) <= in7).slice(0, 25).map(t => ({ task: t.name, owner: t.owner, dept: t.dept, due: dstr(t.end_date) }));
    const activeRisks = risks.filter(r => (r.status || '').toUpperCase() !== 'CLOSED').slice(0, 25).map(r => ({ risk: r.description, impact: r.impact, status: r.status, owner: r.owner }));
    const offNow = leaves.filter(l => l.status === 'approved' && dstr(l.start_date) <= today && dstr(l.end_date) >= today).map(l => ({ person: l.person, type: l.leave_type, until: dstr(l.end_date) }));
    const upcoming = leaves.filter(l => l.status === 'approved' && dstr(l.start_date) > today).slice(0, 25).map(l => ({ person: l.person, type: l.leave_type, from: dstr(l.start_date), to: dstr(l.end_date) }));
    const openDecisions = decisions.filter(d => (d.status || 'open') === 'open').slice(0, 20).map(d => ({ title: d.title, owner: d.owner, priority: d.priority, due: dstr(d.due_date) }));
    const flaggedKpis = kpis.filter(k => k.flag && k.flag !== 'green').slice(0, 20).map(k => ({ kpi: k.name, dept: k.dept, current: k.current_value, target: k.target, flag: k.flag }));
    const openRoles = roles.filter(r => r.status && r.status !== 'Filled').slice(0, 20).map(r => ({ role: r.title, status: r.status }));
    const velocity = Object.entries(metricsData || {}).map(([dept, m]) => ({ dept, velocity: m.velocity, prior: m.prior_velocity, acceleration: m.acceleration }));
    const performance = perfMetrics && perfMetrics.people
      ? Object.entries(perfMetrics.people).filter(([n]) => n !== 'Efehan Maleri').map(([name, d]) => ({ name, dept: deptOf(name), assigned: d.assigned, completed: d.completed, onTime: d.onTime, overdue: d.overdue, onTimeRate: d.onTimeRate }))
      : 'not loaded';
    return {
      note: 'Efehan (CEO) is excluded from performance and leave. Performance figures are current standings across tracked Linear/Asana work (not date-windowed), so treat them as cumulative, not "this week".',
      today, team: { headcount: userRoles.length },
      tasks: { total: tasks.length, byStatus, overdue, dueSoon },
      risks: activeRisks, leaves: { offToday: offNow, upcoming },
      decisionsOpen: openDecisions, kpisFlagged: flaggedKpis, openRoles,
      departmentVelocity: velocity, performance, cashOnHand: config?.cash_on_hand || null,
    };
  }

  async function persist(msgs) {
    const email = emailRef.current; if (!email) return;
    const title = (msgs.find(m => m.role === 'user')?.text || 'New chat').slice(0, 60);
    try {
      if (currentIdRef.current) {
        await sb.from('ai_chats').update({ messages: msgs, title, updated_at: new Date().toISOString() }).eq('id', currentIdRef.current);
        loadConversations();
      } else {
        const { data } = await sb.from('ai_chats').insert({ user_email: email, title, messages: msgs }).select('id').single();
        if (data?.id) { currentIdRef.current = data.id; setCurrentId(data.id); loadConversations(); }
      }
    } catch {}
  }

  const setLastAssistant = (patch) => setMessages(prev => { const c = [...prev]; if (c.length) c[c.length - 1] = { ...c[c.length - 1], ...patch }; return c; });

  async function send(qRaw) {
    const q = (qRaw != null ? qRaw : input).trim();
    if (!q || loading) return;
    setInput('');
    const base = [...messages, { role: 'user', text: q }];
    setMessages([...base, { role: 'assistant', text: '', streaming: true }]);
    setLoading(true);
    try {
      const res = await fetch('/api/vitals-ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, context: buildContext(), history: messages.map(m => ({ role: m.role, text: m.text })) }),
      });
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const d = await res.json();
        const text = d.answer || d.error || 'No response.';
        setLastAssistant({ text, streaming: false, warn: !d.ok });
        if (d.ok) await persist([...base, { role: 'assistant', text }]);
      } else {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let acc = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          setLastAssistant({ text: acc, streaming: true });
        }
        setLastAssistant({ text: acc, streaming: false });
        if (acc.trim()) await persist([...base, { role: 'assistant', text: acc }]);
      }
    } catch (e) {
      setLastAssistant({ text: 'Could not reach the assistant. Please try again.', streaming: false, warn: true });
    } finally { setLoading(false); }
  }

  async function openChat(id) {
    if (loading) return;
    try {
      const { data } = await sb.from('ai_chats').select('messages').eq('id', id).single();
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
      currentIdRef.current = id; setCurrentId(id);
    } catch {}
  }
  function newChat() { if (loading) return; setMessages([]); currentIdRef.current = null; setCurrentId(null); }
  async function deleteChat(id, e) {
    e.stopPropagation();
    try { await sb.from('ai_chats').delete().eq('id', id); } catch {}
    if (id === currentIdRef.current) newChat();
    loadConversations();
  }

  const relTime = (iso) => {
    const d = new Date(iso), now = new Date(), diff = (now - d) / 1000;
    if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const suggestions = [
    'What is most at risk this week?',
    'Who is carrying the most overdue work?',
    'Give me a detailed status brief for leadership.',
    'Which departments are slowing down, and why?',
    'Who has the strongest delivery record so far?',
  ];

  const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 };
  const fg = 'var(--fg)', fg2 = 'var(--fg2)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1120, margin: '0 auto', width: '100%' }}>
      <style>{`@keyframes vcblink{0%,80%,100%{opacity:.25}40%{opacity:1}} .vc-dot{width:6px;height:6px;border-radius:50%;background:var(--fg2);display:inline-block;animation:vcblink 1.2s infinite both} .vc-conv:hover{background:var(--bg3)!important} .vc-conv:hover .vc-del{opacity:1!important}`}</style>

      {/* Recognition standings */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: fg }}>Delivery Recognition — current standings</div>
          <div style={{ fontSize: 9, color: fg2 }}>from tracked Linear + Asana work</div>
        </div>
        <div style={{ fontSize: 10, color: fg2, marginBottom: 12 }}>Recognition, not a formal review — task sizes and roles differ. Week / month / year windows are coming next.</div>
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

      {/* Sidebar + chat */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        {/* Conversation sidebar */}
        <div style={{ ...card, width: 210, minWidth: 210, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
            <button onClick={newChat} style={{ width: '100%', background: 'var(--fg)', color: 'var(--bg)', border: 'none', borderRadius: 8, padding: '9px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ New chat</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 6, minHeight: 120, maxHeight: 520 }}>
            {conversations.length === 0 && <div style={{ fontSize: 10.5, color: fg2, padding: 10, textAlign: 'center' }}>No saved chats yet.</div>}
            {conversations.map(c => (
              <div key={c.id} className="vc-conv" onClick={() => openChat(c.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 9px', borderRadius: 8, cursor: 'pointer', background: c.id === currentId ? 'var(--bg3)' : 'transparent', marginBottom: 2 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: fg, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title || 'Untitled'}</div>
                  <div style={{ fontSize: 9, color: fg2 }}>{relTime(c.updated_at)}</div>
                </div>
                <div className="vc-del" onClick={(e) => deleteChat(c.id, e)} title="Delete" style={{ opacity: 0, fontSize: 14, color: fg2, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>×</div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div style={{ ...card, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: fg }}>Ask the Ops Assistant</div>
            <div style={{ fontSize: 10, color: fg2, marginTop: 2 }}>Answers from your live platform data, with references. It does not make up names or numbers; if the data does not cover something, it says so.</div>
          </div>

          <div ref={scrollRef} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 18, minHeight: 260, maxHeight: 560, overflowY: 'auto' }}>
            {messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 11, color: fg2 }}>Try one of these:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {suggestions.map(s => (
                    <button key={s} onClick={() => send(s)} disabled={loading} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: fg, borderRadius: 999, padding: '7px 13px', fontSize: 11.5, cursor: loading ? 'default' : 'pointer' }}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              m.role === 'user' ? (
                <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ maxWidth: '80%', padding: '9px 13px', borderRadius: 14, borderBottomRightRadius: 4, fontSize: 12.5, lineHeight: 1.5, background: 'var(--fg)', color: 'var(--bg)' }}>{m.text}</div>
                </div>
              ) : (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, background: m.warn ? 'rgba(220,38,38,.12)' : 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: m.warn ? '#B91C1C' : fg2 }}>A</div>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: fg2 }}>Ops Assistant</div>
                  </div>
                  <div style={{ paddingLeft: 25 }}>
                    {m.warn
                      ? <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#B91C1C' }}>{m.text}</div>
                      : (m.text
                        ? <div style={{ color: fg }}><Markdown text={m.text} />{m.streaming && <span style={{ display: 'inline-block', width: 7, height: 14, marginLeft: 2, background: 'var(--fg2)', verticalAlign: 'text-bottom', animation: 'vcblink 1s infinite' }} />}</div>
                        : <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 18 }}><span className="vc-dot" /><span className="vc-dot" style={{ animationDelay: '.2s' }} /><span className="vc-dot" style={{ animationDelay: '.4s' }} /></div>)}
                  </div>
                </div>
              )
            ))}
          </div>

          <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about tasks, risks, leave, performance…"
              style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '11px 13px', fontSize: 12.5, color: fg, outline: 'none' }} />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              style={{ background: 'var(--fg)', color: 'var(--bg)', border: 'none', borderRadius: 8, padding: '0 20px', fontSize: 12, fontWeight: 700, cursor: loading || !input.trim() ? 'default' : 'pointer', opacity: loading || !input.trim() ? 0.5 : 1 }}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}
