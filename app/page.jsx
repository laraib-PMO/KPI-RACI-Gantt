'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL||'', process.env.NEXT_PUBLIC_SUPABASE_KEY||'');
const CL={PMO:"#3B82F6",Development:"#10B981",Architecture:"#14B8A6","AI/Science":"#F59E0B",Design:"#8B5CF6",Marketing:"#EC4899",Legal:"#64748B",Hiring:"#06B6D4",Leadership:"#6366F1"};
const STS=["To Do","Doing","Done"];const PRI_OPT=["Low","Medium","High"];const DEPT_OPT=Object.keys(CL);const RSK_OPT=["On track","At risk","Off track"];const IMP_OPT=["CRITICAL","HIGH","MEDIUM","LOW"];
const RC={"On track":{bg:"#DCFCE7",c:"#166534"},"At risk":{bg:"#FEF3C7",c:"#D97706"},"Off track":{bg:"#FEE2E2",c:"#DC2626"}};
const PC={Low:{bg:"#DBEAFE",c:"#1D4ED8"},Medium:{bg:"#FEF3C7",c:"#D97706"},High:{bg:"#FEE2E2",c:"#DC2626"}};
const FC={green:"#16A34A",yellow:"#D97706",red:"#DC2626"};
const ANCH=[{d:"2026-05-07",l:"Hatchery",c:"#6366F1"},{d:"2026-05-21",l:"GTM",c:"#F59E0B"},{d:"2026-06-10",l:"Launch",c:"#10B981"},{d:"2026-07-01",l:"Pitch Day",c:"#EF4444"}];

// Robust date parsing for Supabase dates
const pD=s=>{if(!s)return new Date();const str=String(s).split('T')[0];const[y,m,d]=str.split('-').map(Number);return new Date(y,m-1,d)};
const fD=s=>{try{return pD(s).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}catch{return String(s)}};
const daysB=(a,b)=>{const da=pD(a),db=pD(b);return Math.round((db-da)/864e5)};
const today=new Date().toISOString().split("T")[0];
const isOverdue=(t)=>t.status!=="Done"&&String(t.end_date).split('T')[0]<today;

// Email → Display Name mapping
const E2N={'burak@attimo.com':'Burak Çetin','burak':'Burak Çetin','burak cetin':'Burak Çetin','talha':'Talha Mubeen','talha@attimo.com':'Talha Mubeen','talha mubeen':'Talha Mubeen','laraib':'Laraib Haider','laraib@attimo.com':'Laraib Haider','murat':'Murat Tut','murat@attimo.com':'Murat Tut','sooling':'Soo Ling Lim','soo ling':'Soo Ling Lim','sooling@attimo.com':'Soo Ling Lim','soo.ling@attimo.com':'Soo Ling Lim','gamze':'Gamze Savaş','gamze@attimo.com':'Gamze Savaş','gamze savas':'Gamze Savaş','claire':'Claire Eskander','claire@attimo.com':'Claire Eskander','mesude':'Mesude Gökpınar','mesude@attimo.com':'Mesude Gökpınar','mesude gokpinar':'Mesude Gökpınar','suche':'Suche Coşkun','suche@attimo.com':'Suche Coşkun','suche coskun':'Suche Coşkun','efehan':'Efehan Maleri','efehan@attimo.com':'Efehan Maleri','syed':'Syed Osama Ali','syed@attimo.com':'Syed Osama Ali','tunc':'Tunç Karadağ','tunch':'Tunç Karadağ','tunc@attimo.com':'Tunç Karadağ','tunc karadag':'Tunç Karadağ'};
const N2D={'Burak Çetin':'AI/Science','Talha Mubeen':'Development','Laraib Haider':'PMO','Murat Tut':'Development','Soo Ling Lim':'AI/Science','Gamze Savaş':'Design','Claire Eskander':'Marketing','Mesude Gökpınar':'PMO','Suche Coşkun':'Marketing','Efehan Maleri':'Leadership','Syed Osama Ali':'Leadership','Tunç Karadağ':'Design'};
const rN=r=>{if(!r)return'Unassigned';return E2N[r.toLowerCase().trim()]||r};
const rND=r=>{const n=rN(r);const d=N2D[n];return d?n+' ('+d+')':n};

// Attimo "o" mark SVG — used for favicon + login icon
const LogoMark=({size=30,color="currentColor"})=><svg width={size} height={size} viewBox="430 375 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="504.18" cy="393.65" r="8.03" fill={color}/><path d="M490.83,382.15c1.35,1.35,1.55,4,2.11,5.77,2.56,8.04,6.64,12.36,14.2,15.98,7.61,3.64,12.42,4.43,13.02,14.46,1.71,28.51-24.66,50.67-52.46,44.07-15.87-3.77-28.81-17-31.71-33.14-4.99-27.8,17.24-51.03,44.91-49.58,2.38.12,8.27.79,9.93,2.45ZM455.55,402.01c-18.71,20.77-.51,52.82,26.81,48.36,20.55-3.35,30.96-27.28,19.6-44.75-10.44-16.06-33.6-17.84-46.41-3.61Z" fill={color}/></svg>;

// Attimo full wordmark SVG — header
const LogoFull=({height=22,color="currentColor"})=><svg height={height} viewBox="70 350 460 120" xmlns="http://www.w3.org/2000/svg"><path fill={color} d="M75.04,420.79c0-24.26,18.11-41.17,41.17-41.17s40.99,16.23,40.99,43.56v36.38c0,2.22-1.2,3.42-3.42,3.42h-4.61c-2.22,0-3.42-1.2-3.42-3.42v-36.04c0-21.18-12.47-32.8-29.55-32.8-15.89,0-29.38,11.44-29.38,29.89,0,16.4,10.76,31.43,33.14,31.43h8.71c2.39,0,3.42,1.54,2.56,3.76l-1.54,4.44c-.68,2.05-2.05,2.73-3.76,2.73h-7.17c-24.43,0-43.73-17.08-43.73-42.19Z"/><path fill={color} d="M173.26,434.8v-69.69c0-2.22,1.2-3.42,3.42-3.42h4.61c2.22,0,3.42,1.2,3.42,3.42v16.4h23.74c2.22,0,3.42,1.2,3.42,3.42v4.1c0,2.22-1.2,3.42-3.42,3.42h-23.74v41.51c0,13.32,7,18.11,17.76,18.11h7.69c2.39,0,3.59,1.54,2.73,3.93l-1.54,4.27c-.68,1.88-2.05,2.73-3.93,2.73h-6.49c-17.94,0-27.67-10.42-27.67-28.18Z"/><path fill={color} d="M223.99,434.8v-69.69c0-2.22,1.2-3.42,3.42-3.42h4.61c2.22,0,3.42,1.2,3.42,3.42v16.4h23.74c2.22,0,3.42,1.2,3.42,3.42v4.1c0,2.22-1.2,3.42-3.42,3.42h-23.74v41.51c0,13.32,7,18.11,17.76,18.11h7.69c2.39,0,3.59,1.54,2.73,3.93l-1.54,4.27c-.68,1.88-2.05,2.73-3.93,2.73h-6.49c-17.94,0-27.67-10.42-27.67-28.18Z"/><circle fill={color} cx="281.04" cy="364.39" r="8.03"/><rect fill={color} x="275.23" y="381.51" width="11.44" height="81.48" rx="3.42" ry="3.42"/><path fill={color} d="M335.36,379.63c12.13,0,21.86,5.98,27.16,15.37,5.47-9.57,14.52-15.37,26.65-15.37,18.11,0,31.6,13.15,31.6,33.14v46.8c0,2.22-1.2,3.42-3.42,3.42h-4.61c-2.22,0-3.42-1.2-3.42-3.42v-46.29c0-13.15-7.69-22.72-20.67-22.72s-20.67,9.57-20.67,22.72v46.29c0,2.22-1.2,3.42-3.42,3.42h-4.61c-2.22,0-3.42-1.2-3.42-3.42v-46.29c0-13.15-7.86-22.72-20.67-22.72s-20.84,9.57-20.84,22.72v46.29c0,2.22-1.2,3.42-3.42,3.42h-4.61c-2.22,0-3.42-1.2-3.42-3.42v-46.8c0-20.16,13.67-33.14,31.77-33.14Z"/><circle fill={color} cx="512.21" cy="393.65" r="8.03"/><path fill={color} d="M490.83,382.15c1.35,1.35,1.55,4,2.11,5.77,2.56,8.04,6.64,12.36,14.2,15.98,7.61,3.64,12.42,4.43,13.02,14.46,1.71,28.51-24.66,50.67-52.46,44.07-15.87-3.77-28.81-17-31.71-33.14-4.99-27.8,17.24-51.03,44.91-49.58,2.38.12,8.27.79,9.93,2.45ZM455.55,402.01c-18.71,20.77-.51,52.82,26.81,48.36,20.55-3.35,30.96-27.28,19.6-44.75-10.44-16.06-33.6-17.84-46.41-3.61Z"/></svg>;

const Bdg=({bg,c,children,onClick})=><span onClick={onClick} style={{background:bg,color:c,padding:"2px 8px",borderRadius:99,fontSize:10,fontWeight:700,whiteSpace:"nowrap",cursor:onClick?"pointer":"default",transition:"all .2s"}}>{children}</span>;

