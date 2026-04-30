'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL||'', process.env.NEXT_PUBLIC_SUPABASE_KEY||'');

const CL={PMO:"#3B82F6",Development:"#10B981",Architecture:"#14B8A6","AI/Science":"#F59E0B",Design:"#8B5CF6",Marketing:"#EC4899",Legal:"#64748B",Hiring:"#06B6D4",Leadership:"#6366F1"};
const STS=["To Do","Doing","Done"];
const PRI_OPT=["Low","Medium","High"];
const DEPT_OPT=Object.keys(CL);
const RSK_OPT=["On track","At risk","Off track"];
const IMP_OPT=["CRITICAL","HIGH","MEDIUM","LOW"];
const RC={"On track":{bg:"#DCFCE7",c:"#166534"},"At risk":{bg:"#FEF3C7",c:"#D97706"},"Off track":{bg:"#FEE2E2",c:"#DC2626"}};
const PC={Low:{bg:"#DBEAFE",c:"#1D4ED8"},Medium:{bg:"#FEF3C7",c:"#D97706"},High:{bg:"#FEE2E2",c:"#DC2626"}};
const FC={green:"#16A34A",yellow:"#D97706",red:"#DC2626"};
const MT_CLR={Weekly:"#3B82F6",Milestone:"#F59E0B","Bi-weekly":"#6366F1",Monthly:"#8B5CF6"};
const ANCH=[{d:"2026-05-07",l:"Hatchery",c:"#6366F1"},{d:"2026-05-21",l:"GTM",c:"#F59E0B"},{d:"2026-06-10",l:"Launch",c:"#10B981"},{d:"2026-07-01",l:"Pitch Day",c:"#EF4444"}];
const fD=s=>{try{return new Date(s+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short"})}catch{return s}};
const dB=(a,b)=>Math.round((new Date(b)-new Date(a))/864e5);
const today=new Date().toISOString().split("T")[0];
const Bdg=({bg,c,children,onClick})=><span onClick={onClick} style={{background:bg,color:c,padding:"2px 8px",borderRadius:99,fontSize:10,fontWeight:700,whiteSpace:"nowrap",cursor:onClick?"pointer":"default"}}>{children}</span>;

function InEdit({value,onChange,type="text",options}){
  const[editing,setEditing]=useState(false);const[val,setVal]=useState(value);const ref=useRef();
  useEffect(()=>{setVal(value)},[value]);useEffect(()=>{if(editing&&ref.current)ref.current.focus()},[editing]);
  if(type==="select")return <select value={val} onChange={e=>{setVal(e.target.value);onChange(e.target.value)}} style={{border:"none",background:"transparent",fontSize:12,color:"#1E293B",cursor:"pointer",padding:"2px 4px",borderRadius:4}}>{options.map(o=><option key={o}>{o}</option>)}</select>;
  if(type==="date")return <input type="date" value={val} onChange={e=>{setVal(e.target.value);onChange(e.target.value)}} style={{border:"1px solid #E2E8F0",borderRadius:4,padding:"2px 4px",fontSize:11,width:120}}/>;
  if(!editing)return <span onClick={()=>setEditing(true)} style={{cursor:"text",padding:"2px 4px",borderRadius:4,minWidth:40,display:"inline-block"}} onMouseEnter={e=>e.target.style.background="#F1F5F9"} onMouseLeave={e=>e.target.style.background="transparent"}>{val||"—"}</span>;
  return <input ref={ref} value={val} onChange={e=>setVal(e.target.value)} onBlur={()=>{setEditing(false);onChange(val)}} onKeyDown={e=>{if(e.key==="Enter"){setEditing(false);onChange(val)}}} style={{border:"1px solid #3B82F6",borderRadius:4,padding:"2px 4px",fontSize:12,width:140}}/>;
}

function AddModal({title,fields,onSave,onClose}){
  const[vals,setVals]=useState({});
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,width:440,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}><h3 style={{margin:0,fontSize:16,fontWeight:800}}>{title}</h3><button onClick={onClose} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#94A3B8"}}>x</button></div>
      {fields.map(f=><div key={f.key} style={{marginBottom:12}}>
        <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4}}>{f.label}</label>
        {f.type==="select"?<select value={vals[f.key]||""} onChange={e=>setVals(p=>({...p,[f.key]:e.target.value}))} style={{width:"100%",padding:"8px",border:"1px solid #E2E8F0",borderRadius:6,fontSize:12}}><option value="">Select...</option>{f.options.map(o=><option key={o}>{o}</option>)}</select>
        :<input type={f.type||"text"} placeholder={f.placeholder} value={vals[f.key]||""} onChange={e=>setVals(p=>({...p,[f.key]:e.target.value}))} style={{width:"100%",padding:"8px",border:"1px solid #E2E8F0",borderRadius:6,fontSize:12,boxSizing:"border-box"}}/>}
      </div>)}
      <button onClick={()=>onSave(vals)} style={{width:"100%",padding:"10px",background:"#0D1B2A",color:"#fff",border:"none",borderRadius:6,fontWeight:700,fontSize:13,cursor:"pointer",marginTop:8}}>Save</button>
    </div>
  </div>;
}

