'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_KEY || ''
);

const CL = { PMO:"#3B82F6", Development:"#10B981", Architecture:"#14B8A6", "AI/Science":"#F59E0B", Design:"#8B5CF6", Marketing:"#EC4899", Legal:"#64748B", Hiring:"#06B6D4", Leadership:"#6366F1" };
const STS = ["To Do","Doing","Done"];
const RSK_OPT = ["On track","At risk","Off track"];
const RC = { "On track":{bg:"#DCFCE7",c:"#166534"}, "At risk":{bg:"#FEF3C7",c:"#D97706"}, "Off track":{bg:"#FEE2E2",c:"#DC2626"} };
const PC = { Low:{bg:"#DBEAFE",c:"#1D4ED8"}, Medium:{bg:"#FEF3C7",c:"#D97706"}, High:{bg:"#FEE2E2",c:"#DC2626"} };
const IC = { CRITICAL:{bg:"#DC2626",c:"white"}, HIGH:{bg:"#FEE2E2",c:"#991B1B"}, MEDIUM:{bg:"#FEF3C7",c:"#92400E"} };
const FC = { green:"#16A34A", yellow:"#D97706", red:"#DC2626" };

const fD = (s) => new Date(s+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short"});
const dB = (a,b) => Math.round((new Date(b)-new Date(a))/864e5);

const Bdg = ({bg,c,children}) => <span style={{background:bg,color:c,padding:"2px 8px",borderRadius:99,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{children}</span>;

// ═══ TICKET POPUP ═══
function TicketPopup({ task, tasks, onClose, onUpdate }) {
  if (!task) return null;
  const cl = CL[task.dept]||"#94A3B8";
  const rc = RC[task.risk]; const pc = PC[task.priority];
  const depNames = (task.deps||[]).map(id => tasks.find(t=>t.id===id)?.name||id);
  const blocks = tasks.filter(t=>(t.deps||[]).includes(task.id)).map(t=>t.name);

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"white",borderRadius:12,width:480,maxHeight:"80vh",overflow:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
        <div style={{borderBottom:`4px solid ${cl}`,padding:"20px 24px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:10,color:"#94A3B8",fontWeight:600}}>TASK-{task.id} / {task.dept}</span>
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#94A3B8"}}>x</button>
          </div>
          <div style={{fontSize:18,fontWeight:800,color:"#0D1B2A",marginTop:4}}>{task.name}</div>
          <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
            <Bdg bg={cl+"20"} c={cl}>{task.dept}</Bdg>
            {pc && <Bdg bg={pc.bg} c={pc.c}>{task.priority}</Bdg>}
            {rc && <Bdg bg={rc.bg} c={rc.c}>{task.risk}</Bdg>}
          </div>
        </div>
        <div style={{padding:"16px 24px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,fontSize:13,color:"#475569"}}>
          <div><div style={{fontSize:10,color:"#94A3B8",fontWeight:600}}>Owner</div><b>{task.owner}</b></div>
          <div><div style={{fontSize:10,color:"#94A3B8",fontWeight:600}}>Duration</div><b>{dB(task.start_date,task.end_date)||1}d</b></div>
          <div><div style={{fontSize:10,color:"#94A3B8",fontWeight:600}}>Start</div>{fD(task.start_date)}</div>
          <div><div style={{fontSize:10,color:"#94A3B8",fontWeight:600}}>End</div>{fD(task.end_date)}</div>
        </div>
        <div style={{padding:"0 24px 16px"}}>
          <div style={{fontSize:10,color:"#94A3B8",fontWeight:600,marginBottom:4}}>Status</div>
          <div style={{display:"flex",gap:6}}>
            {STS.map(s => <button key={s} onClick={()=>onUpdate(task.id,{status:s})} style={{padding:"6px 14px",borderRadius:6,border:task.status===s?"2px solid #1E293B":"1px solid #E2E8F0",background:task.status===s?"#0D1B2A":"white",color:task.status===s?"white":"#475569",fontSize:12,fontWeight:600,cursor:"pointer"}}>{s}</button>)}
          </div>
        </div>
        <div style={{padding:"0 24px 16px"}}>
          <div style={{fontSize:10,color:"#94A3B8",fontWeight:600,marginBottom:4}}>Risk</div>
          <div style={{display:"flex",gap:6}}>
            {RSK_OPT.map(r => {const rc2=RC[r];return <button key={r} onClick={()=>onUpdate(task.id,{risk:r})} style={{padding:"4px 12px",borderRadius:99,border:task.risk===r?`2px solid ${rc2.c}`:"1px solid #E2E8F0",background:rc2.bg,color:rc2.c,fontSize:11,fontWeight:700,cursor:"pointer"}}>{r}</button>})}
          </div>
        </div>
        {depNames.length>0 && <div style={{padding:"0 24px 12px"}}><div style={{fontSize:10,color:"#94A3B8",fontWeight:600}}>Depends On</div>{depNames.map((n,i)=><div key={i} style={{fontSize:12,color:"#6366F1"}}>→ {n}</div>)}</div>}
        {blocks.length>0 && <div style={{padding:"0 24px 20px"}}><div style={{fontSize:10,color:"#94A3B8",fontWeight:600}}>Blocks</div>{blocks.map((n,i)=><div key={i} style={{fontSize:12,color:"#DC2626"}}>← {n}</div>)}</div>}
      </div>
    </div>
  );
}

// ═══ SIMPLE TABLE ═══
function Tbl({ headers, rows }) {
  return (
    <div style={{border:"1px solid #E8ECEF",borderRadius:8,overflow:"hidden"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{background:"#F8FAFC",borderBottom:"1px solid #E2E8F0"}}>
          {headers.map(h => <th key={h} style={{padding:"10px 8px",textAlign:"left",fontWeight:600,color:"#64748B",fontSize:11}}>{h}</th>)}
        </tr></thead>
        <tbody>{rows.map((row,i) => (
          <tr key={i} style={{borderBottom:"1px solid #F1F5F9"}}>
            {row.map((cell,ci) => <td key={ci} style={{padding:"8px"}}>{cell}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function DeptHdr({ dept }) {
  return <div style={{background:(CL[dept]||"#94A3B8")+"15",color:CL[dept],padding:"8px 12px",borderRadius:"6px 6px 0 0",fontWeight:700,fontSize:13,borderLeft:`4px solid ${CL[dept]}`}}>{dept}</div>;
}

// ═══ MAIN PAGE ═══
export default function Home() {
  const [tasks, setTasks] = useState([]);
  const [raci, setRaci] = useState([]);
  const [risks, setRisks] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [view, setView] = useState("timeline");
  const [sel, setSel] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [loading, setLoading] = useState(true);

  // Load all data from Supabase
  useEffect(() => {
    async function loadAll() {
      const [t, r, ri, k, m] = await Promise.all([
        supabase.from('tasks').select('*').order('id'),
        supabase.from('raci').select('*').order('dept,id'),
        supabase.from('risks').select('*').order('id'),
        supabase.from('kpis').select('*').order('dept,id'),
        supabase.from('meetings').select('*').order('id'),
      ]);
      if (t.data) setTasks(t.data);
      if (r.data) setRaci(r.data);
      if (ri.data) setRisks(ri.data);
      if (k.data) setKpis(k.data);
      if (m.data) setMeetings(m.data);
      setLoading(false);
    }
    loadAll();

    // Realtime subscription — tasks update live for all users
    const channel = supabase.channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        supabase.from('tasks').select('*').order('id').then(({ data }) => { if (data) setTasks(data); });
      })
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Update task in Supabase
  const updateTask = useCallback(async (id, updates) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    setSel(prev => prev?.id === id ? { ...prev, ...updates } : prev);
    await supabase.from('tasks').update(updates).eq('id', id);
  }, []);

  // Sync all tools
  const doSync = async () => {
    setSyncing(true); setSyncMsg("Syncing...");
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      setSyncMsg(`Synced: ${data.results?.map(r => `${r.source} ${r.status}`).join(', ')}`);
    } catch (e) { setSyncMsg("Sync error: " + e.message); }
    setSyncing(false);
  };

  const stats = useMemo(() => ({
    total: tasks.length, todo: tasks.filter(t=>t.status==="To Do").length,
    doing: tasks.filter(t=>t.status==="Doing").length, done: tasks.filter(t=>t.status==="Done").length,
    risk: tasks.filter(t=>t.risk!=="On track").length,
  }), [tasks]);

  const TABS = [{id:"timeline",l:"Timeline"},{id:"board",l:"Board"},{id:"raci",l:"RACI"},{id:"kpi",l:"KPIs"},{id:"risk",l:"Risks"},{id:"meet",l:"Meetings"}];

  if (loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontSize:16,color:"#64748B"}}>Loading Attimo PMO...</div>;

  // ═══ RACI grouped by dept ═══
  const raciByDept = {};
  raci.forEach(r => { if (!raciByDept[r.dept]) raciByDept[r.dept] = []; raciByDept[r.dept].push(r); });

  // ═══ KPIs grouped by dept ═══
  const kpiByDept = {};
  kpis.forEach(k => { if (!kpiByDept[k.dept]) kpiByDept[k.dept] = []; kpiByDept[k.dept].push(k); });

  return (
    <div style={{background:"#fff",minHeight:"100vh"}}>
      {/* Header */}
      <div style={{borderBottom:"1px solid #E8ECEF",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:26,height:26,borderRadius:6,background:"#0D1B2A",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"white",fontSize:13,fontWeight:800}}>A</span></div>
          <span style={{fontSize:15,fontWeight:700}}>Attimo PMO</span>
          <span style={{color:"#CBD5E1"}}>|</span>
          <span style={{fontSize:12,color:"#64748B"}}>Company Operations</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={doSync} disabled={syncing} style={{background:syncing?"#E2E8F0":"#0D1B2A",color:syncing?"#94A3B8":"white",border:"none",padding:"6px 14px",borderRadius:6,fontWeight:600,fontSize:11,cursor:syncing?"wait":"pointer"}}>{syncing?"Syncing...":"Sync All"}</button>
          {syncMsg && <span style={{fontSize:10,color:"#10B981"}}>{syncMsg}</span>}
          <div style={{display:"flex",gap:10,fontSize:11}}>
            <span><b style={{color:"#3B82F6"}}>{stats.total}</b> total</span>
            <span><b style={{color:"#F59E0B"}}>{stats.doing}</b> doing</span>
            <span><b style={{color:"#10B981"}}>{stats.done}</b> done</span>
            <span><b style={{color:"#EF4444"}}>{stats.risk}</b> at risk</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{borderBottom:"1px solid #E8ECEF",padding:"0 20px",display:"flex",flexWrap:"wrap"}}>
        {TABS.map(t => <button key={t.id} onClick={()=>setView(t.id)} style={{padding:"10px 16px",border:"none",background:"none",fontWeight:600,fontSize:13,cursor:"pointer",color:view===t.id?"#1E293B":"#94A3B8",borderBottom:view===t.id?"2px solid #1E293B":"2px solid transparent"}}>{t.l}</button>)}
      </div>

      {/* Content */}
      <div style={{padding:20}}>

        {/* ═══ TIMELINE ═══ */}
        {view === "timeline" && (
          <div style={{overflowX:"auto",background:"white",borderRadius:8,border:"1px solid #E8ECEF"}}>
            {STS.map(st => {
              const items = tasks.filter(t => t.status === st);
              return (
                <div key={st} style={{padding:"12px 16px",borderBottom:"1px solid #F1F5F9"}}>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:10,cursor:"pointer"}}>▼</span> {st}
                    <span style={{background:"#E2E8F0",borderRadius:99,padding:"1px 8px",fontSize:11,color:"#64748B"}}>{items.length}</span>
                  </div>
                  {items.map(t => {
                    const cl = CL[t.dept]||"#94A3B8";
                    const rc = RC[t.risk];
                    return (
                      <div key={t.id} onClick={()=>setSel(t)} style={{display:"flex",alignItems:"center",gap:12,padding:"6px 0",cursor:"pointer",borderBottom:"1px solid #FAFAFA"}}>
                        <div style={{width:180,display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                          <div style={{width:18,height:18,borderRadius:"50%",background:cl,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"white",fontSize:8,fontWeight:700}}>{t.owner?.[0]}</span></div>
                          <span style={{fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</span>
                        </div>
                        <div style={{flex:1,position:"relative",height:24,background:"#F8FAFC",borderRadius:4}}>
                          {(() => {
                            const tS = new Date("2026-04-25"), tE = new Date("2026-07-05");
                            const totalD = (tE-tS)/864e5;
                            const sOff = Math.max(0,(new Date(t.start_date)-tS)/864e5);
                            const dur = Math.max(1, dB(t.start_date, t.end_date)+1);
                            const left = `${(sOff/totalD)*100}%`;
                            const width = `${Math.max((dur/totalD)*100, 1)}%`;
                            return <div style={{position:"absolute",left,width,top:2,bottom:2,borderRadius:4,background:cl,opacity:t.status==="Done"?0.3:0.8,display:"flex",alignItems:"center",paddingLeft:6}}>
                              <span style={{color:"white",fontSize:9,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden"}}>{fD(t.start_date)}-{fD(t.end_date)}</span>
                            </div>;
                          })()}
                        </div>
                        {t.risk !== "On track" && rc && <div style={{width:8,height:8,borderRadius:"50%",background:rc.c,flexShrink:0}} />}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ BOARD ═══ */}
        {view === "board" && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
            {STS.map(st => (
              <div key={st} style={{background:"#F8FAFC",borderRadius:8,padding:12,minHeight:200}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{fontWeight:700,fontSize:14}}>{st}</span><span style={{background:"#E2E8F0",borderRadius:99,padding:"2px 8px",fontSize:11,fontWeight:600,color:"#64748B"}}>{tasks.filter(t=>t.status===st).length}</span></div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {tasks.filter(t=>t.status===st).map(t => {
                    const rc=RC[t.risk]; const pc=PC[t.priority];
                    return (
                      <div key={t.id} onClick={()=>setSel(t)} style={{background:"white",borderRadius:8,padding:12,border:"1px solid #E8ECEF",borderLeft:`4px solid ${CL[t.dept]||"#94A3B8"}`,cursor:"pointer"}}>
                        <div style={{fontSize:13,fontWeight:600,marginBottom:6}}>{t.name}</div>
                        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>
                          {pc && <Bdg bg={pc.bg} c={pc.c}>{t.priority}</Bdg>}
                          {rc && <Bdg bg={rc.bg} c={rc.c}>{t.risk}</Bdg>}
                        </div>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                          <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#64748B"}}>
                            <div style={{width:16,height:16,borderRadius:"50%",background:CL[t.dept],display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"white",fontSize:7,fontWeight:700}}>{t.owner?.[0]}</span></div>
                            {fD(t.start_date)}-{fD(t.end_date)}
                          </div>
                          <select value={t.status} onChange={e=>{e.stopPropagation();updateTask(t.id,{status:e.target.value});}} onClick={e=>e.stopPropagation()}
                            style={{fontSize:10,border:"1px solid #E2E8F0",borderRadius:4,padding:"2px",cursor:"pointer"}}>
                            {STS.map(s=><option key={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ RACI ═══ */}
        {view === "raci" && (
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div style={{background:"#F1F5F9",padding:"8px 12px",borderRadius:6,fontSize:11,color:"#64748B"}}><b>R</b>=Responsible <b>A</b>=Accountable <b>C</b>=Consulted <b>I</b>=Informed <span style={{color:"#3B82F6"}}>[Suggest]</span>=PMO suggestion</div>
            {Object.entries(raciByDept).map(([dept, rows]) => (
              <div key={dept}><DeptHdr dept={dept} />
                <Tbl headers={["Task","R","A","C","I","Notes"]} rows={rows.map(r=>[
                  <span style={{fontWeight:600,color:r.is_suggestion?"#3B82F6":"#1E293B"}}>{r.is_suggestion?"[Suggest] ":""}{r.task}</span>,
                  r.responsible, r.accountable, r.consulted, r.informed,
                  <span style={{fontSize:11,color:"#92400E"}}>{r.notes}</span>
                ])} />
              </div>
            ))}
          </div>
        )}

        {/* ═══ KPIs ═══ */}
        {view === "kpi" && (
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {Object.entries(kpiByDept).map(([dept, items]) => (
              <div key={dept}><DeptHdr dept={dept} />
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8,padding:10,background:"white",border:"1px solid #E8ECEF",borderRadius:"0 0 6px 6px"}}>
                  {items.map(k => (
                    <div key={k.id} style={{borderLeft:`3px solid ${FC[k.flag]}`,borderRadius:6,padding:10,background:"#FAFBFC"}}>
                      <div style={{fontSize:12,fontWeight:700,marginBottom:4}}>{k.name}</div>
                      <div style={{fontSize:10,color:"#64748B"}}>Target: {k.target}</div>
                      <div style={{display:"flex",alignItems:"center",gap:4,marginTop:4}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:FC[k.flag]}} />
                        <span style={{fontSize:11,fontWeight:700,color:FC[k.flag]}}>{k.current_value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ RISKS ═══ */}
        {view === "risk" && (
          <Tbl headers={["#","Risk","Impact","Owner","Mitigation"]} rows={risks.map(r => [
            <b>{r.id}</b>, <span style={{fontWeight:600}}>{r.description}</span>,
            <Bdg bg={IC[r.impact]?.bg} c={IC[r.impact]?.c}>{r.impact}</Bdg>,
            <b>{r.owner}</b>, <span style={{color:"#475569"}}>{r.mitigation}</span>
          ])} />
        )}

        {/* ═══ MEETINGS ═══ */}
        {view === "meet" && (
          <Tbl headers={["Type","Meeting","When","Duration","Owner","Attendees"]} rows={meetings.map(m => [
            <Bdg bg={{Weekly:"#3B82F6",Milestone:"#F59E0B","Bi-weekly":"#6366F1",Monthly:"#8B5CF6"}[m.type]||"#94A3B8"} c="white">{m.type}</Bdg>,
            <b>{m.name}</b>, m.schedule, m.duration, <b>{m.owner}</b>, <span style={{color:"#475569"}}>{m.attendees}</span>
          ])} />
        )}
      </div>

      {/* Ticket Popup */}
      <TicketPopup task={sel} tasks={tasks} onClose={()=>setSel(null)} onUpdate={updateTask} />
    </div>
  );
}
