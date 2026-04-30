'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL||'', process.env.NEXT_PUBLIC_SUPABASE_KEY||'');
const CL={PMO:"#3B82F6",Development:"#10B981",Architecture:"#14B8A6","AI/Science":"#F59E0B",Design:"#8B5CF6",Marketing:"#EC4899",Legal:"#64748B",Hiring:"#06B6D4",Leadership:"#6366F1"};
const STS=["To Do","Doing","Done"];const PRI_OPT=["Low","Medium","High"];const DEPT_OPT=Object.keys(CL);const RSK_OPT=["On track","At risk","Off track"];const IMP_OPT=["CRITICAL","HIGH","MEDIUM","LOW"];
const RC={"On track":{bg:"#DCFCE7",c:"#166534"},"At risk":{bg:"#FEF3C7",c:"#D97706"},"Off track":{bg:"#FEE2E2",c:"#DC2626"}};
const PC={Low:{bg:"#DBEAFE",c:"#1D4ED8"},Medium:{bg:"#FEF3C7",c:"#D97706"},High:{bg:"#FEE2E2",c:"#DC2626"}};
const FC={green:"#16A34A",yellow:"#D97706",red:"#DC2626"};
const MT_CLR={Weekly:"#3B82F6",Milestone:"#F59E0B","Bi-weekly":"#6366F1",Monthly:"#8B5CF6"};
const ANCH=[{d:"2026-05-07",l:"Hatchery",c:"#6366F1"},{d:"2026-05-21",l:"GTM",c:"#F59E0B"},{d:"2026-06-10",l:"Launch",c:"#10B981"},{d:"2026-07-01",l:"Pitch Day",c:"#EF4444"}];

// Robust date parsing for Supabase dates
const pD=s=>{if(!s)return new Date();const str=String(s).split('T')[0];const[y,m,d]=str.split('-').map(Number);return new Date(y,m-1,d)};
const fD=s=>{try{return pD(s).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}catch{return String(s)}};
const daysB=(a,b)=>{const da=pD(a),db=pD(b);return Math.round((db-da)/864e5)};
const today=new Date().toISOString().split("T")[0];
const isOverdue=(t)=>t.status!=="Done"&&String(t.end_date).split('T')[0]<today;

const Bdg=({bg,c,children,onClick})=><span onClick={onClick} style={{background:bg,color:c,padding:"2px 8px",borderRadius:99,fontSize:10,fontWeight:700,whiteSpace:"nowrap",cursor:onClick?"pointer":"default",transition:"all .2s"}}>{children}</span>;

const CSS=`
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideR{from{opacity:0;transform:translateX(-15px)}to{opacity:1;transform:translateX(0)}}
@keyframes scaleIn{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes barGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes glow{0%,100%{box-shadow:0 0 5px rgba(59,130,246,.2)}50%{box-shadow:0 0 15px rgba(59,130,246,.4)}}
.af{animation:fadeUp .35s ease-out both}.asl{animation:slideR .35s ease-out both}.asc{animation:scaleIn .25s ease-out both}
.ch{transition:all .2s ease}.ch:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.08)!important}
.rh{transition:all .15s ease}.rh:hover{background:var(--hover)!important}
.bar-g{transform-origin:left;animation:barGrow .5s ease-out both}
.glow-btn{animation:glow 2s infinite}
.overdue-row{border-left:3px solid #EF4444!important;background:linear-gradient(90deg,#FEF2F2,transparent)!important}
.ontrack-row:hover{border-left:3px solid #10B981!important;background:linear-gradient(90deg,#F0FFF4,transparent)!important}
.atrisk-row:hover{border-left:3px solid #F59E0B!important;background:linear-gradient(90deg,#FFFBEB,transparent)!important}
.offtrack-row:hover{border-left:3px solid #EF4444!important;background:linear-gradient(90deg,#FEF2F2,transparent)!important}
.done-row{opacity:.6}.done-row:hover{opacity:1}
.pulse-dot{animation:pulse 1.5s infinite}
[data-theme="dark"]{--bg:#0F172A;--bg2:#1E293B;--bg3:#334155;--fg:#F1F5F9;--fg2:#94A3B8;--border:#334155;--hover:rgba(59,130,246,.08);--card:#1E293B;--hdr:linear-gradient(135deg,#0F172A 0%,#1E293B 50%,#0F172A 100%)}
[data-theme="light"]{--bg:#FFFFFF;--bg2:#F8FAFC;--bg3:#F1F5F9;--fg:#1E293B;--fg2:#64748B;--border:#E8ECEF;--hover:#F8FAFC;--card:#FFFFFF;--hdr:linear-gradient(135deg,#0D1B2A,#1B3A5C)}
body{background:var(--bg);color:var(--fg);transition:background .3s,color .3s}
*{box-sizing:border-box}
@media(max-width:768px){
  .mob-col1{grid-template-columns:1fr!important}
  .mob-hide{display:none!important}
  .mob-wrap{flex-wrap:wrap!important}
  .mob-full{width:100%!important;min-width:0!important}
  .mob-scroll{overflow-x:auto!important;-webkit-overflow-scrolling:touch}
  .mob-pad{padding:12px!important}
  .mob-stack{flex-direction:column!important;gap:8px!important}
}
@media(max-width:480px){
  .mob-sm-hide{display:none!important}
  .mob-sm-text{font-size:11px!important}
}
@media(max-width:768px){table{display:block;overflow-x:auto;-webkit-overflow-scrolling:touch}}
`;

function rowClass(t){if(t.status==="Done")return"done-row rh";if(isOverdue(t))return"overdue-row rh";if(t.risk==="Off track")return"offtrack-row rh";if(t.risk==="At risk")return"atrisk-row rh";return"ontrack-row rh"}