function TicketPopup({task,tasks,onClose,onUpdate,onDelete}){
  if(!task)return null;const cl=CL[task.dept]||"#94A3B8";const rc=RC[task.risk];const pc=PC[task.priority];
  const depN=(task.deps||[]).map(id=>tasks.find(t=>t.id===id)?.name||id);
  const blocks=tasks.filter(t=>(t.deps||[]).includes(task.id)).map(t=>t.name);
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,width:500,maxHeight:"85vh",overflow:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
      <div style={{borderBottom:"4px solid "+cl,padding:"20px 24px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:10,color:"#94A3B8",fontWeight:600}}>TASK-{task.id} / {task.dept}</span><button onClick={onClose} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#94A3B8"}}>x</button></div>
        <div style={{fontSize:18,fontWeight:800,marginTop:4}}><InEdit value={task.name} onChange={v=>onUpdate(task.id,{name:v})}/></div>
        <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}><Bdg bg={cl+"20"} c={cl}>{task.dept}</Bdg>{pc&&<Bdg bg={pc.bg} c={pc.c}>{task.priority}</Bdg>}{rc&&<Bdg bg={rc.bg} c={rc.c}>{task.risk}</Bdg>}</div>
      </div>
      <div style={{padding:"16px 24px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,fontSize:13,color:"#475569"}}>
        <div><div style={{fontSize:10,color:"#94A3B8",fontWeight:600}}>Owner</div><InEdit value={task.owner} onChange={v=>onUpdate(task.id,{owner:v})}/></div>
        <div><div style={{fontSize:10,color:"#94A3B8",fontWeight:600}}>Department</div><InEdit value={task.dept} onChange={v=>onUpdate(task.id,{dept:v})} type="select" options={DEPT_OPT}/></div>
        <div><div style={{fontSize:10,color:"#94A3B8",fontWeight:600}}>Start</div><InEdit value={task.start_date} onChange={v=>onUpdate(task.id,{start_date:v})} type="date"/></div>
        <div><div style={{fontSize:10,color:"#94A3B8",fontWeight:600}}>End</div><InEdit value={task.end_date} onChange={v=>onUpdate(task.id,{end_date:v})} type="date"/></div>
        <div><div style={{fontSize:10,color:"#94A3B8",fontWeight:600}}>Priority</div><InEdit value={task.priority} onChange={v=>onUpdate(task.id,{priority:v})} type="select" options={PRI_OPT}/></div>
        <div><div style={{fontSize:10,color:"#94A3B8",fontWeight:600}}>Duration</div><b>{dB(task.start_date,task.end_date)||1}d</b></div>
      </div>
      <div style={{padding:"0 24px 16px"}}><div style={{fontSize:10,color:"#94A3B8",fontWeight:600,marginBottom:4}}>Status</div><div style={{display:"flex",gap:6}}>{STS.map(s=><button key={s} onClick={()=>onUpdate(task.id,{status:s})} style={{padding:"6px 14px",borderRadius:6,border:task.status===s?"2px solid #1E293B":"1px solid #E2E8F0",background:task.status===s?"#0D1B2A":"#fff",color:task.status===s?"#fff":"#475569",fontSize:12,fontWeight:600,cursor:"pointer"}}>{s}</button>)}</div></div>
      <div style={{padding:"0 24px 16px"}}><div style={{fontSize:10,color:"#94A3B8",fontWeight:600,marginBottom:4}}>Risk</div><div style={{display:"flex",gap:6}}>{RSK_OPT.map(r=>{const rc2=RC[r];return <button key={r} onClick={()=>onUpdate(task.id,{risk:r})} style={{padding:"4px 12px",borderRadius:99,border:task.risk===r?"2px solid "+rc2.c:"1px solid #E2E8F0",background:rc2.bg,color:rc2.c,fontSize:11,fontWeight:700,cursor:"pointer"}}>{r}</button>})}</div></div>
      {depN.length>0&&<div style={{padding:"0 24px 12px"}}><div style={{fontSize:10,color:"#94A3B8",fontWeight:600}}>Depends On</div>{depN.map((n,i)=><div key={i} style={{fontSize:12,color:"#6366F1"}}>→ {n}</div>)}</div>}
      {blocks.length>0&&<div style={{padding:"0 24px 12px"}}><div style={{fontSize:10,color:"#94A3B8",fontWeight:600}}>Blocks</div>{blocks.map((n,i)=><div key={i} style={{fontSize:12,color:"#DC2626"}}>← {n}</div>)}</div>}
      <div style={{padding:"0 24px 20px"}}><button onClick={()=>{onDelete(task.id);onClose()}} style={{background:"#FEE2E2",color:"#DC2626",border:"none",padding:"6px 14px",borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer"}}>Delete Task</button></div>
    </div>
  </div>;
}

function KpiChart({kpis}){
  const byDept={};kpis.forEach(k=>{if(!byDept[k.dept])byDept[k.dept]={green:0,yellow:0,red:0,total:0};byDept[k.dept][k.flag]++;byDept[k.dept].total++});
  const depts=Object.keys(byDept);if(!depts.length)return null;
  const barW=60,barH=120,gap=20,w=depts.length*(barW+gap)+40,h=barH+60;
  return <div style={{overflowX:"auto",marginBottom:16}}>
    <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>Department Health Overview</div>
    <svg width={w} height={h} style={{fontFamily:"Inter,system-ui"}}>{depts.map((d,i)=>{
      const x=20+i*(barW+gap);const data=byDept[d];const t=data.total||1;
      const gH=(data.green/t)*barH;const yH=(data.yellow/t)*barH;const rH=(data.red/t)*barH;
      return <g key={d}><rect x={x} y={barH-gH} width={barW} height={gH} fill="#16A34A" rx={2} opacity={0.8}/><rect x={x} y={barH-gH-yH} width={barW} height={yH} fill="#D97706"/><rect x={x} y={barH-gH-yH-rH} width={barW} height={rH} fill="#DC2626" rx={2}/><rect x={x} y={barH+2} width={barW} height={4} fill={CL[d]||"#94A3B8"} rx={2}/><text x={x+barW/2} y={barH+24} textAnchor="middle" fill="#475569" fontSize={10} fontWeight={600}>{d.length>8?d.slice(0,7)+"..":d}</text><text x={x+barW/2} y={barH+38} textAnchor="middle" fill="#94A3B8" fontSize={9}>{data.green}G {data.yellow}Y {data.red}R</text></g>
    })}<text x={10} y={barH+55} fill="#94A3B8" fontSize={9}>G=Performing  Y=Needs Attention  R=Underperforming</text></svg>
  </div>;
}

function CalendarView({tasks,onSelect}){
  const[month,setMonth]=useState(new Date(2026,4,1));
  const yr=month.getFullYear(),mo=month.getMonth();const firstDay=new Date(yr,mo,1).getDay();const dim=new Date(yr,mo+1,0).getDate();
  const cells=[];for(let i=0;i<firstDay;i++)cells.push(null);for(let d=1;d<=dim;d++)cells.push(d);
  return <div>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
      <button onClick={()=>setMonth(new Date(yr,mo-1,1))} style={{background:"#F1F5F9",border:"none",borderRadius:6,padding:"6px 12px",cursor:"pointer",fontWeight:700}}>←</button>
      <span style={{fontSize:16,fontWeight:700}}>{month.toLocaleDateString("en-GB",{month:"long",year:"numeric"})}</span>
      <button onClick={()=>setMonth(new Date(yr,mo+1,1))} style={{background:"#F1F5F9",border:"none",borderRadius:6,padding:"6px 12px",cursor:"pointer",fontWeight:700}}>→</button>
      <a href="https://calendar.google.com" target="_blank" rel="noopener" style={{marginLeft:"auto",fontSize:11,color:"#3B82F6",fontWeight:600,textDecoration:"none",background:"#EFF6FF",padding:"6px 12px",borderRadius:6}}>Open Google Calendar</a>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,background:"#E8ECEF",borderRadius:8,overflow:"hidden"}}>
      {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d} style={{background:"#F8FAFC",padding:8,textAlign:"center",fontWeight:600,fontSize:11,color:"#64748B"}}>{d}</div>)}
      {cells.map((day,i)=>{if(!day)return <div key={i} style={{background:"#FAFAFA",minHeight:80}}/>;
        const ds=yr+"-"+String(mo+1).padStart(2,"0")+"-"+String(day).padStart(2,"0");const isT=ds===today;
        const dt=tasks.filter(t=>t.start_date<=ds&&t.end_date>=ds);
        return <div key={i} style={{background:"#fff",minHeight:80,padding:4}}>
          <div style={{fontSize:12,fontWeight:isT?800:400,color:isT?"#3B82F6":"#1E293B",marginBottom:2}}>{isT?<span style={{background:"#3B82F6",color:"#fff",borderRadius:"50%",width:22,height:22,display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{day}</span>:day}</div>
          {dt.slice(0,3).map(t=><div key={t.id} onClick={()=>onSelect(t)} style={{background:CL[t.dept]||"#94A3B8",color:"#fff",fontSize:9,fontWeight:600,padding:"1px 4px",borderRadius:3,marginBottom:1,cursor:"pointer",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",opacity:t.status==="Done"?0.35:0.8}}>{t.name}</div>)}
          {dt.length>3&&<div style={{fontSize:9,color:"#94A3B8"}}>+{dt.length-3} more</div>}
        </div>})}
    </div>
  </div>;
}

function Tbl({headers,rows}){return <div style={{border:"1px solid #E8ECEF",borderRadius:8,overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr style={{background:"#F8FAFC",borderBottom:"1px solid #E2E8F0"}}>{headers.map(h=><th key={h} style={{padding:"10px 8px",textAlign:"left",fontWeight:600,color:"#64748B",fontSize:11}}>{h}</th>)}</tr></thead><tbody>{rows.map((row,ri)=><tr key={ri} style={{borderBottom:"1px solid #F1F5F9"}}>{row.map((cell,ci)=><td key={ci} style={{padding:"8px"}}>{cell}</td>)}</tr>)}</tbody></table></div>}
function DeptHdr({dept}){return <div style={{background:(CL[dept]||"#94A3B8")+"15",color:CL[dept],padding:"8px 12px",borderRadius:"6px 6px 0 0",fontWeight:700,fontSize:13,borderLeft:"4px solid "+(CL[dept]||"#94A3B8")}}>{dept}</div>}

export default function Home(){
  const[tasks,setTasks]=useState([]);const[raci,setRaci]=useState([]);const[risks,setRisks]=useState([]);const[kpis,setKpis]=useState([]);const[meetings,setMeetings]=useState([]);
  const[view,setView]=useState("timeline");const[sel,setSel]=useState(null);const[syncing,setSyncing]=useState(false);const[syncMsg,setSyncMsg]=useState("");const[loading,setLoading]=useState(true);const[addModal,setAddModal]=useState(null);

  useEffect(()=>{async function la(){const[t,r,ri,k,m]=await Promise.all([supabase.from('tasks').select('*').order('id'),supabase.from('raci').select('*').order('dept,id'),supabase.from('risks').select('*').order('id'),supabase.from('kpis').select('*').order('dept,id'),supabase.from('meetings').select('*').order('id')]);if(t.data)setTasks(t.data);if(r.data)setRaci(r.data);if(ri.data)setRisks(ri.data);if(k.data)setKpis(k.data);if(m.data)setMeetings(m.data);setLoading(false)}la();
    const ch=supabase.channel('rt').on('postgres_changes',{event:'*',schema:'public',table:'tasks'},()=>{supabase.from('tasks').select('*').order('id').then(({data})=>{if(data)setTasks(data)})}).on('postgres_changes',{event:'*',schema:'public',table:'risks'},()=>{supabase.from('risks').select('*').order('id').then(({data})=>{if(data)setRisks(data)})}).on('postgres_changes',{event:'*',schema:'public',table:'kpis'},()=>{supabase.from('kpis').select('*').order('dept,id').then(({data})=>{if(data)setKpis(data)})}).on('postgres_changes',{event:'*',schema:'public',table:'raci'},()=>{supabase.from('raci').select('*').order('dept,id').then(({data})=>{if(data)setRaci(data)})}).subscribe();
    return()=>{supabase.removeChannel(ch)}},[]);

  const updateTask=useCallback(async(id,u)=>{setTasks(p=>p.map(t=>t.id===id?{...t,...u}:t));setSel(p=>p?.id===id?{...p,...u}:p);await supabase.from('tasks').update(u).eq('id',id)},[]);
  const deleteTask=useCallback(async id=>{setTasks(p=>p.filter(t=>t.id!==id));await supabase.from('tasks').delete().eq('id',id)},[]);
  const addTask=useCallback(async v=>{const n={name:v.name||"New Task",dept:v.dept||"PMO",owner:v.owner||"",start_date:v.start_date||today,end_date:v.end_date||today,status:"To Do",priority:v.priority||"Medium",risk:"On track",deps:[]};const{data}=await supabase.from('tasks').insert(n).select();if(data)setTasks(p=>[...p,...data]);setAddModal(null)},[]);
  const addRaci=useCallback(async v=>{const{data}=await supabase.from('raci').insert({dept:v.dept||"PMO",task:v.task||"",responsible:v.responsible||"",accountable:v.accountable||"",consulted:v.consulted||"",informed:v.informed||"",notes:v.notes||"",is_suggestion:v.is_suggestion==="true"}).select();if(data)setRaci(p=>[...p,...data]);setAddModal(null)},[]);
  const deleteRaci=useCallback(async id=>{setRaci(p=>p.filter(r=>r.id!==id));await supabase.from('raci').delete().eq('id',id)},[]);
  const addRisk=useCallback(async v=>{const ni="R"+(risks.length+1).toString().padStart(2,"0");const{data}=await supabase.from('risks').insert({id:v.id||ni,description:v.description||"",impact:v.impact||"HIGH",status:"ACTIVE",owner:v.owner||"",mitigation:v.mitigation||""}).select();if(data)setRisks(p=>[...p,...data]);setAddModal(null)},[risks]);
  const updateRisk=useCallback(async(id,u)=>{setRisks(p=>p.map(r=>r.id===id?{...r,...u}:r));await supabase.from('risks').update(u).eq('id',id)},[]);
  const deleteRisk=useCallback(async id=>{setRisks(p=>p.filter(r=>r.id!==id));await supabase.from('risks').delete().eq('id',id)},[]);
  const addKpi=useCallback(async v=>{const{data}=await supabase.from('kpis').insert({dept:v.dept||"PMO",name:v.name||"",target:v.target||"",current_value:v.current_value||"",flag:v.flag||"yellow",review_rhythm:v.review_rhythm||"Weekly"}).select();if(data)setKpis(p=>[...p,...data]);setAddModal(null)},[]);
  const updateKpi=useCallback(async(id,u)=>{setKpis(p=>p.map(k=>k.id===id?{...k,...u}:k));await supabase.from('kpis').update(u).eq('id',id)},[]);

  const doSync=async()=>{setSyncing(true);setSyncMsg("Syncing...");try{const res=await fetch('/api/sync',{method:'POST'});const data=await res.json();setSyncMsg("Done: "+(data.results?.map(r=>r.source+" "+r.status).join(', ')||'Synced'))}catch(e){setSyncMsg("Error: "+e.message)}setSyncing(false)};
  const stats=useMemo(()=>({total:tasks.length,todo:tasks.filter(t=>t.status==="To Do").length,doing:tasks.filter(t=>t.status==="Doing").length,done:tasks.filter(t=>t.status==="Done").length,risk:tasks.filter(t=>t.risk!=="On track").length}),[tasks]);
  const raciByDept={};raci.forEach(r=>{if(!raciByDept[r.dept])raciByDept[r.dept]=[];raciByDept[r.dept].push(r)});
  const kpiByDept={};kpis.forEach(k=>{if(!kpiByDept[k.dept])kpiByDept[k.dept]=[];kpiByDept[k.dept].push(k)});

  const TABS=[{id:"timeline",l:"Timeline"},{id:"board",l:"Board"},{id:"calendar",l:"Calendar"},{id:"raci",l:"RACI"},{id:"kpi",l:"KPIs"},{id:"risk",l:"Risks"},{id:"roles",l:"Open Roles"},{id:"meet",l:"Meetings"}];

  if(loading)return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontSize:16,color:"#64748B",fontFamily:"Inter,system-ui"}}>Loading Attimo PMO...</div>;

  return <div style={{fontFamily:"'Inter',system-ui",background:"#fff",minHeight:"100vh"}}>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
    <div style={{borderBottom:"1px solid #E8ECEF",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:26,height:26,borderRadius:6,background:"#0D1B2A",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:13,fontWeight:800}}>A</span></div><span style={{fontSize:15,fontWeight:700}}>Attimo PMO</span><span style={{color:"#CBD5E1"}}>|</span><span style={{fontSize:12,color:"#64748B"}}>Company Operations</span></div>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <button onClick={doSync} disabled={syncing} style={{background:syncing?"#E2E8F0":"#0D1B2A",color:syncing?"#94A3B8":"#fff",border:"none",padding:"6px 14px",borderRadius:6,fontWeight:600,fontSize:11,cursor:syncing?"wait":"pointer"}}>{syncing?"Syncing...":"Sync All"}</button>
        {syncMsg&&<span style={{fontSize:10,color:"#10B981"}}>{syncMsg}</span>}
        <div style={{display:"flex",gap:10,fontSize:11}}><span><b style={{color:"#3B82F6"}}>{stats.total}</b> total</span><span><b style={{color:"#F59E0B"}}>{stats.doing}</b> doing</span><span><b style={{color:"#10B981"}}>{stats.done}</b> done</span><span><b style={{color:"#EF4444"}}>{stats.risk}</b> at risk</span></div>
      </div>
    </div>
    <div style={{borderBottom:"1px solid #E8ECEF",padding:"0 20px",display:"flex",flexWrap:"wrap"}}>
      {TABS.map(t=><button key={t.id} onClick={()=>setView(t.id)} style={{padding:"10px 14px",border:"none",background:"none",fontWeight:600,fontSize:13,cursor:"pointer",color:view===t.id?"#1E293B":"#94A3B8",borderBottom:view===t.id?"2px solid #1E293B":"2px solid transparent"}}>{t.l}</button>)}
      <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6}}>{ANCH.map((a,i)=><span key={i} style={{fontSize:9,color:a.c,fontWeight:700,padding:"2px 6px",background:a.c+"12",borderRadius:99}}>{a.l} {fD(a.d)}</span>)}</div>
    </div>
    <div style={{padding:20}}>

    {view==="timeline"&&<div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:14,fontWeight:800}}>Company Gantt</div><button onClick={()=>setAddModal("task")} style={{background:"#0D1B2A",color:"#fff",border:"none",padding:"6px 14px",borderRadius:6,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add Task</button></div>
      <div style={{background:"#fff",borderRadius:8,border:"1px solid #E8ECEF"}}>{STS.map(st=>{const items=tasks.filter(t=>t.status===st);return <div key={st} style={{padding:"12px 16px",borderBottom:"1px solid #F1F5F9"}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:8,display:"flex",alignItems:"center",gap:8}}>▼ {st}<span style={{background:"#E2E8F0",borderRadius:99,padding:"1px 8px",fontSize:11,color:"#64748B"}}>{items.length}</span></div>
        {items.map(t=>{const cl=CL[t.dept]||"#94A3B8";const sOff=Math.max(0,dB("2026-04-25",t.start_date));const dur=Math.max(1,dB(t.start_date,t.end_date)+1);const totalD=dB("2026-04-25","2026-07-05");
          return <div key={t.id} onClick={()=>setSel(t)} style={{display:"flex",alignItems:"center",gap:12,padding:"4px 0",cursor:"pointer",borderRadius:4}}>
            <div style={{width:200,display:"flex",alignItems:"center",gap:6,flexShrink:0}}><div style={{width:18,height:18,borderRadius:"50%",background:cl,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:8,fontWeight:700}}>{t.owner?.[0]}</span></div><span style={{fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</span></div>
            <div style={{flex:1,height:24,background:"#F8FAFC",borderRadius:4,position:"relative"}}><div style={{position:"absolute",left:(sOff/totalD)*100+"%",width:Math.max((dur/totalD)*100,0.8)+"%",top:2,bottom:2,borderRadius:4,background:cl,opacity:t.status==="Done"?0.3:0.8,display:"flex",alignItems:"center",paddingLeft:6}}><span style={{color:"#fff",fontSize:9,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden"}}>{fD(t.start_date)}-{fD(t.end_date)}</span></div></div>
            {t.risk!=="On track"&&<div style={{width:8,height:8,borderRadius:"50%",background:RC[t.risk]?.c,flexShrink:0}}/>}
          </div>})}
      </div>})}</div>
    </div>}

    {view==="board"&&<div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:14,fontWeight:800}}>Board</div><button onClick={()=>setAddModal("task")} style={{background:"#0D1B2A",color:"#fff",border:"none",padding:"6px 14px",borderRadius:6,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add Task</button></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>{STS.map(st=><div key={st} style={{background:"#F8FAFC",borderRadius:8,padding:12,minHeight:200}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{fontWeight:700,fontSize:14}}>{st}</span><span style={{background:"#E2E8F0",borderRadius:99,padding:"2px 8px",fontSize:11,fontWeight:600,color:"#64748B"}}>{tasks.filter(t=>t.status===st).length}</span></div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>{tasks.filter(t=>t.status===st).map(t=>{const rc=RC[t.risk];const pc=PC[t.priority];
          return <div key={t.id} onClick={()=>setSel(t)} style={{background:"#fff",borderRadius:8,padding:12,border:"1px solid #E8ECEF",borderLeft:"4px solid "+(CL[t.dept]||"#94A3B8"),cursor:"pointer"}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:6}}>{t.name}</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>{pc&&<Bdg bg={pc.bg} c={pc.c}>{t.priority}</Bdg>}{rc&&<Bdg bg={rc.bg} c={rc.c}>{t.risk}</Bdg>}</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#64748B"}}><div style={{width:16,height:16,borderRadius:"50%",background:CL[t.dept],display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:7,fontWeight:700}}>{t.owner?.[0]}</span></div>{fD(t.start_date)}-{fD(t.end_date)}</div>
              <select value={t.status} onChange={e=>{e.stopPropagation();updateTask(t.id,{status:e.target.value})}} onClick={e=>e.stopPropagation()} style={{fontSize:10,border:"1px solid #E2E8F0",borderRadius:4,padding:"2px",cursor:"pointer"}}>{STS.map(s=><option key={s}>{s}</option>)}</select>
            </div></div>})}</div>
      </div>)}</div>
    </div>}

    {view==="calendar"&&<CalendarView tasks={tasks} onSelect={setSel}/>}

    {view==="raci"&&<div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",justifyContent:"space-between"}}><div style={{fontSize:14,fontWeight:800}}>RACI Matrix</div><button onClick={()=>setAddModal("raci")} style={{background:"#0D1B2A",color:"#fff",border:"none",padding:"6px 14px",borderRadius:6,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add Entry</button></div>
      <div style={{background:"#F1F5F9",padding:"8px 12px",borderRadius:6,fontSize:11,color:"#64748B"}}><b>R</b>=Responsible <b>A</b>=Accountable <b>C</b>=Consulted <b>I</b>=Informed <span style={{color:"#3B82F6"}}>[Suggest]</span>=PMO suggestion</div>
      {Object.entries(raciByDept).map(([dept,rows])=><div key={dept}><DeptHdr dept={dept}/><Tbl headers={["Task","R","A","C","I","Notes",""]} rows={rows.map(r=>[<span style={{fontWeight:600,color:r.is_suggestion?"#3B82F6":"#1E293B"}}>{r.is_suggestion?"[Suggest] ":""}{r.task}</span>,r.responsible,r.accountable,r.consulted,r.informed,<span style={{fontSize:11,color:"#92400E"}}>{r.notes}</span>,<button onClick={()=>deleteRaci(r.id)} style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontSize:11}}>x</button>])}/></div>)}
    </div>}

    {view==="kpi"&&<div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",justifyContent:"space-between"}}><div style={{fontSize:14,fontWeight:800}}>KPIs</div><button onClick={()=>setAddModal("kpi")} style={{background:"#0D1B2A",color:"#fff",border:"none",padding:"6px 14px",borderRadius:6,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add KPI</button></div>
      <KpiChart kpis={kpis}/>
      {Object.entries(kpiByDept).map(([dept,items])=><div key={dept}><DeptHdr dept={dept}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8,padding:10,background:"#fff",border:"1px solid #E8ECEF",borderRadius:"0 0 6px 6px"}}>{items.map(k=><div key={k.id} style={{borderLeft:"3px solid "+FC[k.flag],borderRadius:6,padding:10,background:"#FAFBFC"}}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:4}}>{k.name}</div><div style={{fontSize:10,color:"#64748B"}}>Target: {k.target}</div>
          <div style={{display:"flex",alignItems:"center",gap:4,marginTop:4}}><div style={{width:8,height:8,borderRadius:"50%",background:FC[k.flag]}}/><span style={{fontSize:11,fontWeight:700,color:FC[k.flag]}}>{k.current_value}</span></div>
          <div style={{marginTop:6,display:"flex",gap:4}}>{["green","yellow","red"].map(f=><button key={f} onClick={()=>updateKpi(k.id,{flag:f})} style={{width:16,height:16,borderRadius:"50%",background:FC[f],border:k.flag===f?"2px solid #1E293B":"1px solid #E2E8F0",cursor:"pointer"}}/>)}</div>
        </div>)}</div>
      </div>)}
    </div>}

    {view==="risk"&&<div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:14,fontWeight:800}}>Risk Register</div><button onClick={()=>setAddModal("risk")} style={{background:"#0D1B2A",color:"#fff",border:"none",padding:"6px 14px",borderRadius:6,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add Risk</button></div>
      <Tbl headers={["#","Risk","Impact","Status","Owner","Mitigation",""]} rows={risks.map(r=>[<b>{r.id}</b>,<InEdit value={r.description} onChange={v=>updateRisk(r.id,{description:v})}/>,<InEdit value={r.impact} onChange={v=>updateRisk(r.id,{impact:v})} type="select" options={IMP_OPT}/>,<InEdit value={r.status} onChange={v=>updateRisk(r.id,{status:v})} type="select" options={["ACTIVE","MITIGATING","FUTURE","CLOSED"]}/>,<InEdit value={r.owner} onChange={v=>updateRisk(r.id,{owner:v})}/>,<InEdit value={r.mitigation} onChange={v=>updateRisk(r.id,{mitigation:v})}/>,<button onClick={()=>deleteRisk(r.id)} style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontSize:11}}>x</button>])}/>
    </div>}

    {view==="roles"&&<div>
      <div style={{fontSize:14,fontWeight:800,marginBottom:12}}>Open Hiring Positions</div>
      <Tbl headers={["Role","Status","Trigger / Blocker","Target Date"]} rows={[
        [<b>Graphic Designer / Videographer</b>,"Interviewing","Blocks 7 May brand visuals","Confirm 30 Apr"],
        [<b>Full Stack Developer</b>,<span style={{color:"#DC2626",fontWeight:700}}>Blocked</span>,"Shortlist due 30 Apr. Syed on leave.","Hire by 21 May"],
        [<b>DevOps Engineer</b>,"Not opened","Blocks production infra security","Before Phase 1"],
        [<b>QA Engineer</b>,"Not opened","Team doing QA. Flag post-launch.","After launch"],
        [<b>Support / Customer Success</b>,"Not opened","10+ users post-launch","Post-launch"],
        [<b>Business Analyst</b>,"Not opened","PMO absorbing. 3+ pilots trigger","3+ pilots"],
      ]}/>
    </div>}

    {view==="meet"&&<div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:14,fontWeight:800}}>Meeting Cadence</div><a href="https://calendar.google.com" target="_blank" rel="noopener" style={{fontSize:11,color:"#3B82F6",fontWeight:600,textDecoration:"none",background:"#EFF6FF",padding:"6px 12px",borderRadius:6}}>Open Google Calendar</a></div>
      <Tbl headers={["Type","Meeting","When","Duration","Owner","Attendees"]} rows={meetings.map(m=>[<Bdg bg={MT_CLR[m.type]||"#94A3B8"} c="#fff">{m.type}</Bdg>,<b>{m.name}</b>,m.schedule,m.duration,<b>{m.owner}</b>,<span style={{color:"#475569"}}>{m.attendees}</span>])}/>
    </div>}

    </div>
    <TicketPopup task={sel} tasks={tasks} onClose={()=>setSel(null)} onUpdate={updateTask} onDelete={deleteTask}/>

    {addModal==="task"&&<AddModal title="Add Task" fields={[{key:"name",label:"Task Name",placeholder:"e.g. Landing page design"},{key:"dept",label:"Department",type:"select",options:DEPT_OPT},{key:"owner",label:"Owner",placeholder:"e.g. Gamze"},{key:"start_date",label:"Start Date",type:"date"},{key:"end_date",label:"End Date",type:"date"},{key:"priority",label:"Priority",type:"select",options:PRI_OPT}]} onSave={addTask} onClose={()=>setAddModal(null)}/>}
    {addModal==="raci"&&<AddModal title="Add RACI Entry" fields={[{key:"dept",label:"Department",type:"select",options:DEPT_OPT},{key:"task",label:"Task",placeholder:"e.g. Design review"},{key:"responsible",label:"Responsible"},{key:"accountable",label:"Accountable"},{key:"consulted",label:"Consulted"},{key:"informed",label:"Informed"},{key:"notes",label:"Notes"},{key:"is_suggestion",label:"PMO Suggestion?",type:"select",options:["false","true"]}]} onSave={addRaci} onClose={()=>setAddModal(null)}/>}
    {addModal==="risk"&&<AddModal title="Add Risk" fields={[{key:"description",label:"Risk Description",placeholder:"e.g. Key person leaving"},{key:"impact",label:"Impact",type:"select",options:IMP_OPT},{key:"owner",label:"Owner",placeholder:"e.g. Efehan"},{key:"mitigation",label:"Mitigation Plan"}]} onSave={addRisk} onClose={()=>setAddModal(null)}/>}
    {addModal==="kpi"&&<AddModal title="Add KPI" fields={[{key:"dept",label:"Department",type:"select",options:DEPT_OPT},{key:"name",label:"KPI Name"},{key:"target",label:"Target"},{key:"current_value",label:"Current Value"},{key:"flag",label:"Status",type:"select",options:["green","yellow","red"]},{key:"review_rhythm",label:"Review",type:"select",options:["Weekly","Bi-Weekly","Monthly","Per release"]}]} onSave={addKpi} onClose={()=>setAddModal(null)}/>}
  </div>;
}