const CSS=`
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideR{from{opacity:0;transform:translateX(-18px)}to{opacity:1;transform:translateX(0)}}
@keyframes slideL{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
@keyframes scaleIn{from{transform:scale(.88);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes barGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes glow{0%,100%{box-shadow:0 0 5px rgba(59,130,246,.2)}50%{box-shadow:0 0 18px rgba(59,130,246,.45)}}
@keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes bounceIn{0%{transform:scale(.3);opacity:0}50%{transform:scale(1.06)}70%{transform:scale(.95)}100%{transform:scale(1);opacity:1}}
@keyframes ripple{0%{box-shadow:0 0 0 0 rgba(59,130,246,.3)}100%{box-shadow:0 0 0 14px transparent}}
@keyframes slideDown{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
@keyframes wiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-2deg)}75%{transform:rotate(2deg)}}
@keyframes countUp{from{opacity:0;transform:translateY(8px) scale(.9)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes borderGlow{0%,100%{border-color:rgba(59,130,246,.2)}50%{border-color:rgba(59,130,246,.6)}}
@keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}
@keyframes popIn{0%{transform:scale(0);opacity:0}70%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
@keyframes gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
.af{animation:fadeUp .4s cubic-bezier(.22,1,.36,1) both}
.asl{animation:slideR .4s cubic-bezier(.22,1,.36,1) both}
.asr{animation:slideL .4s cubic-bezier(.22,1,.36,1) both}
.asc{animation:scaleIn .3s cubic-bezier(.22,1,.36,1) both}
.asd{animation:slideDown .35s cubic-bezier(.22,1,.36,1) both}
.abn{animation:bounceIn .5s cubic-bezier(.22,1,.36,1) both}
.apop{animation:popIn .3s cubic-bezier(.22,1,.36,1) both}
.acount{animation:countUp .4s cubic-bezier(.22,1,.36,1) both}
.ch{transition:all .25s cubic-bezier(.22,1,.36,1)}.ch:hover{transform:translateY(-3px);box-shadow:0 8px 25px rgba(0,0,0,.1)!important}
.rh{transition:all .2s ease}.rh:hover{background:var(--hover)!important}
.bar-g{transform-origin:left;animation:barGrow .6s cubic-bezier(.22,1,.36,1) both}
.glow-btn{animation:glow 2s infinite}
.float-anim{animation:float 3s ease-in-out infinite}
.breathe-anim{animation:breathe 4s ease-in-out infinite}
.gradient-btn{background-size:200% 200%;animation:gradientShift 3s ease infinite}
.overdue-row{border-left:3px solid #EF4444!important;background:rgba(239,68,68,.08)!important}
.ontrack-row:hover{border-left:3px solid #10B981!important;background:rgba(16,185,129,.08)!important}
.atrisk-row:hover{border-left:3px solid #F59E0B!important;background:rgba(245,158,11,.08)!important}
.offtrack-row:hover{border-left:3px solid #EF4444!important;background:rgba(239,68,68,.08)!important}
.done-row{opacity:.6;transition:opacity .3s}.done-row:hover{opacity:1}
.pulse-dot{animation:pulse 1.5s infinite}
.btn-pop{transition:all .2s cubic-bezier(.22,1,.36,1)}.btn-pop:hover{transform:scale(1.04);box-shadow:0 4px 15px rgba(59,130,246,.3)}.btn-pop:active{transform:scale(.97)}
.card-enter{animation:slideUp .5s cubic-bezier(.22,1,.36,1) both}
.stat-card{transition:all .3s cubic-bezier(.22,1,.36,1)}.stat-card:hover{transform:translateY(-4px) scale(1.02);box-shadow:0 12px 30px rgba(0,0,0,.12)!important}
.tab-btn{transition:all .2s}.tab-btn:hover{transform:translateY(-1px)}
.sb-item{display:flex;align-items:center;padding:10px 16px;cursor:pointer;border-left:3px solid transparent;transition:all .2s cubic-bezier(.22,1,.36,1);gap:0;position:relative}
.sb-item:hover{background:var(--hover);padding-left:20px}
.sb-item.active{border-left-color:#3B82F6;background:rgba(59,130,246,.08);animation:borderGlow 2s infinite}
.sb-item.active .sb-icon{color:#3B82F6;animation:float 3s ease-in-out infinite}
.sb-item.active .sb-label{color:#3B82F6;font-weight:700}
.sb-item[data-tip]:hover::after{content:attr(data-tip);position:absolute;left:100%;top:50%;transform:translateY(-50%);background:var(--fg);color:var(--bg);padding:4px 10px;border-radius:6px;font-size:10px;font-weight:600;white-space:nowrap;z-index:100;pointer-events:none;animation:fadeIn .15s ease-out;box-shadow:0 4px 12px rgba(0,0,0,.2)}
.sidebar{width:56px;transition:width .3s cubic-bezier(.22,1,.36,1);overflow:hidden;white-space:nowrap;flex-shrink:0;height:100vh;position:sticky;top:0;display:flex;flex-direction:column;background:var(--bg2);border-right:1px solid var(--border);z-index:50}
.sidebar:hover{width:200px}
.sidebar:hover .sb-label{opacity:1;transform:translateX(0)}
.sidebar:hover .sb-item[data-tip]:hover::after{display:none}
.sb-label{opacity:0;transition:all .25s cubic-bezier(.22,1,.36,1);margin-left:10px;font-size:12px;font-weight:500;transform:translateX(-8px)}
.sb-icon{width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;color:var(--fg2);transition:all .2s}
.sb-item:hover .sb-icon{transform:scale(1.15)}
.modal-overlay{animation:fadeIn .2s ease-out;backdrop-filter:blur(6px)}
.profile-tab{transition:all .2s}.profile-tab:hover{background:var(--hover)!important}
.profile-tab.active{border-bottom:2px solid #3B82F6;color:#3B82F6!important;font-weight:700!important}
.info-row{animation:slideR .3s cubic-bezier(.22,1,.36,1) both;transition:background .15s}.info-row:hover{background:var(--hover);border-radius:6px}
[data-theme="dark"]{--bg:#0F172A;--bg2:#1E293B;--bg3:#334155;--fg:#F1F5F9;--fg2:#94A3B8;--border:#334155;--hover:rgba(59,130,246,.08);--card:#1E293B;--hdr:linear-gradient(135deg,#0F172A 0%,#1E293B 50%,#0F172A 100%)}
[data-theme="light"]{--bg:#FFFFFF;--bg2:#F8FAFC;--bg3:#F1F5F9;--fg:#1E293B;--fg2:#64748B;--border:#E8ECEF;--hover:#F8FAFC;--card:#FFFFFF;--hdr:linear-gradient(135deg,#0D1B2A,#1B3A5C)}
[data-role="viewer"] .act-add,[data-role="viewer"] .act-del,[data-role="viewer"] .act-edit{display:none!important}
[data-role="editor"] .act-del{display:none!important}
[data-role="viewer"] td input,[data-role="viewer"] td select{pointer-events:none;opacity:.7}
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
  return <div className="af modal-overlay" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}} onClick={onClose}>
    <div className="asc" onClick={e=>e.stopPropagation()} style={{background:"var(--card)",borderRadius:16,width:"min(440px,95vw)",padding:20,boxShadow:"0 25px 60px rgba(0,0,0,.3)",border:"1px solid var(--border)"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}><h3 style={{margin:0,fontSize:16,fontWeight:800,color:"var(--fg)"}}>{title}</h3><button onClick={onClose} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"var(--fg2)"}}>✕</button></div>
      {fields.map(f=><div key={f.key} style={{marginBottom:12}}>
        <label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>{f.label}</label>
        {f.type==="select"?<select value={vals[f.key]||""} onChange={e=>setVals(p=>({...p,[f.key]:e.target.value}))} style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,background:"var(--bg2)",color:"var(--fg)"}}><option value="">Select...</option>{f.options.map(o=><option key={o}>{o}</option>)}</select>
        :<input type={f.type||"text"} placeholder={f.placeholder} value={vals[f.key]||""} onChange={e=>setVals(p=>({...p,[f.key]:e.target.value}))} style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,boxSizing:"border-box",background:"var(--bg2)",color:"var(--fg)"}}/>}
      </div>)}
      <button onClick={()=>onSave(vals)} className="btn-pop" style={{width:"100%",padding:10,background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",borderRadius:8,fontWeight:700,fontSize:13,cursor:"pointer",marginTop:8}}>Save</button>
    </div>
  </div>;
}

function TicketPopup({task,tasks,onClose,onUpdate,onDelete}){
  if(!task)return null;const cl=CL[task.dept]||"#94A3B8";const rc=RC[task.risk];const pc=PC[task.priority];
  const depN=(task.deps||[]).map(id=>tasks.find(t=>t.id===id)?.name||id);
  const blocks=tasks.filter(t=>(t.deps||[]).includes(task.id)).map(t=>t.name);
  const od=isOverdue(task);
  return <div className="af modal-overlay" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}} onClick={onClose}>
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
  return <div className="af" style={{overflowX:"auto",marginBottom:16,background:"var(--bg2)",borderRadius:12,padding:16,border:"1px solid var(--border)",display:"flex",flexDirection:"column",alignItems:"center"}}>
    <div style={{fontSize:13,fontWeight:700,marginBottom:12,color:"var(--fg)",alignSelf:"flex-start"}}>Department Health Overview</div>
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

function Tbl({headers,rows,ids,onReorder}){const[dI,setDI]=useState(null);const[oI,setOI]=useState(null);
  return <div style={{border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}} className="af"><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr style={{background:"var(--bg3)"}}>{onReorder&&<th style={{width:28}}></th>}{headers.map(h=><th key={h} style={{padding:"10px 8px",textAlign:"left",fontWeight:600,color:"var(--fg2)",fontSize:11}}>{h}</th>)}</tr></thead><tbody>{rows.map((row,ri)=><tr key={ri} className="rh" style={{borderBottom:"1px solid var(--border)",background:oI===ri?"rgba(59,130,246,.1)":"transparent",cursor:onReorder?"grab":"default"}}
    draggable={!!onReorder} onDragStart={()=>setDI(ri)} onDragOver={e=>{e.preventDefault();setOI(ri)}} onDragEnd={()=>{setOI(null)}} onDrop={()=>{setOI(null);if(dI!==null&&dI!==ri&&ids&&onReorder)onReorder(ids[dI],ids[ri])}}>
    {onReorder&&<td style={{padding:"4px 6px",color:"var(--fg2)",cursor:"grab",fontSize:14,userSelect:"none"}}>⠿</td>}
    {row.map((cell,ci)=><td key={ci} style={{padding:"8px",color:"var(--fg)"}}>{cell}</td>)}</tr>)}</tbody></table></div>}
function DeptHdr({dept}){return <div className="af" style={{background:(CL[dept]||"#94A3B8")+"15",color:CL[dept],padding:"8px 12px",borderRadius:"8px 8px 0 0",fontWeight:700,fontSize:13,borderLeft:"4px solid "+(CL[dept]||"#94A3B8")}}>{dept}</div>}

export default function Home(){
  const[tasks,setTasks]=useState([]);const[raci,setRaci]=useState([]);const[risks,setRisks]=useState([]);const[kpis,setKpis]=useState([]);const[meetings,setMeetings]=useState([]);const[roles,setRoles]=useState([]);const[standups,setStandups]=useState([]);const[perf,setPerf]=useState([]);const[leaves,setLeaves]=useState([]);
  const[view,setView]=useState("dashboard");const[sel,setSel]=useState(null);const[syncing,setSyncing]=useState(false);const[loading,setLoading]=useState(true);const[addModal,setAddModal]=useState(null);const[meetFilter,setMeetFilter]=useState("all");const[ganttMode,setGanttMode]=useState("company");const[deptTasks,setDeptTasks]=useState(null);const[deptLoading,setDeptLoading]=useState(false);const[dvm,setDvm]=useState("list");const[lastSync,setLastSync]=useState("");
  const[dark,setDark]=useState(false);const[dragId,setDragId]=useState(null);const[statusFilter,setStatusFilter]=useState("all");const[userMenu,setUserMenu]=useState(false);const[profileTab,setProfileTab]=useState("overview");
  const[user,setUser]=useState(null);const[role,setRole]=useState(null);const[authLoading,setAuthLoading]=useState(true);const[userRoles,setUserRoles]=useState([]);
  const[toast,setToast]=useState("");const[personFilter,setPersonFilter]=useState("all");const[editMyName,setEditMyName]=useState(false);const[myNameVal,setMyNameVal]=useState("");const[showHoursModal,setShowHoursModal]=useState(false);const[hoursForm,setHoursForm]=useState({tz:"",start:"",end:""});const[slackStatus,setSlackStatus]=useState({});const[slackLoading,setSlackLoading]=useState(false);const[profileCard,setProfileCard]=useState(null);

  // Fetch Slack availability
  const fetchSlackStatus=useCallback(async()=>{
    setSlackLoading(true);
    try{const r=await fetch('/api/availability');const d=await r.json();
      const users=d.users||[];
      // Normalize: strip Turkish chars for fuzzy matching
      const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/ş/g,'s').replace(/ç/g,'c').replace(/ğ/g,'g').replace(/ö/g,'o').replace(/ü/g,'u');
      const map={};
      users.forEach(u=>{
        const email=(u.email||'').toLowerCase();
        const name=norm(u.name);
        const first=name.split(' ')[0];
        if(email)map['e:'+email]=u;
        if(name)map['n:'+name]=u;
        if(first)map['f:'+first]=u;
      });
      // Match function: tries email, normalized full name, normalized first name
      map._match=(ur)=>{
        const email=(ur.email||'').toLowerCase();
        const name=norm(ur.name);
        const first=name.split(' ')[0];
        return map['e:'+email]||map['n:'+name]||map['f:'+first]||null;
      };
      setSlackStatus(map);showToast("Slack status refreshed")
    }catch{}setSlackLoading(false);
  },[]);
  const canEdit=role==='admin'||role==='editor';
  const canDelete=role==='admin';
  const roleRef=useRef(null);roleRef.current=role;
  const isEditor=()=>['admin','editor'].includes(roleRef.current);
  const isAdmin=()=>roleRef.current==='admin';

  // Auth: listen for session, look up role
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if(session?.user){setUser(session.user);lookupRole(session.user.email)}
      else setAuthLoading(false)
    });
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{
      if(session?.user){setUser(session.user);lookupRole(session.user.email)}
      else{setUser(null);setRole(null);setAuthLoading(false)}
    });
    return()=>subscription.unsubscribe();
  },[]);
  const lookupRole=async(email)=>{
    const{data}=await supabase.from('user_roles').select('role').eq('email',email).single();
    setRole(data?.role||null);setAuthLoading(false);
  };
  const doLogin=()=>supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin}});
  const doLogout=async()=>{await supabase.auth.signOut();setUser(null);setRole(null)};

  useEffect(()=>{if((view==="leave"||view==="dashboard")&&Object.keys(slackStatus).length===0)fetchSlackStatus()},[view]);
  useEffect(()=>{if(typeof window!=='undefined'){const ls=localStorage.getItem('attimo_last_sync');if(ls)setLastSync(ls)}},[]);

  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(""),3000);return()=>clearTimeout(t)}},[toast]);
  const showToast=(msg)=>setToast(msg);
  useEffect(()=>{document.documentElement.setAttribute("data-theme",dark?"dark":"light")},[dark]);
  useEffect(()=>{if(role)document.documentElement.setAttribute("data-role",role)},[role]);

  // Generate favicon from the "o" mark
  useEffect(()=>{
    const cvs=document.createElement('canvas');cvs.width=64;cvs.height=64;const ctx=cvs.getContext('2d');
    ctx.fillStyle=dark?'#1E293B':'#ffffff';ctx.fillRect(0,0,64,64);ctx.fillStyle=dark?'#F1F5F9':'#324047';
    // Draw simplified "o" mark
    ctx.beginPath();ctx.arc(30,36,22,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=dark?'#1E293B':'#ffffff';ctx.beginPath();ctx.arc(30,36,15,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=dark?'#F1F5F9':'#324047';ctx.beginPath();ctx.arc(48,16,7,0,Math.PI*2);ctx.fill();
    const link=document.querySelector("link[rel='icon']")||document.createElement('link');
    link.rel='icon';link.href=cvs.toDataURL();document.head.appendChild(link);
    document.title='Attimo Ops Hub';
  },[dark]);

  useEffect(()=>{async function la(){const[t,r,ri,k,m,ro,su,ur,pf,lv]=await Promise.all([supabase.from('tasks').select('*').order('sort_order,id'),supabase.from('raci').select('*').order('sort_order,dept,id'),supabase.from('risks').select('*').order('sort_order,id'),supabase.from('kpis').select('*').order('sort_order,dept,id'),supabase.from('meetings').select('*').order('sort_order,id'),supabase.from('roles').select('*').order('sort_order,id'),supabase.from('standups').select('*').order('standup_date',{ascending:false}).order('created_at',{ascending:false}).limit(100),supabase.from('user_roles').select('*').order('created_at'),supabase.from('performance').select('*').order('created_at',{ascending:false}),supabase.from('leaves').select('*').order('start_date',{ascending:false})]);
    if(t.data)setTasks(t.data);if(r.data)setRaci(r.data);if(ri.data)setRisks(ri.data);if(k.data)setKpis(k.data);if(m.data)setMeetings(m.data);if(ro.data)setRoles(ro.data);if(su.data)setStandups(su.data);if(ur.data)setUserRoles(ur.data);if(pf.data)setPerf(pf.data);if(lv.data)setLeaves(lv.data);setLoading(false)}la();
    const ch=supabase.channel('rt3').on('postgres_changes',{event:'*',schema:'public',table:'tasks'},()=>supabase.from('tasks').select('*').order('id').then(({data})=>{if(data)setTasks(data)})).on('postgres_changes',{event:'*',schema:'public',table:'risks'},()=>supabase.from('risks').select('*').order('id').then(({data})=>{if(data)setRisks(data)})).on('postgres_changes',{event:'*',schema:'public',table:'kpis'},()=>supabase.from('kpis').select('*').order('dept,id').then(({data})=>{if(data)setKpis(data)})).on('postgres_changes',{event:'*',schema:'public',table:'raci'},()=>supabase.from('raci').select('*').order('dept,id').then(({data})=>{if(data)setRaci(data)})).on('postgres_changes',{event:'*',schema:'public',table:'roles'},()=>supabase.from('roles').select('*').order('id').then(({data})=>{if(data)setRoles(data)})).on('postgres_changes',{event:'*',schema:'public',table:'meetings'},()=>supabase.from('meetings').select('*').order('id').then(({data})=>{if(data)setMeetings(data)})).on('postgres_changes',{event:'*',schema:'public',table:'standups'},()=>supabase.from('standups').select('*').order('standup_date',{ascending:false}).order('created_at',{ascending:false}).limit(100).then(({data})=>{if(data)setStandups(data)})).subscribe();
    return()=>supabase.removeChannel(ch)},[]);

  const updateTask=useCallback(async(id,u)=>{if(!isEditor())return;notify("updated","tasks",u.name||u.status||JSON.stringify(u));setTasks(p=>p.map(t=>t.id===id?{...t,...u}:t));setSel(p=>p?.id===id?{...p,...u}:p);await supabase.from('tasks').update(u).eq('id',id)},[]);
  const deleteTask=useCallback(async id=>{if(!isAdmin()){showToast("Admin only");return}setTasks(p=>p.filter(t=>t.id!==id));await supabase.from('tasks').delete().eq('id',id)},[]);
  const addTask=useCallback(async v=>{if(!isEditor()){showToast("View-only access");return}const{data}=await supabase.from('tasks').insert({name:v.name||"New Task",dept:v.dept||"PMO",owner:v.owner||"",start_date:v.start_date||today,end_date:v.end_date||today,status:"To Do",priority:v.priority||"Medium",risk:"On track",deps:[]}).select();if(data)setTasks(p=>[...p,...data]);setAddModal(null)},[]);
  const addRaci=useCallback(async v=>{if(!isEditor()){showToast("View-only access");return}notify("added","raci",v.task);const{data}=await supabase.from('raci').insert({dept:v.dept||"PMO",task:v.task||"",responsible:v.responsible||"",accountable:v.accountable||"",consulted:v.consulted||"",informed:v.informed||"",notes:v.notes||"",is_suggestion:v.is_suggestion==="true"}).select();if(data)setRaci(p=>[...p,...data]);setAddModal(null)},[]);
  const deleteRaci=useCallback(async id=>{if(!isAdmin()){showToast("Admin only");return}setRaci(p=>p.filter(r=>r.id!==id));await supabase.from('raci').delete().eq('id',id)},[]);
  const updateRaci=useCallback(async(id,u)=>{if(!isEditor())return;setRaci(p=>p.map(r=>r.id===id?{...r,...u}:r));await supabase.from('raci').update(u).eq('id',id)},[]);
  const addRisk=useCallback(async v=>{if(!isEditor()){showToast("View-only access");return}notify("added","risks",v.description);const ni="R"+(risks.length+1).toString().padStart(2,"0");const{data}=await supabase.from('risks').insert({id:v.id||ni,description:v.description||"",impact:v.impact||"HIGH",status:"ACTIVE",owner:v.owner||"",mitigation:v.mitigation||"",linked_to:v.linked_to||""}).select();if(data)setRisks(p=>[...p,...data]);setAddModal(null)},[risks]);
  const updateRisk=useCallback(async(id,u)=>{if(!isEditor())return;setRisks(p=>p.map(r=>r.id===id?{...r,...u}:r));await supabase.from('risks').update(u).eq('id',id)},[]);
  const deleteRisk=useCallback(async id=>{if(!isAdmin()){showToast("Admin only");return}setRisks(p=>p.filter(r=>r.id!==id));await supabase.from('risks').delete().eq('id',id)},[]);
  const addKpi=useCallback(async v=>{if(!isEditor()){showToast("View-only access");return}const{data}=await supabase.from('kpis').insert({dept:v.dept||"PMO",name:v.name||"",target:v.target||"",current_value:v.current_value||"",flag:v.flag||"yellow",review_rhythm:v.review_rhythm||"Weekly"}).select();if(data)setKpis(p=>[...p,...data]);setAddModal(null)},[]);
  const updateKpi=useCallback(async(id,u)=>{if(!isEditor())return;notify("updated","kpis",JSON.stringify(u));setKpis(p=>p.map(k=>k.id===id?{...k,...u}:k));await supabase.from('kpis').update(u).eq('id',id)},[]);
  const addRole=useCallback(async v=>{if(!isEditor()){showToast("View-only access");return}const{data}=await supabase.from('roles').insert({title:v.title||"",status:v.status||"Not opened",trigger_blocker:v.trigger_blocker||"",target_date:v.target_date||""}).select();if(data)setRoles(p=>[...p,...data]);setAddModal(null)},[]);
  const updateRole=useCallback(async(id,u)=>{if(!isEditor())return;setRoles(p=>p.map(r=>r.id===id?{...r,...u}:r));await supabase.from('roles').update(u).eq('id',id)},[]);
  const deleteRole=useCallback(async id=>{if(!isAdmin()){showToast("Admin only");return}setRoles(p=>p.filter(r=>r.id!==id));await supabase.from('roles').delete().eq('id',id)},[]);
  const addMeeting=useCallback(async v=>{if(!isEditor()){showToast("View-only access");return}const{data}=await supabase.from('meetings').insert({type:v.type||"Milestone",name:v.name||"",schedule:v.schedule||"",duration:v.duration||"",owner:v.owner||"",attendees:v.attendees||"",output:v.output||""}).select();if(data)setMeetings(p=>[...p,...data]);setAddModal(null)},[]);
  const deleteMeeting=useCallback(async id=>{if(!isAdmin()){showToast("Admin only");return}setMeetings(p=>p.filter(m=>m.id!==id));await supabase.from('meetings').delete().eq('id',id)},[]);
  const updateMeeting=useCallback(async(id,u)=>{if(!isEditor())return;setMeetings(p=>p.map(m=>m.id===id?{...m,...u}:m));await supabase.from('meetings').update(u).eq('id',id)},[]);
  const addStandup=useCallback(async v=>{if(!isEditor()){showToast("View-only access");return}const{data}=await supabase.from('standups').insert({person:v.person||"",completed:v.completed||"",tomorrow:v.tomorrow||"",blockers:v.blockers||"None",standup_date:v.standup_date||today,source:"manual"}).select();if(data)setStandups(p=>[...data,...p]);setAddModal(null)},[]);
  const deleteStandup=useCallback(async id=>{setStandups(p=>p.filter(s=>s.id!==id));await supabase.from('standups').delete().eq('id',id)},[]);
  const onDrop=useCallback(ns=>{if(dragId){updateTask(dragId,{status:ns});setDragId(null)}},[dragId,updateTask]);

  // Slack edit notification — fires on any editor action
  const notify=useCallback(async(action,table,detail)=>{
    try{await fetch('/api/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:user?.user_metadata?.full_name||user?.email,action,table,detail})})}catch{}
  },[user]);

  // User roles CRUD (admin only)
  const addUserRole=useCallback(async v=>{if(role!=='admin')return;const{data}=await supabase.from('user_roles').insert({email:v.email||'',name:v.name||'',role:v.role||'viewer',dept:v.dept||'Team'}).select();if(data)setUserRoles(p=>[...p,...data]);setAddModal(null)},[role]);
  const updateUserRole=useCallback(async(id,u)=>{if(role!=='admin')return;setUserRoles(p=>p.map(r=>r.id===id?{...r,...u}:r));await supabase.from('user_roles').update(u).eq('id',id)},[role]);
  const deleteUserRole=useCallback(async id=>{if(role!=='admin')return;setUserRoles(p=>p.filter(r=>r.id!==id));await supabase.from('user_roles').delete().eq('id',id)},[role]);

  // Performance CRUD
  const addPerf=useCallback(async v=>{if(!isEditor()){showToast("View-only access");return}const{data}=await supabase.from('performance').insert({person:v.person||'',period:v.period||'',goals:v.goals||'',status:'draft'}).select();if(data)setPerf(p=>[...data,...p]);setAddModal(null)},[]);
  const updatePerf=useCallback(async(id,u)=>{if(!isEditor()){showToast("View-only access");return}setPerf(p=>p.map(r=>r.id===id?{...r,...u}:r));await supabase.from('performance').update({...u,updated_at:new Date().toISOString()}).eq('id',id)},[]);
  const deletePerf=useCallback(async id=>{if(!isAdmin()){showToast("Admin only");return}setPerf(p=>p.filter(r=>r.id!==id));await supabase.from('performance').delete().eq('id',id)},[]);

  // Leave CRUD
  const addLeave=useCallback(async v=>{if(!isEditor()){showToast("View-only access");return}const me=userRoles.find(r=>r.email===user?.email);if(me?.name==="Efehan Maleri"){showToast("CEO is excluded from leave requests");return}const s=v.start_date;const e=v.end_date||v.start_date;const hd=v.half_day==="Yes";const d=hd?0.5:(s&&e?Math.max(1,daysB(s,e)+1):1);const dbType=v.leave_type==="casual"?"personal":(v.leave_type||"annual");const{data}=await supabase.from('leaves').insert({person:v.person||user?.user_metadata?.full_name||'',email:user?.email||'',leave_type:dbType,half_day:hd,start_date:s,end_date:hd?s:e,days:d,reason:v.reason||'',status:'pending'}).select();if(data)setLeaves(p=>[...data,...p]);notify("requested","leave",(v.leave_type||"annual")+" "+s+(hd?" (half day)":""));setAddModal(null)},[user,userRoles]);
  const updateLeave=useCallback(async(id,u)=>{if(!isEditor()){showToast("View-only access");return}setLeaves(p=>p.map(r=>r.id===id?{...r,...u}:r));await supabase.from('leaves').update(u).eq('id',id);if(u.status)notify("updated","leave",u.status)},[]);
  const deleteLeave=useCallback(async id=>{if(!isAdmin()){showToast("Admin only");return}setLeaves(p=>p.filter(r=>r.id!==id));await supabase.from('leaves').delete().eq('id',id)},[]);

  // Profile picture upload
  // Self profile — any user can update own name + photo
  const updateMyName=useCallback(async(newName)=>{
    if(!newName?.trim())return;
    const me=userRoles.find(r=>r.email===user?.email);if(!me)return;
    await supabase.from('user_roles').update({name:newName.trim()}).eq('id',me.id);
    setUserRoles(p=>p.map(r=>r.id===me.id?{...r,name:newName.trim()}:r));
    setEditMyName(false);showToast("Name updated");
  },[user,userRoles]);

  // Propose working hours — any user
  const proposeHours=useCallback(async(tz,start,end)=>{
    if(!tz||!start||!end)return;
    const me=userRoles.find(r=>r.email===user?.email);if(!me)return;
    await supabase.from('user_roles').update({proposed_tz:tz,proposed_start:start,proposed_end:end,hours_status:'pending'}).eq('id',me.id);
    setUserRoles(p=>p.map(r=>r.id===me.id?{...r,proposed_tz:tz,proposed_start:start,proposed_end:end,hours_status:'pending'}:r));
    notify("requested","working hours",start+" - "+end+" "+tz);
    setShowHoursModal(false);showToast("Working hours submitted for approval");
  },[user,userRoles]);

  // Approve/reject hours — admin only
  const handleHoursApproval=useCallback(async(id,approve)=>{
    if(!isAdmin())return;
    const ur=userRoles.find(r=>r.id===id);if(!ur)return;
    if(approve){
      await supabase.from('user_roles').update({timezone:ur.proposed_tz,work_start:ur.proposed_start,work_end:ur.proposed_end,hours_status:'approved',proposed_tz:null,proposed_start:null,proposed_end:null}).eq('id',id);
      setUserRoles(p=>p.map(r=>r.id===id?{...r,timezone:ur.proposed_tz,work_start:ur.proposed_start,work_end:ur.proposed_end,hours_status:'approved',proposed_tz:null,proposed_start:null,proposed_end:null}:r));
      showToast("Hours approved for "+ur.name);
    }else{
      await supabase.from('user_roles').update({hours_status:'rejected',proposed_tz:null,proposed_start:null,proposed_end:null}).eq('id',id);
      setUserRoles(p=>p.map(r=>r.id===id?{...r,hours_status:'rejected',proposed_tz:null,proposed_start:null,proposed_end:null}:r));
      showToast("Hours rejected for "+ur.name);
    }
  },[userRoles]);

  const uploadAvatar=useCallback(async(roleId,file)=>{if(!file)return;
    const me=userRoles.find(r=>r.email===user?.email);
    const isSelf=me?.id===roleId;
    if(!isSelf&&role!=='admin'){showToast("Can only update your own photo");return}
    const ext=file.name.split('.').pop();const path=`avatars/${roleId}.${ext}`;
    const{error}=await supabase.storage.from('Avatar').upload(path,file,{upsert:true});
    if(error){showToast("Upload failed: "+error.message);return}
    const{data:{publicUrl}}=supabase.storage.from('Avatar').getPublicUrl(path);
    await supabase.from('user_roles').update({avatar_url:publicUrl}).eq('id',roleId);
    setUserRoles(p=>p.map(r=>r.id===roleId?{...r,avatar_url:publicUrl}:r));
    showToast("Photo updated");
  },[role,user,userRoles]);

  // Drag reorder — swaps sort_order between two rows
  const reorder=useCallback(async(table,items,setItems,fromId,toId)=>{
    if(!isEditor()||fromId===toId)return;
    const arr=[...items];const fi=arr.findIndex(x=>x.id===fromId);const ti=arr.findIndex(x=>x.id===toId);
    if(fi<0||ti<0)return;
    const[moved]=arr.splice(fi,1);arr.splice(ti,0,moved);
    const updated=arr.map((item,i)=>({...item,sort_order:i}));setItems(updated);
    for(const item of updated){await supabase.from(table).update({sort_order:item.sort_order}).eq('id',item.id)}
  },[canEdit]);

  const doSync=async()=>{setSyncing(true);showToast("Syncing...");try{const res=await fetch('/api/sync',{method:'POST'});await res.json();const now=new Date().toLocaleString('en-GB',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'});setLastSync(now);localStorage.setItem('attimo_last_sync',now);showToast("Sync complete — "+now);if(deptTasks)fetch('/api/linear-tasks').then(r=>r.json()).then(d=>setDeptTasks(d)).catch(()=>{})}catch(e){showToast("Sync failed")}setSyncing(false)};
  const stats=useMemo(()=>({total:tasks.length,todo:tasks.filter(t=>t.status==="To Do").length,doing:tasks.filter(t=>t.status==="Doing").length,done:tasks.filter(t=>t.status==="Done").length,risk:tasks.filter(t=>t.risk!=="On track").length,overdue:tasks.filter(t=>isOverdue(t)).length}),[tasks]);
  const raciByDept={};raci.forEach(r=>{if(!raciByDept[r.dept])raciByDept[r.dept]=[];raciByDept[r.dept].push(r)});
  const kpiByDept={};kpis.forEach(k=>{if(!kpiByDept[k.dept])kpiByDept[k.dept]=[];kpiByDept[k.dept].push(k)});
  const TABS=[{id:"dashboard",l:"Dashboard",icon:"⊞"},{id:"timeline",l:"Timeline",icon:"◔"},{id:"board",l:"Board",icon:"▦"},{id:"calendar",l:"Calendar",icon:"◫"},{id:"standup",l:"Daily Standup",icon:"◉"},{id:"raci",l:"RACI",icon:"▤"},{id:"kpi",l:"KPIs",icon:"◎"},{id:"risk",l:"Risks",icon:"△"},{id:"roles",l:"Open Roles",icon:"◇"},{id:"meet",l:"Meetings",icon:"◈"},{id:"perf",l:"Performance",icon:"★"},{id:"leave",l:"Leave & Availability",icon:"🌴"}];

  // Timeline window — auto-calculated from task dates, with sensible padding
  const tlBounds=useMemo(()=>{
    const dates=tasks.flatMap(t=>[t.start_date,t.end_date]).filter(Boolean).map(d=>String(d).split('T')[0]).sort();
    if(dates.length<2)return{s:"2026-04-25",e:"2026-07-05"};
    const earliest=dates[0];const latest=dates[dates.length-1];
    const pad=d=>{const dt=pD(d);dt.setDate(dt.getDate()-7);return dt.toISOString().split('T')[0]};
    const padE=d=>{const dt=pD(d);dt.setDate(dt.getDate()+14);return dt.toISOString().split('T')[0]};
    return{s:pad(earliest),e:padE(latest)};
  },[tasks]);
  const TL_START=tlBounds.s,TL_END=tlBounds.e;
  const TL_DAYS=daysB(TL_START,TL_END)||1;

  if(loading)return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontSize:16,color:"var(--fg2)",background:"var(--bg)"}}><div style={{textAlign:"center"}}><div style={{width:40,height:40,border:"3px solid var(--border)",borderTopColor:"#3B82F6",borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 12px"}}></div><LogoFull height={18} color="var(--fg2)"/></div></div>;

  if(authLoading)return <div style={{fontFamily:"'Inter',system-ui",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#0F172A 0%,#1E293B 50%,#0F172A 100%)"}}>
    <style dangerouslySetInnerHTML={{__html:CSS+"@keyframes spin{to{transform:rotate(360deg)}}"}}/>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
    <div style={{textAlign:"center"}}><div style={{width:40,height:40,border:"3px solid #334155",borderTopColor:"#3B82F6",borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 12px"}}></div><LogoFull height={18} color="#64748B"/></div>
  </div>;

  if(!user)return <div style={{fontFamily:"'Inter',system-ui",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#0F172A 0%,#1E293B 50%,#0F172A 100%)"}}>
    <style dangerouslySetInnerHTML={{__html:CSS+"@keyframes spin{to{transform:rotate(360deg)}}"}}/>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
    <div className="asc" style={{background:"#1E293B",borderRadius:20,padding:40,width:"min(400px,90vw)",textAlign:"center",border:"1px solid #334155",boxShadow:"0 25px 60px rgba(0,0,0,.5)"}}>
      <div style={{width:50,height:50,borderRadius:12,background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><LogoMark size={32} color="#fff"/></div>
      <h1 style={{color:"#F1F5F9",fontSize:22,fontWeight:800,margin:"0 0 4px"}}><LogoFull height={20} color="#F1F5F9"/></h1>
      <p style={{color:"#94A3B8",fontSize:13,margin:"0 0 24px"}}>Company Operations Hub</p>
      <button onClick={doLogin} className="btn-pop" style={{width:"100%",padding:"12px",background:"#fff",color:"#1E293B",border:"none",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        Sign in with Google
      </button>
      <p style={{color:"#475569",fontSize:10,marginTop:16}}>Access restricted to Attimo team members</p>
    </div>
  </div>;

  if(!role)return <div style={{fontFamily:"'Inter',system-ui",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#0F172A 0%,#1E293B 50%,#0F172A 100%)"}}>
    <style dangerouslySetInnerHTML={{__html:CSS}}/>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
    <div className="asc" style={{background:"#1E293B",borderRadius:20,padding:40,width:"min(400px,90vw)",textAlign:"center",border:"1px solid #334155"}}>
      <div style={{fontSize:40,marginBottom:12}}>x</div>
      <h2 style={{color:"#F1F5F9",fontSize:18,fontWeight:700,margin:"0 0 8px"}}>Access Denied</h2>
      <p style={{color:"#94A3B8",fontSize:13,margin:"0 0 8px"}}>{user.email} is not in the team roster.</p>
      <p style={{color:"#64748B",fontSize:11,margin:"0 0 20px"}}>Ask an admin to add your email in User Roles.</p>
      <button onClick={doLogout} style={{padding:"8px 20px",background:"#334155",color:"#F1F5F9",border:"none",borderRadius:8,fontWeight:600,fontSize:12,cursor:"pointer"}}>Sign out</button>
    </div>
  </div>;

  return <div style={{fontFamily:"'Inter',system-ui",background:"var(--bg)",minHeight:"100vh",transition:"all .3s",display:"flex"}}>
    <style dangerouslySetInnerHTML={{__html:CSS+"@keyframes spin{to{transform:rotate(360deg)}}"}}/>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>

    {/* ═══ SIDEBAR ═══ */}
    <div className="sidebar">
      <div style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:8,borderBottom:"1px solid var(--border)"}}>
        <div style={{width:24,height:24,flexShrink:0}}><LogoMark size={24} color="var(--fg)"/></div>
        <span className="sb-label" style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>Attimo</span>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"8px 0"}}>
        {TABS.map(t=><div key={t.id} className={"sb-item"+(view===t.id?" active":"")} onClick={()=>setView(t.id)} data-tip={t.l}>
          <div className="sb-icon">{t.icon}</div>
          <span className="sb-label" style={{color:view===t.id?"#3B82F6":"var(--fg2)"}}>{t.l}</span>
        </div>)}
      </div>
      <div style={{borderTop:"1px solid var(--border)",padding:"8px 0"}}>
        {role==='admin'&&<div className={"sb-item"+(view==="settings"?" active":"")} onClick={()=>setView("settings")}><div className="sb-icon">&#9881;</div><span className="sb-label">Settings</span></div>}
        <div className="sb-item" onClick={()=>{const me=userRoles.find(r=>r.email===user?.email);setHoursForm({tz:me?.timezone||"Europe/Istanbul",start:me?.work_start||"09:00",end:me?.work_end||"18:00"});setShowHoursModal(true)}}><div className="sb-icon">🕐</div><span className="sb-label">Working Hours</span></div>
        <div className="sb-item" onClick={()=>setDark(!dark)}><div className="sb-icon">{dark?"☀":"◑"}</div><span className="sb-label">{dark?"Light Mode":"Dark Mode"}</span></div>
      </div>
    </div>

    {/* ═══ MAIN AREA ═══ */}
    <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,overflow:"hidden"}}>

    {/* Header — compact */}
    <div style={{background:"var(--hdr)",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <button onClick={doSync} disabled={syncing} className="btn-pop" style={{background:syncing?"rgba(255,255,255,.1)":"rgba(59,130,246,.8)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:syncing?"wait":"pointer"}}>{syncing?"Syncing...":"Sync All"}</button>
        {lastSync&&<span style={{fontSize:9,color:"#64748B"}}>Last: {lastSync}</span>}
        <div className="mob-hide" style={{display:"flex",gap:8,fontSize:11,color:"#94A3B8"}}>
          <span><b style={{color:"#93C5FD"}}>{stats.total}</b> total</span><span><b style={{color:"#FDE68A"}}>{stats.doing}</b> doing</span><span><b style={{color:"#6EE7B7"}}>{stats.done}</b> done</span>
          {stats.overdue>0&&<span style={{animation:"pulse 1.5s infinite"}}><b style={{color:"#FCA5A5"}}>{stats.overdue}</b> overdue</span>}
        </div>
        <div className="mob-hide" style={{display:"flex",alignItems:"center",gap:6}}>{ANCH.map((a,i)=><span key={i} style={{fontSize:9,color:a.c,fontWeight:700,padding:"2px 6px",background:a.c+"12",borderRadius:99}}>{a.l} {fD(a.d)}</span>)}</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <label style={{cursor:"pointer",position:"relative"}}>
          <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(!f)return;const me=userRoles.find(r=>r.email===user?.email);if(me)uploadAvatar(me.id,f);else showToast("Your email not in user roles yet")}}/>
          {(()=>{const me=userRoles.find(r=>r.email===user?.email);return me?.avatar_url?<img src={me.avatar_url} style={{width:26,height:26,borderRadius:"50%",objectFit:"cover",border:"2px solid rgba(255,255,255,.2)"}}/>:<span style={{width:26,height:26,borderRadius:"50%",background:"#3B82F6",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff",border:"2px solid rgba(255,255,255,.2)"}}>{user?.user_metadata?.full_name?.[0]||user?.email?.[0]||"?"}</span>})()}
        </label>
        <div style={{position:"relative"}}>
          <button onClick={()=>setUserMenu(!userMenu)} style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.15)",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:11,color:"#94A3B8",fontWeight:500,display:"flex",alignItems:"center",gap:5}}>
            <span className="mob-hide">{(()=>{const me=userRoles.find(r=>r.email===user?.email);return me?.name||user?.user_metadata?.full_name||user?.email?.split("@")[0]})()}</span>
            <span style={{fontSize:8,padding:"1px 5px",borderRadius:4,background:role==="admin"?"#3B82F630":role==="editor"?"#F59E0B30":"#64748B30",color:role==="admin"?"#93C5FD":role==="editor"?"#FDE68A":"#94A3B8"}}>{role}</span>
            <span style={{fontSize:8,transition:"transform .2s",transform:userMenu?"rotate(180deg)":"rotate(0)"}}>▾</span>
          </button>
          {userMenu&&<div className="asc" style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,padding:6,minWidth:180,boxShadow:"0 12px 40px rgba(0,0,0,.25)",zIndex:100}}>
            <div onClick={()=>{const me=userRoles.find(r=>r.email===user?.email);if(me){const slk=slackStatus._match?slackStatus._match(me):null;setProfileCard({ur:me,slk})}setUserMenu(false)}} style={{padding:"8px 12px",borderRadius:6,cursor:"pointer",fontSize:11,color:"var(--fg)",fontWeight:500,display:"flex",alignItems:"center",gap:8,transition:"background .15s"}} className="rh">👤 My Profile</div>
            <div onClick={()=>{const me=userRoles.find(r=>r.email===user?.email);setMyNameVal(me?.name||user?.user_metadata?.full_name||"");setEditMyName(true);setUserMenu(false)}} style={{padding:"8px 12px",borderRadius:6,cursor:"pointer",fontSize:11,color:"var(--fg)",fontWeight:500,display:"flex",alignItems:"center",gap:8}} className="rh">✏️ Edit Name</div>
            <div onClick={()=>{setShowHoursModal(true);setUserMenu(false)}} style={{padding:"8px 12px",borderRadius:6,cursor:"pointer",fontSize:11,color:"var(--fg)",fontWeight:500,display:"flex",alignItems:"center",gap:8}} className="rh">🕐 Working Hours</div>
            <div style={{height:1,background:"var(--border)",margin:"4px 0"}}/>
            <div onClick={()=>{doLogout();setUserMenu(false)}} style={{padding:"8px 12px",borderRadius:6,cursor:"pointer",fontSize:11,color:"#EF4444",fontWeight:600,display:"flex",alignItems:"center",gap:8}} className="rh">⏻ Sign Out</div>
          </div>}
        </div>
      </div>
    </div>

    <div style={{padding:20,flex:1,overflowY:"auto"}}>

    {/* ═══ DASHBOARD ═══ */}
    {view==="dashboard"&&<div className="af">
      <div style={{fontSize:16,fontWeight:800,color:"var(--fg)",marginBottom:16}}>Dashboard Overview</div>

      {/* Hero Metrics Row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:20}}>
        {[
          {label:"Total Tasks",val:stats.total,color:"#3B82F6",icon:"📋"},
          {label:"In Progress",val:stats.doing,color:"#F59E0B",icon:"⚡"},
          {label:"Completed",val:stats.done,color:"#10B981",icon:"✅"},
          {label:"Overdue",val:stats.overdue,color:"#EF4444",icon:"🔥"},
          {label:"At Risk",val:stats.risk,color:"#F97316",icon:"⚠️"},
          {label:"Team Size",val:userRoles.length,color:"#8B5CF6",icon:"👥"},
        ].map((m,i)=><div key={i} className="stat-card asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,borderLeft:"4px solid "+m.color,animationDelay:i*80+"ms"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:20}}>{m.icon}</span>
            <span style={{fontSize:24,fontWeight:800,color:m.color}}>{m.val}</span>
          </div>
          <div style={{fontSize:11,fontWeight:600,color:"var(--fg2)"}}>{m.label}</div>
        </div>)}
      </div>

      {/* Two-column layout */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}} className="mob-col1">
        {/* Phase Progress */}
        <div className="ch asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,animationDelay:"100ms"}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--fg)",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>📊 Phase Progress</div>
          {[{name:"Phase 0 — Trusted Context Navigator",pct:30,color:"#14B8A6",owner:"Talha"},{name:"Phase 1 — Accepted State",pct:0,color:"#10B981",owner:"Blocked"},{name:"Phase 2 — Channel Capture",pct:0,color:"#3B82F6",owner:"Queued"},{name:"Phase 3 — Obligation Orchestrator",pct:0,color:"#8B5CF6",owner:"Queued"},{name:"Phase 4 — Evidence Ledger",pct:0,color:"#EC4899",owner:"Queued"}].map((p,i)=><div key={i} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:3}}>
              <span style={{fontWeight:600,color:"var(--fg)"}}>{p.name}</span>
              <span style={{color:p.pct>0?p.color:"var(--fg2)",fontWeight:700}}>{p.pct}%</span>
            </div>
            <div style={{height:6,background:"var(--bg3)",borderRadius:3,overflow:"hidden"}}>
              <div className="bar-g" style={{height:"100%",width:p.pct+"%",borderRadius:3,background:p.color,animationDelay:i*100+"ms"}}/>
            </div>
            <div style={{fontSize:8,color:"var(--fg2)",marginTop:2}}>{p.owner}</div>
          </div>)}
        </div>

        {/* Upcoming Deadlines */}
        <div className="ch asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,animationDelay:"150ms"}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--fg)",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>📅 Upcoming Deadlines</div>
          {tasks.filter(t=>t.status!=="Done"&&t.end_date).sort((a,b)=>String(a.end_date).localeCompare(String(b.end_date))).slice(0,8).map((t,i)=>{const od=isOverdue(t);return <div key={t.id} className="rh asl" style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,animationDelay:i*40+"ms"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:od?"#EF4444":CL[t.dept]||"#94A3B8",flexShrink:0}}/>
            <span style={{fontSize:11,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:od?"#EF4444":"var(--fg)"}}>{t.name}</span>
            <span style={{fontSize:9,color:od?"#EF4444":"var(--fg2)",fontWeight:od?700:400,flexShrink:0}}>{fD(t.end_date)}</span>
          </div>})}
          {tasks.filter(t=>t.status!=="Done"&&t.end_date).length===0&&<div style={{textAlign:"center",padding:20,color:"var(--fg2)",fontSize:11}}>No upcoming deadlines</div>}
        </div>
      </div>

      {/* Second row */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}} className="mob-col1">
        {/* KPI Health */}
        <div className="ch asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,animationDelay:"200ms"}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--fg)",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>🎯 KPI Health</div>
          {kpis.length>0?<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,textAlign:"center"}}>
            <div style={{background:"#DCFCE720",borderRadius:8,padding:12}}><div style={{fontSize:20,fontWeight:800,color:"#10B981"}}>{kpis.filter(k=>k.flag==="green").length}</div><div style={{fontSize:9,color:"var(--fg2)"}}>On Track</div></div>
            <div style={{background:"#FEF3C720",borderRadius:8,padding:12}}><div style={{fontSize:20,fontWeight:800,color:"#F59E0B"}}>{kpis.filter(k=>k.flag==="yellow").length}</div><div style={{fontSize:9,color:"var(--fg2)"}}>Attention</div></div>
            <div style={{background:"#FEE2E220",borderRadius:8,padding:12}}><div style={{fontSize:20,fontWeight:800,color:"#EF4444"}}>{kpis.filter(k=>k.flag==="red").length}</div><div style={{fontSize:9,color:"var(--fg2)"}}>Critical</div></div>
          </div>:<div style={{textAlign:"center",padding:20,color:"var(--fg2)",fontSize:11}}>No KPIs configured yet</div>}
        </div>

        {/* Risk Summary */}
        <div className="ch asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,animationDelay:"250ms"}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--fg)",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>⚡ Risk Summary</div>
          {risks.length>0?<div>
            {risks.filter(r=>r.status==="ACTIVE").slice(0,5).map((r,i)=><div key={r.id} className="rh asl" style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,borderLeft:"3px solid "+(r.impact==="CRITICAL"?"#EF4444":r.impact==="HIGH"?"#F97316":"#F59E0B"),marginBottom:4,animationDelay:i*40+"ms"}}>
              <span style={{fontSize:10,flex:1,color:"var(--fg)"}}>{r.description}</span>
              <Bdg bg={r.impact==="CRITICAL"?"#FEE2E2":"#FEF3C7"} c={r.impact==="CRITICAL"?"#DC2626":"#D97706"}>{r.impact}</Bdg>
            </div>)}
            {risks.filter(r=>r.status==="ACTIVE").length===0&&<div style={{textAlign:"center",padding:20,color:"var(--fg2)",fontSize:11}}>No active risks</div>}
          </div>:<div style={{textAlign:"center",padding:20,color:"var(--fg2)",fontSize:11}}>No risks logged yet</div>}
        </div>
      </div>

      {/* Quick Nav */}
      <div className="asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,animationDelay:"300ms"}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--fg)",marginBottom:12}}>Quick Navigation</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>
          {TABS.filter(t=>t.id!=="dashboard").map(t=><div key={t.id} onClick={()=>setView(t.id)} className="ch" style={{background:"var(--bg2)",borderRadius:8,padding:12,cursor:"pointer",textAlign:"center",transition:"all .2s"}}>
            <div style={{fontSize:18,marginBottom:4}}>{t.icon}</div>
            <div style={{fontSize:11,fontWeight:600,color:"var(--fg)"}}>{t.l}</div>
          </div>)}
        </div>
      </div>
    </div>}

    {/* ═══ TIMELINE ═══ */}
    {view==="timeline"&&<div className="af">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>Gantt Chart</div>
          <div style={{display:"flex",background:"var(--bg3)",borderRadius:8,padding:2}}>
            <button onClick={()=>{setGanttMode("company");setPersonFilter("all")}} style={{padding:"6px 14px",borderRadius:6,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",background:ganttMode==="company"?"var(--fg)":"transparent",color:ganttMode==="company"?"var(--bg)":"var(--fg2)",transition:"all .2s"}}>Company</button>
            <button onClick={()=>{setGanttMode("department");setPersonFilter("all");if(!deptTasks){setDeptLoading(true);fetch('/api/linear-tasks').then(r=>r.json()).then(d=>{setDeptTasks(d);setDeptLoading(false);showToast("Loaded from Linear + Asana")}).catch(()=>setDeptLoading(false))}}} style={{padding:"6px 14px",borderRadius:6,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",background:ganttMode==="department"?"var(--fg)":"transparent",color:ganttMode==="department"?"var(--bg)":"var(--fg2)",transition:"all .2s"}}>Department</button>
          </div>
          <select value={personFilter} onChange={e=>setPersonFilter(e.target.value)} style={{border:"1px solid var(--border)",borderRadius:6,padding:"4px 8px",fontSize:11,background:"var(--bg2)",color:"var(--fg)",cursor:"pointer"}}>
            <option value="all">All People</option>
            {ganttMode==="company"
              ?[...new Set(tasks.map(t=>t.owner).filter(Boolean))].sort().map(p=><option key={p} value={p}>{p}</option>)
              :deptTasks?[...new Set(Object.values(deptTasks.projects||{}).flat().map(t=>rN(t.person)).filter(v=>v&&v!=="Unassigned"))].sort().map(p=><option key={p} value={p}>{p}</option>)
              :null}
          </select>
        </div>
        {ganttMode==="company"&&<button onClick={()=>setAddModal("task")} className="act-add" style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add Task</button>}
        {ganttMode==="department"&&<button onClick={()=>{setDeptLoading(true);fetch('/api/linear-tasks').then(r=>r.json()).then(d=>{setDeptTasks(d);setDeptLoading(false);showToast("Synced from Linear + Asana")}).catch(()=>{setDeptLoading(false);showToast("Sync failed")})}} style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>Refresh from Linear + Asana</button>}
      </div>

      {/* COMPANY GANTT */}
      {ganttMode==="company"&&<div style={{background:"var(--card)",borderRadius:10,border:"1px solid var(--border)"}}>{STS.map(st=>{const items=tasks.filter(t=>t.status===st&&(personFilter==="all"||t.owner===personFilter));return <div key={st} style={{padding:"12px 16px",borderBottom:"1px solid var(--border)"}}>
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
      </div>})}</div>}

      {/* DEPARTMENT VIEW */}
      {ganttMode==="department"&&<div>
        {deptLoading&&<div style={{textAlign:"center",padding:40,color:"var(--fg2)"}}>Loading from Linear + Asana...</div>}
        {!deptLoading&&!deptTasks&&<div style={{textAlign:"center",padding:40,color:"var(--fg2)"}}>Click "Department" to load tickets</div>}
        {!deptLoading&&deptTasks&&<div>
          <div style={{display:"flex",gap:4,marginBottom:16,background:"var(--bg3)",borderRadius:8,padding:2,width:"fit-content"}}>
            {["list","gantt"].map(m=><button key={m} onClick={()=>setDvm(m)} style={{padding:"6px 14px",borderRadius:6,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",background:dvm===m?"var(--fg)":"transparent",color:dvm===m?"var(--bg)":"var(--fg2)",transition:"all .2s",textTransform:"capitalize"}}>{m}</button>)}
          </div>
          {Object.entries(deptTasks.projects||{}).map(([project,tickets])=>{
          const src=deptTasks.sources?.[project]||'Linear';
          const cl=project.includes("Phase 0")?"#14B8A6":project.includes("Phase 1")?"#10B981":project.includes("Phase 2")?"#3B82F6":project.includes("Phase 3")?"#8B5CF6":project.includes("Phase 4")?"#EC4899":project.includes("AEC")?"#F59E0B":project.includes("Marketing")?"#EC4899":project.includes("Design")?"#8B5CF6":"#6366F1";
          const allT=tickets.filter(t=>personFilter==="all"||rN(t.person)===personFilter);
          const doing=allT.filter(t=>t.status==="Doing").length;
          const done=allT.filter(t=>t.status==="Done").length;
          const overdue=allT.filter(t=>t.isOverdue).length;
          if(allT.length===0)return null;
          return <div key={project} className="asl" style={{marginBottom:16}}>
            <div style={{background:cl+"15",color:cl,padding:"10px 14px",borderRadius:"10px 10px 0 0",fontWeight:700,fontSize:13,borderLeft:"4px solid "+cl,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}><span>{project}</span><span style={{fontSize:9,padding:"2px 6px",borderRadius:99,background:src==="Asana"?"#F472B620":"#6366F120",color:src==="Asana"?"#EC4899":"#6366F1",fontWeight:700}}>{src}</span></div>
              <div style={{display:"flex",gap:8,fontSize:11}}>
                <span style={{color:"var(--fg2)"}}>{allT.length} total</span>
                <span style={{color:"#F59E0B"}}>{doing} doing</span>
                <span style={{color:"#10B981"}}>{done} done</span>
                {overdue>0&&<span style={{color:"#EF4444",fontWeight:700}}>{overdue} overdue</span>}
              </div>
            </div>
            <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:"0 0 10px 10px",overflow:"hidden"}}>
              {dvm==="gantt"?STS.map(st=>{const items=allT.filter(t=>t.status===st);if(!items.length)return null;return <div key={st} style={{padding:"12px 16px",borderBottom:"1px solid var(--border)"}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:8,display:"flex",alignItems:"center",gap:8,color:"var(--fg)"}}>▼ {st}<span style={{background:"var(--bg3)",borderRadius:99,padding:"1px 8px",fontSize:11,color:"var(--fg2)"}}>{items.length}</span></div>
                {items.slice(0,20).map((t,idx)=>{const od=t.isOverdue;const dn=rN(t.person);
                  const hasDue=!!t.dueDate;
                  let leftPct,widthPct,dateLabel="";
                  if(hasDue){
                    const endStr=t.dueDate;
                    const startStr=t.startDate||(()=>{const d2=pD(t.dueDate);d2.setDate(d2.getDate()-21);return d2.toISOString().split('T')[0]})();
                    const sOff=Math.max(0,daysB(TL_START,startStr));const dur=Math.max(3,daysB(startStr,endStr)+1);
                    leftPct=(sOff/TL_DAYS)*100;widthPct=Math.max((dur/TL_DAYS)*100,2);dateLabel=fD(t.dueDate);
                  }else{
                    // No date: spread evenly across timeline based on index
                    leftPct=(idx/Math.max(items.length,1))*70+5;widthPct=8;dateLabel="no date";
                  }
                  const noDate=!hasDue&&t.status!=="Done";
                  return <div key={t.id} className={"rh asl"+(od?" overdue-row":"")+(noDate?" overdue-row":"")} style={{display:"flex",alignItems:"center",gap:12,padding:"5px 8px",cursor:"pointer",borderRadius:6,animationDelay:idx*25+"ms"}} onClick={()=>t.url&&window.open(t.url,'_blank')}>
                    <div style={{width:"clamp(120px,25vw,220px)",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                      <div style={{width:20,height:20,borderRadius:"50%",background:noDate?"#EF4444":cl,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{color:"#fff",fontSize:8,fontWeight:700}}>{dn?.[0]}</span></div>
                      <span style={{fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:noDate?"#EF4444":"var(--fg)",textDecoration:t.status==="Done"?"line-through":"none"}}>{t.title}</span>
                      {noDate&&<span style={{fontSize:7,color:"#EF4444",background:"#FEE2E2",padding:"1px 4px",borderRadius:3,flexShrink:0,fontWeight:700}}>NO DATE</span>}
                      {t.identifier&&<span style={{fontSize:7,color:"var(--fg2)",background:"var(--bg3)",padding:"1px 3px",borderRadius:3,flexShrink:0,fontFamily:"monospace"}}>{t.identifier}</span>}
                    </div>
                    <div style={{flex:1,height:26,background:"var(--bg3)",borderRadius:6,position:"relative",overflow:"hidden"}}>
                      <div className="bar-g" style={{position:"absolute",left:leftPct+"%",width:widthPct+"%",top:2,bottom:2,borderRadius:4,background:noDate?"linear-gradient(90deg,#EF4444,#F87171)":od?"linear-gradient(90deg,#EF4444,#F87171)":t.status==="Done"?"linear-gradient(90deg,#10B981,#34D399)":"linear-gradient(90deg,"+cl+","+cl+"CC)",opacity:hasDue?(t.status==="Done"?.3:.9):(t.status==="Done"?.15:.6),display:"flex",alignItems:"center",paddingLeft:6,animationDelay:idx*40+"ms"}}>
                        <span style={{color:"#fff",fontSize:9,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden"}}>{dateLabel}</span>
                      </div>
                    </div>
                    <span style={{fontSize:10,color:"var(--fg2)",flexShrink:0,width:80,textAlign:"right"}}>{dn==="Unassigned"?"":dn}</span>
                    {od&&<div className="pulse-dot" style={{width:10,height:10,borderRadius:"50%",background:"#EF4444",flexShrink:0}}/>}
                  </div>})}
                {items.length>20&&<div style={{padding:"6px 12px",fontSize:10,color:"var(--fg2)",textAlign:"center"}}>...and {items.length-20} more</div>}
              </div>})
              :allT.slice(0,25).map((t,idx)=>{const od=t.isOverdue;const dn=rN(t.person);const dnd=rND(t.person);
                return <div key={t.id} className={"rh asl"+(od?" overdue-row":"")} style={{display:"flex",alignItems:"center",gap:12,padding:"5px 12px",borderBottom:"1px solid var(--border)",animationDelay:idx*20+"ms"}}>
                  <div style={{width:"clamp(120px,25vw,240px)",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                    <div style={{width:18,height:18,borderRadius:"50%",background:cl,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{color:"#fff",fontSize:7,fontWeight:700}}>{dn?.[0]}</span></div>
                    {t.url?<a href={t.url} target="_blank" rel="noopener" style={{fontSize:11,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--fg)",textDecoration:"none"}} onMouseEnter={e=>e.target.style.color="#3B82F6"} onMouseLeave={e=>e.target.style.color="var(--fg)"}>{t.title}</a>:<span style={{fontSize:11,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--fg)"}}>{t.title}</span>}
                    {t.identifier&&<span style={{fontSize:8,color:"var(--fg2)",background:"var(--bg3)",padding:"1px 4px",borderRadius:4,flexShrink:0,fontFamily:"monospace"}}>{t.identifier}</span>}
                  </div>
                  <div style={{flex:1,display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:99,background:t.status==="Done"?"#DCFCE7":t.status==="Doing"?"#FEF3C7":"#E0E7FF",color:t.status==="Done"?"#166534":t.status==="Doing"?"#92400E":"#3730A3"}}>{t.status}</span>
                    {t.dueDate&&<span style={{fontSize:10,color:od?"#EF4444":"var(--fg2)"}}>{od?"Overdue: ":"Due: "}{fD(t.dueDate)}</span>}
                  </div>
                  <span style={{fontSize:10,color:"var(--fg2)",flexShrink:0}}>{dnd}</span>
                  {od&&<div className="pulse-dot" style={{width:8,height:8,borderRadius:"50%",background:"#EF4444",flexShrink:0}}/>}
                </div>})}
              {dvm==="list"&&allT.length>25&&<div style={{padding:"8px 12px",fontSize:11,color:"var(--fg2)",textAlign:"center"}}>...and {allT.length-25} more tickets</div>}
            </div>
          </div>})}
        </div>}
      </div>}
    </div>}

    {/* ═══ BOARD ═══ */}
    {view==="board"&&<div className="af">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>Board</div><button onClick={()=>setAddModal("task")} className="act-add" style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add Task</button></div>
      <div className="mob-col1" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>{STS.map((st,si)=><div key={st} onDragOver={e=>e.preventDefault()} onDrop={()=>onDrop(st)}
        className="af" style={{background:"var(--bg2)",borderRadius:10,padding:12,minHeight:200,border:dragId?"2px dashed #3B82F6":"2px solid transparent",transition:"all .2s",animationDelay:si*100+"ms"}}>
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

    {/* ═══ DAILY STANDUP ═══ */}
    {view==="standup"&&<div className="af">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>Daily Standup</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setAddModal("standup")} className="act-add" style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add Update</button>
          <button onClick={()=>{showToast("Syncing standups...");fetch('/api/digest').then(r=>r.json()).then(()=>{showToast("Standup synced");supabase.from('standups').select('*').order('standup_date',{ascending:false}).order('created_at',{ascending:false}).limit(100).then(({data})=>{if(data)setStandups(data)})}).catch(()=>showToast("Sync failed"))}} style={{background:"var(--bg3)",color:"var(--fg)",border:"1px solid var(--border)",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>Sync from Linear + Asana</button>
          <a href="https://attimo-labs.slack.com/archives/daily-standup" target="_blank" rel="noopener" style={{fontSize:11,color:"#3B82F6",fontWeight:600,textDecoration:"none",background:"#EFF6FF",padding:"6px 14px",borderRadius:8,display:"flex",alignItems:"center"}}>Open #daily-standup</a>
        </div>
      </div>
      <div style={{background:"var(--bg2)",padding:"8px 12px",borderRadius:8,fontSize:11,color:"var(--fg2)",marginBottom:16}}>Updates from Slack workflow and manual entries. Syncs when you click Sync All. Slack workflow sends DMs at 5pm daily.</div>
      {(()=>{
        const byDate={};standups.forEach(s=>{const d=String(s.standup_date).split('T')[0];if(!byDate[d])byDate[d]=[];byDate[d].push(s)});
        const dates=Object.keys(byDate).sort((a,b)=>b.localeCompare(a));
        if(dates.length===0)return <div style={{textAlign:"center",padding:40,color:"var(--fg2)"}}>No standup updates yet. Click "+ Add Update" or wait for the 5pm Slack workflow.</div>;
        return dates.map(date=><div key={date} className="asl" style={{marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--fg)",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:4,height:16,borderRadius:2,background:"#3B82F6"}}/>
            {new Date(date+"T00:00:00").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
            <span style={{background:"var(--bg3)",borderRadius:99,padding:"1px 8px",fontSize:10,color:"var(--fg2)"}}>{byDate[date].length} updates</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
            {byDate[date].map((s,si)=><div key={s.id} className="ch asl" style={{background:"var(--card)",borderRadius:10,padding:14,border:"1px solid var(--border)",borderLeft:"4px solid "+(CL[s.person]||"#3B82F6"),animationDelay:si*50+"ms"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:24,height:24,borderRadius:"50%",background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:10,fontWeight:700}}>{s.person?.[0]}</span></div>
                  <span style={{fontWeight:700,fontSize:13,color:"var(--fg)"}}>{s.person}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:9,color:"var(--fg2)",background:"var(--bg3)",padding:"2px 6px",borderRadius:99}}>{s.source==="slack"?"via Slack":"manual"}</span>
                  <button onClick={()=>deleteStandup(s.id)} className="act-del" style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontSize:11}}>✕</button>
                </div>
              </div>
              <div style={{fontSize:12,color:"var(--fg)",marginBottom:6}}>
                <div style={{color:"#10B981",fontWeight:600,fontSize:10,marginBottom:2}}>COMPLETED</div>
                <div style={{color:"var(--fg)",lineHeight:1.4}}>{s.completed||"—"}</div>
              </div>
              <div style={{fontSize:12,color:"var(--fg)",marginBottom:6}}>
                <div style={{color:"#3B82F6",fontWeight:600,fontSize:10,marginBottom:2}}>TOMORROW</div>
                <div style={{color:"var(--fg)",lineHeight:1.4}}>{s.tomorrow||"—"}</div>
              </div>
              <div style={{fontSize:12}}>
                <div style={{color:s.blockers&&s.blockers!=="None"&&s.blockers!=="none"?"#EF4444":"#10B981",fontWeight:600,fontSize:10,marginBottom:2}}>BLOCKERS</div>
                <div style={{color:s.blockers&&s.blockers!=="None"&&s.blockers!=="none"?"#EF4444":"var(--fg2)",fontWeight:s.blockers&&s.blockers!=="None"&&s.blockers!=="none"?600:400}}>{s.blockers||"None"}</div>
              </div>
            </div>)}
          </div>
        </div>);
      })()}
    </div>}

    {/* ═══ RACI ═══ */}
    {view==="raci"&&<div className="af" style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",justifyContent:"space-between"}}><div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>RACI Matrix</div><button onClick={()=>setAddModal("raci")} className="act-add" style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add</button></div>
      <div style={{background:"var(--bg2)",padding:"8px 12px",borderRadius:8,fontSize:11,color:"var(--fg2)"}}><b>R</b>=Responsible <b>A</b>=Accountable <b>C</b>=Consulted <b>I</b>=Informed <span style={{color:"#3B82F6"}}>[Suggest]</span>=PMO suggestion</div>
      {Object.entries(raciByDept).map(([dept,rows])=><div key={dept}><DeptHdr dept={dept}/><Tbl headers={["Task","R","A","C","I","Notes",""]} rows={rows.map(r=>[
        <InEdit value={r.task} onChange={v=>updateRaci(r.id,{task:v})}/>,
        <InEdit value={r.responsible} onChange={v=>updateRaci(r.id,{responsible:v})}/>,
        <InEdit value={r.accountable} onChange={v=>updateRaci(r.id,{accountable:v})}/>,
        <InEdit value={r.consulted} onChange={v=>updateRaci(r.id,{consulted:v})}/>,
        <InEdit value={r.informed} onChange={v=>updateRaci(r.id,{informed:v})}/>,
        <InEdit value={r.notes} onChange={v=>updateRaci(r.id,{notes:v})}/>,
        <button onClick={()=>deleteRaci(r.id)} className="act-del" style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer"}}>✕</button>
      ])}/></div>)}
    </div>}

    {/* ═══ KPIs ═══ */}
    {view==="kpi"&&<div className="af" style={{display:"flex",flexDirection:"column",gap:16,maxWidth:1100,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between"}}><div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>KPIs</div><button onClick={()=>setAddModal("kpi")} className="act-add" style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add KPI</button></div>
      <KpiChart kpis={kpis}/>
      {Object.entries(kpiByDept).map(([dept,items])=><div key={dept} className="asl"><DeptHdr dept={dept}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,padding:16,background:"var(--card)",border:"1px solid var(--border)",borderRadius:"0 0 8px 8px"}}>{items.map((k,ki)=><div key={k.id} className="ch asl" style={{borderLeft:"3px solid "+FC[k.flag],borderRadius:8,padding:14,background:"var(--bg2)",animationDelay:ki*50+"ms"}}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:4,color:"var(--fg)"}}><InEdit value={k.name} onChange={v=>updateKpi(k.id,{name:v})}/></div>
          <div style={{fontSize:10,color:"var(--fg2)"}}>Target: <InEdit value={k.target} onChange={v=>updateKpi(k.id,{target:v})}/></div>
          <div style={{display:"flex",alignItems:"center",gap:4,marginTop:4}}><div style={{width:8,height:8,borderRadius:"50%",background:FC[k.flag]}}/><span style={{fontSize:11,fontWeight:700,color:FC[k.flag]}}><InEdit value={k.current_value} onChange={v=>updateKpi(k.id,{current_value:v})}/></span></div>
          <div style={{marginTop:6,display:"flex",gap:4}}>{["green","yellow","red"].map(f=><button key={f} onClick={()=>updateKpi(k.id,{flag:f})} style={{width:18,height:18,borderRadius:"50%",background:FC[f],border:k.flag===f?"2px solid var(--fg)":"1px solid var(--border)",cursor:"pointer",transition:"transform .15s"}} onMouseEnter={e=>e.target.style.transform="scale(1.3)"} onMouseLeave={e=>e.target.style.transform="scale(1)"}/>)}</div>
        </div>)}</div>
      </div>)}
    </div>}

    {/* ═══ RISKS ═══ */}
    {view==="risk"&&<div className="af">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>Risk Register</div><button onClick={()=>setAddModal("risk")} className="act-add" style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add Risk</button></div>
      <Tbl headers={["#","Risk","Impact","Status","Owner","Mitigation","Linked To",""]} ids={risks.map(r=>r.id)} onReorder={(a,b)=>reorder("risks",risks,setRisks,a,b)} rows={risks.map(r=>[<b>{r.id}</b>,<InEdit value={r.description} onChange={v=>updateRisk(r.id,{description:v})}/>,<InEdit value={r.impact} onChange={v=>updateRisk(r.id,{impact:v})} type="select" options={IMP_OPT}/>,<InEdit value={r.status} onChange={v=>updateRisk(r.id,{status:v})} type="select" options={["ACTIVE","MITIGATING","FUTURE","CLOSED"]}/>,<InEdit value={r.owner} onChange={v=>updateRisk(r.id,{owner:v})}/>,<InEdit value={r.mitigation} onChange={v=>updateRisk(r.id,{mitigation:v})}/>,<span style={{fontSize:11}}><InEdit value={r.linked_to||""} onChange={v=>updateRisk(r.id,{linked_to:v})}/>{r.linked_to&&tasks.find(t=>t.id===r.linked_to||t.name===r.linked_to)?<div style={{fontSize:9,color:"#6366F1",marginTop:2}}>{"→ "+tasks.find(t=>t.id===r.linked_to||t.name===r.linked_to).name}</div>:null}</span>,<button onClick={()=>deleteRisk(r.id)} className="act-del" style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer"}}>✕</button>])}/>
    </div>}

    {/* ═══ OPEN ROLES (dynamic from DB) ═══ */}
    {view==="roles"&&<div className="af">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>Open Hiring Positions</div><button onClick={()=>setAddModal("role")} className="act-add" style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add Role</button></div>
      <Tbl headers={["Role","Status","Trigger / Blocker","Target",""]} ids={roles.map(r=>r.id)} onReorder={(a,b)=>reorder("roles",roles,setRoles,a,b)} rows={roles.map(r=>[
        <InEdit value={r.title} onChange={v=>updateRole(r.id,{title:v})}/>,
        <InEdit value={r.status} onChange={v=>updateRole(r.id,{status:v})} type="select" options={["Not opened","Interviewing","Blocked","Filled"]}/>,
        <InEdit value={r.trigger_blocker} onChange={v=>updateRole(r.id,{trigger_blocker:v})}/>,
        <InEdit value={r.target_date} onChange={v=>updateRole(r.id,{target_date:v})}/>,
        <button onClick={()=>deleteRole(r.id)} className="act-del" style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer"}}>✕</button>
      ])}/>
    </div>}

    {/* ═══ MEETINGS (dynamic) ═══ */}
    {view==="meet"&&<div className="af">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>Meeting Cadence</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setAddModal("meeting")} className="act-add" style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add Meeting</button>
          <a href="https://calendar.google.com/calendar/r/eventedit" target="_blank" rel="noopener" style={{fontSize:11,color:"#3B82F6",fontWeight:600,textDecoration:"none",background:"#EFF6FF",padding:"6px 14px",borderRadius:8,display:"flex",alignItems:"center"}}>+ Google Calendar</a>
        </div>
      </div>
      {/* Toggle filters */}
      <div style={{display:"flex",gap:4,marginBottom:16,background:"var(--bg3)",borderRadius:10,padding:3,width:"fit-content"}}>
        {[{id:"all",l:"All Meetings"},{id:"recurring",l:"Recurring"},{id:"milestone",l:"Milestone-Gated"}].map(f=>
          <button key={f.id} onClick={()=>setMeetFilter(f.id)} style={{padding:"8px 16px",borderRadius:8,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .2s",background:meetFilter===f.id?"var(--fg)":"transparent",color:meetFilter===f.id?"var(--bg)":"var(--fg2)"}}>{f.l}
            <span style={{marginLeft:6,background:meetFilter===f.id?"rgba(255,255,255,.2)":"var(--border)",borderRadius:99,padding:"1px 6px",fontSize:10}}>{
              f.id==="all"?meetings.length:
              f.id==="recurring"?meetings.filter(m=>["Weekly","Bi-weekly","Monthly"].includes(m.type)).length:
              meetings.filter(m=>m.type==="Milestone").length
            }</span>
          </button>
        )}
      </div>
      {/* Recurring section */}
      {(meetFilter==="all"||meetFilter==="recurring")&&<div style={{marginBottom:16}}>
        {meetFilter==="all"&&<div style={{fontSize:13,fontWeight:700,color:"var(--fg)",marginBottom:8,display:"flex",alignItems:"center",gap:6}}><div style={{width:4,height:16,borderRadius:2,background:"#3B82F6"}}/> Recurring Meetings</div>}
        <Tbl headers={["Type","Meeting","When","Duration","Owner","Attendees",""]} rows={meetings.filter(m=>["Weekly","Bi-weekly","Monthly"].includes(m.type)).map(m=>[
          <InEdit value={m.type} onChange={v=>updateMeeting(m.id,{type:v})} type="select" options={["Weekly","Bi-weekly","Monthly","Milestone"]}/>,
          <InEdit value={m.name} onChange={v=>updateMeeting(m.id,{name:v})}/>,
          <InEdit value={m.schedule} onChange={v=>updateMeeting(m.id,{schedule:v})}/>,
          <InEdit value={m.duration} onChange={v=>updateMeeting(m.id,{duration:v})}/>,
          <InEdit value={m.owner} onChange={v=>updateMeeting(m.id,{owner:v})}/>,
          <InEdit value={m.attendees} onChange={v=>updateMeeting(m.id,{attendees:v})}/>,
          <button onClick={()=>deleteMeeting(m.id)} className="act-del" style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer"}}>✕</button>
        ])}/>
      </div>}
      {/* Milestone section */}
      {(meetFilter==="all"||meetFilter==="milestone")&&<div>
        {meetFilter==="all"&&<div style={{fontSize:13,fontWeight:700,color:"var(--fg)",marginBottom:8,display:"flex",alignItems:"center",gap:6}}><div style={{width:4,height:16,borderRadius:2,background:"#F59E0B"}}/> Milestone-Gated Meetings</div>}
        <Tbl headers={["Type","Meeting","When","Duration","Owner","Attendees",""]} rows={meetings.filter(m=>m.type==="Milestone").map(m=>[
          <InEdit value={m.type} onChange={v=>updateMeeting(m.id,{type:v})} type="select" options={["Weekly","Bi-weekly","Monthly","Milestone"]}/>,
          <InEdit value={m.name} onChange={v=>updateMeeting(m.id,{name:v})}/>,
          <InEdit value={m.schedule} onChange={v=>updateMeeting(m.id,{schedule:v})}/>,
          <InEdit value={m.duration} onChange={v=>updateMeeting(m.id,{duration:v})}/>,
          <InEdit value={m.owner} onChange={v=>updateMeeting(m.id,{owner:v})}/>,
          <InEdit value={m.attendees} onChange={v=>updateMeeting(m.id,{attendees:v})}/>,
          <button onClick={()=>deleteMeeting(m.id)} className="act-del" style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer"}}>✕</button>
        ])}/>
      </div>}
    </div>}

    {/* ═══ PERFORMANCE ═══ */}
    {view==="perf"&&<div className="af">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>Performance Reviews</div>{canEdit&&<button className="act-add" onClick={()=>setAddModal("perf")} style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add Review</button>}</div>
      {perf.length===0?<div style={{textAlign:"center",padding:40,color:"var(--fg2)"}}>No performance reviews yet. Click + Add Review to start.</div>:
      perf.map((p,idx)=><div key={p.id} className="af ch" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,marginBottom:12,animationDelay:idx*60+"ms"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:CL[N2D[p.person]]||"#6366F1",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:12,fontWeight:700}}>{p.person?.[0]}</span></div>
            <div><InEdit value={p.person} onChange={v=>updatePerf(p.id,{person:v})}/><div style={{fontSize:10,color:"var(--fg2)"}}>{p.period}</div></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <InEdit value={p.rating} onChange={v=>updatePerf(p.id,{rating:v})} type="select" options={["pending","exceeds","meets","developing"]}/>
            <InEdit value={p.status} onChange={v=>updatePerf(p.id,{status:v})} type="select" options={["draft","submitted","reviewed","closed"]}/>
            <button onClick={()=>deletePerf(p.id)} className="act-del" style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer"}}>✕</button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><div style={{fontSize:10,fontWeight:700,color:"var(--fg2)",marginBottom:4}}>Goals</div><InEdit value={p.goals||""} onChange={v=>updatePerf(p.id,{goals:v})}/></div>
          <div><div style={{fontSize:10,fontWeight:700,color:"var(--fg2)",marginBottom:4}}>Self Review</div><InEdit value={p.self_review||""} onChange={v=>updatePerf(p.id,{self_review:v})}/></div>
          <div><div style={{fontSize:10,fontWeight:700,color:"var(--fg2)",marginBottom:4}}>Manager Review</div><InEdit value={p.manager_review||""} onChange={v=>updatePerf(p.id,{manager_review:v})}/></div>
          <div><div style={{fontSize:10,fontWeight:700,color:"var(--fg2)",marginBottom:4}}>Reviewer</div><InEdit value={p.reviewer||""} onChange={v=>updatePerf(p.id,{reviewer:v})}/></div>
        </div>
      </div>)}
    </div>}

    {/* ═══ LEAVE ═══ */}
    {view==="leave"&&<div className="af">
      {/* ─── STATUS BAR + WHO'S AVAILABLE ─── */}
      <div style={{marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>Team Availability</div><button onClick={fetchSlackStatus} disabled={slackLoading} style={{padding:"4px 10px",borderRadius:6,border:"1px solid var(--border)",background:"var(--bg3)",color:"var(--fg2)",fontSize:10,fontWeight:600,cursor:"pointer",opacity:slackLoading?.5:1}}>{slackLoading?"Syncing...":"Refresh from Slack"}</button></div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:10,color:"var(--fg2)"}}>My status:</span>
            {["working","break","meeting","off"].map(s=>{const me=userRoles.find(r=>r.email===user?.email);const active=me?.current_status===s;return <button key={s} onClick={()=>{const me2=userRoles.find(r=>r.email===user?.email);if(me2){supabase.from('user_roles').update({current_status:s}).eq('id',me2.id);setUserRoles(p=>p.map(r=>r.id===me2.id?{...r,current_status:s}:r))}}} style={{padding:"4px 10px",borderRadius:6,border:active?"2px solid":"1px solid var(--border)",borderColor:active?s==="working"?"#10B981":s==="break"?"#F59E0B":s==="meeting"?"#3B82F6":"#64748B":"var(--border)",background:active?(s==="working"?"#DCFCE7":s==="break"?"#FEF3C7":s==="meeting"?"#DBEAFE":"#F1F5F9"):"transparent",color:active?(s==="working"?"#166534":s==="break"?"#92400E":s==="meeting"?"#1D4ED8":"#475569"):"var(--fg2)",fontSize:10,fontWeight:active?700:500,cursor:"pointer",transition:"all .2s"}}>{s}</button>})}
          </div>
        </div>

        {/* Status Filter */}
        <div style={{display:"flex",gap:4,marginBottom:12,background:"var(--bg3)",borderRadius:8,padding:2,width:"fit-content"}}>
          {[{id:"all",l:"All"},{id:"working",l:"Working"},{id:"break",l:"Break"},{id:"meeting",l:"Meeting"},{id:"off",l:"Off/Offline"}].map(f=><button key={f.id} onClick={()=>setStatusFilter(f.id)} style={{padding:"5px 12px",borderRadius:6,border:"none",fontSize:10,fontWeight:600,cursor:"pointer",transition:"all .2s",background:statusFilter===f.id?"var(--fg)":"transparent",color:statusFilter===f.id?"var(--bg)":"var(--fg2)"}}>{f.l}</button>)}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8}}>
          {userRoles.filter(ur=>{
            const slk=slackStatus._match?slackStatus._match(ur):null;
            const onLeave=leaves.some(l=>l.person===ur.name&&l.status==="approved"&&l.start_date<=today&&l.end_date>=today);
            const st=onLeave?"off":slk?slk.mapped_status:(ur.current_status||"offline");
            if(statusFilter==="all")return true;
            if(statusFilter==="off")return st==="off"||st==="offline";
            return st===statusFilter;
          }).map((ur,idx)=>{
            const slk=slackStatus._match?slackStatus._match(ur):null;
            const tz=slk?.tz||ur.timezone||"Europe/Istanbul";
            let localTime="";try{localTime=new Date().toLocaleString('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false})}catch{localTime="--:--"}
            const ws=parseInt((ur.work_start||"09:00").split(":")[0]);const we=parseInt((ur.work_end||"18:00").split(":")[0]);
            let localH=0;try{localH=parseInt(new Date().toLocaleString('en-GB',{timeZone:tz,hour:'2-digit',hour12:false}))}catch{}
            const inHours=localH>=ws&&localH<we;
            const onLeave=leaves.some(l=>l.person===ur.name&&l.status==="approved"&&l.start_date<=today&&l.end_date>=today);
            const st=onLeave?"off":slk?slk.mapped_status:(ur.current_status||"offline");
            const slkText=slk?.status_text||"";
            const slkEmoji=slk?.status_emoji||"";
            const stC=st==="working"?"#10B981":st==="break"?"#F59E0B":st==="meeting"?"#3B82F6":"#94A3B8";
            const avatarSrc=ur.avatar_url||(slk?.avatar)||null;
            return <div key={ur.id} onClick={()=>setProfileCard({ur,slk})} className="ch asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,padding:"10px 12px",display:"flex",alignItems:"center",gap:8,cursor:"pointer",animationDelay:idx*30+"ms"}}>
              <div style={{position:"relative"}}>
                {avatarSrc?<img src={avatarSrc} style={{width:32,height:32,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:32,height:32,borderRadius:"50%",background:CL[ur.dept]||"#6366F1",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:11,fontWeight:700}}>{ur.name?.[0]}</span></div>}
                <div style={{position:"absolute",bottom:-1,right:-1,width:10,height:10,borderRadius:"50%",background:stC,border:"2px solid var(--card)"}}/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:600,color:"var(--fg)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ur.name}</div>
                <div style={{fontSize:9,color:"var(--fg2)"}}>{localTime} {slk?.tz_label||tz.split("/").pop().replace("_"," ")}</div>
                <div style={{fontSize:8,color:stC,fontWeight:700,textTransform:"uppercase"}}>{onLeave?"ON LEAVE":st}{inHours&&st!=="off"&&!onLeave?" (in hours)":""}</div>
                {slkText&&<div style={{fontSize:8,color:"var(--fg2)",marginTop:1}}>{slkEmoji} {slkText}</div>}
                {ur.hours_status==="pending"&&<div style={{fontSize:7,color:"#F59E0B",fontWeight:700}}>HOURS PENDING APPROVAL</div>}
              </div>
            </div>})}
        </div>
      </div>

      {/* ─── OVERLAP FINDER (CENTERED) ─── */}
      <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,padding:14,marginBottom:20}}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--fg)",marginBottom:8,textAlign:"center"}}>Team Overlap Hours (shared working window)</div>
        <div style={{display:"flex",gap:4,alignItems:"center",justifyContent:"center",flexWrap:"wrap"}}>
          {Array.from({length:24},(_,h)=>{
            const count=userRoles.filter(ur=>{
              const slk=slackStatus._match?slackStatus._match(ur):null;
              const tz=slk?.tz||ur.timezone||"Europe/Istanbul";
              const ws=parseInt((ur.work_start||"09:00").split(":")[0]);
              const we=parseInt((ur.work_end||"18:00").split(":")[0]);
              try{const d=new Date();d.setUTCHours(h,0,0,0);const localH=parseInt(d.toLocaleString('en-GB',{timeZone:tz,hour:'2-digit',hour12:false}));return localH>=ws&&localH<we}catch{return false}
            }).length;
            const pct=count/Math.max(userRoles.length,1);
            return <div key={h} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <div className="asl" style={{width:18,height:40,borderRadius:4,background:count===0?"var(--bg3)":pct>0.7?"#10B981":pct>0.4?"#F59E0B":"#3B82F6",opacity:count===0?.3:0.3+pct*0.7,display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:2,animationDelay:h*30+"ms",transition:"all .3s"}}>
                <span style={{fontSize:7,color:"#fff",fontWeight:700}}>{count||""}</span>
              </div>
              <span style={{fontSize:7,color:"var(--fg2)"}}>{h===0?"12AM":h<12?h+"AM":h===12?"12PM":(h-12)+"PM"}</span>
            </div>
          })}
        </div>
        <div style={{display:"flex",gap:12,marginTop:6,fontSize:9,color:"var(--fg2)",justifyContent:"center"}}>
          <span>Green = most team online</span><span>Yellow = partial overlap</span><span>Blue = few people</span><span>Times in UTC (12hr)</span>
        </div>
      </div>

      {/* ─── LEAVE BALANCES (DYNAMIC CATEGORIES) ─── */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--fg)",marginBottom:8}}>Leave Balances ({new Date().getFullYear()})</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8}}>
          {userRoles.filter(ur=>ur.name!=="Efehan Maleri").map((ur,idx)=>{
            const yearStr=String(new Date().getFullYear());
            const approvedLeaves=leaves.filter(l=>l.person===ur.name&&l.status==="approved"&&l.start_date?.startsWith(yearStr));
            const annualUsed=approvedLeaves.filter(l=>l.leave_type==="annual").reduce((s,l)=>s+(l.half_day?0.5:Number(l.days||0)),0);
            const sickUsed=approvedLeaves.filter(l=>l.leave_type==="sick").reduce((s,l)=>s+(l.half_day?0.5:Number(l.days||0)),0);
            const casualUsed=approvedLeaves.filter(l=>l.leave_type==="personal").reduce((s,l)=>s+(l.half_day?0.5:Number(l.days||0)),0);
            const annualQuota=ur.annual_leave_quota||14;const sickQuota=8;const casualQuota=12;
            return <div key={ur.id} className="ch asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,padding:12,animationDelay:idx*30+"ms"}}>
              <div style={{fontSize:12,fontWeight:700,color:"var(--fg)",marginBottom:8}}>{ur.name}</div>
              {[{label:"Annual",used:annualUsed,quota:annualQuota,color:"#3B82F6"},{label:"Sick",used:sickUsed,quota:sickQuota,color:"#EF4444"},{label:"Casual",used:casualUsed,quota:casualQuota,color:"#F59E0B",note:"1/month"}].map(cat=>{
                const rem=cat.quota-cat.used;const pct=Math.min(cat.used/cat.quota*100,100);
                return <div key={cat.label} style={{marginBottom:6}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:9,marginBottom:2}}>
                    <span style={{color:"var(--fg2)"}}>{cat.label}{cat.note?" ("+cat.note+")":""}</span>
                    <span style={{color:rem<=2?"#EF4444":"var(--fg2)",fontWeight:rem<=2?700:400}}>{rem}/{cat.quota}</span>
                  </div>
                  <div style={{height:4,background:"var(--bg3)",borderRadius:2,overflow:"hidden"}}>
                    <div className="bar-g" style={{height:"100%",width:pct+"%",borderRadius:2,background:cat.color,transition:"width .3s"}}/>
                  </div>
                </div>})}
            </div>})}
        </div>
      </div>

      {/* ─── LEAVE CALENDAR (this month) ─── */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--fg)",marginBottom:8}}>Leave Calendar — {new Date().toLocaleString('en-GB',{month:'long',year:'numeric'})}</div>
        {(()=>{const now=new Date();const y=now.getFullYear();const mo=now.getMonth();const dim=new Date(y,mo+1,0).getDate();
          const monthLeaves=leaves.filter(l=>l.status==="approved"&&l.start_date&&l.end_date&&(l.start_date.slice(0,7)===`${y}-${String(mo+1).padStart(2,'0')}`||l.end_date.slice(0,7)===`${y}-${String(mo+1).padStart(2,'0')}`));
          if(!monthLeaves.length)return <div style={{textAlign:"center",padding:20,color:"var(--fg2)",fontSize:11}}>No approved leaves this month</div>;
          return <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
            <div style={{display:"flex",padding:"8px 12px",borderBottom:"1px solid var(--border)",background:"var(--bg3)"}}>
              <div style={{width:100,fontSize:10,fontWeight:600,color:"var(--fg2)",flexShrink:0}}>Person</div>
              <div style={{flex:1,display:"flex"}}>{Array.from({length:dim},(_,i)=><div key={i} style={{flex:1,textAlign:"center",fontSize:8,color:"var(--fg2)"}}>{i+1}</div>)}</div>
            </div>
            {monthLeaves.map((l,idx)=>{const sd=parseInt(l.start_date.split("-")[2]);const ed=parseInt(l.end_date.split("-")[2]);
              return <div key={idx} style={{display:"flex",padding:"6px 12px",borderBottom:"1px solid var(--border)",alignItems:"center"}}>
                <div style={{width:100,fontSize:10,fontWeight:500,color:"var(--fg)",flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.person?.split(" ")[0]}</div>
                <div style={{flex:1,display:"flex",height:16}}>{Array.from({length:dim},(_,i)=>{const d=i+1;const inRange=d>=sd&&d<=ed;
                  return <div key={i} style={{flex:1,margin:"0 1px",borderRadius:2,background:inRange?(l.leave_type==="sick"?"#EF4444":l.leave_type==="wfh"?"#8B5CF6":"#3B82F6"):"transparent",opacity:inRange?.8:.1}}/>})}</div>
              </div>})}
          </div>})()}
      </div>

      {/* ─── STATUS BADGES + REQUEST BUTTON ─── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {["pending","approved","rejected"].map(s=>{const c=leaves.filter(l=>l.status===s).length;return <div key={s} style={{padding:"6px 14px",borderRadius:8,background:s==="pending"?"#FEF3C7":s==="approved"?"#DCFCE7":"#FEE2E2",color:s==="pending"?"#92400E":s==="approved"?"#166534":"#991B1B",fontWeight:700,fontSize:11}}>{c} {s}</div>})}
        </div>
        <button className="act-add" onClick={()=>setAddModal("leave")} style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Request Leave</button>
      </div>

      {/* ─── LEAVE TABLE ─── */}
      <Tbl headers={["Person","Type","Half Day","From","To","Days","Reason","Status","Approved By",""]} rows={leaves.map(l=>[
        <span style={{fontWeight:600}}>{l.person}</span>,
        <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:99,background:l.leave_type==="sick"?"#FEE2E2":l.leave_type==="annual"?"#DBEAFE":l.leave_type==="wfh"?"#F3E8FF":l.leave_type==="casual"?"#FEF3C7":"#F1F5F9",color:l.leave_type==="sick"?"#991B1B":l.leave_type==="annual"?"#1D4ED8":l.leave_type==="wfh"?"#7C3AED":l.leave_type==="casual"?"#92400E":"#475569"}}>{l.leave_type}</span>,
        <span style={{fontSize:10,color:l.half_day?"#F59E0B":"var(--fg2)"}}>{l.half_day?"Yes":"No"}</span>,
        fD(l.start_date),fD(l.end_date),<b>{l.half_day?"0.5":l.days}</b>,
        <span style={{fontSize:11}}>{l.reason}</span>,
        canEdit?<InEdit value={l.status} onChange={v=>{updateLeave(l.id,{status:v,approved_by:v==="approved"||v==="rejected"?user?.user_metadata?.full_name||user?.email:""})}} type="select" options={["pending","approved","rejected","cancelled"]}/>:<Bdg bg={l.status==="approved"?"#DCFCE7":l.status==="rejected"?"#FEE2E2":"#FEF3C7"} c={l.status==="approved"?"#166534":l.status==="rejected"?"#991B1B":"#92400E"}>{l.status}</Bdg>,
        <span style={{fontSize:10,color:"var(--fg2)"}}>{l.approved_by}</span>,
        <button onClick={()=>deleteLeave(l.id)} className="act-del" style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer"}}>✕</button>
      ])}/>
    </div>}

    {/* Settings — Admin Only */}
    {view==="settings"&&role==="admin"&&<div className="af">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>User Roles</div><button className="act-add" onClick={()=>setAddModal("userrole")} style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add User</button></div>
      <p style={{fontSize:11,color:"var(--fg2)",marginBottom:12}}>Controls who can view, edit, or delete data. Changes take effect on next login.</p>

      {/* Pending Hours Requests */}
      {(()=>{const pending=userRoles.filter(r=>r.hours_status==="pending"&&r.proposed_start);
        if(!pending.length)return null;
        return <div style={{background:"#FEF3C7",border:"1px solid #F59E0B",borderRadius:10,padding:14,marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#92400E",marginBottom:8}}>Pending Working Hours Requests ({pending.length})</div>
          {pending.map(r=><div key={r.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #FDE68A"}}>
            <div><span style={{fontWeight:600,color:"#92400E"}}>{r.name}</span><span style={{color:"#B45309",fontSize:11}}> wants {r.proposed_start} – {r.proposed_end} ({r.proposed_tz?.split("/").pop().replace("_"," ")})</span></div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>handleHoursApproval(r.id,true)} style={{padding:"4px 12px",borderRadius:6,border:"none",background:"#10B981",color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer"}}>Approve</button>
              <button onClick={()=>handleHoursApproval(r.id,false)} style={{padding:"4px 12px",borderRadius:6,border:"none",background:"#EF4444",color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer"}}>Reject</button>
            </div>
          </div>)}
        </div>})()}
      <Tbl headers={["","Email","Name","Role","Department",""]} ids={userRoles.map(r=>r.id)} onReorder={(a,b)=>reorder('user_roles',userRoles,setUserRoles,a,b)} rows={userRoles.map(r=>[
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          {r.avatar_url?<img src={r.avatar_url} style={{width:28,height:28,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:28,height:28,borderRadius:"50%",background:CL[r.dept]||"#6366F1",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:10,fontWeight:700}}>{r.name?.[0]}</span></div>}
          <label style={{cursor:"pointer",fontSize:9,color:"#3B82F6"}}><input type="file" accept="image/*" style={{display:"none"}} onChange={e=>uploadAvatar(r.id,e.target.files?.[0])}/>edit</label>
        </div>,
        <InEdit value={r.email} onChange={v=>updateUserRole(r.id,{email:v})}/>,
        <InEdit value={r.name} onChange={v=>updateUserRole(r.id,{name:v})}/>,
        <InEdit value={r.role} onChange={v=>updateUserRole(r.id,{role:v})} type="select" options={["admin","editor","viewer"]}/>,
        <InEdit value={r.dept||""} onChange={v=>updateUserRole(r.id,{dept:v})}/>,
        <button onClick={()=>deleteUserRole(r.id)} className="act-del" style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer"}}>✕</button>
      ])}/>
      <div style={{marginTop:20,padding:16,background:"var(--bg3)",borderRadius:10}}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--fg)",marginBottom:8}}>Role Permissions</div>
        <div style={{fontSize:11,color:"var(--fg2)",lineHeight:1.8}}>
          <b style={{color:"#3B82F6"}}>admin</b> — Full access: view, add, edit, delete, manage users<br/>
          <b style={{color:"#F59E0B"}}>editor</b> — Can view, add, and edit. Cannot delete. Edits trigger Slack notifications.<br/>
          <b style={{color:"#94A3B8"}}>viewer</b> — Read-only access. No add, edit, or delete buttons visible.
        </div>
      </div>
    </div>}

    </div>
    <TicketPopup task={sel} tasks={tasks} onClose={()=>setSel(null)} onUpdate={updateTask} onDelete={deleteTask}/>
    {addModal==="task"&&<AddModal title="Add Task" fields={[{key:"name",label:"Task Name",placeholder:"e.g. Landing page"},{key:"dept",label:"Department",type:"select",options:DEPT_OPT},{key:"owner",label:"Owner"},{key:"start_date",label:"Start",type:"date"},{key:"end_date",label:"End",type:"date"},{key:"priority",label:"Priority",type:"select",options:PRI_OPT}]} onSave={addTask} onClose={()=>setAddModal(null)}/>}
    {addModal==="raci"&&<AddModal title="Add RACI" fields={[{key:"dept",label:"Department",type:"select",options:DEPT_OPT},{key:"task",label:"Task"},{key:"responsible",label:"R"},{key:"accountable",label:"A"},{key:"consulted",label:"C"},{key:"informed",label:"I"},{key:"notes",label:"Notes"},{key:"is_suggestion",label:"PMO Suggestion?",type:"select",options:["false","true"]}]} onSave={addRaci} onClose={()=>setAddModal(null)}/>}
    {addModal==="risk"&&<AddModal title="Add Risk" fields={[{key:"description",label:"Risk"},{key:"impact",label:"Impact",type:"select",options:IMP_OPT},{key:"owner",label:"Owner"},{key:"mitigation",label:"Mitigation"},{key:"linked_to",label:"Linked Task (name or ID)"}]} onSave={addRisk} onClose={()=>setAddModal(null)}/>}
    {addModal==="kpi"&&<AddModal title="Add KPI" fields={[{key:"dept",label:"Department",type:"select",options:DEPT_OPT},{key:"name",label:"KPI"},{key:"target",label:"Target"},{key:"current_value",label:"Current"},{key:"flag",label:"Status",type:"select",options:["green","yellow","red"]},{key:"review_rhythm",label:"Review",type:"select",options:["Weekly","Bi-Weekly","Monthly"]}]} onSave={addKpi} onClose={()=>setAddModal(null)}/>}
    {addModal==="role"&&<AddModal title="Add Role" fields={[{key:"title",label:"Role Title"},{key:"status",label:"Status",type:"select",options:["Not opened","Interviewing","Blocked","Filled"]},{key:"trigger_blocker",label:"Trigger / Blocker"},{key:"target_date",label:"Target Date"}]} onSave={addRole} onClose={()=>setAddModal(null)}/>}
    {addModal==="meeting"&&<AddModal title="Add Meeting" fields={[{key:"type",label:"Type",type:"select",options:["Weekly","Milestone","Bi-weekly","Monthly"]},{key:"name",label:"Meeting Name"},{key:"schedule",label:"When"},{key:"duration",label:"Duration"},{key:"owner",label:"Owner"},{key:"attendees",label:"Attendees"}]} onSave={addMeeting} onClose={()=>setAddModal(null)}/>}
    {addModal==="standup"&&<AddModal title="Add Standup Update" fields={[{key:"person",label:"Person",placeholder:"e.g. Talha"},{key:"completed",label:"What did you complete today?",placeholder:"Finished the API endpoints..."},{key:"tomorrow",label:"What are you working on tomorrow?",placeholder:"Starting the frontend..."},{key:"blockers",label:"Any blockers?",placeholder:"None"},{key:"standup_date",label:"Date",type:"date"}]} onSave={addStandup} onClose={()=>setAddModal(null)}/>}
    {addModal==="userrole"&&<AddModal title="Add User" fields={[{key:"email",label:"Google Email",placeholder:"name@attimo.com"},{key:"name",label:"Full Name"},{key:"role",label:"Role",type:"select",options:["admin","editor","viewer"]},{key:"dept",label:"Department",type:"select",options:DEPT_OPT}]} onSave={addUserRole} onClose={()=>setAddModal(null)}/>}
    {addModal==="perf"&&<AddModal title="Add Performance Review" fields={[{key:"person",label:"Person",placeholder:"e.g. Talha Mubeen"},{key:"period",label:"Period",placeholder:"e.g. Q2 2026"},{key:"goals",label:"Goals",placeholder:"Key objectives..."}]} onSave={addPerf} onClose={()=>setAddModal(null)}/>}
    {addModal==="leave"&&<AddModal title="Request Leave" fields={[{key:"person",label:"Your Name",placeholder:user?.user_metadata?.full_name||""},{key:"leave_type",label:"Type",type:"select",options:["annual","sick","casual","wfh","unpaid","other"]},{key:"half_day",label:"Half Day?",type:"select",options:["No","Yes"]},{key:"start_date",label:"From",type:"date"},{key:"end_date",label:"To",type:"date"},{key:"reason",label:"Reason",placeholder:"Optional"}]} onSave={addLeave} onClose={()=>setAddModal(null)}/>}

    {/* Working Hours Modal */}
    {showHoursModal&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowHoursModal(false)}>
      <div onClick={e=>e.stopPropagation()} className="asc" style={{background:"var(--card)",borderRadius:16,padding:24,width:"min(400px,90vw)",border:"1px solid var(--border)"}}>
        <div style={{fontSize:14,fontWeight:800,color:"var(--fg)",marginBottom:16}}>Set Working Hours</div>
        <p style={{fontSize:11,color:"var(--fg2)",marginBottom:16}}>Your request will be sent to admin for approval.</p>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div><label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Timezone</label>
            <select value={hoursForm.tz} onChange={e=>setHoursForm(p=>({...p,tz:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--bg2)",color:"var(--fg)",fontSize:12}}>
              {["Asia/Karachi","Europe/Istanbul","Europe/London","Asia/Kuala_Lumpur","America/New_York","Europe/Berlin","Asia/Dubai","UTC"].map(tz=><option key={tz} value={tz}>{tz.replace("_"," ")}</option>)}
            </select></div>
          <div style={{display:"flex",gap:12}}>
            <div style={{flex:1}}><label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Start Time</label>
              <input type="time" value={hoursForm.start} onChange={e=>setHoursForm(p=>({...p,start:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--bg2)",color:"var(--fg)",fontSize:12}}/></div>
            <div style={{flex:1}}><label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>End Time</label>
              <input type="time" value={hoursForm.end} onChange={e=>setHoursForm(p=>({...p,end:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--bg2)",color:"var(--fg)",fontSize:12}}/></div>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
            <button onClick={()=>setShowHoursModal(false)} style={{padding:"8px 16px",borderRadius:8,border:"1px solid var(--border)",background:"transparent",color:"var(--fg2)",fontSize:12,cursor:"pointer"}}>Cancel</button>
            <button onClick={()=>proposeHours(hoursForm.tz,hoursForm.start,hoursForm.end)} style={{padding:"8px 16px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Submit for Approval</button>
          </div>
        </div>
      </div>
    </div>}

    {/* Profile Card Modal — Enhanced */}
    {profileCard&&<div className="modal-overlay" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>{setProfileCard(null);setProfileTab("overview")}}>
      <div onClick={e=>e.stopPropagation()} className="asc" style={{background:"var(--card)",borderRadius:20,width:"min(500px,94vw)",maxHeight:"88vh",overflow:"hidden",border:"1px solid var(--border)",boxShadow:"0 25px 60px rgba(0,0,0,.35)",display:"flex",flexDirection:"column"}}>
        {(()=>{const{ur,slk}=profileCard;const onLeave=leaves.some(l=>l.person===ur.name&&l.status==="approved"&&l.start_date<=today&&l.end_date>=today);
          const st=onLeave?"off":slk?slk.mapped_status:(ur.current_status||"offline");
          const stC=st==="working"?"#10B981":st==="break"?"#F59E0B":st==="meeting"?"#3B82F6":"#94A3B8";
          const avatar=slk?.avatar_lg||slk?.avatar||ur.avatar_url;
          let localTime="";try{localTime=new Date().toLocaleString('en-GB',{timeZone:ur.timezone||"UTC",weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false})}catch{}
          const yearStr=String(new Date().getFullYear());
          const usedLeave=leaves.filter(l=>l.person===ur.name&&l.status==="approved"&&l.start_date?.startsWith(yearStr)).reduce((s,l)=>s+(l.half_day?0.5:Number(l.days||0)),0);
          const personKpis=kpis.filter(k=>k.dept===ur.dept);
          const personLeaves=leaves.filter(l=>l.person===ur.name).slice(0,5);
          const personStandups=standups.filter(s=>s.person===ur.name).slice(0,3);
          const personPerf=perf.filter(p=>p.person===ur.name).slice(0,2);
          const isSelf=ur.email===user?.email;
          const isViewerRole=role==='viewer';
          return <>
          {/* Header with gradient */}
          <div style={{background:"linear-gradient(135deg,"+stC+"40,"+stC+"15)",padding:"24px 24px 16px",position:"relative",flexShrink:0}}>
            <button onClick={()=>{setProfileCard(null);setProfileTab("overview")}} style={{position:"absolute",top:12,right:12,background:"rgba(0,0,0,.2)",border:"none",color:"#fff",width:28,height:28,borderRadius:"50%",cursor:"pointer",fontSize:14,transition:"all .2s"}} onMouseEnter={e=>e.target.style.transform="rotate(90deg)"} onMouseLeave={e=>e.target.style.transform="rotate(0)"}>✕</button>
            <div style={{display:"flex",gap:16,alignItems:"flex-end"}}>
              <div style={{position:"relative"}} className="abn">
                {avatar?<img src={avatar} style={{width:80,height:80,borderRadius:16,objectFit:"cover",border:"3px solid var(--card)"}}/>
                :<div style={{width:80,height:80,borderRadius:16,background:CL[ur.dept]||"#6366F1",display:"flex",alignItems:"center",justifyContent:"center",border:"3px solid var(--card)"}}><span style={{color:"#fff",fontSize:28,fontWeight:700}}>{ur.name?.[0]}</span></div>}
                <div className="pulse-dot" style={{position:"absolute",bottom:2,right:2,width:16,height:16,borderRadius:"50%",background:stC,border:"3px solid var(--card)"}}/>
              </div>
              <div style={{flex:1}} className="asl">
                <div style={{fontSize:18,fontWeight:800,color:"var(--fg)"}}>{ur.name}</div>
                <div style={{fontSize:12,color:"var(--fg2)"}}>{slk?.title||ur.dept||"Team"}</div>
                {slk?.display_name&&slk.display_name!==ur.name&&<div style={{fontSize:11,color:"var(--fg2)"}}>@{slk.display_name}</div>}
              </div>
            </div>
          </div>

          {/* Status bar */}
          <div className="asl" style={{padding:"10px 24px",background:stC+"15",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:stC}}/>
            <span style={{fontSize:12,fontWeight:600,color:stC,textTransform:"capitalize"}}>{onLeave?"On Leave":st}</span>
            {slk?.status_text&&<span style={{fontSize:11,color:"var(--fg2)"}}>{slk.status_emoji} {slk.status_text}</span>}
          </div>

          {/* Tabs */}
          <div style={{display:"flex",borderBottom:"1px solid var(--border)",padding:"0 24px",flexShrink:0}}>
            {[{id:"overview",l:"Overview"},{id:"kpis",l:"KPIs"},{id:"activity",l:"Activity"},{id:"details",l:role==="admin"?"Admin Details":"Details"}].map(t=>
              <div key={t.id} onClick={()=>setProfileTab(t.id)} className={"profile-tab"+(profileTab===t.id?" active":"")} style={{padding:"10px 16px",cursor:"pointer",fontSize:11,fontWeight:500,color:"var(--fg2)",borderBottom:"2px solid transparent",transition:"all .2s"}}>{t.l}</div>
            )}
          </div>

          {/* Tab Content — scrollable */}
          <div style={{flex:1,overflowY:"auto",padding:"16px 24px"}}>

          {/* OVERVIEW TAB */}
          {profileTab==="overview"&&<div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[{l:"Department",v:ur.dept||"Team"},{l:"Role",v:ur.role},{l:"Local Time",v:localTime},{l:"Timezone",v:(slk?.tz_label||ur.timezone||"").replace("_"," ")},{l:"Working Hours",v:(ur.work_start||"09:00")+" – "+(ur.work_end||"18:00")},{l:"Leave Balance",v:(ur.annual_leave_quota||14)-usedLeave+" of "+(ur.annual_leave_quota||14)+" days"}].map((f,i)=>
                <div key={i} className="info-row" style={{padding:"6px 8px",animationDelay:i*50+"ms"}}>
                  <div style={{fontSize:9,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>{f.l}</div>
                  <div style={{fontSize:13,color:"var(--fg)",fontWeight:500}}>{f.v}</div>
                </div>
              )}
            </div>
            <div style={{borderTop:"1px solid var(--border)",paddingTop:12}}>
              <div style={{fontSize:9,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Contact</div>
              {(slk?.email||ur.email)&&<div className="info-row" style={{display:"flex",alignItems:"center",gap:8,padding:"4px 8px"}}><span style={{fontSize:11,color:"var(--fg2)",width:50}}>Email</span><a href={"mailto:"+(slk?.email||ur.email)} style={{fontSize:12,color:"#3B82F6",textDecoration:"none"}}>{slk?.email||ur.email}</a></div>}
              {slk?.phone&&<div className="info-row" style={{display:"flex",alignItems:"center",gap:8,padding:"4px 8px"}}><span style={{fontSize:11,color:"var(--fg2)",width:50}}>Phone</span><a href={"tel:"+slk.phone} style={{fontSize:12,color:"#3B82F6",textDecoration:"none"}}>{slk.phone}</a></div>}
            </div>
            {slk?.start_date&&<div style={{borderTop:"1px solid var(--border)",paddingTop:12}}>
              <div style={{fontSize:9,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Start Date</div>
              <div style={{fontSize:12,color:"var(--fg)"}}>{slk.start_date}</div>
            </div>}
          </div>}

          {/* KPIS TAB */}
          {profileTab==="kpis"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontSize:10,color:"var(--fg2)",marginBottom:4}}>KPIs for {ur.dept} department</div>
            {personKpis.length>0?personKpis.map((k,i)=><div key={k.id} className="ch asl" style={{borderLeft:"3px solid "+FC[k.flag],borderRadius:8,padding:12,background:"var(--bg2)",animationDelay:i*60+"ms"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,fontWeight:700,color:"var(--fg)"}}>{k.name}</span>
                <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:"50%",background:FC[k.flag]}}/><span style={{fontSize:11,fontWeight:700,color:FC[k.flag]}}>{k.current_value}</span></div>
              </div>
              <div style={{fontSize:10,color:"var(--fg2)",marginTop:4}}>Target: {k.target}</div>
            </div>):<div style={{textAlign:"center",padding:24,color:"var(--fg2)",fontSize:11}}>No KPIs configured for {ur.dept}</div>}
          </div>}

          {/* ACTIVITY TAB */}
          {profileTab==="activity"&&<div style={{display:"flex",flexDirection:"column",gap:12}}>
            {/* Performance Reviews */}
            {personPerf.length>0&&<div>
              <div style={{fontSize:10,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Performance Reviews</div>
              {personPerf.map((p,i)=><div key={p.id} className="asl" style={{padding:"8px 10px",borderRadius:8,background:"var(--bg2)",marginBottom:6,borderLeft:"3px solid "+(p.rating==="exceeds"?"#10B981":p.rating==="meets"?"#3B82F6":p.rating==="developing"?"#F59E0B":"#94A3B8"),animationDelay:i*60+"ms"}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:11,fontWeight:600,color:"var(--fg)"}}>{p.period}</span>
                  <Bdg bg={p.rating==="exceeds"?"#DCFCE7":p.rating==="meets"?"#DBEAFE":"#FEF3C7"} c={p.rating==="exceeds"?"#166534":p.rating==="meets"?"#1D4ED8":"#92400E"}>{p.rating}</Bdg>
                </div>
                {p.goals&&<div style={{fontSize:10,color:"var(--fg2)",marginTop:4}}>{p.goals}</div>}
              </div>)}
            </div>}

            {/* Recent Leaves */}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Recent Leave</div>
              {personLeaves.length>0?personLeaves.map((l,i)=><div key={l.id} className="asl" style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:6,background:"var(--bg2)",marginBottom:4,animationDelay:i*50+"ms"}}>
                <Bdg bg={l.status==="approved"?"#DCFCE7":l.status==="rejected"?"#FEE2E2":"#FEF3C7"} c={l.status==="approved"?"#166534":l.status==="rejected"?"#991B1B":"#92400E"}>{l.status}</Bdg>
                <span style={{fontSize:10,color:"var(--fg)"}}>{l.leave_type} · {fD(l.start_date)}–{fD(l.end_date)}</span>
                <span style={{fontSize:9,color:"var(--fg2)",marginLeft:"auto"}}>{l.days}d</span>
              </div>):<div style={{fontSize:11,color:"var(--fg2)",padding:8}}>No leave records</div>}
            </div>

            {/* Recent Standups */}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Recent Updates</div>
              {personStandups.length>0?personStandups.map((s,i)=><div key={s.id} className="asl" style={{padding:"8px 10px",borderRadius:8,background:"var(--bg2)",marginBottom:4,borderLeft:"3px solid #3B82F6",animationDelay:i*50+"ms"}}>
                <div style={{fontSize:9,color:"var(--fg2)",marginBottom:4}}>{fD(s.standup_date)}</div>
                <div style={{fontSize:10,color:"var(--fg)"}}>{(s.completed||"").slice(0,120)}{(s.completed||"").length>120?"...":""}</div>
              </div>):<div style={{fontSize:11,color:"var(--fg2)",padding:8}}>No standup updates</div>}
            </div>
          </div>}

          {/* DETAILS TAB */}
          {profileTab==="details"&&<div style={{display:"flex",flexDirection:"column",gap:12}}>
            {role==="admin"?<>
              {/* Admin sees everything */}
              <div style={{fontSize:10,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:1}}>Admin-Only Information</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div className="info-row" style={{padding:"6px 8px"}}><div style={{fontSize:9,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>System Role</div><div style={{fontSize:13,color:"var(--fg)",fontWeight:500}}>{ur.role}</div></div>
                <div className="info-row" style={{padding:"6px 8px"}}><div style={{fontSize:9,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Email</div><div style={{fontSize:13,color:"var(--fg)",fontWeight:500}}>{ur.email}</div></div>
                <div className="info-row" style={{padding:"6px 8px"}}><div style={{fontSize:9,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Leave Quota</div><div style={{fontSize:13,color:"var(--fg)",fontWeight:500}}>{ur.annual_leave_quota||14} days/yr</div></div>
                <div className="info-row" style={{padding:"6px 8px"}}><div style={{fontSize:9,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Hours Status</div><div style={{fontSize:13,color:ur.hours_status==="pending"?"#F59E0B":"var(--fg)",fontWeight:500}}>{ur.hours_status||"approved"}</div></div>
              </div>
              <div style={{background:"var(--bg2)",borderRadius:8,padding:12,borderLeft:"3px solid #3B82F6"}}>
                <div style={{fontSize:9,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Job Description</div>
                <div style={{fontSize:11,color:"var(--fg)",lineHeight:1.5}}>{N2D[ur.name]?N2D[ur.name]+" team member":"Team member"} at Attimo — building Panovia, governed AEC coordination layer.</div>
              </div>
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <button onClick={()=>{setProfileCard(null);setProfileTab("overview");setView("settings")}} className="btn-pop" style={{padding:"8px 16px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer"}}>Edit in Settings</button>
                <button onClick={()=>{setProfileCard(null);setProfileTab("overview");setView("perf")}} style={{padding:"8px 16px",borderRadius:8,border:"1px solid var(--border)",background:"transparent",color:"var(--fg2)",fontSize:11,cursor:"pointer"}}>View Performance</button>
              </div>
            </>:<>
              {/* Non-admin sees limited info + request edit */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div className="info-row" style={{padding:"6px 8px"}}><div style={{fontSize:9,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Department</div><div style={{fontSize:13,color:"var(--fg)",fontWeight:500}}>{ur.dept}</div></div>
                <div className="info-row" style={{padding:"6px 8px"}}><div style={{fontSize:9,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Role</div><div style={{fontSize:13,color:"var(--fg)",fontWeight:500}}>{ur.role}</div></div>
              </div>
              {isSelf&&<div style={{background:"#FEF3C720",borderRadius:8,padding:12,border:"1px solid #FDE68A50"}}>
                <div style={{fontSize:11,color:"var(--fg)",marginBottom:8}}>Want to update your details? Submit a request to your admin.</div>
                <button onClick={()=>{notify("requested","profile edit","Profile update for "+ur.name);showToast("Edit request sent to admin");setProfileCard(null);setProfileTab("overview")}} className="btn-pop" style={{padding:"8px 16px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#F59E0B,#F97316)",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer"}}>Request Profile Edit</button>
              </div>}
              {!isSelf&&<div style={{textAlign:"center",padding:16,color:"var(--fg2)",fontSize:11}}>Additional details are visible to admins only.</div>}
            </>}
          </div>}
          </div>
        </>})()}
      </div>
    </div>}

    {/* Edit Name Modal */}
    {editMyName&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setEditMyName(false)}>
      <div onClick={e=>e.stopPropagation()} className="asc" style={{background:"var(--card)",borderRadius:16,padding:24,width:"min(360px,90vw)",border:"1px solid var(--border)"}}>
        <div style={{fontSize:14,fontWeight:800,color:"var(--fg)",marginBottom:12}}>Edit Your Name</div>
        <input autoFocus value={myNameVal} onChange={e=>setMyNameVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")updateMyName(myNameVal)}} style={{width:"100%",padding:"10px 12px",border:"1px solid var(--border)",borderRadius:8,fontSize:13,background:"var(--bg2)",color:"var(--fg)",boxSizing:"border-box"}}/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:12}}>
          <button onClick={()=>setEditMyName(false)} style={{padding:"8px 16px",borderRadius:8,border:"1px solid var(--border)",background:"transparent",color:"var(--fg2)",fontSize:12,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>updateMyName(myNameVal)} style={{padding:"8px 16px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Save</button>
        </div>
      </div>
    </div>}

    {/* Close user menu on outside click */}
    {userMenu&&<div style={{position:"fixed",inset:0,zIndex:90}} onClick={()=>setUserMenu(false)}/>}

    {/* Toast notification */}
    {toast&&<div className="asd" style={{position:"fixed",bottom:24,right:24,background:"var(--fg)",color:"var(--bg)",padding:"12px 20px",borderRadius:10,fontSize:13,fontWeight:600,boxShadow:"0 8px 30px rgba(0,0,0,.25)",zIndex:2000,display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:14}}>✓</span>{toast}</div>}
    </div>{/* close main area */}
  </div>;
}