function InEdit({value,onChange,type="text",options}){
  const[editing,setEditing]=useState(false);const[val,setVal]=useState(value);const ref=useRef();
  useEffect(()=>{setVal(value)},[value]);useEffect(()=>{if(editing&&ref.current)ref.current.focus()},[editing]);
  if(type==="select")return <select value={val} onChange={e=>{setVal(e.target.value);onChange(e.target.value)}} style={{border:"none",background:"transparent",fontSize:12,color:"var(--fg)",cursor:"pointer",padding:"2px 4px",borderRadius:4}}>{options.map(o=><option key={o}>{o}</option>)}</select>;
  if(type==="date")return <input type="date" value={val} onChange={e=>{setVal(e.target.value);onChange(e.target.value)}} style={{border:"1px solid var(--border)",borderRadius:4,padding:"2px 4px",fontSize:11,width:120,background:"var(--bg2)",color:"var(--fg)"}}/>;
  if(!editing)return <span onClick={()=>setEditing(true)} style={{cursor:"text",padding:"2px 4px",borderRadius:4,minWidth:40,display:"inline-block",color:"var(--fg)"}}>{val||"—"}</span>;
  return <input ref={ref} value={val} onChange={e=>setVal(e.target.value)} onBlur={()=>{setEditing(false);onChange(val)}} onKeyDown={e=>{if(e.key==="Enter"){setEditing(false);onChange(val)}}} style={{border:"1px solid #3B82F6",borderRadius:4,padding:"2px 4px",fontSize:12,width:140,background:"var(--bg2)",color:"var(--fg)"}}/>;
}

function AddModal({title,fields,onSave,onClose}){
  const[vals,setVals]=useState({});
  return <div className="af" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}} onClick={onClose}>
    <div className="asc" onClick={e=>e.stopPropagation()} style={{background:"var(--card)",borderRadius:16,width:"min(440px,95vw)",padding:20,boxShadow:"0 25px 60px rgba(0,0,0,.3)",border:"1px solid var(--border)"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}><h3 style={{margin:0,fontSize:16,fontWeight:800,color:"var(--fg)"}}>{title}</h3><button onClick={onClose} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"var(--fg2)"}}>✕</button></div>
      {fields.map(f=><div key={f.key} style={{marginBottom:12}}>
        <label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>{f.label}</label>
        {f.type==="select"?<select value={vals[f.key]||""} onChange={e=>setVals(p=>({...p,[f.key]:e.target.value}))} style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,background:"var(--bg2)",color:"var(--fg)"}}><option value="">Select...</option>{f.options.map(o=><option key={o}>{o}</option>)}</select>
        :<input type={f.type||"text"} placeholder={f.placeholder} value={vals[f.key]||""} onChange={e=>setVals(p=>({...p,[f.key]:e.target.value}))} style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,boxSizing:"border-box",background:"var(--bg2)",color:"var(--fg)"}}/>}
      </div>)}
      <button onClick={()=>onSave(vals)} style={{width:"100%",padding:10,background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",borderRadius:8,fontWeight:700,fontSize:13,cursor:"pointer",marginTop:8,transition:"transform .15s"}} onMouseEnter={e=>e.target.style.transform="scale(1.02)"} onMouseLeave={e=>e.target.style.transform="scale(1)"}>Save</button>
    </div>
  </div>;
}

function TicketPopup({task,tasks,onClose,onUpdate,onDelete}){
  if(!task)return null;const cl=CL[task.dept]||"#94A3B8";const rc=RC[task.risk];const pc=PC[task.priority];
  const depN=(task.deps||[]).map(id=>tasks.find(t=>t.id===id)?.name||id);
  const blocks=tasks.filter(t=>(t.deps||[]).includes(task.id)).map(t=>t.name);
  const od=isOverdue(task);
  return <div className="af" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}} onClick={onClose}>
    <div className="asc" onClick={e=>e.stopPropagation()} style={{background:"var(--card)",borderRadius:16,width:"min(500px,95vw)",maxHeight:"85vh",overflow:"auto",boxShadow:"0 25px 60px rgba(0,0,0,.3)",border:"1px solid var(--border)"}}>
      <div style={{borderBottom:"4px solid "+cl,padding:"20px 24px 16px",background:od?"linear-gradient(135deg,#FEE2E2,#FEF2F2)":"transparent",borderRadius:"16px 16px 0 0"}}>
        <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:10,color:"var(--fg2)",fontWeight:600}}>TASK-{task.id} / {task.dept}{od?" — OVERDUE":""}</span><button onClick={onClose} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"var(--fg2)"}}>✕</button></div>
        <div style={{fontSize:18,fontWeight:800,marginTop:4,color:od?"#DC2626":"var(--fg)"}}><InEdit value={task.name} onChange={v=>onUpdate(task.id,{name:v})}/></div>
        <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}><Bdg bg={cl+"20"} c={cl}>{task.dept}</Bdg>{pc&&<Bdg bg={pc.bg} c={pc.c}>{task.priority}</Bdg>}{rc&&<Bdg bg={rc.bg} c={rc.c}>{task.risk}</Bdg>}{od&&<Bdg bg="#DC2626" c="#fff">OVERDUE</Bdg>}</div>
      </div>
      <div style={{padding:"16px 24px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,fontSize:13,color:"var(--fg2)"}}>
        <div><div style={{fontSize:10,fontWeight:600}}>Owner</div><InEdit value={task.owner} onChange={v=>onUpdate(task.id,{owner:v})}/></div>
        <div><div style={{fontSize:10,fontWeight:600}}>Department</div><InEdit value={task.dept} onChange={v=>onUpdate(task.id,{dept:v})} type="select" options={DEPT_OPT}/></div>
        <div><div style={{fontSize:10,fontWeight:600}}>Start</div><InEdit value={String(task.start_date).split('T')[0]} onChange={v=>onUpdate(task.id,{start_date:v})} type="date"/></div>
        <div><div style={{fontSize:10,fontWeight:600}}>End</div><InEdit value={String(task.end_date).split('T')[0]} onChange={v=>onUpdate(task.id,{end_date:v})} type="date"/></div>
        <div><div style={{fontSize:10,fontWeight:600}}>Priority</div><InEdit value={task.priority} onChange={v=>onUpdate(task.id,{priority:v})} type="select" options={PRI_OPT}/></div>
        <div><div style={{fontSize:10,fontWeight:600}}>Duration</div><b style={{color:"var(--fg)"}}>{daysB(task.start_date,task.end_date)||1} days</b></div>
      </div>
      <div style={{padding:"0 24px 16px"}}><div style={{fontSize:10,fontWeight:600,color:"var(--fg2)",marginBottom:4}}>Status</div><div style={{display:"flex",gap:6}}>{STS.map(s=><button key={s} onClick={()=>onUpdate(task.id,{status:s})} style={{padding:"6px 14px",borderRadius:8,border:task.status===s?"2px solid var(--fg)":"1px solid var(--border)",background:task.status===s?"var(--fg)":"var(--card)",color:task.status===s?"var(--bg)":"var(--fg2)",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s"}}>{s}</button>)}</div></div>
      <div style={{padding:"0 24px 16px"}}><div style={{fontSize:10,fontWeight:600,color:"var(--fg2)",marginBottom:4}}>Risk</div><div style={{display:"flex",gap:6}}>{RSK_OPT.map(r=>{const rc2=RC[r];return <button key={r} onClick={()=>onUpdate(task.id,{risk:r})} style={{padding:"4px 12px",borderRadius:99,border:task.risk===r?"2px solid "+rc2.c:"1px solid var(--border)",background:rc2.bg,color:rc2.c,fontSize:11,fontWeight:700,cursor:"pointer",transition:"all .15s"}}>{r}</button>})}</div></div>
      {depN.length>0&&<div style={{padding:"0 24px 12px"}}><div style={{fontSize:10,fontWeight:600,color:"var(--fg2)"}}>Depends On</div>{depN.map((n,i)=><div key={i} style={{fontSize:12,color:"#6366F1",padding:"2px 0"}}>→ {n}</div>)}</div>}
      {blocks.length>0&&<div style={{padding:"0 24px 12px"}}><div style={{fontSize:10,fontWeight:600,color:"var(--fg2)"}}>Blocks</div>{blocks.map((n,i)=><div key={i} style={{fontSize:12,color:"#DC2626",padding:"2px 0"}}>← {n}</div>)}</div>}
      <div style={{padding:"0 24px 20px"}}><button onClick={()=>{onDelete(task.id);onClose()}} style={{background:"#FEE2E2",color:"#DC2626",border:"none",padding:"6px 14px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer"}}>Delete Task</button></div>
    </div>
  </div>;
}

function KpiChart({kpis}){
  const byDept={};kpis.forEach(k=>{if(!byDept[k.dept])byDept[k.dept]={green:0,yellow:0,red:0,total:0};byDept[k.dept][k.flag]++;byDept[k.dept].total++});
  const depts=Object.keys(byDept);if(!depts.length)return null;
  const bW=70,bH=140,gap=24,w=depts.length*(bW+gap)+60,h=bH+70;
  return <div className="af" style={{overflowX:"auto",marginBottom:16,background:"var(--bg2)",borderRadius:12,padding:16,border:"1px solid var(--border)"}}>
    <div style={{fontSize:13,fontWeight:700,marginBottom:12,color:"var(--fg)"}}>Department Health Overview</div>
    <svg width={w} height={h} style={{fontFamily:"Inter,system-ui"}}>{depts.map((d,i)=>{
      const x=30+i*(bW+gap);const data=byDept[d];const t=data.total||1;
      const gH=(data.green/t)*bH;const yH=(data.yellow/t)*bH;const rH=(data.red/t)*bH;
      return <g key={d}>
        <rect x={x} y={bH-gH} width={bW} height={gH} fill="url(#gGrad)" rx={4}><animate attributeName="height" from="0" to={gH} dur="0.8s" fill="freeze"/><animate attributeName="y" from={bH} to={bH-gH} dur="0.8s" fill="freeze"/></rect>
        <rect x={x} y={bH-gH-yH} width={bW} height={yH} fill="url(#yGrad)"><animate attributeName="height" from="0" to={yH} dur="0.8s" fill="freeze" begin="0.15s"/><animate attributeName="y" from={bH-gH} to={bH-gH-yH} dur="0.8s" fill="freeze" begin="0.15s"/></rect>
        <rect x={x} y={bH-gH-yH-rH} width={bW} height={rH} fill="url(#rGrad)" rx={4}><animate attributeName="height" from="0" to={rH} dur="0.8s" fill="freeze" begin="0.3s"/><animate attributeName="y" from={bH-gH-yH} to={bH-gH-yH-rH} dur="0.8s" fill="freeze" begin="0.3s"/></rect>
        <rect x={x} y={bH+4} width={bW} height={5} fill={CL[d]||"#94A3B8"} rx={2.5}><animate attributeName="width" from="0" to={bW} dur="0.5s" fill="freeze" begin="0.4s"/></rect>
        <text x={x+bW/2} y={bH+26} textAnchor="middle" fill="var(--fg)" fontSize={10} fontWeight={600}>{d.length>9?d.slice(0,8)+"..":d}</text>
        <text x={x+bW/2} y={bH+42} textAnchor="middle" fill="var(--fg2)" fontSize={9}>{data.green} on track</text>
        <text x={x+bW/2} y={bH+56} textAnchor="middle" fill="var(--fg2)" fontSize={8}>{data.yellow} attention · {data.red} under</text>
      </g>})}
      <defs><linearGradient id="gGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34D399"/><stop offset="100%" stopColor="#059669"/></linearGradient>
      <linearGradient id="yGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FBBF24"/><stop offset="100%" stopColor="#D97706"/></linearGradient>
      <linearGradient id="rGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F87171"/><stop offset="100%" stopColor="#DC2626"/></linearGradient></defs>
    </svg>
  </div>;
}

function CalendarView({tasks,onSelect}){
  const[month,setMonth]=useState(new Date(2026,4,1));
  const yr=month.getFullYear(),mo=month.getMonth();const fd=new Date(yr,mo,1).getDay();const dim=new Date(yr,mo+1,0).getDate();
  const cells=[];for(let i=0;i<fd;i++)cells.push(null);for(let d=1;d<=dim;d++)cells.push(d);
  return <div className="af">
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
      <button onClick={()=>setMonth(new Date(yr,mo-1,1))} style={{background:"var(--bg3)",border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontWeight:700,color:"var(--fg)"}}>←</button>
      <span style={{fontSize:16,fontWeight:700,color:"var(--fg)"}}>{month.toLocaleDateString("en-GB",{month:"long",year:"numeric"})}</span>
      <button onClick={()=>setMonth(new Date(yr,mo+1,1))} style={{background:"var(--bg3)",border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontWeight:700,color:"var(--fg)"}}>→</button>
      <a href="https://calendar.google.com" target="_blank" rel="noopener" style={{marginLeft:"auto",fontSize:11,color:"#3B82F6",fontWeight:600,textDecoration:"none",background:"#EFF6FF",padding:"8px 14px",borderRadius:8}}>Connect Google Calendar</a>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,background:"var(--border)",borderRadius:12,overflow:"hidden"}}>
      {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d} style={{background:"var(--bg3)",padding:8,textAlign:"center",fontWeight:600,fontSize:11,color:"var(--fg2)"}}>{d}</div>)}
      {cells.map((day,i)=>{if(!day)return <div key={i} style={{background:"var(--bg2)",minHeight:90}}/>;
        const ds=yr+"-"+String(mo+1).padStart(2,"0")+"-"+String(day).padStart(2,"0");const isT=ds===today;
        const dt=tasks.filter(t=>String(t.start_date).split('T')[0]<=ds&&String(t.end_date).split('T')[0]>=ds);
        return <div key={i} className="ch" style={{background:"var(--card)",minHeight:90,padding:4}}>
          <div style={{fontSize:12,fontWeight:isT?800:400,color:isT?"#3B82F6":"var(--fg)",marginBottom:2}}>{isT?<span style={{background:"#3B82F6",color:"#fff",borderRadius:"50%",width:24,height:24,display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{day}</span>:day}</div>
          {dt.slice(0,3).map(t=><div key={t.id} onClick={()=>onSelect(t)} style={{background:CL[t.dept]||"#94A3B8",color:"#fff",fontSize:9,fontWeight:600,padding:"2px 4px",borderRadius:4,marginBottom:1,cursor:"pointer",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",opacity:t.status==="Done"?.35:.85}}>{t.name}</div>)}
          {dt.length>3&&<div style={{fontSize:9,color:"var(--fg2)"}}>+{dt.length-3}</div>}
        </div>})}
    </div>
  </div>;
}

function Tbl({headers,rows}){return <div style={{border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}} className="af"><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr style={{background:"var(--bg3)"}}>{headers.map(h=><th key={h} style={{padding:"10px 8px",textAlign:"left",fontWeight:600,color:"var(--fg2)",fontSize:11}}>{h}</th>)}</tr></thead><tbody>{rows.map((row,ri)=><tr key={ri} className="rh" style={{borderBottom:"1px solid var(--border)"}}>{row.map((cell,ci)=><td key={ci} style={{padding:"8px",color:"var(--fg)"}}>{cell}</td>)}</tr>)}</tbody></table></div>}
function DeptHdr({dept}){return <div className="af" style={{background:(CL[dept]||"#94A3B8")+"15",color:CL[dept],padding:"8px 12px",borderRadius:"8px 8px 0 0",fontWeight:700,fontSize:13,borderLeft:"4px solid "+(CL[dept]||"#94A3B8")}}>{dept}</div>}

export default function Home(){
  const[tasks,setTasks]=useState([]);const[raci,setRaci]=useState([]);const[risks,setRisks]=useState([]);const[kpis,setKpis]=useState([]);const[meetings,setMeetings]=useState([]);const[roles,setRoles]=useState([]);
  const[view,setView]=useState("timeline");const[sel,setSel]=useState(null);const[syncing,setSyncing]=useState(false);const[syncMsg,setSyncMsg]=useState("");const[loading,setLoading]=useState(true);const[addModal,setAddModal]=useState(null);
  const[dark,setDark]=useState(false);const[dragId,setDragId]=useState(null);

  useEffect(()=>{document.documentElement.setAttribute("data-theme",dark?"dark":"light")},[dark]);

  useEffect(()=>{async function la(){const[t,r,ri,k,m,ro]=await Promise.all([supabase.from('tasks').select('*').order('id'),supabase.from('raci').select('*').order('dept,id'),supabase.from('risks').select('*').order('id'),supabase.from('kpis').select('*').order('dept,id'),supabase.from('meetings').select('*').order('id'),supabase.from('roles').select('*').order('id')]);
    if(t.data)setTasks(t.data);if(r.data)setRaci(r.data);if(ri.data)setRisks(ri.data);if(k.data)setKpis(k.data);if(m.data)setMeetings(m.data);if(ro.data)setRoles(ro.data);setLoading(false)}la();
    const ch=supabase.channel('rt3').on('postgres_changes',{event:'*',schema:'public',table:'tasks'},()=>supabase.from('tasks').select('*').order('id').then(({data})=>{if(data)setTasks(data)})).on('postgres_changes',{event:'*',schema:'public',table:'risks'},()=>supabase.from('risks').select('*').order('id').then(({data})=>{if(data)setRisks(data)})).on('postgres_changes',{event:'*',schema:'public',table:'kpis'},()=>supabase.from('kpis').select('*').order('dept,id').then(({data})=>{if(data)setKpis(data)})).on('postgres_changes',{event:'*',schema:'public',table:'raci'},()=>supabase.from('raci').select('*').order('dept,id').then(({data})=>{if(data)setRaci(data)})).on('postgres_changes',{event:'*',schema:'public',table:'roles'},()=>supabase.from('roles').select('*').order('id').then(({data})=>{if(data)setRoles(data)})).on('postgres_changes',{event:'*',schema:'public',table:'meetings'},()=>supabase.from('meetings').select('*').order('id').then(({data})=>{if(data)setMeetings(data)})).subscribe();
    return()=>supabase.removeChannel(ch)},[]);

  const updateTask=useCallback(async(id,u)=>{setTasks(p=>p.map(t=>t.id===id?{...t,...u}:t));setSel(p=>p?.id===id?{...p,...u}:p);await supabase.from('tasks').update(u).eq('id',id)},[]);
  const deleteTask=useCallback(async id=>{setTasks(p=>p.filter(t=>t.id!==id));await supabase.from('tasks').delete().eq('id',id)},[]);
  const addTask=useCallback(async v=>{const{data}=await supabase.from('tasks').insert({name:v.name||"New Task",dept:v.dept||"PMO",owner:v.owner||"",start_date:v.start_date||today,end_date:v.end_date||today,status:"To Do",priority:v.priority||"Medium",risk:"On track",deps:[]}).select();if(data)setTasks(p=>[...p,...data]);setAddModal(null)},[]);
  const addRaci=useCallback(async v=>{const{data}=await supabase.from('raci').insert({dept:v.dept||"PMO",task:v.task||"",responsible:v.responsible||"",accountable:v.accountable||"",consulted:v.consulted||"",informed:v.informed||"",notes:v.notes||"",is_suggestion:v.is_suggestion==="true"}).select();if(data)setRaci(p=>[...p,...data]);setAddModal(null)},[]);
  const deleteRaci=useCallback(async id=>{setRaci(p=>p.filter(r=>r.id!==id));await supabase.from('raci').delete().eq('id',id)},[]);
  const addRisk=useCallback(async v=>{const ni="R"+(risks.length+1).toString().padStart(2,"0");const{data}=await supabase.from('risks').insert({id:v.id||ni,description:v.description||"",impact:v.impact||"HIGH",status:"ACTIVE",owner:v.owner||"",mitigation:v.mitigation||""}).select();if(data)setRisks(p=>[...p,...data]);setAddModal(null)},[risks]);
  const updateRisk=useCallback(async(id,u)=>{setRisks(p=>p.map(r=>r.id===id?{...r,...u}:r));await supabase.from('risks').update(u).eq('id',id)},[]);
  const deleteRisk=useCallback(async id=>{setRisks(p=>p.filter(r=>r.id!==id));await supabase.from('risks').delete().eq('id',id)},[]);
  const addKpi=useCallback(async v=>{const{data}=await supabase.from('kpis').insert({dept:v.dept||"PMO",name:v.name||"",target:v.target||"",current_value:v.current_value||"",flag:v.flag||"yellow",review_rhythm:v.review_rhythm||"Weekly"}).select();if(data)setKpis(p=>[...p,...data]);setAddModal(null)},[]);
  const updateKpi=useCallback(async(id,u)=>{setKpis(p=>p.map(k=>k.id===id?{...k,...u}:k));await supabase.from('kpis').update(u).eq('id',id)},[]);
  const addRole=useCallback(async v=>{const{data}=await supabase.from('roles').insert({title:v.title||"",status:v.status||"Not opened",trigger_blocker:v.trigger_blocker||"",target_date:v.target_date||""}).select();if(data)setRoles(p=>[...p,...data]);setAddModal(null)},[]);
  const updateRole=useCallback(async(id,u)=>{setRoles(p=>p.map(r=>r.id===id?{...r,...u}:r));await supabase.from('roles').update(u).eq('id',id)},[]);
  const deleteRole=useCallback(async id=>{setRoles(p=>p.filter(r=>r.id!==id));await supabase.from('roles').delete().eq('id',id)},[]);
  const addMeeting=useCallback(async v=>{const{data}=await supabase.from('meetings').insert({type:v.type||"Milestone",name:v.name||"",schedule:v.schedule||"",duration:v.duration||"",owner:v.owner||"",attendees:v.attendees||"",output:v.output||""}).select();if(data)setMeetings(p=>[...p,...data]);setAddModal(null)},[]);
  const deleteMeeting=useCallback(async id=>{setMeetings(p=>p.filter(m=>m.id!==id));await supabase.from('meetings').delete().eq('id',id)},[]);
  const onDrop=useCallback(ns=>{if(dragId){updateTask(dragId,{status:ns});setDragId(null)}},[dragId,updateTask]);

  const doSync=async()=>{setSyncing(true);setSyncMsg("Syncing...");try{const res=await fetch('/api/sync',{method:'POST'});const data=await res.json();setSyncMsg("Done: "+(data.results?.map(r=>r.source+" "+r.status).join(', ')||'Synced'))}catch(e){setSyncMsg("Error: "+e.message)}setSyncing(false)};
  const stats=useMemo(()=>({total:tasks.length,todo:tasks.filter(t=>t.status==="To Do").length,doing:tasks.filter(t=>t.status==="Doing").length,done:tasks.filter(t=>t.status==="Done").length,risk:tasks.filter(t=>t.risk!=="On track").length,overdue:tasks.filter(t=>isOverdue(t)).length}),[tasks]);
  const raciByDept={};raci.forEach(r=>{if(!raciByDept[r.dept])raciByDept[r.dept]=[];raciByDept[r.dept].push(r)});
  const kpiByDept={};kpis.forEach(k=>{if(!kpiByDept[k.dept])kpiByDept[k.dept]=[];kpiByDept[k.dept].push(k)});
  const TABS=[{id:"timeline",l:"Timeline"},{id:"board",l:"Board"},{id:"calendar",l:"Calendar"},{id:"raci",l:"RACI"},{id:"kpi",l:"KPIs"},{id:"risk",l:"Risks"},{id:"roles",l:"Open Roles"},{id:"meet",l:"Meetings"}];

  // Timeline date calc constants
  const TL_START="2026-04-25",TL_END="2026-07-05";
  const TL_DAYS=daysB(TL_START,TL_END);

  if(loading)return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontSize:16,color:"var(--fg2)",background:"var(--bg)"}}><div style={{textAlign:"center"}}><div style={{width:40,height:40,border:"3px solid var(--border)",borderTopColor:"#3B82F6",borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 12px"}}></div>Loading Attimo...</div></div>;

  return <div style={{fontFamily:"'Inter',system-ui",background:"var(--bg)",minHeight:"100vh",transition:"all .3s"}}>
    <style dangerouslySetInnerHTML={{__html:CSS+"@keyframes spin{to{transform:rotate(360deg)}}"}}/>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>

    {/* Header */}
    <div style={{background:"var(--hdr)",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div className="glow-btn" style={{width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:15,fontWeight:800}}>A</span></div>
        <span style={{fontSize:17,fontWeight:800,color:"#fff",letterSpacing:-.5}}>Attimo</span><span style={{color:"#475569"}}>|</span><span style={{fontSize:12,color:"#94A3B8"}}>Company Operations</span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <button onClick={()=>setDark(!dark)} style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:11,color:"#fff",fontWeight:600,transition:"all .2s"}}>{dark?"☀ Light":"◑ Dark"}</button>
        <button onClick={doSync} disabled={syncing} style={{background:syncing?"rgba(255,255,255,.1)":"rgba(59,130,246,.8)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:syncing?"wait":"pointer"}}>{syncing?"Syncing...":"Sync All"}</button>
        {syncMsg&&<span style={{fontSize:10,color:"#10B981"}}>{syncMsg}</span>}
        <div className="mob-hide" style={{display:"flex",gap:8,fontSize:11,color:"#94A3B8"}}>
          <span><b style={{color:"#93C5FD"}}>{stats.total}</b> total</span><span><b style={{color:"#FDE68A"}}>{stats.doing}</b> doing</span><span><b style={{color:"#6EE7B7"}}>{stats.done}</b> done</span>
          {stats.overdue>0&&<span style={{animation:"pulse 1.5s infinite"}}><b style={{color:"#FCA5A5"}}>{stats.overdue}</b> overdue</span>}
        </div>
      </div>
    </div>

    {/* Tabs */}
    <div style={{borderBottom:"1px solid var(--border)",padding:"0 20px",display:"flex",flexWrap:"nowrap",background:"var(--card)",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
      {TABS.map(t=><button key={t.id} onClick={()=>setView(t.id)} style={{padding:"10px 14px",border:"none",background:"none",fontWeight:600,fontSize:13,cursor:"pointer",color:view===t.id?"var(--fg)":"var(--fg2)",borderBottom:view===t.id?"2px solid #3B82F6":"2px solid transparent",transition:"all .15s",whiteSpace:"nowrap"}}>{t.l}</button>)}
      <div className="mob-hide" style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6}}>{ANCH.map((a,i)=><span key={i} style={{fontSize:9,color:a.c,fontWeight:700,padding:"2px 6px",background:a.c+"12",borderRadius:99}}>{a.l} {fD(a.d)}</span>)}</div>
    </div>

    <div style={{padding:20}}>

    {/* ═══ TIMELINE ═══ */}
    {view==="timeline"&&<div className="af">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>Company Gantt</div><button onClick={()=>setAddModal("task")} style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add Task</button></div>
      <div style={{background:"var(--card)",borderRadius:10,border:"1px solid var(--border)"}}>{STS.map(st=>{const items=tasks.filter(t=>t.status===st);return <div key={st} style={{padding:"12px 16px",borderBottom:"1px solid var(--border)"}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:8,display:"flex",alignItems:"center",gap:8,color:"var(--fg)"}}>▼ {st}<span style={{background:"var(--bg3)",borderRadius:99,padding:"1px 8px",fontSize:11,color:"var(--fg2)"}}>{items.length}</span></div>
        {items.map((t,idx)=>{const cl=CL[t.dept]||"#94A3B8";
          const startStr=String(t.start_date).split('T')[0];const endStr=String(t.end_date).split('T')[0];
          const sOff=Math.max(0,daysB(TL_START,startStr));
          const dur=Math.max(1,daysB(startStr,endStr)+1);
          const leftPct=(sOff/TL_DAYS)*100;
          const widthPct=Math.max((dur/TL_DAYS)*100,0.5);
          const od=isOverdue(t);
          return <div key={t.id} className={rowClass(t)+" asl"} style={{display:"flex",alignItems:"center",gap:12,padding:"5px 8px",cursor:"pointer",borderRadius:6,animationDelay:idx*25+"ms"}} onClick={()=>setSel(t)}>
            <div style={{width:"clamp(120px,25vw,200px)",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              <div style={{width:20,height:20,borderRadius:"50%",background:cl,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{color:"#fff",fontSize:8,fontWeight:700}}>{t.owner?.[0]}</span></div>
              <span style={{fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--fg)",textDecoration:t.status==="Done"?"line-through":"none"}}>{t.name}</span>
            </div>
            <div style={{flex:1,height:26,background:"var(--bg3)",borderRadius:6,position:"relative",overflow:"hidden"}}>
              <div className="bar-g" style={{position:"absolute",left:leftPct+"%",width:widthPct+"%",top:2,bottom:2,borderRadius:4,background:od?"linear-gradient(90deg,#EF4444,#F87171)":"linear-gradient(90deg,"+cl+","+cl+"CC)",opacity:t.status==="Done"?.3:.9,display:"flex",alignItems:"center",paddingLeft:6,animationDelay:idx*40+"ms"}}>
                <span style={{color:"#fff",fontSize:9,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden"}}>{fD(startStr)} – {fD(endStr)}</span>
              </div>
            </div>
            {od&&<div className="pulse-dot" style={{width:10,height:10,borderRadius:"50%",background:"#EF4444",flexShrink:0}}/>}
            {!od&&t.risk==="At risk"&&<div style={{width:8,height:8,borderRadius:"50%",background:"#F59E0B",flexShrink:0}}/>}
            {!od&&t.risk==="Off track"&&<div className="pulse-dot" style={{width:8,height:8,borderRadius:"50%",background:"#EF4444",flexShrink:0}}/>}
          </div>})}
      </div>})}</div>
    </div>}

    {/* ═══ BOARD ═══ */}
    {view==="board"&&<div className="af">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>Board</div><button onClick={()=>setAddModal("task")} style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add Task</button></div>
      <div className="mob-col1" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>{STS.map(st=><div key={st} onDragOver={e=>e.preventDefault()} onDrop={()=>onDrop(st)}
        style={{background:"var(--bg2)",borderRadius:10,padding:12,minHeight:200,border:dragId?"2px dashed #3B82F6":"2px solid transparent",transition:"all .2s"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{fontWeight:700,fontSize:14,color:"var(--fg)"}}>{st}</span><span style={{background:"var(--bg3)",borderRadius:99,padding:"2px 8px",fontSize:11,fontWeight:600,color:"var(--fg2)"}}>{tasks.filter(t=>t.status===st).length}</span></div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>{tasks.filter(t=>t.status===st).map((t,idx)=>{const rc=RC[t.risk];const pc=PC[t.priority];const od=isOverdue(t);
          return <div key={t.id} className="ch asl" draggable onDragStart={()=>setDragId(t.id)} onDragEnd={()=>setDragId(null)}
            onClick={()=>setSel(t)} style={{background:"var(--card)",borderRadius:10,padding:12,border:"1px solid var(--border)",borderLeft:od?"4px solid #EF4444":"4px solid "+(CL[t.dept]||"#94A3B8"),cursor:"grab",animationDelay:idx*40+"ms"}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:6,color:od?"#DC2626":"var(--fg)"}}>{t.name}{od&&<span style={{fontSize:9,marginLeft:6,color:"#EF4444",animation:"pulse 1.5s infinite"}}>OVERDUE</span>}</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>{pc&&<Bdg bg={pc.bg} c={pc.c}>{t.priority}</Bdg>}{rc&&<Bdg bg={rc.bg} c={rc.c}>{t.risk}</Bdg>}</div>
            <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"var(--fg2)"}}><div style={{width:16,height:16,borderRadius:"50%",background:CL[t.dept],display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:7,fontWeight:700}}>{t.owner?.[0]}</span></div>{fD(t.start_date)}–{fD(t.end_date)}</div>
          </div>})}</div>
      </div>)}</div>
    </div>}

    {view==="calendar"&&<CalendarView tasks={tasks} onSelect={setSel}/>}

    {/* ═══ RACI ═══ */}
    {view==="raci"&&<div className="af" style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",justifyContent:"space-between"}}><div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>RACI Matrix</div><button onClick={()=>setAddModal("raci")} style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add</button></div>
      <div style={{background:"var(--bg2)",padding:"8px 12px",borderRadius:8,fontSize:11,color:"var(--fg2)"}}><b>R</b>=Responsible <b>A</b>=Accountable <b>C</b>=Consulted <b>I</b>=Informed <span style={{color:"#3B82F6"}}>[Suggest]</span>=PMO suggestion</div>
      {Object.entries(raciByDept).map(([dept,rows])=><div key={dept}><DeptHdr dept={dept}/><Tbl headers={["Task","R","A","C","I","Notes",""]} rows={rows.map(r=>[<span style={{fontWeight:600,color:r.is_suggestion?"#3B82F6":"var(--fg)"}}>{r.is_suggestion?"[Suggest] ":""}{r.task}</span>,r.responsible,r.accountable,r.consulted,r.informed,<span style={{fontSize:11,color:"#D97706"}}>{r.notes}</span>,<button onClick={()=>deleteRaci(r.id)} style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer"}}>✕</button>])}/></div>)}
    </div>}

    {/* ═══ KPIs ═══ */}
    {view==="kpi"&&<div className="af" style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",justifyContent:"space-between"}}><div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>KPIs</div><button onClick={()=>setAddModal("kpi")} style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add KPI</button></div>
      <KpiChart kpis={kpis}/>
      {Object.entries(kpiByDept).map(([dept,items])=><div key={dept} className="asl"><DeptHdr dept={dept}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8,padding:10,background:"var(--card)",border:"1px solid var(--border)",borderRadius:"0 0 8px 8px"}}>{items.map(k=><div key={k.id} className="ch" style={{borderLeft:"3px solid "+FC[k.flag],borderRadius:8,padding:12,background:"var(--bg2)"}}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:4,color:"var(--fg)"}}>{k.name}</div><div style={{fontSize:10,color:"var(--fg2)"}}>Target: {k.target}</div>
          <div style={{display:"flex",alignItems:"center",gap:4,marginTop:4}}><div style={{width:8,height:8,borderRadius:"50%",background:FC[k.flag]}}/><span style={{fontSize:11,fontWeight:700,color:FC[k.flag]}}>{k.current_value}</span></div>
          <div style={{marginTop:6,display:"flex",gap:4}}>{["green","yellow","red"].map(f=><button key={f} onClick={()=>updateKpi(k.id,{flag:f})} style={{width:18,height:18,borderRadius:"50%",background:FC[f],border:k.flag===f?"2px solid var(--fg)":"1px solid var(--border)",cursor:"pointer",transition:"transform .15s"}} onMouseEnter={e=>e.target.style.transform="scale(1.3)"} onMouseLeave={e=>e.target.style.transform="scale(1)"}/>)}</div>
        </div>)}</div>
      </div>)}
    </div>}

    {/* ═══ RISKS ═══ */}
    {view==="risk"&&<div className="af">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>Risk Register</div><button onClick={()=>setAddModal("risk")} style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add Risk</button></div>
      <Tbl headers={["#","Risk","Impact","Status","Owner","Mitigation",""]} rows={risks.map(r=>[<b>{r.id}</b>,<InEdit value={r.description} onChange={v=>updateRisk(r.id,{description:v})}/>,<InEdit value={r.impact} onChange={v=>updateRisk(r.id,{impact:v})} type="select" options={IMP_OPT}/>,<InEdit value={r.status} onChange={v=>updateRisk(r.id,{status:v})} type="select" options={["ACTIVE","MITIGATING","FUTURE","CLOSED"]}/>,<InEdit value={r.owner} onChange={v=>updateRisk(r.id,{owner:v})}/>,<InEdit value={r.mitigation} onChange={v=>updateRisk(r.id,{mitigation:v})}/>,<button onClick={()=>deleteRisk(r.id)} style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer"}}>✕</button>])}/>
    </div>}

    {/* ═══ OPEN ROLES (dynamic from DB) ═══ */}
    {view==="roles"&&<div className="af">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>Open Hiring Positions</div><button onClick={()=>setAddModal("role")} style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add Role</button></div>
      <Tbl headers={["Role","Status","Trigger / Blocker","Target",""]} rows={roles.map(r=>[
        <InEdit value={r.title} onChange={v=>updateRole(r.id,{title:v})}/>,
        <InEdit value={r.status} onChange={v=>updateRole(r.id,{status:v})} type="select" options={["Not opened","Interviewing","Blocked","Filled"]}/>,
        <InEdit value={r.trigger_blocker} onChange={v=>updateRole(r.id,{trigger_blocker:v})}/>,
        <InEdit value={r.target_date} onChange={v=>updateRole(r.id,{target_date:v})}/>,
        <button onClick={()=>deleteRole(r.id)} style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer"}}>✕</button>
      ])}/>
    </div>}

    {/* ═══ MEETINGS (dynamic) ═══ */}
    {view==="meet"&&<div className="af">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>Meeting Cadence</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setAddModal("meeting")} style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add Meeting</button>
          <a href="https://calendar.google.com/calendar/r/eventedit" target="_blank" rel="noopener" style={{fontSize:11,color:"#3B82F6",fontWeight:600,textDecoration:"none",background:"#EFF6FF",padding:"6px 14px",borderRadius:8,display:"flex",alignItems:"center"}}>+ Google Calendar</a>
        </div>
      </div>
      <Tbl headers={["Type","Meeting","When","Duration","Owner","Attendees",""]} rows={meetings.map(m=>[
        <Bdg bg={MT_CLR[m.type]||"#94A3B8"} c="#fff">{m.type}</Bdg>,
        <b style={{color:"var(--fg)"}}>{m.name}</b>,m.schedule,m.duration,<b>{m.owner}</b>,
        <span style={{color:"var(--fg2)"}}>{m.attendees}</span>,
        <button onClick={()=>deleteMeeting(m.id)} style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer"}}>✕</button>
      ])}/>
    </div>}

    </div>
    <TicketPopup task={sel} tasks={tasks} onClose={()=>setSel(null)} onUpdate={updateTask} onDelete={deleteTask}/>
    {addModal==="task"&&<AddModal title="Add Task" fields={[{key:"name",label:"Task Name",placeholder:"e.g. Landing page"},{key:"dept",label:"Department",type:"select",options:DEPT_OPT},{key:"owner",label:"Owner"},{key:"start_date",label:"Start",type:"date"},{key:"end_date",label:"End",type:"date"},{key:"priority",label:"Priority",type:"select",options:PRI_OPT}]} onSave={addTask} onClose={()=>setAddModal(null)}/>}
    {addModal==="raci"&&<AddModal title="Add RACI" fields={[{key:"dept",label:"Department",type:"select",options:DEPT_OPT},{key:"task",label:"Task"},{key:"responsible",label:"R"},{key:"accountable",label:"A"},{key:"consulted",label:"C"},{key:"informed",label:"I"},{key:"notes",label:"Notes"},{key:"is_suggestion",label:"PMO Suggestion?",type:"select",options:["false","true"]}]} onSave={addRaci} onClose={()=>setAddModal(null)}/>}
    {addModal==="risk"&&<AddModal title="Add Risk" fields={[{key:"description",label:"Risk"},{key:"impact",label:"Impact",type:"select",options:IMP_OPT},{key:"owner",label:"Owner"},{key:"mitigation",label:"Mitigation"}]} onSave={addRisk} onClose={()=>setAddModal(null)}/>}
    {addModal==="kpi"&&<AddModal title="Add KPI" fields={[{key:"dept",label:"Department",type:"select",options:DEPT_OPT},{key:"name",label:"KPI"},{key:"target",label:"Target"},{key:"current_value",label:"Current"},{key:"flag",label:"Status",type:"select",options:["green","yellow","red"]},{key:"review_rhythm",label:"Review",type:"select",options:["Weekly","Bi-Weekly","Monthly"]}]} onSave={addKpi} onClose={()=>setAddModal(null)}/>}
    {addModal==="role"&&<AddModal title="Add Role" fields={[{key:"title",label:"Role Title"},{key:"status",label:"Status",type:"select",options:["Not opened","Interviewing","Blocked","Filled"]},{key:"trigger_blocker",label:"Trigger / Blocker"},{key:"target_date",label:"Target Date"}]} onSave={addRole} onClose={()=>setAddModal(null)}/>}
    {addModal==="meeting"&&<AddModal title="Add Meeting" fields={[{key:"type",label:"Type",type:"select",options:["Weekly","Milestone","Bi-weekly","Monthly"]},{key:"name",label:"Meeting Name"},{key:"schedule",label:"When"},{key:"duration",label:"Duration"},{key:"owner",label:"Owner"},{key:"attendees",label:"Attendees"}]} onSave={addMeeting} onClose={()=>setAddModal(null)}/>}
  </div>;
}
