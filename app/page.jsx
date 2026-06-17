'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import PermissionsMatrix from './components/PermissionsMatrix';
import KnowledgeHub from './components/KnowledgeHub';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL||'', process.env.NEXT_PUBLIC_SUPABASE_KEY||'');

// ─── Monochrome SVG Icon System ──────────────────────────────────────────────
const I={
  grid:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  list:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>,
  clock:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  calendar:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  zap:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  check:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12"/></svg>,
  alert:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg>,
  fire:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2c1 4-2 6-2 10a4 4 0 108 0c0-4-3-6-2-10"/><path d="M12 22a4 4 0 01-4-4c0-2 1-3 2-5"/></svg>,
  users:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  chart:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  target:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  user:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  edit:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  logout:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  leaf:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75"/></svg>,
  settings:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  star:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  shield:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  briefcase:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>,
  sun:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  moon:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  x:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  trash:s=><svg width={s||14} height={s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
};

// ─── Config & Constants (readable names) ─────────────────────────────────────
const DEPT_COLORS={PMO:"#3B82F6",Development:"#10B981",Architecture:"#14B8A6","AI/Science":"#F59E0B",Design:"#8B5CF6",Marketing:"#EC4899",Legal:"#64748B",Hiring:"#06B6D4",Leadership:"#6366F1"};
const CL=DEPT_COLORS; // alias for compact JSX
const STATUS_OPTIONS=["To Do","Doing","Done"];const STS=STATUS_OPTIONS;
const PRIORITY_OPTIONS=["Low","Medium","High"];const PRI_OPT=PRIORITY_OPTIONS;
const DEPT_OPT=Object.keys(CL);
const RISK_OPTIONS=["On track","At risk","Off track"];const RSK_OPT=RISK_OPTIONS;
const IMPACT_OPTIONS=["CRITICAL","HIGH","MEDIUM","LOW"];const IMP_OPT=IMPACT_OPTIONS;
const RISK_COLORS={"On track":{bg:"#DCFCE7",c:"#166534"},"At risk":{bg:"#FEF3C7",c:"#D97706"},"Off track":{bg:"#FEE2E2",c:"#DC2626"}};const RC=RISK_COLORS;
const PRIORITY_COLORS={Low:{bg:"#DBEAFE",c:"#1D4ED8"},Medium:{bg:"#FEF3C7",c:"#D97706"},High:{bg:"#FEE2E2",c:"#DC2626"}};const PC=PRIORITY_COLORS;
const FLAG_COLORS={green:"#16A34A",yellow:"#D97706",red:"#DC2626"};const FC=FLAG_COLORS;
// Milestone anchors — editable here, not buried in JSX
const MILESTONES=[{d:"2026-05-07",l:"Hatchery",c:"#6366F1"},{d:"2026-05-21",l:"GTM",c:"#F59E0B"},{d:"2026-06-10",l:"Launch",c:"#10B981"},{d:"2026-07-01",l:"Pitch Day",c:"#EF4444"}];
const ANCH=MILESTONES;

// Robust date parsing for Supabase dates
const pD=s=>{if(!s)return new Date();const str=String(s).split('T')[0];const[y,m,d]=str.split('-').map(Number);return new Date(y,m-1,d)};
const fD=s=>{try{return pD(s).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}catch{return String(s)}};
const daysB=(a,b)=>{const da=pD(a),db=pD(b);return Math.round((db-da)/864e5)};
const today=new Date().toISOString().split("T")[0];
const isOverdue=(t)=>t.status!=="Done"&&String(t.end_date).split('T')[0]<today;

// Email → Display Name mapping
const E2N={'burak@attimo.com':'Burak Çetin','burak':'Burak Çetin','burak cetin':'Burak Çetin','talha':'Talha Mubeen','talha@attimo.com':'Talha Mubeen','talha mubeen':'Talha Mubeen','laraib':'Laraib Haider','laraib@attimo.com':'Laraib Haider','murat':'Murat Tut','murat@attimo.com':'Murat Tut','sooling':'Soo Ling Lim','soo ling':'Soo Ling Lim','sooling@attimo.com':'Soo Ling Lim','soo.ling@attimo.com':'Soo Ling Lim','gamze':'Gamze Savaş','gamze@attimo.com':'Gamze Savaş','gamze savas':'Gamze Savaş','claire':'Claire Eskander','claire@attimo.com':'Claire Eskander','mesude':'Mesude Gökpınar','mesude@attimo.com':'Mesude Gökpınar','mesude gokpinar':'Mesude Gökpınar','suche':'Suche Coşkun','suche@attimo.com':'Suche Coşkun','suche coskun':'Suche Coşkun','efehan':'Efehan Maleri','efehan@attimo.com':'Efehan Maleri','syed':'Syed Osama Ali','syed@attimo.com':'Syed Osama Ali','tunc':'Tunç Karadağ','tunch':'Tunç Karadağ','tunc@attimo.com':'Tunç Karadağ','tunc karadag':'Tunç Karadağ','farman':'Farman Ali','farman@attimo.com':'Farman Ali','farman ali':'Farman Ali'};
const N2D={'Burak Çetin':'AI/Science','Talha Mubeen':'Development','Laraib Haider':'PMO','Murat Tut':'Development','Soo Ling Lim':'AI/Science','Gamze Savaş':'Design','Claire Eskander':'Marketing','Mesude Gökpınar':'PMO','Suche Coşkun':'Marketing','Efehan Maleri':'Leadership','Syed Osama Ali':'Leadership','Tunç Karadağ':'Design','Farman Ali':'Development'};
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
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes tickerSlide{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.ticker-scroll{animation:tickerSlide 30s linear infinite}.ticker-scroll:hover{animation-play-state:paused}
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
.edit-hint{opacity:0!important;transition:opacity .2s}span:hover>.edit-hint{opacity:.4!important}
.avatar-click{transition:transform .4s cubic-bezier(.22,1,.36,1);cursor:pointer}.avatar-click:active{transform:rotate(90deg)}
.avatar-open{animation:avatarFlip .5s cubic-bezier(.22,1,.36,1) both}
@keyframes avatarFlip{0%{transform:rotate(0) scale(1)}50%{transform:rotate(90deg) scale(1.05)}100%{transform:rotate(0) scale(1)}}
.toast-success{background:var(--fg)}.toast-error{background:#EF4444}
[data-theme="dark"]{--bg:#0F172A;--bg2:#1E293B;--bg3:#334155;--fg:#F1F5F9;--fg2:#94A3B8;--border:#334155;--hover:rgba(59,130,246,.08);--card:#1E293B;--hdr:linear-gradient(135deg,#0F172A 0%,#1E293B 50%,#0F172A 100%);--shadow:0 4px 12px rgba(0,0,0,.4);--shadow-lg:0 12px 40px rgba(0,0,0,.5)}
[data-theme="light"]{--bg:#FFFFFF;--bg2:#F8FAFC;--bg3:#F1F5F9;--fg:#1E293B;--fg2:#64748B;--border:#E8ECEF;--hover:#F8FAFC;--card:#FFFFFF;--hdr:linear-gradient(135deg,#0D1B2A,#1B3A5C);--shadow:0 4px 12px rgba(0,0,0,.06);--shadow-lg:0 12px 40px rgba(0,0,0,.1)}
[data-theme="dark"] .ch:hover{box-shadow:0 8px 25px rgba(0,0,0,.35)!important}
[data-theme="dark"] .stat-card:hover{box-shadow:0 12px 30px rgba(0,0,0,.4)!important}
[data-theme="dark"] .toast-success{background:#F1F5F9;color:#0F172A}
[data-theme="dark"] .modal-overlay{background:rgba(0,0,0,.7)}
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
  if(!editing)return <span onClick={()=>setEditing(true)} style={{cursor:"text",padding:"2px 4px",borderRadius:4,minWidth:40,display:"inline-flex",alignItems:"center",gap:4,color:"var(--fg)",transition:"background .15s"}} className="rh"><span>{val||"—"}</span><span style={{opacity:.3,transition:"opacity .2s"}} className="edit-hint">{I.edit(10)}</span></span>;
  return <input ref={ref} value={val} onChange={e=>setVal(e.target.value)} onBlur={()=>{setEditing(false);onChange(val)}} onKeyDown={e=>{if(e.key==="Enter"){setEditing(false);onChange(val)}}} style={{border:"1px solid #3B82F6",borderRadius:4,padding:"2px 4px",fontSize:12,width:140,background:"var(--bg2)",color:"var(--fg)"}}/>;
}

function ConfirmDialog({message,onConfirm,onCancel}){
  return <div className="af modal-overlay" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}} onClick={onCancel}>
    <div className="asc" onClick={e=>e.stopPropagation()} style={{background:"var(--card)",borderRadius:14,padding:20,width:"min(360px,90vw)",border:"1px solid var(--border)",boxShadow:"0 20px 50px rgba(0,0,0,.3)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><div style={{color:"#EF4444"}}>{I.alert(20)}</div><div style={{fontSize:14,fontWeight:700,color:"var(--fg)"}}>Confirm Delete</div></div>
      <p style={{fontSize:12,color:"var(--fg2)",margin:"0 0 16px",lineHeight:1.5}}>{message||"This action cannot be undone. Are you sure?"}</p>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button onClick={onCancel} style={{padding:"8px 16px",borderRadius:8,border:"1px solid var(--border)",background:"transparent",color:"var(--fg2)",fontSize:12,cursor:"pointer",transition:"all .2s"}}>Cancel</button>
        <button onClick={onConfirm} className="btn-pop" style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#EF4444",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Delete</button>
      </div>
    </div>
  </div>;
}

function LeaveRequestModal({user,onSave,onClose,isAdmin,leaves,userRoles,holidays,initialType}){
  const[step,setStep]=useState(initialType?2:1);const[vals,setVals]=useState({duration:"full",leave_type:initialType||"",person:user?.user_metadata?.full_name||""});const[err,setErr]=useState("");
  const set=(k,v)=>setVals(p=>({...p,[k]:v}));
  const empTypes=[{id:"annual",l:"Annual",sub:"14/yr"},{id:"sick",l:"Sick",sub:"8/yr"},{id:"casual",l:"Casual",sub:"1/mo"}];
  const adminExtra=[{id:"other",l:"Other",sub:""}];
  const halfDayTypes=[{id:"annual",l:"Annual",sub:"14/yr"},{id:"casual",l:"Casual",sub:"1/mo"}];
  const getTypes=()=>{
    if(vals.duration==="half")return halfDayTypes;
    return isAdmin?[...empTypes,...adminExtra]:empTypes;
  };
  const types=getTypes();
  const validate1=()=>{if(!vals.leave_type){setErr("Select a leave type");return false}setErr("");return true};
  // Check overlap + holidays
  const getOverlap=()=>{if(!vals.start_date)return{overlap:[],hols:[]};const me=userRoles?.find(r=>r.name===vals.person);const myDept=me?.dept||"";const s=vals.start_date;const e=vals.duration==="half"?s:(vals.end_date||s);const overlap=(leaves||[]).filter(l=>l.status==="approved"&&l.person!==vals.person&&l.start_date<=e&&l.end_date>=s).map(l=>{const ur=userRoles?.find(r=>r.name===l.person);return{name:l.person,dept:ur?.dept||"",sameDept:ur?.dept===myDept}}).filter(o=>o.sameDept);const hols=(holidays||[]).filter(h=>h.d>=s&&h.d<=e);return{overlap,hols}};
  const validate2=()=>{const todayStr=new Date().toISOString().split('T')[0];if(!vals.person?.trim()){setErr("Name is required");return false}if(!vals.start_date){setErr("Select a date");return false}if(vals.start_date<todayStr){setErr("Cannot book leave starting in the past");return false}if(vals.duration==="full"&&!vals.end_date){setErr("Select end date");return false}if(vals.duration==="full"&&vals.end_date<vals.start_date){setErr("End date must be after start date");return false}setErr("");return true};
  return <div className="af modal-overlay" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}} onClick={onClose}>
    <div className="asc" onClick={e=>e.stopPropagation()} style={{background:"var(--card)",borderRadius:16,width:"min(440px,95vw)",padding:20,boxShadow:"0 25px 60px rgba(0,0,0,.3)",border:"1px solid var(--border)"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><h3 style={{margin:0,fontSize:16,fontWeight:800,color:"var(--fg)"}}>Request Leave</h3><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"var(--fg2)"}}>{I.x(16)}</button></div>
      <div style={{display:"flex",gap:4,marginBottom:16}}>{[1,2].map(s=><div key={s} style={{flex:1,height:3,borderRadius:2,background:s<=step?"#3B82F6":"var(--bg3)",transition:"background .3s"}}/>)}</div>
      {err&&<div className="asd" style={{background:"#FEE2E2",color:"#DC2626",padding:"8px 12px",borderRadius:8,fontSize:11,fontWeight:600,marginBottom:12,display:"flex",alignItems:"center",gap:6}}>{I.alert(12)} {err}</div>}

      {step===1&&<div className="af">
        <label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:8}}>Duration <span style={{color:"#EF4444"}}>*</span></label>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
          {[{id:"full",l:"Full Day(s)",desc:"One or more complete days"},{id:"half",l:"Half Day",desc:"Morning or afternoon only"}].map(d=><div key={d.id} onClick={()=>{set("duration",d.id);set("leave_type","")}} className="ch" style={{padding:14,borderRadius:10,border:vals.duration===d.id?"2px solid #3B82F6":"1px solid var(--border)",background:vals.duration===d.id?"rgba(59,130,246,.06)":"var(--bg2)",cursor:"pointer",textAlign:"center",transition:"all .2s"}}>
            <div style={{fontSize:13,fontWeight:700,color:vals.duration===d.id?"#3B82F6":"var(--fg)"}}>{d.l}</div>
            <div style={{fontSize:9,color:"var(--fg2)",marginTop:2}}>{d.desc}</div>
          </div>)}
        </div>
        <label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:8}}>Leave Type <span style={{color:"#EF4444"}}>*</span></label>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
          {types.map(t=><div key={t.id} onClick={()=>set("leave_type",t.id)} className="ch" style={{padding:10,borderRadius:8,border:vals.leave_type===t.id?"2px solid #3B82F6":"1px solid var(--border)",background:vals.leave_type===t.id?"rgba(59,130,246,.06)":"var(--bg2)",cursor:"pointer",textAlign:"center",transition:"all .2s"}}>
            <div style={{fontSize:11,fontWeight:600,color:vals.leave_type===t.id?"#3B82F6":"var(--fg)"}}>{t.l}</div>
            {t.sub&&<div style={{fontSize:8,color:"var(--fg2)"}}>{t.sub}</div>}
          </div>)}
        </div>
        <button onClick={()=>{if(validate1())setStep(2)}} className="btn-pop" style={{width:"100%",padding:10,background:vals.leave_type?"linear-gradient(135deg,#3B82F6,#8B5CF6)":"var(--bg3)",color:vals.leave_type?"#fff":"var(--fg2)",border:"none",borderRadius:8,fontWeight:700,fontSize:13,cursor:vals.leave_type?"pointer":"not-allowed",marginTop:16,transition:"all .3s"}}>Next</button>
      </div>}

      {step===2&&<div className="af">
        <label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Your Name <span style={{color:"#EF4444"}}>*</span></label>
        <input value={vals.person} onChange={e=>set("person",e.target.value)} style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,background:"var(--bg2)",color:"var(--fg)",marginBottom:12,boxSizing:"border-box"}}/>
        <div style={{display:"flex",gap:12,marginBottom:12}}>
          <div style={{flex:1}}><label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>{vals.duration==="half"?"Date":"From"} <span style={{color:"#EF4444"}}>*</span></label>
            <input type="date" min={new Date().toISOString().split('T')[0]} value={vals.start_date||""} onChange={e=>set("start_date",e.target.value)} style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,background:"var(--bg2)",color:"var(--fg)",boxSizing:"border-box"}}/></div>
          {vals.duration==="full"&&<div style={{flex:1}}><label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>To <span style={{color:"#EF4444"}}>*</span></label>
            <input type="date" min={vals.start_date||new Date().toISOString().split('T')[0]} value={vals.end_date||""} onChange={e=>set("end_date",e.target.value)} style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,background:"var(--bg2)",color:"var(--fg)",boxSizing:"border-box"}}/></div>}
        </div>
        <div style={{background:"var(--bg2)",borderRadius:8,padding:10,marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:vals.leave_type==="annual"?"#3B82F6":vals.leave_type==="sick"?"#EF4444":"#F59E0B"}}/>
          <span style={{fontSize:11,color:"var(--fg)",fontWeight:600,textTransform:"capitalize"}}>{vals.leave_type}</span>
          <span style={{fontSize:10,color:"var(--fg2)"}}>· {vals.duration==="half"?"Half day":"Full day(s)"}</span>
        </div>
        <label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Reason</label>
        <input value={vals.reason||""} onChange={e=>set("reason",e.target.value)} placeholder="Optional" style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,background:"var(--bg2)",color:"var(--fg)",marginBottom:12,boxSizing:"border-box"}}/>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setStep(1);setErr("")}} style={{flex:1,padding:10,border:"1px solid var(--border)",borderRadius:8,background:"transparent",color:"var(--fg2)",fontWeight:600,fontSize:12,cursor:"pointer"}}>Back</button>
          <button onClick={()=>{if(validate2())onSave({...vals,half_day:vals.duration==="half"?"Yes":"No"})}} className="btn-pop" style={{flex:2,padding:10,background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",borderRadius:8,fontWeight:700,fontSize:13,cursor:"pointer"}}>Submit Request</button>
        </div>
        {/* Overlap + holiday warnings */}
        {(()=>{const{overlap,hols}=getOverlap();return <>
          {overlap.length>0&&<div style={{marginTop:10,padding:8,background:"#FEF3C720",borderRadius:8,border:"1px solid #FDE68A50",fontSize:10}}>
            <span style={{fontWeight:700,color:"#D97706"}}>Overlap warning:</span> {overlap.map(o=>o.name.split(" ")[0]).join(", ")} from your dept {overlap.length===1?"is":"are"} also off on these dates.
          </div>}
          {hols.length>0&&<div style={{marginTop:6,padding:8,background:"#DBEAFE50",borderRadius:8,border:"1px solid #93C5FD50",fontSize:10}}>
            <span style={{fontWeight:700,color:"#1D4ED8"}}>Public holiday{hols.length>1?"s":""}:</span> {hols.map(h=>h.l+" ("+h.d.slice(5)+")").join(", ")}
          </div>}
        </>})()}
      </div>}
    </div>
  </div>;
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

// Guided Add Task — picks dept → auto-routes to Asana/Linear → pick board/project
function SmartAddTask({onSave,onClose}){
  const DEPT_SRC={Marketing:"asana",Design:"asana",PMO:"linear",Leadership:"linear","AI/Science":"linear",Development:"linear"};
  const[v,setV]=useState({dept:"",priority:"Medium"});
  const[projects,setProjects]=useState({linear:[],asana:[]});
  const[loadingProj,setLoadingProj]=useState(true);
  const[saving,setSaving]=useState(false);
  const[err,setErr]=useState("");
  useEffect(()=>{fetch('/api/list-projects').then(r=>r.json()).then(d=>{setProjects({linear:d.linear||[],asana:d.asana||[]});setLoadingProj(false)}).catch(()=>setLoadingProj(false))},[]);
  const set=(k,val)=>setV(p=>({...p,[k]:val}));
  const src=v.dept?DEPT_SRC[v.dept]:null;
  const projList=src==="asana"?projects.asana:src==="linear"?projects.linear:[];
  const submit=async()=>{
    if(!v.name?.trim()){setErr("Task name required");return}
    if(!v.dept){setErr("Pick a department");return}
    if(!v.projectId){setErr("Pick a "+(src==="asana"?"board":"project"));return}
    setErr("");setSaving(true);
    await onSave({...v,source:src});
    setSaving(false);
  };
  return <div className="af modal-overlay" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}} onClick={onClose}>
    <div className="asc" onClick={e=>e.stopPropagation()} style={{background:"var(--card)",borderRadius:16,width:"min(460px,95vw)",padding:20,boxShadow:"0 25px 60px rgba(0,0,0,.3)",border:"1px solid var(--border)"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}><h3 style={{margin:0,fontSize:16,fontWeight:800,color:"var(--fg)"}}>Add Task</h3><button onClick={onClose} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"var(--fg2)"}}>✕</button></div>
      {err&&<div style={{background:"#FEE2E2",color:"#DC2626",padding:"8px 12px",borderRadius:8,fontSize:11,fontWeight:600,marginBottom:12}}>{err}</div>}
      <label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Task Name *</label>
      <input value={v.name||""} onChange={e=>set("name",e.target.value)} placeholder="e.g. Landing page hero section" style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,boxSizing:"border-box",background:"var(--bg2)",color:"var(--fg)",marginBottom:12}}/>

      <label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Department *</label>
      <select value={v.dept} onChange={e=>{set("dept",e.target.value);set("projectId","")}} style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,background:"var(--bg2)",color:"var(--fg)",marginBottom:8}}>
        <option value="">Select department...</option>
        {Object.keys(DEPT_SRC).map(d=><option key={d} value={d}>{d}</option>)}
      </select>

      {/* Source indicator */}
      {src&&<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12,padding:"6px 10px",borderRadius:8,background:src==="asana"?"#F472B610":"#6366F110"}}>
        <span style={{fontSize:10,color:"var(--fg2)"}}>This task will be created in</span>
        <span style={{fontSize:11,fontWeight:700,color:src==="asana"?"#EC4899":"#6366F1"}}>{src==="asana"?"Asana":"Linear"}</span>
      </div>}

      {/* Project/Board picker */}
      {src&&<>
        <label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>{src==="asana"?"Asana Board":"Linear Project"} *</label>
        {loadingProj?<div style={{fontSize:11,color:"var(--fg2)",padding:8}}>Loading {src==="asana"?"boards":"projects"}...</div>
        :<select value={v.projectId||""} onChange={e=>set("projectId",e.target.value)} style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,background:"var(--bg2)",color:"var(--fg)",marginBottom:12}}>
          <option value="">Select {src==="asana"?"board":"project"}...</option>
          {projList.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>}
      </>}

      <div style={{display:"flex",gap:10,marginBottom:12}}>
        <div style={{flex:1}}><label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Owner</label>
          <input value={v.owner||""} onChange={e=>set("owner",e.target.value)} placeholder="Name" style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,boxSizing:"border-box",background:"var(--bg2)",color:"var(--fg)"}}/></div>
        <div style={{flex:1}}><label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Priority</label>
          <select value={v.priority} onChange={e=>set("priority",e.target.value)} style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,background:"var(--bg2)",color:"var(--fg)"}}>{["Low","Medium","High"].map(p=><option key={p}>{p}</option>)}</select></div>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:16}}>
        <div style={{flex:1}}><label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Start</label>
          <input type="date" value={v.start_date||""} onChange={e=>set("start_date",e.target.value)} style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,boxSizing:"border-box",background:"var(--bg2)",color:"var(--fg)"}}/></div>
        <div style={{flex:1}}><label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Due Date</label>
          <input type="date" value={v.end_date||""} onChange={e=>set("end_date",e.target.value)} style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,boxSizing:"border-box",background:"var(--bg2)",color:"var(--fg)"}}/></div>
      </div>
      <button onClick={submit} disabled={saving} className="btn-pop" style={{width:"100%",padding:10,background:saving?"var(--bg3)":"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:saving?"var(--fg2)":"#fff",border:"none",borderRadius:8,fontWeight:700,fontSize:13,cursor:saving?"wait":"pointer"}}>{saving?"Creating...":"Create Task"}</button>
    </div>
  </div>;
}

// Onboarding / Offboarding modal — tabbed, dynamic, dept-aware, interlinked
function OnboardModal({initialMode,userRoles,onboarding,onboardCommon,onboardDept,offboardTemplate,onGenerate,onClose}){
  const[mode,setMode]=useState(initialMode||"onboarding");
  const[name,setName]=useState("");
  const[dept,setDept]=useState("");
  const[selPerson,setSelPerson]=useState("");
  const[custom,setCustom]=useState([]);
  const[newItem,setNewItem]=useState("");
  const[newCat,setNewCat]=useState("general");
  const[generating,setGenerating]=useState(false);
  const depts=["Development","AI/Science","Design","Marketing","PMO","Leadership"];
  // People already onboarded or in roster (for offboarding dropdown) — exclude already-offboarding
  const offboardingNames=new Set(onboarding.filter(o=>o.person?.includes("(offboarding)")).map(o=>o.person.replace(" (offboarding)","")));
  const activePeople=userRoles.filter(r=>r.name&&r.name!=="Efehan Maleri"&&!offboardingNames.has(r.name));
  const selPersonDept=userRoles.find(r=>r.name===selPerson)?.dept||"";

  // Build preview items
  const onboardPreview=dept?[...onboardCommon,...(onboardDept[dept]||onboardDept['Development'])]:onboardCommon;
  const theirGrants=selPerson?onboarding.filter(o=>o.person===selPerson&&(o.category==="accounts"||o.category==="tools")):[];
  const offboardPreview=[...offboardTemplate,...theirGrants.map(o=>({item:"Revoke: "+o.item,category:"accounts",assigned_to:o.assigned_to}))];

  const addCustom=()=>{if(!newItem.trim())return;setCustom(p=>[...p,{item:newItem.trim(),category:newCat,assigned_to:"Nil Ozdamar"}]);setNewItem("")};
  const removeCustom=i=>setCustom(p=>p.filter((_,idx)=>idx!==i));

  const submit=async()=>{
    if(mode==="onboarding"){if(!name.trim()||!dept){return}setGenerating(true);await onGenerate(name.trim(),dept,false,custom)}
    else{if(!selPerson){return}setGenerating(true);await onGenerate(selPerson,selPersonDept,true,custom)}
    setGenerating(false);
  };

  const catColors={accounts:"#3B82F6",documents:"#F59E0B",orientation:"#10B981",tools:"#8B5CF6",general:"#64748B"};
  const previewItems=mode==="onboarding"?[...onboardPreview,...custom]:[...offboardPreview,...custom];
  const canSubmit=mode==="onboarding"?(name.trim()&&dept):selPerson;

  return <div className="af modal-overlay" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}} onClick={onClose}>
    <div className="asc" onClick={e=>e.stopPropagation()} style={{background:"var(--card)",borderRadius:16,width:"min(520px,95vw)",maxHeight:"88vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 25px 60px rgba(0,0,0,.3)",border:"1px solid var(--border)"}}>
      {/* Header + tabs */}
      <div style={{padding:"18px 20px 0",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}><h3 style={{margin:0,fontSize:16,fontWeight:800,color:"var(--fg)"}}>{mode==="onboarding"?"Onboard New Hire":"Offboard Team Member"}</h3><button onClick={onClose} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"var(--fg2)"}}>✕</button></div>
        <div style={{display:"flex",gap:4,background:"var(--bg3)",borderRadius:10,padding:3,marginBottom:16}}>
          <button onClick={()=>setMode("onboarding")} style={{flex:1,padding:"8px",borderRadius:7,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",background:mode==="onboarding"?"#3B82F6":"transparent",color:mode==="onboarding"?"#fff":"var(--fg2)",transition:"all .2s"}}>Onboarding</button>
          <button onClick={()=>setMode("offboarding")} style={{flex:1,padding:"8px",borderRadius:7,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",background:mode==="offboarding"?"#EF4444":"transparent",color:mode==="offboarding"?"#fff":"var(--fg2)",transition:"all .2s"}}>Offboarding</button>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{flex:1,overflowY:"auto",padding:"0 20px 16px"}}>
        {mode==="onboarding"?<>
          <label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>New Hire's Full Name *</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Ayşe Yılmaz" style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,boxSizing:"border-box",background:"var(--bg2)",color:"var(--fg)",marginBottom:12}}/>
          <label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Department *</label>
          <select value={dept} onChange={e=>setDept(e.target.value)} style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,background:"var(--bg2)",color:"var(--fg)",marginBottom:12}}>
            <option value="">Select department...</option>
            {depts.map(d=><option key={d} value={d}>{d}</option>)}
          </select>
        </>:<>
          <label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Select Team Member *</label>
          <select value={selPerson} onChange={e=>setSelPerson(e.target.value)} style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,background:"var(--bg2)",color:"var(--fg)",marginBottom:12}}>
            <option value="">Select person to offboard...</option>
            {activePeople.map(p=><option key={p.id} value={p.name}>{p.name} — {p.dept}</option>)}
          </select>
          {selPerson&&theirGrants.length>0&&<div style={{fontSize:10,color:"#10B981",marginBottom:12,padding:"6px 10px",background:"#10B98110",borderRadius:8}}>Found {theirGrants.length} access grants from {selPerson.split(" ")[0]}'s onboarding — revocation steps added automatically.</div>}
          {selPerson&&theirGrants.length===0&&<div style={{fontSize:10,color:"#F59E0B",marginBottom:12,padding:"6px 10px",background:"#F59E0B10",borderRadius:8}}>No onboarding record found — using standard offboarding checklist.</div>}
        </>}

        {/* Preview */}
        {canSubmit&&<div style={{marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--fg)",marginBottom:6}}>Checklist Preview ({previewItems.length} items)</div>
          <div style={{maxHeight:180,overflowY:"auto",background:"var(--bg2)",borderRadius:8,padding:8}}>
            {previewItems.map((it,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 0",fontSize:10,color:"var(--fg)"}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:catColors[it.category]||"#64748B",flexShrink:0}}/>
              <span style={{flex:1}}>{it.item}</span>
              <span style={{fontSize:8,color:"var(--fg2)"}}>{it.assigned_to?.split(" ")[0]}</span>
            </div>)}
          </div>
        </div>}

        {/* Add custom item */}
        {canSubmit&&<div style={{marginBottom:8}}>
          <div style={{fontSize:11,fontWeight:600,color:"var(--fg2)",marginBottom:4}}>Add custom step</div>
          <div style={{display:"flex",gap:6}}>
            <input value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addCustom()}} placeholder="e.g. Issue laptop" style={{flex:1,padding:6,border:"1px solid var(--border)",borderRadius:6,fontSize:11,background:"var(--bg2)",color:"var(--fg)"}}/>
            <select value={newCat} onChange={e=>setNewCat(e.target.value)} style={{padding:6,border:"1px solid var(--border)",borderRadius:6,fontSize:10,background:"var(--bg2)",color:"var(--fg)"}}>{["accounts","documents","orientation","tools","general"].map(c=><option key={c}>{c}</option>)}</select>
            <button onClick={addCustom} className="btn-pop" style={{padding:"6px 12px",borderRadius:6,border:"none",background:"var(--fg)",color:"var(--bg)",fontSize:11,fontWeight:700,cursor:"pointer"}}>Add</button>
          </div>
          {custom.length>0&&<div style={{marginTop:6,display:"flex",flexWrap:"wrap",gap:4}}>{custom.map((c,i)=><span key={i} style={{fontSize:9,padding:"2px 8px",borderRadius:99,background:"var(--bg3)",color:"var(--fg)",display:"inline-flex",alignItems:"center",gap:4}}>{c.item}<span onClick={()=>removeCustom(i)} style={{cursor:"pointer",color:"#EF4444",fontWeight:700}}>✕</span></span>)}</div>}
        </div>}
      </div>

      {/* Footer */}
      <div style={{padding:"12px 20px",borderTop:"1px solid var(--border)",flexShrink:0}}>
        <button onClick={submit} disabled={!canSubmit||generating} className="btn-pop" style={{width:"100%",padding:10,background:!canSubmit?"var(--bg3)":mode==="onboarding"?"linear-gradient(135deg,#3B82F6,#8B5CF6)":"linear-gradient(135deg,#EF4444,#F97316)",color:!canSubmit?"var(--fg2)":"#fff",border:"none",borderRadius:8,fontWeight:700,fontSize:13,cursor:canSubmit&&!generating?"pointer":"not-allowed"}}>{generating?"Creating...":mode==="onboarding"?"Generate Onboarding Checklist":"Generate Offboarding Checklist"}</button>
      </div>
    </div>
  </div>;
}

// Notification bell — pending leaves + active risks + decisions
function NotificationBell({leaves,risks,decisions,isApprover,onNavigate}){
  const[open,setOpen]=useState(false);
  const pendingLeaves=isApprover?leaves.filter(l=>l.status==="pending"):[];
  const activeRisks=risks.filter(r=>r.status==="ACTIVE"&&(r.impact==="HIGH"||r.impact==="CRITICAL"));
  const openDecisions=decisions.filter(d=>d.status==="open"&&(d.priority==="high"||d.priority==="critical"));
  const total=pendingLeaves.length+activeRisks.length+openDecisions.length;

  return <div style={{position:"relative"}}>
    <button onClick={()=>setOpen(!open)} style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.15)",borderRadius:8,padding:"6px 10px",cursor:"pointer",color:"#94A3B8",position:"relative",display:"flex",alignItems:"center"}}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
      {total>0&&<span style={{position:"absolute",top:-4,right:-4,minWidth:16,height:16,background:"#EF4444",color:"#fff",borderRadius:99,fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px"}}>{total}</span>}
    </button>
    {open&&<>
      <div style={{position:"fixed",inset:0,zIndex:9998}} onClick={()=>setOpen(false)}/>
      <div className="asc" style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,minWidth:320,maxWidth:380,maxHeight:480,overflow:"auto",boxShadow:"0 12px 40px rgba(0,0,0,.3)",zIndex:9999}}>
        <div style={{padding:"10px 14px",borderBottom:"1px solid var(--border)",fontSize:12,fontWeight:700,color:"var(--fg)"}}>Notifications {total>0&&`(${total})`}</div>
        {total===0&&<div style={{padding:20,fontSize:11,color:"var(--fg2)",textAlign:"center"}}>All clear — no pending items.</div>}
        {pendingLeaves.length>0&&<div>
          <div style={{padding:"8px 14px",fontSize:9,fontWeight:700,color:"#F59E0B",textTransform:"uppercase",letterSpacing:.5,background:"#FEF3C720"}}>Pending Leave Approvals ({pendingLeaves.length})</div>
          {pendingLeaves.map(l=><div key={l.id} onClick={()=>{onNavigate("leave");setOpen(false)}} className="rh" style={{padding:"8px 14px",borderBottom:"1px solid var(--border)",cursor:"pointer"}}>
            <div style={{fontSize:11,fontWeight:600,color:"var(--fg)"}}>{l.person}</div>
            <div style={{fontSize:9,color:"var(--fg2)"}}>{l.leave_type} · {l.start_date}{l.start_date!==l.end_date?` → ${l.end_date}`:""} · {l.half_day?"0.5":l.days}d</div>
          </div>)}
        </div>}
        {activeRisks.length>0&&<div>
          <div style={{padding:"8px 14px",fontSize:9,fontWeight:700,color:"#EF4444",textTransform:"uppercase",letterSpacing:.5,background:"#FEE2E220"}}>High Risks ({activeRisks.length})</div>
          {activeRisks.slice(0,5).map(r=><div key={r.id} onClick={()=>{onNavigate("vitals");setOpen(false)}} className="rh" style={{padding:"8px 14px",borderBottom:"1px solid var(--border)",cursor:"pointer"}}>
            <div style={{fontSize:11,fontWeight:600,color:"var(--fg)"}}>{r.description}</div>
            <div style={{fontSize:9,color:"var(--fg2)"}}>{r.impact} · Owner: {r.owner||"unassigned"}</div>
          </div>)}
        </div>}
        {openDecisions.length>0&&<div>
          <div style={{padding:"8px 14px",fontSize:9,fontWeight:700,color:"#3B82F6",textTransform:"uppercase",letterSpacing:.5,background:"#DBEAFE40"}}>Open Decisions ({openDecisions.length})</div>
          {openDecisions.slice(0,5).map(d=><div key={d.id} onClick={()=>{onNavigate("dashboard");setOpen(false)}} className="rh" style={{padding:"8px 14px",borderBottom:"1px solid var(--border)",cursor:"pointer"}}>
            <div style={{fontSize:11,fontWeight:600,color:"var(--fg)"}}>{d.title}</div>
            <div style={{fontSize:9,color:"var(--fg2)"}}>{d.priority} · {d.owner||"unassigned"}</div>
          </div>)}
        </div>}
      </div>
    </>}
  </div>;
}

// Full-featured Meeting modal — one-time or recurring, multi-attendee, Fireflies bot
function MeetingModal({userRoles,onSave,onClose}){
  const[v,setV]=useState({type:"One-time",cadence:"Weekly",date:"",time:"10:00",duration:30,attendees:[],description:"",fireflies:true,location:"Google Meet",sendDM:true,channelPost:false});
  const[saving,setSaving]=useState(false);
  const[err,setErr]=useState("");
  const set=(k,val)=>setV(p=>({...p,[k]:val}));
  const durations=[15,30,45,60,90,120];
  const toggleAttendee=email=>setV(p=>({...p,attendees:p.attendees.includes(email)?p.attendees.filter(e=>e!==email):[...p.attendees,email]}));
  const submit=async()=>{
    if(!v.name?.trim()){setErr("Meeting name required");return}
    if(v.type==="One-time"&&!v.date){setErr("Date required for one-time meeting");return}
    if(v.attendees.length===0){setErr("Add at least one attendee");return}
    setErr("");setSaving(true);
    await onSave(v);
    setSaving(false);
  };
  return <div className="af modal-overlay" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}} onClick={onClose}>
    <div className="asc" onClick={e=>e.stopPropagation()} style={{background:"var(--card)",borderRadius:16,width:"min(520px,95vw)",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 25px 60px rgba(0,0,0,.3)",border:"1px solid var(--border)"}}>
      <div style={{padding:"18px 20px 12px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between"}}><h3 style={{margin:0,fontSize:16,fontWeight:800,color:"var(--fg)"}}>Schedule Meeting</h3><button onClick={onClose} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"var(--fg2)"}}>✕</button></div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 20px"}}>
        {err&&<div style={{background:"#FEE2E2",color:"#DC2626",padding:"8px 12px",borderRadius:8,fontSize:11,fontWeight:600,marginBottom:12}}>{err}</div>}

        <label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Meeting Name *</label>
        <input value={v.name||""} onChange={e=>set("name",e.target.value)} placeholder="e.g. Q3 Planning, Design Review" style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,boxSizing:"border-box",background:"var(--bg2)",color:"var(--fg)",marginBottom:12}}/>

        {/* Type toggle */}
        <label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Meeting Type</label>
        <div style={{display:"flex",gap:4,marginBottom:12,background:"var(--bg3)",borderRadius:8,padding:3}}>
          {["One-time","Recurring"].map(t=><button key={t} onClick={()=>set("type",t)} style={{flex:1,padding:"6px",borderRadius:6,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",background:v.type===t?"var(--fg)":"transparent",color:v.type===t?"var(--bg)":"var(--fg2)"}}>{t}</button>)}
        </div>

        {/* Date & Time + Cadence */}
        <div style={{display:"grid",gridTemplateColumns:v.type==="Recurring"?"1fr 1fr":"1fr 1fr 1fr",gap:8,marginBottom:12}}>
          {v.type==="One-time"&&<div><label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Date *</label>
            <input type="date" value={v.date} onChange={e=>set("date",e.target.value)} style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,boxSizing:"border-box",background:"var(--bg2)",color:"var(--fg)"}}/></div>}
          {v.type==="Recurring"&&<div><label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Cadence</label>
            <select value={v.cadence} onChange={e=>set("cadence",e.target.value)} style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,background:"var(--bg2)",color:"var(--fg)"}}>
              {["Daily","Weekly","Bi-weekly","Monthly"].map(c=><option key={c}>{c}</option>)}
            </select></div>}
          <div><label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Time</label>
            <input type="time" value={v.time} onChange={e=>set("time",e.target.value)} style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,boxSizing:"border-box",background:"var(--bg2)",color:"var(--fg)"}}/></div>
          <div><label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Duration</label>
            <select value={v.duration} onChange={e=>set("duration",Number(e.target.value))} style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:12,background:"var(--bg2)",color:"var(--fg)"}}>
              {durations.map(d=><option key={d} value={d}>{d} min</option>)}
            </select></div>
        </div>

        {/* Attendees */}
        <label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Attendees * <span style={{color:"var(--fg2)",fontWeight:400}}>({v.attendees.length} selected)</span></label>
        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8,maxHeight:120,overflowY:"auto",border:"1px solid var(--border)",borderRadius:8,padding:8,background:"var(--bg2)"}}>
          {userRoles.map(u=>{const sel=v.attendees.includes(u.email);return <button key={u.id} onClick={()=>toggleAttendee(u.email)} className="btn-pop" style={{padding:"4px 10px",borderRadius:6,border:sel?"2px solid #3B82F6":"1px solid var(--border)",background:sel?"rgba(59,130,246,.1)":"var(--card)",color:sel?"#3B82F6":"var(--fg2)",fontSize:10,fontWeight:sel?700:500,cursor:"pointer"}}>{u.name?.split(" ")[0]}</button>})}
        </div>

        {/* Fireflies + Location */}
        <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:8}}>
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:11,color:"var(--fg)"}}>
            <input type="checkbox" checked={v.fireflies} onChange={e=>set("fireflies",e.target.checked)} style={{cursor:"pointer"}}/>
            <span>Add Fireflies bot for notes</span>
          </label>
          <div style={{flex:1}}/>
          <select value={v.location} onChange={e=>set("location",e.target.value)} style={{padding:6,border:"1px solid var(--border)",borderRadius:6,fontSize:10,background:"var(--bg2)",color:"var(--fg)"}}>
            {["Google Meet","Zoom","In-person","Other"].map(l=><option key={l}>{l}</option>)}
          </select>
        </div>

        {/* Slack notification options */}
        <div style={{background:"var(--bg2)",borderRadius:8,padding:10,marginBottom:12,display:"flex",flexDirection:"column",gap:8}}>
          <div style={{fontSize:10,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:.5}}>Slack Notifications</div>
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:11,color:"var(--fg)"}}>
            <input type="checkbox" checked={v.sendDM} onChange={e=>set("sendDM",e.target.checked)} style={{cursor:"pointer"}}/>
            <span>Send DM invitation to each attendee ({v.attendees.length} selected)</span>
          </label>
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:11,color:"var(--fg)"}}>
            <input type="checkbox" checked={v.channelPost} onChange={e=>set("channelPost",e.target.checked)} style={{cursor:"pointer"}}/>
            <span>Announce in #pmo channel</span>
          </label>
        </div>

        {/* Description */}
        <label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Description / Agenda</label>
        <textarea value={v.description} onChange={e=>set("description",e.target.value)} placeholder="What's this meeting about?" rows={3} style={{width:"100%",padding:8,border:"1px solid var(--border)",borderRadius:8,fontSize:11,boxSizing:"border-box",background:"var(--bg2)",color:"var(--fg)",resize:"vertical",fontFamily:"inherit"}}/>
      </div>
      <div style={{padding:"12px 20px",borderTop:"1px solid var(--border)",flexShrink:0}}>
        <button onClick={submit} disabled={saving} className="btn-pop" style={{width:"100%",padding:10,background:saving?"var(--bg3)":"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:saving?"var(--fg2)":"#fff",border:"none",borderRadius:8,fontWeight:700,fontSize:13,cursor:saving?"wait":"pointer"}}>{saving?"Creating...":"Schedule & Send Invites"}</button>
        <div style={{fontSize:9,color:"var(--fg2)",marginTop:6,textAlign:"center"}}>Opens Google Calendar pre-filled with attendees{v.fireflies?" + Fireflies bot":""} — click Save there to send calendar invites{v.sendDM?". Slack DMs go out instantly.":"."}</div>
      </div>
    </div>
  </div>;
}

function TicketPopup({task,tasks,onClose,onUpdate,onDelete,setConfirmDlg}){
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
      {/* Linked source + progress */}
      {(task.linked_project||task.linked_task_url)&&<div style={{padding:"0 24px 16px"}}>
        <div style={{fontSize:10,fontWeight:600,color:"var(--fg2)",marginBottom:6}}>Linked Source</div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <Bdg bg={task.linked_source==="asana"?"#F472B615":"#6366F115"} c={task.linked_source==="asana"?"#EC4899":"#6366F1"}>{task.linked_source==="asana"?"Asana":"Linear"}</Bdg>
          {task.progress>0&&<Bdg bg="#DBEAFE" c="#1D4ED8">{task.progress}% complete</Bdg>}
          <a href={task.linked_task_url||("https://linear.app/attimo/project/"+(task.linked_project||""))} target="_blank" rel="noopener" style={{fontSize:11,color:"#3B82F6",fontWeight:600,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:4}}>{I.zap(10)} Open in {task.linked_source==="asana"?"Asana":"Linear"}</a>
        </div>
        {task.progress>0&&<div style={{height:4,background:"var(--bg3)",borderRadius:2,overflow:"hidden",marginTop:8}}><div className="bar-g" style={{height:"100%",width:task.progress+"%",borderRadius:2,background:task.progress>=80?"#10B981":task.progress>=50?"#F59E0B":"#3B82F6"}}/></div>}
      </div>}
      {!(task.linked_project||task.linked_task_url)&&<div style={{padding:"0 24px 12px"}}><Bdg bg="var(--bg3)" c="var(--fg2)">Manual — not linked to Linear/Asana</Bdg></div>}
      <div style={{padding:"0 24px 16px"}}><div style={{fontSize:10,fontWeight:600,color:"var(--fg2)",marginBottom:4}}>Risk</div><div style={{display:"flex",gap:6}}>{RSK_OPT.map(r=>{const rc2=RC[r];return <button key={r} onClick={()=>onUpdate(task.id,{risk:r})} style={{padding:"4px 12px",borderRadius:99,border:task.risk===r?"2px solid "+rc2.c:"1px solid var(--border)",background:rc2.bg,color:rc2.c,fontSize:11,fontWeight:700,cursor:"pointer",transition:"all .15s"}}>{r}</button>})}</div></div>
      {depN.length>0&&<div style={{padding:"0 24px 12px"}}><div style={{fontSize:10,fontWeight:600,color:"var(--fg2)"}}>Depends On</div>{depN.map((n,i)=><div key={i} style={{fontSize:12,color:"#6366F1",padding:"2px 0"}}>→ {n}</div>)}</div>}
      {blocks.length>0&&<div style={{padding:"0 24px 12px"}}><div style={{fontSize:10,fontWeight:600,color:"var(--fg2)"}}>Blocks</div>{blocks.map((n,i)=><div key={i} style={{fontSize:12,color:"#DC2626",padding:"2px 0"}}>← {n}</div>)}</div>}
      <div style={{padding:"0 24px 20px"}}><button onClick={()=>setConfirmDlg({msg:"Delete this task? This cannot be undone.",fn:()=>{onDelete(task.id);onClose()}})} style={{background:"#FEE2E2",color:"#DC2626",border:"none",padding:"6px 14px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6,transition:"all .2s"}} className="btn-pop">{I.trash(12)} Delete Task</button></div>
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
  const[month,setMonth]=useState(()=>{const n=new Date();return new Date(n.getFullYear(),n.getMonth(),1)});
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
  const[tasks,setTasks]=useState([]);const[raci,setRaci]=useState([]);const[risks,setRisks]=useState([]);const[kpis,setKpis]=useState([]);const[meetings,setMeetings]=useState([]);const[roles,setRoles]=useState([]);const[standups,setStandups]=useState([]);const[perf,setPerf]=useState([]);const[leaves,setLeaves]=useState([]);const[decisions,setDecisions]=useState([]);const[onboarding,setOnboarding]=useState([]);const[hrDocs,setHrDocs]=useState([]);
  // Public holidays — fetched from Google Calendar API, hardcoded fallback
  const HOLIDAYS_FALLBACK=[
    {d:"2026-01-01",l:"New Year's Day",c:"TR"},
    {d:"2026-02-05",l:"Kashmir Day",c:"PK"},
    {d:"2026-03-20",l:"Ramazan Bayramı Day 1",c:"TR"},{d:"2026-03-21",l:"Eid-ul-Fitr Day 1",c:"PK,TR"},{d:"2026-03-22",l:"Eid-ul-Fitr Day 2",c:"PK,TR"},{d:"2026-03-23",l:"Pakistan Day / Eid-ul-Fitr Day 3",c:"PK"},
    {d:"2026-04-23",l:"National Sovereignty & Children's Day",c:"TR"},
    {d:"2026-05-01",l:"Labour Day",c:"PK,TR"},
    {d:"2026-05-19",l:"Commemoration of Atatürk / Youth Day",c:"TR"},
    {d:"2026-05-26",l:"Hajj Day",c:"PK"},
    {d:"2026-05-27",l:"Eid-ul-Adha Day 1",c:"PK,TR"},{d:"2026-05-28",l:"Eid-ul-Adha Day 2",c:"PK,TR"},{d:"2026-05-29",l:"Eid-ul-Adha Day 3",c:"PK"},{d:"2026-05-30",l:"Kurban Bayramı Day 4",c:"TR"},
    {d:"2026-06-24",l:"9 Muharram",c:"PK"},{d:"2026-06-25",l:"Ashura",c:"PK"},
    {d:"2026-07-15",l:"Democracy & National Unity Day",c:"TR"},
    {d:"2026-08-14",l:"Independence Day",c:"PK"},
    {d:"2026-08-25",l:"Eid Milad-un-Nabi",c:"PK,TR"},
    {d:"2026-08-30",l:"Victory Day",c:"TR"},
    {d:"2026-10-29",l:"Republic Day",c:"TR"},
    {d:"2026-11-09",l:"Iqbal Day",c:"PK"},
    {d:"2026-12-25",l:"Quaid-e-Azam Day",c:"PK"},
  ];
  const[publicHolidays,setPublicHolidays]=useState(HOLIDAYS_FALLBACK);const[holidaySource,setHolidaySource]=useState("fallback");
  const[config,setConfig]=useState({cash_on_hand:0,monthly_burn:0,currency:"USD",launch_date:"2026-06-10",pitch_day:"2026-07-01"});
  const[metricsData,setMetricsData]=useState(null);
  const[driveFolders,setDriveFolders]=useState([]);
  const[leaveBalances,setLeaveBalances]=useState([]);
  const[leaveTypes,setLeaveTypes]=useState([]);
  useEffect(()=>{
    const yr=new Date().getFullYear();
    supabase.from('leave_balances').select('*').eq('year',yr).then(({data,error})=>{if(error)console.warn('leave_balances:',error.message);else if(data)setLeaveBalances(data)});
    supabase.from('leave_types').select('*').order('sort_order').then(({data,error})=>{if(error)console.warn('leave_types:',error.message);else if(data)setLeaveTypes(data)});
    // Realtime: refresh balances when leaves change
    const ch=supabase.channel('leave-balances').on('postgres_changes',{event:'*',schema:'public',table:'leave_balances'},()=>{
      supabase.from('leave_balances').select('*').eq('year',new Date().getFullYear()).then(({data})=>{if(data)setLeaveBalances(data)});
    }).subscribe();
    return()=>{supabase.removeChannel(ch)};
  },[]);
  useEffect(()=>{supabase.from('config').select('*').then(({data})=>{if(data){const m={};data.forEach(r=>m[r.key]=r.value);setConfig(p=>({...p,...m}))}});supabase.from('metrics').select('*').order('computed_at',{ascending:false}).then(({data})=>{if(data&&data.length>0){const latest={};data.forEach(r=>{if(!latest[r.dept])latest[r.dept]=r});setMetricsData(latest)}});supabase.from('drive_folders').select('*').order('sort_order').then(({data})=>{if(data)setDriveFolders(data)})},[]);
  useEffect(()=>{fetch('/api/holidays').then(r=>r.json()).then(d=>{if(d.holidays?.length>0){setPublicHolidays(d.holidays);setHolidaySource(d.source)}}).catch(()=>{})},[]);
  const[view,setView]=useState("dashboard");const[sel,setSel]=useState(null);const[syncing,setSyncing]=useState(false);const[loading,setLoading]=useState(true);const[addModal,setAddModal]=useState(null);const[onboardModal,setOnboardModal]=useState(null);const[onboardTab,setOnboardTab]=useState("onboarding");const[deptFilter,setDeptFilter]=useState("all");const[meetFilter,setMeetFilter]=useState("all");const[ganttMode,setGanttMode]=useState("company");const[deptTasks,setDeptTasks]=useState(null);const[deptLoading,setDeptLoading]=useState(false);const[dvm,setDvm]=useState("list");const[lastSync,setLastSync]=useState("");
  const[dark,setDark]=useState(false);const[dragId,setDragId]=useState(null);const[statusFilter,setStatusFilter]=useState("all");const[userMenu,setUserMenu]=useState(false);const[profileTab,setProfileTab]=useState("overview");const[confirmDlg,setConfirmDlg]=useState(null);const[perfMetrics,setPerfMetrics]=useState(null);const[perfLoading,setPerfLoading]=useState(false);const[leavePreFill,setLeavePreFill]=useState(null);const[slotFinder,setSlotFinder]=useState(null);const[slotAttendees,setSlotAttendees]=useState([]);const[slotLoading,setSlotLoading]=useState(false);const[newSlackMembers,setNewSlackMembers]=useState([]);const[meetingNotes,setMeetingNotes]=useState(null);const[notesLoading,setNotesLoading]=useState(false);
  const[user,setUser]=useState(null);const[role,setRole]=useState(null);const[authLoading,setAuthLoading]=useState(true);const[userRoles,setUserRoles]=useState([]);
  const[toast,setToast]=useState("");const[personFilter,setPersonFilter]=useState("all");const[editMyName,setEditMyName]=useState(false);const[myNameVal,setMyNameVal]=useState("");const[showHoursModal,setShowHoursModal]=useState(false);const[hoursForm,setHoursForm]=useState({tz:"",start:"",end:""});const[slackStatus,setSlackStatus]=useState({});const[slackLoading,setSlackLoading]=useState(false);const[profileCard,setProfileCard]=useState(null);
  const[effectivePerms,setEffectivePerms]=useState(null);const[platformRole,setPlatformRole]=useState(null);const[settingsTab,setSettingsTab]=useState("team");const[docsTab,setDocsTab]=useState("knowledge");

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
        const last=name.split(' ').slice(1).join(' ');
        return map['e:'+email]||map['n:'+name]||map['f:'+first]||(last?map['f:'+last]:null)||null;
      };
      map._allUsers=users;
      setSlackStatus(map);
      // Auto-save avatars to DB — try EVERY matching strategy
      const avatarUpdates={};
      const norm2=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[ışçğöü]/g,c=>({'ı':'i','ş':'s','ç':'c','ğ':'g','ö':'o','ü':'u'})[c]||c).trim();
      for(const u of users){
        if(!u.avatar)continue;
        // Try 5 matching strategies
        const match=
          userRoles.find(r=>r.email&&u.email&&r.email.toLowerCase()===u.email.toLowerCase()) // exact email
          ||userRoles.find(r=>norm2(r.name)===norm2(u.name)) // exact name (normalized)
          ||userRoles.find(r=>u.name&&norm2(r.name).split(' ')[0]===norm2(u.name).split(' ')[0]) // first name
          ||userRoles.find(r=>u.name&&norm2(u.name).includes(norm2(r.name).split(' ')[0])&&norm2(r.name).split(' ')[0].length>2) // partial first name >2 chars
          ||userRoles.find(r=>u.email&&r.email&&u.email.split('@')[0]===r.email.split('@')[0]); // email prefix
        if(match){avatarUpdates[match.id]=u.avatar;if(match.avatar_url!==u.avatar)supabase.from('user_roles').update({avatar_url:u.avatar}).eq('id',match.id)}
      }
      if(Object.keys(avatarUpdates).length>0)setUserRoles(p=>p.map(r=>avatarUpdates[r.id]?{...r,avatar_url:avatarUpdates[r.id]}:r));
      setSlackStatus(map);
      // Detect new Slack members not in user_roles
      if(userRoles.length>0){const knownEmails=userRoles.map(r=>r.email?.toLowerCase());const newMembers=users.filter(u=>u.email&&!knownEmails.includes(u.email.toLowerCase())&&!u.email.includes('bot')&&!u.email.includes('slackbot'));if(newMembers.length>0)setNewSlackMembers(newMembers)}
      showToast("Slack status refreshed")
    }catch{}setSlackLoading(false);
  },[userRoles]);

  // Performance auto-fetch on tab open
  const[vitalsTab,setVitalsTab]=useState("overview");
  useEffect(()=>{if(((view==="perf")||(view==="vitals"&&vitalsTab==="people"))&&!perfMetrics&&!perfLoading){setPerfLoading(true);fetch('/api/performance').then(r=>r.json()).then(d=>{setPerfMetrics(d);setPerfLoading(false)}).catch(()=>setPerfLoading(false))}},[view,vitalsTab]);
  useEffect(()=>{try{const v=localStorage.getItem('attimo_view');const ok=["dashboard","vitals","timeline","board","calendar","standup","meet","leave","onboard","hrdocs","settings"];if(v&&ok.includes(v))setView(v)}catch{}},[]);
  useEffect(()=>{try{localStorage.setItem('attimo_view',view)}catch{}},[view]);
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
    const{data}=await supabase.from('user_roles').select('role,platform_role').eq('email',email).single();
    setRole(data?.role||null);setPlatformRole(data?.platform_role||null);
    const{data:perms}=await supabase.rpc('get_effective_permissions',{p_email:email});
    if(perms)setEffectivePerms(perms);
    setAuthLoading(false);
  };
  const canSeeTab=useCallback((tabKey)=>{if(!effectivePerms)return true;const p=effectivePerms.find(ep=>ep.tab_key===tabKey);return p?.can_view??false},[effectivePerms]);
  const getTabPerm=useCallback((tabKey,field)=>{if(!effectivePerms)return role==='admin'||role==='editor';const p=effectivePerms.find(ep=>ep.tab_key===tabKey);return p?.[field]??false},[effectivePerms,role]);
  const TAB_PERM={dashboard:'dashboard',vitals:['kpis','risks','raci','performance','open_roles'],timeline:'timeline',board:'board',calendar:'calendar',standup:'standup',meet:'meetings',leave:'leave',onboard:'onboarding',hrdocs:'hr_docs'};
  const doLogin=()=>supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin}});
  const doLogout=async()=>{await supabase.auth.signOut();setUser(null);setRole(null)};

  useEffect(()=>{if(userRoles.length>0&&Object.keys(slackStatus).length===0)fetchSlackStatus()},[userRoles.length]);
  useEffect(()=>{if(typeof window!=='undefined'){const ls=localStorage.getItem('attimo_last_sync');if(ls)setLastSync(ls)}},[]);

  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(""),3000);return()=>clearTimeout(t)}},[toast]);
  const showToast=(msg,type="success")=>setToast({msg,type:type||"success"});
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

  useEffect(()=>{async function la(){const[t,r,ri,k,m,ro,su,ur,pf,lv,dc,ob,hd]=await Promise.all([supabase.from('tasks').select('*').order('sort_order,id'),supabase.from('raci').select('*').order('sort_order,dept,id'),supabase.from('risks').select('*').order('sort_order,id'),supabase.from('kpis').select('*').order('sort_order,dept,id'),supabase.from('meetings').select('*').order('sort_order,id'),supabase.from('roles').select('*').order('sort_order,id'),supabase.from('standups').select('*').order('standup_date',{ascending:false}).order('created_at',{ascending:false}).limit(100),supabase.from('user_roles').select('*').order('created_at'),supabase.from('performance').select('*').order('created_at',{ascending:false}),supabase.from('leaves').select('*').order('start_date',{ascending:false}),supabase.from('decisions').select('*').order('sort_order,id'),supabase.from('onboarding').select('*').order('sort_order,id'),supabase.from('hr_documents').select('*').order('person,doc_type')]);
    if(t.data)setTasks(t.data);if(r.data)setRaci(r.data);if(ri.data)setRisks(ri.data);if(k.data)setKpis(k.data);if(m.data)setMeetings(m.data);if(ro.data)setRoles(ro.data);if(su.data)setStandups(su.data);if(ur.data)setUserRoles(ur.data);if(pf.data)setPerf(pf.data);if(lv.data)setLeaves(lv.data);if(dc.data)setDecisions(dc.data);if(ob.data)setOnboarding(ob.data);if(hd.data)setHrDocs(hd.data);setLoading(false);
    // Auto-sync linked Gantt tasks + standups on every page load (background)
    fetch('/api/sync',{method:'POST'}).then(()=>{
      supabase.from('tasks').select('*').order('id').then(({data})=>{if(data)setTasks(data)});
      supabase.from('standups').select('*').order('standup_date',{ascending:false}).order('created_at',{ascending:false}).limit(100).then(({data})=>{if(data)setStandups(data)});
    }).catch(()=>{});
    }la();
    const ch=supabase.channel('rt3').on('postgres_changes',{event:'*',schema:'public',table:'tasks'},()=>supabase.from('tasks').select('*').order('id').then(({data})=>{if(data)setTasks(data)})).on('postgres_changes',{event:'*',schema:'public',table:'risks'},()=>supabase.from('risks').select('*').order('id').then(({data})=>{if(data)setRisks(data)})).on('postgres_changes',{event:'*',schema:'public',table:'kpis'},()=>supabase.from('kpis').select('*').order('dept,id').then(({data})=>{if(data)setKpis(data)})).on('postgres_changes',{event:'*',schema:'public',table:'raci'},()=>supabase.from('raci').select('*').order('dept,id').then(({data})=>{if(data)setRaci(data)})).on('postgres_changes',{event:'*',schema:'public',table:'roles'},()=>supabase.from('roles').select('*').order('id').then(({data})=>{if(data)setRoles(data)})).on('postgres_changes',{event:'*',schema:'public',table:'meetings'},()=>supabase.from('meetings').select('*').order('id').then(({data})=>{if(data)setMeetings(data)})).on('postgres_changes',{event:'*',schema:'public',table:'standups'},()=>supabase.from('standups').select('*').order('standup_date',{ascending:false}).order('created_at',{ascending:false}).limit(100).then(({data})=>{if(data)setStandups(data)})).on('postgres_changes',{event:'*',schema:'public',table:'user_roles'},()=>supabase.from('user_roles').select('*').order('created_at').then(({data})=>{if(data)setUserRoles(data)})).on('postgres_changes',{event:'*',schema:'public',table:'performance'},()=>supabase.from('performance').select('*').order('created_at',{ascending:false}).then(({data})=>{if(data)setPerf(data)})).on('postgres_changes',{event:'*',schema:'public',table:'leaves'},()=>supabase.from('leaves').select('*').order('start_date',{ascending:false}).then(({data})=>{if(data)setLeaves(data)})).on('postgres_changes',{event:'*',schema:'public',table:'decisions'},()=>supabase.from('decisions').select('*').order('sort_order,id').then(({data})=>{if(data)setDecisions(data)})).subscribe();
    return()=>supabase.removeChannel(ch)},[]);

  const updateTask=useCallback(async(id,u)=>{if(!isEditor())return;notify("updated","tasks",u.name||u.status||JSON.stringify(u));setTasks(p=>p.map(t=>t.id===id?{...t,...u}:t));setSel(p=>p?.id===id?{...p,...u}:p);await supabase.from('tasks').update(u).eq('id',id)},[]);
  const deleteTask=useCallback(async id=>{if(!isAdmin()){showToast("Admin only","error");return}setTasks(p=>p.filter(t=>t.id!==id));await supabase.from('tasks').delete().eq('id',id)},[]);
  const addTask=useCallback(async v=>{if(!isEditor()){showToast("View-only access","error");return}try{const res=await fetch('/api/create-task',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:v.name,dept:v.dept,owner:v.owner||"",priority:v.priority||"Medium",start_date:v.start_date||today,end_date:v.end_date||today,source:v.source,projectId:v.projectId})});const r=await res.json();if(r.ok&&r.task){setTasks(p=>[...p,r.task]);showToast("Created in "+(r.source==="linear"?"Linear":"Asana"));setAddModal(null);return}if(r.ok){showToast("Created in "+(r.source||"external"));setAddModal(null);return}showToast("Failed: "+(r.error||"unknown"),"error");console.error(r)}catch(e){console.error(e);showToast("Create failed","error")}},[]);
  const addRaci=useCallback(async v=>{if(!isEditor()){showToast("View-only access","error");return}notify("added","raci",v.task);const{data}=await supabase.from('raci').insert({dept:v.dept||"PMO",task:v.task||"",responsible:v.responsible||"",accountable:v.accountable||"",consulted:v.consulted||"",informed:v.informed||"",notes:v.notes||"",is_suggestion:v.is_suggestion==="true"}).select();if(data)setRaci(p=>[...p,...data]);setAddModal(null)},[]);
  const deleteRaci=useCallback(async id=>{if(!isAdmin()){showToast("Admin only","error");return}setRaci(p=>p.filter(r=>r.id!==id));await supabase.from('raci').delete().eq('id',id)},[]);
  const updateRaci=useCallback(async(id,u)=>{if(!isEditor())return;setRaci(p=>p.map(r=>r.id===id?{...r,...u}:r));await supabase.from('raci').update(u).eq('id',id)},[]);
  const addRisk=useCallback(async v=>{if(!isEditor()){showToast("View-only access","error");return}notify("added","risks",v.description);const ni="R"+(risks.length+1).toString().padStart(2,"0");const{data}=await supabase.from('risks').insert({id:v.id||ni,description:v.description||"",impact:v.impact||"HIGH",status:"ACTIVE",owner:v.owner||"",mitigation:v.mitigation||"",linked_to:v.linked_to||""}).select();if(data)setRisks(p=>[...p,...data]);setAddModal(null)},[risks]);
  const updateRisk=useCallback(async(id,u)=>{if(!isEditor())return;setRisks(p=>p.map(r=>r.id===id?{...r,...u}:r));await supabase.from('risks').update(u).eq('id',id)},[]);
  const deleteRisk=useCallback(async id=>{if(!isAdmin()){showToast("Admin only","error");return}setRisks(p=>p.filter(r=>r.id!==id));await supabase.from('risks').delete().eq('id',id)},[]);
  const addKpi=useCallback(async v=>{if(!isEditor()){showToast("View-only access","error");return}const{data}=await supabase.from('kpis').insert({dept:v.dept||"PMO",name:v.name||"",target:v.target||"",current_value:v.current_value||"",flag:v.flag||"yellow",review_rhythm:v.review_rhythm||"Weekly"}).select();if(data)setKpis(p=>[...p,...data]);setAddModal(null)},[]);
  const updateKpi=useCallback(async(id,u)=>{if(!isEditor())return;notify("updated","kpis",JSON.stringify(u));setKpis(p=>p.map(k=>k.id===id?{...k,...u}:k));await supabase.from('kpis').update(u).eq('id',id)},[]);
  const addRole=useCallback(async v=>{if(!isEditor()){showToast("View-only access","error");return}const{data}=await supabase.from('roles').insert({title:v.title||"",status:v.status||"Not opened",trigger_blocker:v.trigger_blocker||"",target_date:v.target_date||""}).select();if(data)setRoles(p=>[...p,...data]);setAddModal(null)},[]);
  const updateRole=useCallback(async(id,u)=>{if(!isEditor())return;setRoles(p=>p.map(r=>r.id===id?{...r,...u}:r));await supabase.from('roles').update(u).eq('id',id)},[]);
  const deleteRole=useCallback(async id=>{if(!isAdmin()){showToast("Admin only","error");return}setRoles(p=>p.filter(r=>r.id!==id));await supabase.from('roles').delete().eq('id',id)},[]);
  const addMeeting=useCallback(async v=>{if(!isEditor()){showToast("View-only access","error");return}
    // Build the rich record from MeetingModal output
    const dateTime=v.type==="One-time"?(v.date+"T"+(v.time||"10:00")+":00"):null;
    const attendeeNames=(v.attendees||[]).map(em=>userRoles.find(u=>u.email===em)?.name||em).join(", ");
    const rec={
      type:v.type==="Recurring"?(v.cadence||"Weekly"):"One-time",
      name:v.name||"Untitled meeting",
      schedule:v.type==="One-time"?(v.date||""):(v.cadence||"Weekly"),
      duration:String(v.duration||30)+" min",
      owner:user?.user_metadata?.full_name||user?.email||"",
      attendees:attendeeNames,
      attendees_emails:(v.attendees||[]).join(","),
      location:v.location||"",
      description:v.description||"",
      fireflies:!!v.fireflies,
      meeting_datetime:dateTime
    };
    const{data}=await supabase.from('meetings').insert(rec).select();
    if(!data||!data[0]){showToast("Failed to save meeting — run SQL migration 07 if columns are missing","error");return}
    setMeetings(p=>[...p,...data]);showToast("Meeting created");

    // Build Google Calendar prefill URL (fallback if server-side calendar isn't configured)
    let calUrl="";
    try{
      const fmtCal=(d)=>{const dt=new Date(d);const p=n=>String(n).padStart(2,"0");return dt.getFullYear()+p(dt.getMonth()+1)+p(dt.getDate())+"T"+p(dt.getHours())+p(dt.getMinutes())+"00"};
      const guests=[...(v.attendees||[])];
      if(v.fireflies)guests.push("fred@fireflies.ai");
      if(dateTime){
        const endDt=new Date(new Date(dateTime).getTime()+(v.duration||30)*60000);
        calUrl="https://calendar.google.com/calendar/render?action=TEMPLATE"
          +"&text="+encodeURIComponent(rec.name)
          +"&dates="+fmtCal(dateTime)+"/"+fmtCal(endDt)
          +"&details="+encodeURIComponent(rec.description||"Scheduled via Attimo Ops Hub")
          +(rec.location&&rec.location!=="Google Meet"?"&location="+encodeURIComponent(rec.location):"")
          +"&add="+encodeURIComponent(guests.join(","));
        if(v.type==="Recurring"){const fr={"Daily":"DAILY","Weekly":"WEEKLY","Bi-weekly":"WEEKLY;INTERVAL=2","Monthly":"MONTHLY"}[v.cadence];if(fr)calUrl+="&recur="+encodeURIComponent("RRULE:FREQ="+fr)}
      }
    }catch(e){console.error('calendar prefill',e)}

    // Server-side calendar + Slack notifications — one call
    try{
      const res=await fetch('/api/schedule-meeting',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        title:rec.name,description:rec.description,
        start:dateTime,duration_minutes:v.duration||30,
        attendees:v.sendDM?(v.attendees||[]):[],location:rec.location,
        add_fireflies:!!v.fireflies,recurrence:v.type==="Recurring"?v.cadence:null,
        channel_post:!!v.channelPost,calendar_url:calUrl
      })});
      const d=await res.json();
      if(d?.hasCalendar&&d?.htmlLink){
        // Fully in-Hub: event created, Google sends invites + Meet link automatically
        await supabase.from('meetings').update({calendar_link:d.htmlLink,calendar_event_id:d.eventId||null,meeting_link:d.meetLink||null}).eq('id',data[0].id);
        setMeetings(p=>p.map(m=>m.id===data[0].id?{...m,calendar_link:d.htmlLink,calendar_event_id:d.eventId,meeting_link:d.meetLink||m.meeting_link}:m));
        showToast("Calendar event created — Google is sending invites"+(d.meetLink?" with Meet link":""));
      }else if(calUrl){
        // Fallback: open Google Calendar pre-filled, user clicks Save there
        await supabase.from('meetings').update({calendar_link:calUrl}).eq('id',data[0].id);
        setMeetings(p=>p.map(m=>m.id===data[0].id?{...m,calendar_link:calUrl}:m));
        window.open(calUrl,"_blank");
        showToast("Google Calendar opened — click Save there to send invites");
      }
      if(d?.slackInvites>0)showToast(d.slackInvites+" Slack DM invitation"+(d.slackInvites>1?"s":"")+" sent");
      if(d?.slackFailed?.length>0)showToast("DM failed for: "+d.slackFailed.join(", "),"error");
      if(d?.channelPosted)showToast("Announced in #pmo");
      if(v.sendDM&&!d?.slackInvites&&!d?.slackFailed?.length)showToast("Slack invites did not send — check /api/meetings-test","error");
    }catch(e){
      console.error('schedule-meeting',e);
      if(calUrl){window.open(calUrl,"_blank");showToast("Route unreachable — opened Google Calendar fallback","error")}
      else showToast("Scheduling backend failed — is the route deployed?","error");
    }
    setAddModal(null);
  },[user,userRoles]);

  // Send Slack reminder to all attendees of a meeting
  const sendMeetingReminder=useCallback(async(m)=>{
    if(!m.attendees_emails){showToast("No attendee emails saved","error");return}
    try{
      await fetch('/api/meeting-reminder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        meeting_id:m.id,meeting_name:m.name,when:m.schedule,duration:m.duration,
        location:m.location,calendar_link:m.calendar_link,
        attendees_emails:(m.attendees_emails||"").split(",").filter(Boolean)
      })});
      showToast("Reminder DM'd to attendees")
    }catch(e){showToast("Reminder failed: "+e.message,"error")}
  },[]);
  const deleteMeeting=useCallback(async id=>{if(!isAdmin()){showToast("Admin only","error");return}setMeetings(p=>p.filter(m=>m.id!==id));await supabase.from('meetings').delete().eq('id',id)},[]);
  const updateMeeting=useCallback(async(id,u)=>{if(!isEditor())return;setMeetings(p=>p.map(m=>m.id===id?{...m,...u}:m));await supabase.from('meetings').update(u).eq('id',id)},[]);
  const addStandup=useCallback(async v=>{if(!isEditor()){showToast("View-only access","error");return}const{data}=await supabase.from('standups').insert({person:v.person||"",completed:v.completed||"",tomorrow:v.tomorrow||"",blockers:v.blockers||"None",standup_date:v.standup_date||today,source:"manual"}).select();if(data)setStandups(p=>[...data,...p]);setAddModal(null)},[]);
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
  const addPerf=useCallback(async v=>{if(!isEditor()){showToast("View-only access","error");return}const{data}=await supabase.from('performance').insert({person:v.person||'',period:v.period||'',goals:v.goals||'',status:'draft'}).select();if(data)setPerf(p=>[...data,...p]);setAddModal(null)},[]);
  const updatePerf=useCallback(async(id,u)=>{if(!isEditor()){showToast("View-only access","error");return}setPerf(p=>p.map(r=>r.id===id?{...r,...u}:r));await supabase.from('performance').update({...u,updated_at:new Date().toISOString()}).eq('id',id)},[]);
  const deletePerf=useCallback(async id=>{if(!isAdmin()){showToast("Admin only","error");return}setPerf(p=>p.filter(r=>r.id!==id));await supabase.from('performance').delete().eq('id',id)},[]);

  // Leave CRUD
  // Leave quota management (Settings > Team > Leave Quotas)
  const updateLeaveTypeDefault=useCallback(async(key,field,value)=>{const num=value===""?null:Number(value);setLeaveTypes(p=>p.map(t=>t.key===key?{...t,[field]:num}:t));await supabase.from('leave_types').update({[field]:num}).eq('key',key)},[]);
  const setPersonQuota=useCallback(async(email,leave_type,value)=>{const yr=new Date().getFullYear();const num=value===""?null:Number(value);const existing=leaveBalances.find(b=>b.email===email&&b.leave_type===leave_type&&b.year===yr);if(existing){setLeaveBalances(p=>p.map(b=>b.id===existing.id?{...b,allowance_override:num}:b));await supabase.from('leave_balances').update({allowance_override:num}).eq('id',existing.id)}else{const{data}=await supabase.from('leave_balances').insert({email,leave_type,year:yr,spent:0,spent_this_month:0,allowance_override:num}).select();if(data)setLeaveBalances(p=>[...p,...data])}},[leaveBalances]);

  const addLeave=useCallback(async v=>{const me=userRoles.find(r=>r.email===user?.email);if(me?.name==="Efehan Maleri"){showToast("CEO is excluded from leave requests","error");return}const s=v.start_date;const e=v.end_date||v.start_date;if(s&&s<today){showToast("Cannot book leave starting in the past","error");return}const hd=v.half_day==="Yes";const d=hd?0.5:(s&&e?Math.max(1,daysB(s,e)+1):1);const dbType=v.leave_type==="casual"?"personal":(v.leave_type||"annual");const{data}=await supabase.from('leaves').insert({person:v.person||user?.user_metadata?.full_name||'',email:user?.email||'',leave_type:dbType,half_day:hd,start_date:s,end_date:hd?s:e,days:d,reason:v.reason||'',status:'pending'}).select();if(data){setLeaves(p=>[...data,...p]);showToast("Leave request submitted — pending approval");
    // Send Spock-style Slack card with Approve/Reject buttons
    try{await fetch('/api/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:v.person||user?.user_metadata?.full_name,action:"requested",table:"leave",leave:data[0]})})}catch{}
  }setAddModal(null)},[user,userRoles]);

  // Decisions CRUD
  const addDecision=useCallback(async v=>{if(!isEditor())return;const{data}=await supabase.from('decisions').insert({title:v.title||'',owner:v.owner||'',priority:v.priority||'medium',due_date:v.due_date||null,context:v.context||'',dept:v.dept||'Team',status:'open'}).select();if(data)setDecisions(p=>[...data,...p]);showToast("Decision added");setAddModal(null)},[]);
  const updateDecision=useCallback(async(id,u)=>{if(!isEditor())return;setDecisions(p=>p.map(d=>d.id===id?{...d,...u}:d));await supabase.from('decisions').update(u).eq('id',id)},[]);
  const deleteDecision=useCallback(async id=>{if(!isAdmin())return;setDecisions(p=>p.filter(d=>d.id!==id));await supabase.from('decisions').delete().eq('id',id)},[]);

  // Department-specific onboarding templates
  const ONBOARD_COMMON=[
    {item:"Create @attimo.com email",category:"accounts",assigned_to:"Nil Ozdamar"},
    {item:"Invite to Slack workspace",category:"accounts",assigned_to:"Nil Ozdamar"},
    {item:"Google Drive folder access",category:"accounts",assigned_to:"Nil Ozdamar"},
    {item:"Collect ID copy",category:"documents",assigned_to:"Nil Ozdamar"},
    {item:"Collect signed contract",category:"documents",assigned_to:"Nil Ozdamar"},
    {item:"Collect CV / resume",category:"documents",assigned_to:"Nil Ozdamar"},
    {item:"Bank details for payroll",category:"documents",assigned_to:"Nil Ozdamar"},
    {item:"Send welcome email",category:"orientation",assigned_to:"Nil Ozdamar"},
    {item:"Slack channels introduction",category:"orientation",assigned_to:"Laraib Haider"},
    {item:"Product walkthrough (Panovia overview)",category:"orientation",assigned_to:"Laraib Haider"},
  ];
  const ONBOARD_DEPT={
    Development:[
      {item:"GitHub repository access",category:"accounts",assigned_to:"Syed Osama Ali"},
      {item:"Linear workspace invite",category:"accounts",assigned_to:"Laraib Haider"},
      {item:"Technical onboarding (architecture, codebase)",category:"orientation",assigned_to:"Syed Osama Ali"},
      {item:"Dev environment setup (IDE, Docker, local stack)",category:"tools",assigned_to:"Talha Mubeen"},
      {item:"Code review standards walkthrough",category:"orientation",assigned_to:"Talha Mubeen"},
      {item:"VERBIS consent form",category:"documents",assigned_to:"Soo Ling Lim"},
    ],
    "AI/Science":[
      {item:"GitHub repository access",category:"accounts",assigned_to:"Syed Osama Ali"},
      {item:"Linear workspace invite",category:"accounts",assigned_to:"Laraib Haider"},
      {item:"Research methodology walkthrough",category:"orientation",assigned_to:"Soo Ling Lim"},
      {item:"ML pipeline & data access setup",category:"tools",assigned_to:"Soo Ling Lim"},
      {item:"VERBIS consent form",category:"documents",assigned_to:"Soo Ling Lim"},
    ],
    Design:[
      {item:"Figma workspace invite",category:"accounts",assigned_to:"Gamze Savaş"},
      {item:"Asana Design board access",category:"accounts",assigned_to:"Laraib Haider"},
      {item:"Design system walkthrough",category:"orientation",assigned_to:"Tunç Karadağ"},
      {item:"Brand guidelines & assets folder",category:"tools",assigned_to:"Gamze Savaş"},
    ],
    Marketing:[
      {item:"Asana Marketing board access",category:"accounts",assigned_to:"Laraib Haider"},
      {item:"HubSpot CRM access",category:"accounts",assigned_to:"Claire Eskander"},
      {item:"Brand voice & messaging doc walkthrough",category:"orientation",assigned_to:"Claire Eskander"},
      {item:"Social media account access",category:"tools",assigned_to:"Claire Eskander"},
    ],
    PMO:[
      {item:"Linear Operations board access",category:"accounts",assigned_to:"Laraib Haider"},
      {item:"Asana board access",category:"accounts",assigned_to:"Laraib Haider"},
      {item:"PMO Ops Hub walkthrough",category:"orientation",assigned_to:"Laraib Haider"},
      {item:"Standup & reporting workflow",category:"orientation",assigned_to:"Laraib Haider"},
    ],
    Leadership:[
      {item:"All tool admin access",category:"accounts",assigned_to:"Laraib Haider"},
      {item:"Strategic docs & investor materials access",category:"orientation",assigned_to:"Efehan Maleri"},
    ],
  };
  const OFFBOARD_TEMPLATE=[
    {item:"Revoke @attimo.com email",category:"accounts",assigned_to:"Nil Ozdamar"},
    {item:"Remove from Slack workspace",category:"accounts",assigned_to:"Nil Ozdamar"},
    {item:"Revoke GitHub access",category:"accounts",assigned_to:"Syed Osama Ali"},
    {item:"Remove from Linear/Asana",category:"accounts",assigned_to:"Laraib Haider"},
    {item:"Revoke Google Drive access",category:"accounts",assigned_to:"Nil Ozdamar"},
    {item:"Collect company equipment",category:"general",assigned_to:"Nil Ozdamar"},
    {item:"Final payroll settlement",category:"documents",assigned_to:"Nil Ozdamar"},
    {item:"Exit interview",category:"orientation",assigned_to:"Nil Ozdamar"},
    {item:"Knowledge transfer documentation",category:"general",assigned_to:"Laraib Haider"},
    {item:"Update team directory & user_roles",category:"general",assigned_to:"Laraib Haider"},
  ];
  const generateOnboarding=useCallback(async(personName,dept,isOffboard=false,extraItems=[])=>{if(!isEditor())return;const dueDate=new Date();dueDate.setDate(dueDate.getDate()+(isOffboard?7:3));const dueDateStr=dueDate.toISOString().split('T')[0];
    let template;
    if(isOffboard){
      // Interlink: derive offboarding from what this person was granted at onboarding
      const theirOnboarding=onboarding.filter(o=>o.person===personName&&(o.category==="accounts"||o.category==="tools"));
      const derived=theirOnboarding.map(o=>({item:o.item.replace(/^(Create|Invite to|Add to|Grant|Setup|Set up)/i,"Revoke").replace(/access$/i,"access").startsWith("Revoke")?o.item.replace(/^(Create|Invite to|Add to|Grant|Setup|Set up)/i,"Revoke"):"Revoke: "+o.item,category:"accounts",assigned_to:o.assigned_to}));
      template=[...OFFBOARD_TEMPLATE,...derived];
    }else{
      template=[...ONBOARD_COMMON,...(ONBOARD_DEPT[dept]||ONBOARD_DEPT['Development'])];
    }
    template=[...template,...extraItems];
    const items=template.map((t,i)=>({...t,person:personName+(isOffboard?" (offboarding)":""),status:'pending',due_date:dueDateStr,sort_order:i}));const{data}=await supabase.from('onboarding').insert(items).select();if(data){setOnboarding(p=>[...p,...data]);showToast(data.length+(isOffboard?" offboarding":" onboarding")+" items created for "+personName)}
    if(!isOffboard){const docTypes=['id_copy','cv','contract','verbis_consent','bank_details','emergency_contact','photo'];const docs=docTypes.map(dt=>({person:personName,doc_type:dt,status:'missing'}));const{data:dd}=await supabase.from('hr_documents').insert(docs).select();if(dd)setHrDocs(p=>[...p,...dd])}
    setOnboardModal(null);
  },[onboarding]);
  const updateOnboardItem=useCallback(async(id,u)=>{if(!isEditor())return;setOnboarding(p=>p.map(o=>o.id===id?{...o,...u}:o));await supabase.from('onboarding').update(u).eq('id',id)},[]);
  const deleteOnboardItem=useCallback(async id=>{if(!isAdmin())return;setOnboarding(p=>p.filter(o=>o.id!==id));await supabase.from('onboarding').delete().eq('id',id)},[]);
  const updateHrDoc=useCallback(async(id,u)=>{if(!isEditor())return;setHrDocs(p=>p.map(d=>d.id===id?{...d,...u}:d));await supabase.from('hr_documents').update(u).eq('id',id)},[]);
  const updateLeave=useCallback(async(id,u)=>{if(!isEditor()){showToast("View-only access","error");return}const leave=leaves.find(l=>l.id===id);setLeaves(p=>p.map(r=>r.id===id?{...r,...u}:r));await supabase.from('leaves').update(u).eq('id',id);if(u.status){
    try{await fetch('/api/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:user?.user_metadata?.full_name||user?.email,action:u.status,table:"leave",leave:{...leave,...u}})})}catch{}
    showToast("Leave "+u.status+" for "+(leave?.person||"employee"))
  }},[leaves,user]);
  const deleteLeave=useCallback(async id=>{if(!isAdmin()){showToast("Admin only","error");return}setLeaves(p=>p.filter(r=>r.id!==id));await supabase.from('leaves').delete().eq('id',id)},[]);

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
    if(!isSelf&&role!=='admin'){showToast("Can only update your own photo","error");return}
    const ext=file.name.split('.').pop();const path=`avatars/${roleId}.${ext}`;
    const{error}=await supabase.storage.from('Avatar').upload(path,file,{upsert:true});
    if(error){showToast("Upload failed: "+error.message,"error");return}
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
    await Promise.all(updated.map(item=>supabase.from(table).update({sort_order:item.sort_order}).eq('id',item.id)));
  },[canEdit]);

  // Leave approvers — ONLY these people can approve/reject leaves
  const LEAVE_APPROVERS=['nil@attimo.com','laraib@attimo.com','efehan@attimo.com'];
  const isLeaveApprover=LEAVE_APPROVERS.includes(user?.email);

  const stripSlackEmoji=(text)=>(text||"").replace(/:[a-z_]+:/g,"").trim();

  const doSync=async()=>{setSyncing(true);showToast("Syncing...");try{const res=await fetch('/api/sync',{method:'POST'});await res.json();const now=new Date().toLocaleString('en-GB',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'});setLastSync(now);localStorage.setItem('attimo_last_sync',now);showToast("Sync complete — "+now);if(deptTasks)fetch('/api/linear-tasks').then(r=>r.json()).then(d=>setDeptTasks(d)).catch(()=>{})}catch(e){showToast("Sync failed","error")}setSyncing(false)};
  const stats=useMemo(()=>({total:tasks.length,todo:tasks.filter(t=>t.status==="To Do").length,doing:tasks.filter(t=>t.status==="Doing").length,done:tasks.filter(t=>t.status==="Done").length,risk:tasks.filter(t=>t.risk!=="On track").length,overdue:tasks.filter(t=>isOverdue(t)).length}),[tasks]);
  const raciByDept={};raci.forEach(r=>{if(!raciByDept[r.dept])raciByDept[r.dept]=[];raciByDept[r.dept].push(r)});
  const kpiByDept={};kpis.forEach(k=>{if(!kpiByDept[k.dept])kpiByDept[k.dept]=[];kpiByDept[k.dept].push(k)});
  const TABS=[{id:"dashboard",l:"Dashboard",icon:"⊞"},{id:"vitals",l:"Vitals",icon:"♥"},{id:"timeline",l:"Timeline",icon:"◔"},{id:"board",l:"Board",icon:"▦"},{id:"calendar",l:"Calendar",icon:"◫"},{id:"standup",l:"Daily Standup",icon:"◉"},{id:"meet",l:"Meetings",icon:"◈"},{id:"leave",l:"Leave",icon:"◇"},{id:"onboard",l:"Onboarding",icon:"◑"},{id:"hrdocs",l:"Documents",icon:"◪"}];

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
        {TABS.filter(t=>{if(!effectivePerms)return true;const k=TAB_PERM[t.id];if(Array.isArray(k))return k.some(x=>canSeeTab(x));return canSeeTab(k||t.id)}).map(t=><div key={t.id} className={"sb-item"+(view===t.id?" active":"")} onClick={()=>setView(t.id)} data-tip={t.l}>
          <div className="sb-icon">{t.icon}</div>
          <span className="sb-label" style={{color:view===t.id?"#3B82F6":"var(--fg2)"}}>{t.l}</span>
        </div>)}
      </div>
      <div style={{borderTop:"1px solid var(--border)",padding:"8px 0"}}>
        {canSeeTab('settings')&&<div className={"sb-item"+(view==="settings"?" active":"")} onClick={()=>setView("settings")}><div className="sb-icon">{I.settings(16)}</div><span className="sb-label">Settings</span></div>}
        <div className="sb-item" onClick={()=>{const me=userRoles.find(r=>r.email===user?.email);setHoursForm({tz:me?.timezone||"Europe/Istanbul",start:me?.work_start||"09:00",end:me?.work_end||"18:00"});setShowHoursModal(true)}}><div className="sb-icon">{I.clock(16)}</div><span className="sb-label">Working Hours</span></div>
        <div className="sb-item" onClick={()=>setDark(!dark)}><div className="sb-icon">{dark?I.sun(16):I.moon(16)}</div><span className="sb-label">{dark?"Light Mode":"Dark Mode"}</span></div>
      </div>
    </div>

    {/* ═══ MAIN AREA ═══ */}
    <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,overflow:"hidden"}}>

    {/* Header — animated ticker */}
    <div style={{background:"var(--hdr)",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,position:"relative",zIndex:50}}>
      <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <button onClick={doSync} disabled={syncing} className="btn-pop" style={{background:syncing?"rgba(255,255,255,.15)":"linear-gradient(135deg,#3B82F6,#6366F1)",color:"#fff",border:"none",padding:"6px 16px",borderRadius:8,fontWeight:700,fontSize:11,cursor:syncing?"wait":"pointer",display:"flex",alignItems:"center",gap:6,minWidth:90,justifyContent:"center"}}>
          {syncing?<><span style={{display:"inline-block",animation:"spin .8s linear infinite",fontSize:12}}>◌</span> Syncing</>:<>{I.zap(12)} Sync All</>}
        </button>
        {lastSync&&<span style={{fontSize:8,color:"rgba(255,255,255,.4)"}}>Last: {lastSync}</span>}
      </div>
      <div style={{flex:1,overflow:"hidden",position:"relative",maskImage:"linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)"}}>
        <div className="ticker-scroll" style={{display:"flex",gap:16,alignItems:"center",whiteSpace:"nowrap",fontSize:11,color:"#94A3B8",paddingLeft:12}}>
          <span><b style={{color:"#93C5FD"}}>{stats.total}</b> total</span>
          <span style={{color:"rgba(255,255,255,.15)"}}>|</span>
          <span><b style={{color:"#FDE68A"}}>{stats.doing}</b> doing</span>
          <span style={{color:"rgba(255,255,255,.15)"}}>|</span>
          <span><b style={{color:"#6EE7B7"}}>{stats.done}</b> done</span>
          {stats.overdue>0&&<><span style={{color:"rgba(255,255,255,.15)"}}>|</span><span className="pulse-dot"><b style={{color:"#FCA5A5"}}>{stats.overdue}</b> overdue</span></>}
          <span style={{color:"rgba(255,255,255,.15)"}}>|</span>
          {ANCH.map((a,i)=><span key={i} style={{fontSize:9,color:a.c,fontWeight:700,padding:"2px 8px",background:a.c+"18",borderRadius:99,border:"1px solid "+a.c+"30"}}>{a.l} {fD(a.d)}</span>)}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <NotificationBell leaves={leaves} risks={risks} decisions={decisions} isApprover={['nil@attimo.com','laraib@attimo.com','efehan@attimo.com'].includes((user?.email||'').toLowerCase())} onNavigate={setView}/>
        <label style={{cursor:"pointer",position:"relative"}}>
          <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(!f)return;const me=userRoles.find(r=>r.email===user?.email);if(me)uploadAvatar(me.id,f);else showToast("Your email not in user roles yet","error")}}/>
          {(()=>{const me=userRoles.find(r=>r.email===user?.email);return me?.avatar_url?<img src={me.avatar_url} style={{width:26,height:26,borderRadius:"50%",objectFit:"cover",border:"2px solid rgba(255,255,255,.2)"}}/>:<span style={{width:26,height:26,borderRadius:"50%",background:"#3B82F6",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff",border:"2px solid rgba(255,255,255,.2)"}}>{user?.user_metadata?.full_name?.[0]||user?.email?.[0]||"?"}</span>})()}
        </label>
        <div style={{position:"relative"}}>
          <button onClick={()=>setUserMenu(!userMenu)} style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.15)",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:11,color:"#94A3B8",fontWeight:500,display:"flex",alignItems:"center",gap:5}}>
            <span className="mob-hide">{(()=>{const me=userRoles.find(r=>r.email===user?.email);return me?.name||user?.user_metadata?.full_name||user?.email?.split("@")[0]})()}</span>
            <span style={{fontSize:8,padding:"1px 5px",borderRadius:4,background:role==="admin"?"#3B82F630":role==="editor"?"#F59E0B30":"#64748B30",color:role==="admin"?"#93C5FD":role==="editor"?"#FDE68A":"#94A3B8"}}>{role}</span>
            <span style={{fontSize:8,transition:"transform .2s",transform:userMenu?"rotate(180deg)":"rotate(0)"}}>▾</span>
          </button>
          {userMenu&&<><div style={{position:"fixed",inset:0,zIndex:9998}} onClick={()=>setUserMenu(false)}/><div className="asc" style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,padding:6,minWidth:180,boxShadow:"0 12px 40px rgba(0,0,0,.25)",zIndex:9999}}>
            <div onClick={()=>{const me=userRoles.find(r=>r.email===user?.email);if(me){const slk=slackStatus._match?slackStatus._match(me):null;setProfileCard({ur:me,slk})}setUserMenu(false)}} style={{padding:"8px 12px",borderRadius:6,cursor:"pointer",fontSize:11,color:"var(--fg)",fontWeight:500,display:"flex",alignItems:"center",gap:8,transition:"background .15s"}} className="rh">{ I.user(14)} My Profile</div>
            <div onClick={()=>{const me=userRoles.find(r=>r.email===user?.email);setMyNameVal(me?.name||user?.user_metadata?.full_name||"");setEditMyName(true);setUserMenu(false)}} style={{padding:"8px 12px",borderRadius:6,cursor:"pointer",fontSize:11,color:"var(--fg)",fontWeight:500,display:"flex",alignItems:"center",gap:8}} className="rh">{ I.edit(14)} Edit Name</div>
            <div onClick={()=>{const me=userRoles.find(r=>r.email===user?.email);setHoursForm({tz:me?.timezone||"Europe/Istanbul",start:me?.work_start||"09:00",end:me?.work_end||"18:00"});setShowHoursModal(true);setUserMenu(false)}} style={{padding:"8px 12px",borderRadius:6,cursor:"pointer",fontSize:11,color:"var(--fg)",fontWeight:500,display:"flex",alignItems:"center",gap:8}} className="rh">{ I.clock(14)} Working Hours</div>
            <div style={{height:1,background:"var(--border)",margin:"4px 0"}}/>
            <div onClick={()=>{doLogout();setUserMenu(false)}} style={{padding:"8px 12px",borderRadius:6,cursor:"pointer",fontSize:11,color:"#EF4444",fontWeight:600,display:"flex",alignItems:"center",gap:8}} className="rh">{ I.logout(14)} Sign Out</div>
          </div></>}
        </div>
      </div>
    </div>

    <div style={{padding:20,flex:1,overflowY:"auto"}}>

    {/* ═══ DASHBOARD ═══ */}
    {view==="dashboard"&&<div className="af">
      <div style={{fontSize:16,fontWeight:800,color:"var(--fg)",marginBottom:16}}>Dashboard Overview</div>

      {/* ─── CEO HERO ROW: Runway · Launch Readiness · Company Acceleration ─── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,marginBottom:16}}>
        {/* Runway */}
        {(()=>{const cash=Number(config.cash_on_hand||0);const burn=Number(config.monthly_burn||0);const months=burn>0?cash/burn:null;const c=months==null?"#94A3B8":months<3?"#EF4444":months<6?"#F59E0B":"#10B981";
          return <div className="stat-card asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,borderLeft:"4px solid "+c}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <span style={{fontSize:10,color:"var(--fg2)",fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>Runway</span>
              <span style={{color:c}}>{I.fire(16)}</span>
            </div>
            {months==null?<div><div style={{fontSize:22,fontWeight:800,color:"var(--fg2)"}}>—</div><div style={{fontSize:9,color:"var(--fg2)"}}>Set cash + burn in Settings</div></div>
            :<><div style={{fontSize:24,fontWeight:800,color:c}}>{months.toFixed(1)} <span style={{fontSize:12,fontWeight:500,color:"var(--fg2)"}}>months</span></div>
              <div style={{fontSize:9,color:"var(--fg2)"}}>${(cash/1000).toFixed(0)}k cash · ${(burn/1000).toFixed(1)}k/mo burn</div></>}
            {role==="admin"&&<button onClick={()=>{const newCash=prompt("Cash on hand ("+config.currency+"):",cash);if(newCash==null)return;const newBurn=prompt("Monthly burn ("+config.currency+"):",burn);if(newBurn==null)return;Promise.all([supabase.from('config').upsert({key:'cash_on_hand',value:String(Number(newCash)),updated_at:new Date().toISOString(),updated_by:user?.email}),supabase.from('config').upsert({key:'monthly_burn',value:String(Number(newBurn)),updated_at:new Date().toISOString(),updated_by:user?.email})]).then(()=>{setConfig(p=>({...p,cash_on_hand:newCash,monthly_burn:newBurn}));showToast("Runway updated")})}} style={{marginTop:6,padding:"3px 8px",borderRadius:5,border:"1px solid var(--border)",background:"transparent",color:"var(--fg2)",fontSize:9,cursor:"pointer"}}>Edit</button>}
          </div>;
        })()}

        {/* Launch Readiness */}
        {(()=>{const ld=config.launch_date;const launchTasks=tasks.filter(t=>t.end_date&&String(t.end_date).split('T')[0]<=ld);const done=launchTasks.filter(t=>t.status==="Done").length;const pct=launchTasks.length>0?Math.round((done/launchTasks.length)*100):0;const daysLeft=Math.ceil((new Date(ld+"T00:00:00").getTime()-Date.now())/86400000);const c=pct>=80?"#10B981":pct>=50?"#F59E0B":"#EF4444";
          return <div className="stat-card asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,borderLeft:"4px solid "+c}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <span style={{fontSize:10,color:"var(--fg2)",fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>Launch Readiness</span>
              <span style={{color:c}}>{I.zap(16)}</span>
            </div>
            <div style={{fontSize:24,fontWeight:800,color:c}}>{pct}<span style={{fontSize:12,fontWeight:500,color:"var(--fg2)"}}>%</span></div>
            <div style={{fontSize:9,color:"var(--fg2)"}}>{done}/{launchTasks.length} tasks · {daysLeft>0?daysLeft+" days to launch":"Launch passed"}</div>
            <div style={{height:4,background:"var(--bg3)",borderRadius:2,overflow:"hidden",marginTop:6}}><div className="bar-g" style={{height:"100%",width:pct+"%",borderRadius:2,background:c}}/></div>
          </div>;
        })()}

        {/* Company Acceleration (from metrics table) */}
        {(()=>{const depts=metricsData?Object.values(metricsData):[];const totalCurrent=depts.reduce((s,d)=>s+(d.tasks_current||0),0);const totalPrior=depts.reduce((s,d)=>s+(d.tasks_prior||0),0);const accel=totalPrior===0?(totalCurrent>0?100:0):Math.round(((totalCurrent-totalPrior)/totalPrior)*100);const c=accel>5?"#10B981":accel<-5?"#EF4444":"#94A3B8";const arrow=accel>5?"↗":accel<-5?"↘":"→";
          return <div className="stat-card asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,borderLeft:"4px solid "+c}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <span style={{fontSize:10,color:"var(--fg2)",fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>Company Acceleration</span>
              <span style={{color:c,fontSize:18,fontWeight:800}}>{arrow}</span>
            </div>
            {!metricsData?<div><div style={{fontSize:22,fontWeight:800,color:"var(--fg2)"}}>—</div><div style={{fontSize:9,color:"var(--fg2)"}}>Awaiting first compute (8am UTC)</div></div>
            :<><div style={{fontSize:24,fontWeight:800,color:c}}>{accel>0?"+":""}{accel}<span style={{fontSize:12,fontWeight:500,color:"var(--fg2)"}}>%</span></div>
              <div style={{fontSize:9,color:"var(--fg2)"}}>{totalCurrent} done this fortnight · {totalPrior} prior</div></>}
          </div>;
        })()}
      </div>

      {/* Department acceleration sub-row */}
      {metricsData&&Object.keys(metricsData).length>0&&<div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:14,marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Departments — Acceleration This Fortnight</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8}}>
          {Object.entries(metricsData).sort((a,b)=>(b[1].acceleration_pct||0)-(a[1].acceleration_pct||0)).map(([dept,d])=>{const accel=d.acceleration_pct||0;const c=accel>5?"#10B981":accel<-5?"#EF4444":"#94A3B8";const arrow=accel>5?"↗":accel<-5?"↘":"→";const cl=CL[dept]||"#6366F1";
            return <div key={dept} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,background:"var(--bg2)",borderLeft:"2px solid "+cl}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:600,color:"var(--fg)"}}>{dept}</div>
                <div style={{fontSize:8,color:"var(--fg2)"}}>{(d.velocity||0).toFixed(1)}/wk</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:13,fontWeight:800,color:c}}>{accel>0?"+":""}{accel}% {arrow}</div>
              </div>
            </div>;
          })}
        </div>
      </div>}

      {/* ─── TEAM AVAILABILITY (TOP OF DASHBOARD) ─── */}
      <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>Team Availability</div>
            <button onClick={fetchSlackStatus} disabled={slackLoading} className="btn-pop" style={{padding:"4px 12px",borderRadius:6,border:"1px solid var(--border)",background:"var(--bg3)",color:"var(--fg2)",fontSize:10,fontWeight:600,cursor:"pointer",opacity:slackLoading?.5:1}}>{slackLoading?"Syncing...":"Refresh"}</button>
          </div>
          <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:10,color:"var(--fg2)"}}>My status:</span>
            {["working","break","meeting","off"].map(s=>{const me=userRoles.find(r=>r.email===user?.email);const active=me?.current_status===s;return <button key={s} onClick={()=>{const me2=userRoles.find(r=>r.email===user?.email);if(me2){supabase.from('user_roles').update({current_status:s}).eq('id',me2.id);setUserRoles(p=>p.map(r=>r.id===me2.id?{...r,current_status:s}:r))}}} style={{padding:"3px 8px",borderRadius:5,border:active?"2px solid":"1px solid var(--border)",borderColor:active?s==="working"?"#10B981":s==="break"?"#F59E0B":s==="meeting"?"#3B82F6":"#64748B":"var(--border)",background:active?(s==="working"?"#DCFCE7":s==="break"?"#FEF3C7":s==="meeting"?"#DBEAFE":"#F1F5F9"):"transparent",color:active?(s==="working"?"#166534":s==="break"?"#92400E":s==="meeting"?"#1D4ED8":"#475569"):"var(--fg2)",fontSize:9,fontWeight:active?700:500,cursor:"pointer",transition:"all .2s"}}>{s}</button>})}
          </div>
        </div>
        {/* Status Filter */}
        <div style={{display:"flex",gap:4,marginBottom:10,background:"var(--bg3)",borderRadius:8,padding:2,width:"fit-content"}}>
          {[{id:"all",l:"All"},{id:"working",l:"Working"},{id:"break",l:"Break"},{id:"meeting",l:"Meeting"},{id:"off",l:"Off"}].map(f=><button key={f.id} onClick={()=>setStatusFilter(f.id)} style={{padding:"4px 10px",borderRadius:6,border:"none",fontSize:9,fontWeight:600,cursor:"pointer",transition:"all .2s",background:statusFilter===f.id?"var(--fg)":"transparent",color:statusFilter===f.id?"var(--bg)":"var(--fg2)"}}>{f.l}</button>)}
        </div>
        {/* Team Cards */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8,marginBottom:16}}>
          {userRoles.filter(ur=>{const slk=slackStatus._match?slackStatus._match(ur):null;const onLeave=leaves.some(l=>l.person===ur.name&&l.status==="approved"&&l.start_date<=today&&l.end_date>=today);const st=onLeave?"off":slk?slk.mapped_status:(ur.current_status||"offline");if(statusFilter==="all")return true;if(statusFilter==="off")return st==="off"||st==="offline";return st===statusFilter}).map((ur,idx)=>{
            const slk=slackStatus._match?slackStatus._match(ur):null;const tz=slk?.tz||ur.timezone||"Europe/Istanbul";
            let localTime="";try{localTime=new Date().toLocaleString('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false})}catch{}
            const ws=parseInt((ur.work_start||"09:00").split(":")[0]);const we=parseInt((ur.work_end||"18:00").split(":")[0]);
            let localH=0;try{localH=parseInt(new Date().toLocaleString('en-GB',{timeZone:tz,hour:'2-digit',hour12:false}))}catch{}
            const inHours=localH>=ws&&localH<we;
            const onLeave=leaves.some(l=>l.person===ur.name&&l.status==="approved"&&l.start_date<=today&&l.end_date>=today);
            const st=onLeave?"off":slk?slk.mapped_status:(ur.current_status||"offline");
            const slkText=slk?.status_text||"";
            const stC=st==="working"?"#10B981":st==="break"?"#F59E0B":st==="meeting"?"#3B82F6":"#94A3B8";
            const av=ur.avatar_url||(slk?.avatar)||null;
            return <div key={ur.id} onClick={()=>setProfileCard({ur,slk})} className="ch asl" style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:10,padding:"10px 12px",display:"flex",alignItems:"center",gap:8,cursor:"pointer",animationDelay:idx*25+"ms"}}>
              <div style={{position:"relative"}} className="avatar-click">
                {av?<img src={av} style={{width:32,height:32,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:32,height:32,borderRadius:"50%",background:CL[ur.dept]||"#6366F1",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:11,fontWeight:700}}>{ur.name?.[0]}</span></div>}
                <div style={{position:"absolute",bottom:-1,right:-1,width:10,height:10,borderRadius:"50%",background:stC,border:"2px solid var(--bg2)"}}/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:600,color:"var(--fg)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ur.name}</div>
                <div style={{fontSize:9,color:"var(--fg2)"}}>{localTime} {slk?.tz_label||tz.split("/").pop().replace("_"," ")}</div>
                <div style={{fontSize:8,color:stC,fontWeight:700,textTransform:"uppercase"}}>{onLeave?"ON LEAVE":st==="offline"?"OFFLINE":st==="working"&&inHours?st+" (IN HOURS)":st}</div>
                {slkText&&<div style={{fontSize:8,color:"var(--fg2)",marginTop:1}}>{stripSlackEmoji(slkText)}</div>}
              </div>
            </div>})}
        </div>
        {/* Full interactive overlap chart */}
        {(()=>{const myUr=userRoles.find(r=>r.email===user?.email);const myTz=myUr?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";const myTzLabel=myTz.split("/").pop().replace("_"," ");
        return <div style={{background:"var(--bg2)",borderRadius:10,padding:16}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--fg)",marginBottom:4,textAlign:"center"}}>Team Overlap Hours</div>
          <div style={{fontSize:10,color:"var(--fg2)",marginBottom:14,textAlign:"center"}}>Showing in your timezone ({myTzLabel}) · Hover bars to see who's online</div>
          <div style={{display:"flex",gap:3,alignItems:"flex-end",justifyContent:"center",flexWrap:"wrap",minHeight:90}}>
            {Array.from({length:24},(_,localH)=>{
              const onlineMembers=userRoles.filter(ur=>{const slk=slackStatus._match?slackStatus._match(ur):null;const tz=slk?.tz||ur.timezone||"Europe/Istanbul";const ws=parseInt((ur.work_start||"09:00").split(":")[0]);const we=parseInt((ur.work_end||"18:00").split(":")[0]);
                try{const now=new Date();const ref=new Date(now.getFullYear(),now.getMonth(),now.getDate(),localH,0,0);const myOff=new Date(ref.toLocaleString('en-US',{timeZone:myTz})).getTime();const theirT=new Date(ref.toLocaleString('en-US',{timeZone:tz}));const diff=theirT.getTime()-myOff;const thH=(localH+Math.round(diff/3600000)+24)%24;return thH>=ws&&thH<we}catch{return false}});
              const count=onlineMembers.length;const pct=count/Math.max(userRoles.length,1);
              const barH=Math.max(count===0?6:18,pct*75);
              const bg=count===0?"var(--bg3)":pct>0.7?"#10B981":pct>0.4?"#F59E0B":"#3B82F6";
              let myNowH=0;try{myNowH=parseInt(new Date().toLocaleString('en-GB',{timeZone:myTz,hour:'2-digit',hour12:false}))}catch{}
              const isNow=localH===myNowH;
              const timeLabel=localH===0?"12AM":localH<12?localH+"AM":localH===12?"12PM":(localH-12)+"PM";
              return <div key={localH} className="ch" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,position:"relative",cursor:count>0?"pointer":"default"}} title={count>0?count+" online: "+onlineMembers.map(u=>u.name).join(", "):"No one online"}>
                {isNow&&<div style={{width:5,height:5,borderRadius:"50%",background:"#EF4444",position:"absolute",top:-10}} className="pulse-dot"/>}
                <div className="asl" style={{width:22,height:barH,borderRadius:5,background:bg,opacity:count===0?.15:0.4+pct*0.6,display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:3,animationDelay:localH*25+"ms",transition:"all .3s ease",border:isNow?"2px solid #EF4444":"none"}}>
                  <span style={{fontSize:8,color:"#fff",fontWeight:700}}>{count||""}</span>
                </div>
                <span style={{fontSize:8,color:isNow?"#EF4444":"var(--fg2)",fontWeight:isNow?700:400}}>{timeLabel}</span>
              </div>})}
          </div>
          <div style={{display:"flex",gap:14,marginTop:10,fontSize:9,color:"var(--fg2)",justifyContent:"center",alignItems:"center",flexWrap:"wrap"}}>
            <span style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,borderRadius:3,background:"#10B981"}}/> Most online</span>
            <span style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,borderRadius:3,background:"#F59E0B"}}/> Partial</span>
            <span style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,borderRadius:3,background:"#3B82F6"}}/> Few</span>
            <span style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:5,height:5,borderRadius:"50%",background:"#EF4444"}}/> Now</span>
          </div>
        </div>})()}
      </div>

      {/* ─── NEW SLACK MEMBER DETECTION (admin only) ─── */}
      {role==="admin"&&(()=>{const slackUsers=(slackStatus._allUsers||[]);const knownEmails=userRoles.map(r=>r.email?.toLowerCase());const newMembers=slackUsers.filter(s=>s.email&&!knownEmails.includes(s.email.toLowerCase())&&!s.email.includes("bot")&&s.name!=="Slackbot");
        return newMembers.length>0?<div className="asl" style={{background:"rgba(59,130,246,.06)",border:"1px solid rgba(59,130,246,.2)",borderRadius:10,padding:12,marginBottom:12,animationDelay:"30ms"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <span style={{color:"#3B82F6"}}>{I.users(14)}</span>
            <span style={{fontSize:12,fontWeight:700,color:"#3B82F6"}}>New Slack member{newMembers.length>1?"s":""} detected</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {newMembers.map(m=><div key={m.email} className="rh" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"6px 10px",borderRadius:6,background:"var(--card)",border:"1px solid var(--border)"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {m.avatar?<img src={m.avatar} style={{width:24,height:24,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:24,height:24,borderRadius:"50%",background:"#6366F1",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:9,fontWeight:700}}>{m.name?.[0]}</span></div>}
                <div><div style={{fontSize:11,fontWeight:600,color:"var(--fg)"}}>{m.name}</div><div style={{fontSize:9,color:"var(--fg2)"}}>{m.email}</div></div>
              </div>
              <button onClick={async()=>{const dept=prompt("Department for "+m.name+"?","Development");if(!dept)return;const{data}=await supabase.from('user_roles').insert({email:m.email,name:m.name,role:'viewer',dept,timezone:m.tz||'Europe/Istanbul',work_start:'09:00',work_end:'18:00',employment_type:'full_time',avatar_url:m.avatar||''}).select();if(data){setUserRoles(p=>[...p,...data]);showToast(m.name+" added to team")}}} className="btn-pop" style={{padding:"4px 12px",borderRadius:6,border:"none",background:"#3B82F6",color:"#fff",fontSize:10,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>+ Add to Team</button>
            </div>)}
          </div>
        </div>:null})()}

      {/* ─── WHO'S OFF + UPCOMING HOLIDAYS ─── */}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        {/* Off Today */}
        {(()=>{const offToday=userRoles.filter(ur=>leaves.some(l=>l.person===ur.name&&l.status==="approved"&&l.start_date<=today&&l.end_date>=today));
          return offToday.length>0?<div className="asl" style={{flex:1,minWidth:200,background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.2)",borderRadius:10,padding:12,display:"flex",alignItems:"center",gap:10,animationDelay:"40ms"}}>
            <span style={{color:"#F59E0B"}}>{I.leaf(16)}</span>
            <div style={{fontSize:11,color:"var(--fg)"}}>
              <span style={{fontWeight:700}}>Off today:</span>{" "}
              {offToday.map((ur,i)=><span key={ur.id}>{i>0?", ":""}<span style={{fontWeight:600}}>{ur.name?.split(" ")[0]}</span><span style={{color:"var(--fg2)",fontSize:9}}> ({leaves.find(l=>l.person===ur.name&&l.status==="approved"&&l.start_date<=today&&l.end_date>=today)?.leave_type})</span></span>)}
            </div>
          </div>:<div className="asl" style={{flex:1,minWidth:200,background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.2)",borderRadius:10,padding:12,display:"flex",alignItems:"center",gap:10,animationDelay:"40ms"}}>
            <span style={{color:"#10B981"}}>{I.check(16)}</span>
            <span style={{fontSize:11,fontWeight:600,color:"#10B981"}}>Full team available today</span>
          </div>})()}

        {/* Next Holiday */}
        {(()=>{const upcoming=publicHolidays.filter(h=>h.d>=today).sort((a,b)=>a.d.localeCompare(b.d));const next=upcoming[0];
          if(!next)return null;
          const daysUntil=Math.ceil((new Date(next.d+"T00:00:00").getTime()-new Date(today+"T00:00:00").getTime())/86400000);
          return <div className="asl" style={{flex:1,minWidth:200,background:"rgba(99,102,241,.06)",border:"1px solid rgba(99,102,241,.2)",borderRadius:10,padding:12,display:"flex",alignItems:"center",gap:10,animationDelay:"60ms"}}>
            <span style={{color:"#6366F1"}}>{I.calendar(16)}</span>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"var(--fg)"}}>{next.l}</div>
              <div style={{fontSize:9,color:"var(--fg2)"}}>{fD(next.d)} · {daysUntil===0?"Today":daysUntil===1?"Tomorrow":daysUntil+" days away"} · {next.c.split(",").join(" + ")}</div>
            </div>
          </div>})()}
      </div>

      {/* Upcoming leaves (next 7 days) */}
      {(()=>{const next7=new Date();next7.setDate(next7.getDate()+7);const next7Str=next7.toISOString().split("T")[0];const upcoming=leaves.filter(l=>l.status==="approved"&&l.start_date>today&&l.start_date<=next7Str);return upcoming.length>0?<div className="asl" style={{background:"rgba(139,92,246,.06)",border:"1px solid rgba(139,92,246,.2)",borderRadius:10,padding:12,marginBottom:12,display:"flex",alignItems:"center",gap:10}}><span style={{color:"#8B5CF6"}}>{I.calendar(16)}</span><div style={{fontSize:11,color:"var(--fg)"}}><span style={{fontWeight:700}}>Upcoming leave:</span>{" "}{upcoming.slice(0,4).map((l,i)=>{const days=Math.ceil((new Date(l.start_date)-new Date(today))/86400000);return <span key={l.id}>{i>0?" · ":""}<span style={{fontWeight:600}}>{l.person?.split(" ")[0]}</span><span style={{color:"var(--fg2)",fontSize:9}}> in {days}d</span></span>})}</div></div>:null})()}

      {/* Upcoming meetings */}
      {(()=>{const nextMeet=meetings.filter(m=>m.schedule).slice(0,2);return nextMeet.length>0?<div className="asl" style={{background:"rgba(6,182,212,.06)",border:"1px solid rgba(6,182,212,.2)",borderRadius:10,padding:12,marginBottom:12,display:"flex",alignItems:"center",gap:10}}><span style={{color:"#06B6D4"}}>{I.clock(16)}</span><div style={{fontSize:11,color:"var(--fg)"}}><span style={{fontWeight:700}}>Next meetings:</span>{" "}{nextMeet.map((m,i)=><span key={m.id}>{i>0?" · ":""}<span style={{fontWeight:600}}>{m.name}</span><span style={{color:"var(--fg2)",fontSize:9}}> {m.schedule}{m.meeting_link?" ":"" }</span>{m.meeting_link&&<a href={m.meeting_link} target="_blank" rel="noopener" style={{fontSize:9,color:"#06B6D4",textDecoration:"none"}}>Join</a>}</span>)}</div></div>:null})()}

      {/* Hero Metrics Row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:20}}>
        {[
          {label:"Total Tasks",val:stats.total,color:"#3B82F6",icon:"list"},
          {label:"In Progress",val:stats.doing,color:"#F59E0B",icon:"zap"},
          {label:"Completed",val:stats.done,color:"#10B981",icon:"check"},
          {label:"Overdue",val:stats.overdue,color:"#EF4444",icon:"fire"},
          {label:"At Risk",val:stats.risk,color:"#F97316",icon:"alert"},
          {label:"Team Size",val:userRoles.length,color:"#8B5CF6",icon:"users"},
        ].map((m,i)=><div key={i} className="stat-card asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,borderLeft:"4px solid "+m.color,animationDelay:i*80+"ms"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{color:m.color}}>{I[m.icon]&&I[m.icon](20)}</span>
            <span style={{fontSize:24,fontWeight:800,color:m.color}}>{m.val}</span>
          </div>
          <div style={{fontSize:11,fontWeight:600,color:"var(--fg2)"}}>{m.label}</div>
        </div>)}
      </div>

      {/* Two-column layout */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}} className="mob-col1">
        {/* Phase Progress */}
        <div className="ch asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,animationDelay:"100ms"}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--fg)",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>{ I.chart(14)} Phase Progress</div>
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
          <div style={{fontSize:13,fontWeight:700,color:"var(--fg)",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>{ I.calendar(14)} Upcoming Deadlines</div>
          {(()=>{const active=tasks.filter(t=>t.status!=="Done"&&t.end_date);const overdue=active.filter(t=>isOverdue(t)).sort((a,b)=>String(a.end_date).localeCompare(String(b.end_date)));const upcoming=active.filter(t=>!isOverdue(t)).sort((a,b)=>String(a.end_date).localeCompare(String(b.end_date)));
          return <>
            {overdue.length>0&&<div style={{fontSize:9,fontWeight:700,color:"#EF4444",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Overdue ({overdue.length})</div>}
            {overdue.slice(0,4).map((t,i)=><div key={t.id} className="rh asl" style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,animationDelay:i*40+"ms"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#EF4444",flexShrink:0}}/>
              <span style={{fontSize:11,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"#EF4444"}}>{t.name}</span>
              <span style={{fontSize:9,color:"#EF4444",fontWeight:700,flexShrink:0}}>{fD(t.end_date)}</span>
            </div>)}
            {upcoming.length>0&&<div style={{fontSize:9,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:.5,margin:overdue.length>0?"8px 0 4px":"0 0 4px"}}>Upcoming</div>}
            {upcoming.slice(0,6).map((t,i)=><div key={t.id} className="rh asl" style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,animationDelay:i*40+"ms"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:CL[t.dept]||"#94A3B8",flexShrink:0}}/>
              <span style={{fontSize:11,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--fg)"}}>{t.name}</span>
              <span style={{fontSize:9,color:"var(--fg2)",flexShrink:0}}>{fD(t.end_date)}</span>
            </div>)}
            {active.length===0&&<div style={{textAlign:"center",padding:20,color:"var(--fg2)",fontSize:11}}>No deadlines</div>}
          </>})()}
        </div>
      </div>

      {/* Second row */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}} className="mob-col1">
        {/* KPI Health */}
        <div className="ch asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,animationDelay:"200ms"}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--fg)",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>{ I.target(14)} KPI Health</div>
          {kpis.length>0?<div>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              {[{l:"On Track",c:"#10B981",n:kpis.filter(k=>k.flag==="green").length},{l:"Attention",c:"#F59E0B",n:kpis.filter(k=>k.flag==="yellow").length},{l:"Critical",c:"#EF4444",n:kpis.filter(k=>k.flag==="red").length}].map(s=><div key={s.l} style={{flex:1,textAlign:"center",padding:6,background:s.c+"10",borderRadius:6}}>
                <div style={{fontSize:16,fontWeight:800,color:s.c}}>{s.n}</div><div style={{fontSize:8,color:"var(--fg2)"}}>{s.l}</div>
              </div>)}
            </div>
            {kpis.slice(0,6).map((k,i)=><div key={k.id} className="rh" style={{display:"flex",alignItems:"center",gap:6,padding:"4px 6px",borderRadius:4,fontSize:10}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:FC[k.flag],flexShrink:0}}/>
              <span style={{flex:1,color:"var(--fg)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{k.name}</span>
              <span style={{fontWeight:700,color:FC[k.flag],fontSize:9}}>{k.current_value||"—"}</span>
            </div>)}
            {kpis.length>6&&<div style={{fontSize:9,color:"#3B82F6",textAlign:"center",marginTop:4,cursor:"pointer"}} onClick={()=>setView("kpi")}>+{kpis.length-6} more →</div>}
          </div>:<div style={{textAlign:"center",padding:20,color:"var(--fg2)",fontSize:11}}>No KPIs configured yet</div>}
        </div>

        {/* Risk Summary */}
        <div className="ch asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,animationDelay:"250ms"}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--fg)",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>{ I.shield(14)} Risk Summary</div>
          {risks.length>0?<div>
            {risks.filter(r=>r.status==="ACTIVE").slice(0,5).map((r,i)=><div key={r.id} className="rh asl" style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,borderLeft:"3px solid "+(r.impact==="CRITICAL"?"#EF4444":r.impact==="HIGH"?"#F97316":"#F59E0B"),marginBottom:4,animationDelay:i*40+"ms"}}>
              <span style={{fontSize:10,flex:1,color:"var(--fg)"}}>{r.description}</span>
              <Bdg bg={r.impact==="CRITICAL"?"#FEE2E2":"#FEF3C7"} c={r.impact==="CRITICAL"?"#DC2626":"#D97706"}>{r.impact}</Bdg>
            </div>)}
            {risks.filter(r=>r.status==="ACTIVE").length===0&&<div style={{textAlign:"center",padding:20,color:"var(--fg2)",fontSize:11}}>No active risks</div>}
          </div>:<div style={{textAlign:"center",padding:20,color:"var(--fg2)",fontSize:11}}>No risks logged yet</div>}
        </div>
      </div>

      {/* Decisions Pending */}
      <div className="asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,marginBottom:16,animationDelay:"280ms"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--fg)",display:"flex",alignItems:"center",gap:6}}>{I.alert(14)} Decisions Pending</div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:20,fontWeight:800,color:decisions.filter(d=>d.status==="open").length>0?"#EF4444":"#10B981"}}>{decisions.filter(d=>d.status==="open").length}</span>
            {canEdit&&<button onClick={()=>setAddModal("decision")} className="btn-pop" style={{fontSize:9,padding:"3px 8px",borderRadius:6,border:"1px solid var(--border)",background:"var(--bg2)",color:"var(--fg2)",cursor:"pointer"}}>+ Add</button>}
          </div>
        </div>
        {decisions.filter(d=>d.status==="open").length===0?<div style={{fontSize:11,color:"var(--fg2)",textAlign:"center",padding:8}}>No open decisions</div>
        :decisions.filter(d=>d.status==="open").slice(0,5).map((d,i)=>{
          const age=d.created_at?Math.floor((Date.now()-new Date(d.created_at).getTime())/86400000):0;
          return <div key={d.id} className="rh asl" style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,borderLeft:"3px solid "+(d.priority==="critical"?"#EF4444":d.priority==="high"?"#F97316":"#F59E0B"),marginBottom:3,animationDelay:i*40+"ms"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,fontWeight:600,color:"var(--fg)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.title}</div>
              <div style={{fontSize:9,color:"var(--fg2)"}}>{d.owner} · {age}d open</div>
            </div>
            <Bdg bg={d.priority==="critical"?"#FEE2E2":d.priority==="high"?"#FEF3C7":"#F1F5F9"} c={d.priority==="critical"?"#DC2626":d.priority==="high"?"#D97706":"#64748B"}>{d.priority}</Bdg>
            {canEdit&&<button onClick={()=>updateDecision(d.id,{status:"decided",decided_date:today})} style={{fontSize:8,padding:"2px 6px",borderRadius:4,border:"1px solid #10B981",background:"#DCFCE7",color:"#166534",cursor:"pointer",fontWeight:600}}>Decide</button>}
          </div>})}
      </div>

      {/* Standup Compliance */}
      {(()=>{const todayStr=today;const submitted=standups.filter(s=>String(s.standup_date).split('T')[0]===todayStr&&s.person!=="Efehan Maleri").map(s=>s.person);const allMembers=userRoles.filter(ur=>ur.name!=="Efehan Maleri").map(ur=>ur.name);const notSubmitted=allMembers.filter(n=>!submitted.includes(n));
        return <div className="asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,animationDelay:"320ms"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:700,color:"var(--fg)",display:"flex",alignItems:"center",gap:6}}>{I.list(14)} Standup Today</div>
            <span style={{fontSize:12,fontWeight:700,color:submitted.length>=allMembers.length?"#10B981":"#F59E0B"}}>{submitted.length}/{allMembers.length}</span>
          </div>
          {notSubmitted.length>0?<div style={{fontSize:10,color:"var(--fg2)"}}>
            <span style={{fontWeight:600,color:"#EF4444"}}>Not submitted:</span> {notSubmitted.map(n=>n.split(" ")[0]).join(", ")}
          </div>:<div style={{fontSize:10,color:"#10B981",fontWeight:600}}>All submitted</div>}
        </div>})()}

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
        {ganttMode==="department"&&<button onClick={()=>{setDeptLoading(true);fetch('/api/linear-tasks').then(r=>r.json()).then(d=>{setDeptTasks(d);setDeptLoading(false);showToast("Synced from Linear + Asana")}).catch(()=>{setDeptLoading(false);showToast("Sync failed","error")})}} style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>Refresh from Linear + Asana</button>}
      </div>

      {/* COMPANY GANTT */}
      {ganttMode==="company"&&<div style={{background:"var(--card)",borderRadius:10,border:"1px solid var(--border)",position:"relative"}}>{(()=>{const tOff=Math.max(0,daysB(TL_START,today));const tPct=25+(tOff/TL_DAYS)*75;return tPct>25&&tPct<100?<div style={{position:"absolute",top:8,bottom:8,left:tPct+"%",width:0,borderLeft:"1.5px dashed #EF4444",zIndex:5,pointerEvents:"none",opacity:.45}}><div style={{position:"absolute",top:-6,left:-16,background:"var(--card)",border:"1px solid #EF4444",color:"#EF4444",fontSize:7,fontWeight:700,padding:"1px 5px",borderRadius:99,whiteSpace:"nowrap"}}>Today</div></div>:null})()}{STS.map(st=>{const items=tasks.filter(t=>t.status===st&&(personFilter==="all"||t.owner===personFilter));return <div key={st} style={{padding:"12px 16px",borderBottom:"1px solid var(--border)"}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:8,display:"flex",alignItems:"center",gap:8,color:"var(--fg)"}}>▼ {st}<span style={{background:"var(--bg3)",borderRadius:99,padding:"1px 8px",fontSize:11,color:"var(--fg2)"}}>{items.length}</span></div>
        {items.map((t,idx)=>{const cl=CL[t.dept]||"#94A3B8";
          const startStr=String(t.start_date).split('T')[0];const endStr=String(t.end_date).split('T')[0];
          const sOff=Math.max(0,daysB(TL_START,startStr));
          const dur=Math.max(1,daysB(startStr,endStr)+1);
          const leftPct=(sOff/TL_DAYS)*100;
          const widthPct=Math.max((dur/TL_DAYS)*100,0.5);
          const od=isOverdue(t);
          const isLinked=t.linked_project||t.linked_task_url;
          const srcType=t.linked_source==="asana"?"Asana":t.linked_project?"Linear":t.linked_task_url?"Linked":"Manual";
          return <div key={t.id} className={rowClass(t)+" asl"} style={{display:"flex",alignItems:"center",gap:12,padding:"5px 8px",cursor:"pointer",borderRadius:6,animationDelay:idx*25+"ms"}} onClick={()=>setSel(t)}>
            <div style={{width:"clamp(120px,25vw,220px)",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              <div style={{width:20,height:20,borderRadius:"50%",background:cl,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{color:"#fff",fontSize:8,fontWeight:700}}>{t.owner?.[0]}</span></div>
              <span style={{fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--fg)",textDecoration:t.status==="Done"?"line-through":"none"}}>{t.name}</span>
              <span style={{fontSize:7,padding:"1px 4px",borderRadius:3,fontWeight:700,flexShrink:0,background:isLinked?(srcType==="Asana"?"#F472B615":"#6366F115"):"var(--bg3)",color:isLinked?(srcType==="Asana"?"#EC4899":"#6366F1"):"var(--fg2)"}}>{srcType==="Manual"?"M":srcType==="Asana"?"A":"L"}</span>
            </div>
            <div style={{flex:1,height:26,background:"var(--bg3)",borderRadius:6,position:"relative",overflow:"hidden"}}>
              <div className="bar-g" style={{position:"absolute",left:leftPct+"%",width:widthPct+"%",top:2,bottom:2,borderRadius:4,background:od?"linear-gradient(90deg,#EF4444,#F87171)":"linear-gradient(90deg,"+cl+","+cl+"CC)",opacity:t.status==="Done"?.3:.9,display:"flex",alignItems:"center",paddingLeft:6,animationDelay:idx*40+"ms",overflow:"hidden"}}>
                {t.progress>0&&t.progress<100&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:t.progress+"%",background:"rgba(255,255,255,.2)",borderRadius:4}}/>}
                <span style={{color:"#fff",fontSize:9,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",position:"relative",zIndex:1}}>{t.progress>0?t.progress+"% · ":""}{fD(startStr)} – {fD(endStr)}</span>
              </div>
            </div>
            {od&&<div className="pulse-dot" style={{width:10,height:10,borderRadius:"50%",background:"#EF4444",flexShrink:0}}/>}
            {!od&&t.risk==="At risk"&&<div style={{width:8,height:8,borderRadius:"50%",background:"#F59E0B",flexShrink:0}}/>}
            {!od&&t.risk==="Off track"&&<div className="pulse-dot" style={{width:8,height:8,borderRadius:"50%",background:"#EF4444",flexShrink:0}}/>}
          </div>})}
      </div>})}</div>}

      {/* DEPARTMENT VIEW — grouped by ACTUAL department, not Linear/Asana project */}
      {ganttMode==="department"&&<div>
        {deptLoading&&<div style={{textAlign:"center",padding:40,color:"var(--fg2)"}}>Loading from Linear + Asana...</div>}
        {!deptLoading&&!deptTasks&&<div style={{textAlign:"center",padding:40,color:"var(--fg2)"}}>Click "Department" to load tickets</div>}
        {!deptLoading&&deptTasks&&(()=>{
          // Map project name → department fallback
          const projectToDept=(p)=>{
            if(/marketing/i.test(p))return"Marketing";
            if(/design/i.test(p))return"Design";
            if(/(ai|ml|research|science)/i.test(p))return"AI/Science";
            if(/(ops|pmo)/i.test(p))return"PMO";
            if(/(phase|attimo-core|aec|sdk|dev|core)/i.test(p))return"Development";
            return"Other";
          };
          // Re-group all tickets by department
          const byDept={};
          Object.entries(deptTasks.projects||{}).forEach(([proj,tickets])=>{
            tickets.forEach(t=>{
              const personName=rN(t.person);
              const dept=N2D[personName]||projectToDept(proj);
              if(!byDept[dept])byDept[dept]=[];
              byDept[dept].push({...t,_project:proj,_source:deptTasks.sources?.[proj]||'Linear'});
            });
          });
          // Available departments (with tickets)
          const availableDepts=Object.keys(byDept).sort();
          // Apply person + dept filter
          const filterTickets=arr=>arr.filter(t=>personFilter==="all"||rN(t.person)===personFilter);
          const visibleDepts=deptFilter==="all"?availableDepts:availableDepts.filter(d=>d===deptFilter);

          return <div>
            {/* Top control row: view mode + dept filter */}
            <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
              <div style={{display:"flex",gap:4,background:"var(--bg3)",borderRadius:8,padding:2,width:"fit-content"}}>
                {["list","gantt"].map(m=><button key={m} onClick={()=>setDvm(m)} style={{padding:"6px 14px",borderRadius:6,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",background:dvm===m?"var(--fg)":"transparent",color:dvm===m?"var(--bg)":"var(--fg2)",transition:"all .2s",textTransform:"capitalize"}}>{m}</button>)}
              </div>
              <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)} style={{padding:"6px 12px",borderRadius:6,border:"1px solid var(--border)",fontSize:11,background:"var(--bg2)",color:"var(--fg)",fontWeight:600,cursor:"pointer"}}>
                <option value="all">All Departments ({availableDepts.length})</option>
                {availableDepts.map(d=>{const c=byDept[d].filter(t=>personFilter==="all"||rN(t.person)===personFilter).length;return <option key={d} value={d}>{d} ({c})</option>})}
              </select>
            </div>

            {/* Department Progress Summary */}
            <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--fg)",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>{I.chart(14)} Progress by Department</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
                {availableDepts.map(dept=>{
                  const allT=filterTickets(byDept[dept]);
                  if(allT.length===0)return null;
                  const done=allT.filter(t=>t.status==="Done").length;
                  const doing=allT.filter(t=>t.status==="Doing").length;
                  const overdue=allT.filter(t=>t.isOverdue).length;
                  const pct=Math.round((done/allT.length)*100);
                  const cl=CL[dept]||"#6366F1";
                  return <div key={dept} onClick={()=>setDeptFilter(deptFilter===dept?"all":dept)} className="ch" style={{background:"var(--bg2)",borderRadius:10,padding:12,borderLeft:"3px solid "+cl,cursor:"pointer",outline:deptFilter===dept?"2px solid "+cl:"none"}}>
                    <div style={{fontSize:11,fontWeight:700,color:"var(--fg)",marginBottom:6}}>{dept}</div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"var(--fg2)",marginBottom:4}}><span>{done}/{allT.length} done</span><span style={{fontWeight:700,color:cl}}>{pct}%</span></div>
                    <div style={{height:6,background:"var(--bg3)",borderRadius:3,overflow:"hidden"}}><div className="bar-g" style={{height:"100%",width:pct+"%",borderRadius:3,background:cl}}/></div>
                    <div style={{display:"flex",gap:8,marginTop:6,fontSize:8,color:"var(--fg2)"}}><span style={{color:"#F59E0B"}}>{doing} doing</span>{overdue>0&&<span style={{color:"#EF4444",fontWeight:700}}>{overdue} overdue</span>}</div>
                  </div>;
                })}
              </div>
            </div>

            {/* Department groups — main rendering */}
            {visibleDepts.map(dept=>{
              const cl=CL[dept]||"#6366F1";
              const allT=filterTickets(byDept[dept]);
              if(allT.length===0)return null;
              const doing=allT.filter(t=>t.status==="Doing").length;
              const done=allT.filter(t=>t.status==="Done").length;
              const overdue=allT.filter(t=>t.isOverdue).length;
              return <div key={dept} className="asl" style={{marginBottom:16}}>
                <div style={{background:cl+"15",color:cl,padding:"10px 14px",borderRadius:"10px 10px 0 0",fontWeight:700,fontSize:13,borderLeft:"4px solid "+cl,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>{dept}</span>
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
                        leftPct=(idx/Math.max(items.length,1))*70+5;widthPct=8;dateLabel="no date";
                      }
                      const noDate=!hasDue&&t.status!=="Done";
                      return <div key={t.id} className={"rh asl"+(od?" overdue-row":"")+(noDate?" overdue-row":"")} style={{display:"flex",alignItems:"center",gap:12,padding:"5px 8px",cursor:"pointer",borderRadius:6,animationDelay:idx*25+"ms"}} onClick={()=>t.url&&window.open(t.url,'_blank')}>
                        <div style={{width:"clamp(120px,25vw,220px)",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                          <div style={{width:20,height:20,borderRadius:"50%",background:noDate?"#EF4444":cl,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{color:"#fff",fontSize:8,fontWeight:700}}>{dn?.[0]}</span></div>
                          <span style={{fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:noDate?"#EF4444":"var(--fg)",textDecoration:t.status==="Done"?"line-through":"none"}}>{t.title}</span>
                          {noDate&&<span style={{fontSize:7,color:"#EF4444",background:"#FEE2E2",padding:"1px 4px",borderRadius:3,flexShrink:0,fontWeight:700}}>NO DATE</span>}
                          {t.identifier&&<span style={{fontSize:7,color:"var(--fg2)",background:"var(--bg3)",padding:"1px 3px",borderRadius:3,flexShrink:0,fontFamily:"monospace"}}>{t.identifier}</span>}
                          <span style={{fontSize:7,padding:"1px 4px",borderRadius:3,background:t._source==="Asana"?"#F472B620":"#6366F120",color:t._source==="Asana"?"#EC4899":"#6366F1",fontWeight:700,flexShrink:0}}>{t._source==="Asana"?"A":"L"}</span>
                        </div>
                        <div style={{flex:1,height:26,background:"var(--bg3)",borderRadius:6,position:"relative",overflow:"hidden"}}>
                          <div className="bar-g" style={{position:"absolute",left:leftPct+"%",width:widthPct+"%",top:2,bottom:2,borderRadius:4,background:noDate?"linear-gradient(90deg,#EF4444,#F87171)":od?"linear-gradient(90deg,#EF4444,#F87171)":t.status==="Done"?"linear-gradient(90deg,#10B981,#34D399)":"linear-gradient(90deg,"+cl+","+cl+"CC)",opacity:hasDue?(t.status==="Done"?.3:.9):(t.status==="Done"?.15:.6),display:"flex",alignItems:"center",paddingLeft:6,animationDelay:idx*40+"ms"}}>
                            <span style={{color:"#fff",fontSize:9,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden"}}>{dateLabel}</span>
                          </div>
                        </div>
                        <span style={{fontSize:10,color:"var(--fg2)",flexShrink:0,width:80,textAlign:"right"}}>{dn==="Unassigned"?"":dn}</span>
                        {od&&<div className="pulse-dot" style={{width:10,height:10,borderRadius:"50%",background:"#EF4444",flexShrink:0}}/>}
                      </div>;})}
                    {items.length>20&&<div style={{padding:"6px 12px",fontSize:10,color:"var(--fg2)",textAlign:"center"}}>...and {items.length-20} more</div>}
                  </div>;})
                  :allT.slice(0,25).map((t,idx)=>{const od=t.isOverdue;const dn=rN(t.person);const dnd=rND(t.person);
                    return <div key={t.id} className={"rh asl"+(od?" overdue-row":"")} style={{display:"flex",alignItems:"center",gap:12,padding:"5px 12px",borderBottom:"1px solid var(--border)",animationDelay:idx*20+"ms"}}>
                      <div style={{width:"clamp(120px,25vw,240px)",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                        <div style={{width:18,height:18,borderRadius:"50%",background:cl,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{color:"#fff",fontSize:7,fontWeight:700}}>{dn?.[0]}</span></div>
                        {t.url?<a href={t.url} target="_blank" rel="noopener" style={{fontSize:11,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--fg)",textDecoration:"none"}} onMouseEnter={e=>e.target.style.color="#3B82F6"} onMouseLeave={e=>e.target.style.color="var(--fg)"}>{t.title}</a>:<span style={{fontSize:11,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--fg)"}}>{t.title}</span>}
                        {t.identifier&&<span style={{fontSize:8,color:"var(--fg2)",background:"var(--bg3)",padding:"1px 4px",borderRadius:4,flexShrink:0,fontFamily:"monospace"}}>{t.identifier}</span>}
                        <span style={{fontSize:7,padding:"1px 4px",borderRadius:3,background:t._source==="Asana"?"#F472B620":"#6366F120",color:t._source==="Asana"?"#EC4899":"#6366F1",fontWeight:700,flexShrink:0}}>{t._source==="Asana"?"A":"L"}</span>
                      </div>
                      <div style={{flex:1,display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:99,background:t.status==="Done"?"#DCFCE7":t.status==="Doing"?"#FEF3C7":"#E0E7FF",color:t.status==="Done"?"#166534":t.status==="Doing"?"#92400E":"#3730A3"}}>{t.status}</span>
                        {t.dueDate&&<span style={{fontSize:10,color:od?"#EF4444":"var(--fg2)"}}>{od?"Overdue: ":"Due: "}{fD(t.dueDate)}</span>}
                      </div>
                      <span style={{fontSize:10,color:"var(--fg2)",flexShrink:0}}>{dnd}</span>
                      {od&&<div className="pulse-dot" style={{width:8,height:8,borderRadius:"50%",background:"#EF4444",flexShrink:0}}/>}
                    </div>;})}
                  {dvm==="list"&&allT.length>25&&<div style={{padding:"8px 12px",fontSize:11,color:"var(--fg2)",textAlign:"center"}}>...and {allT.length-25} more tickets</div>}
                </div>
              </div>;
            })}
          </div>;
        })()}
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
            <div style={{fontSize:13,fontWeight:600,marginBottom:6,color:od?"#DC2626":"var(--fg)",display:"flex",alignItems:"center",gap:4}}>{t.name}{od&&<span style={{fontSize:9,marginLeft:4,color:"#EF4444",animation:"pulse 1.5s infinite"}}>OVERDUE</span>}{(t.linked_project||t.linked_task_url)&&<span style={{fontSize:7,padding:"1px 3px",borderRadius:3,background:t.linked_source==="asana"?"#F472B615":"#6366F115",color:t.linked_source==="asana"?"#EC4899":"#6366F1",fontWeight:700,flexShrink:0}}>{t.linked_source==="asana"?"A":"L"}</span>}</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>{pc&&<Bdg bg={pc.bg} c={pc.c}>{t.priority}</Bdg>}{rc&&<Bdg bg={rc.bg} c={rc.c}>{t.risk}</Bdg>}{t.progress>0&&<Bdg bg="#DBEAFE" c="#1D4ED8">{t.progress}%</Bdg>}</div>
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
          <button onClick={()=>{showToast("Syncing standups...");fetch('/api/digest').then(r=>r.json()).then(()=>{showToast("Standup synced");supabase.from('standups').select('*').order('standup_date',{ascending:false}).order('created_at',{ascending:false}).limit(100).then(({data})=>{if(data)setStandups(data)})}).catch(()=>showToast("Sync failed","error"))}} style={{background:"var(--bg3)",color:"var(--fg)",border:"1px solid var(--border)",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>Sync from Linear + Asana</button>
          <a href="https://attimo-labs.slack.com/archives/daily-standup" target="_blank" rel="noopener" style={{fontSize:11,color:"#3B82F6",fontWeight:600,textDecoration:"none",background:"#EFF6FF",padding:"6px 14px",borderRadius:8,display:"flex",alignItems:"center"}}>Open #daily-standup</a>
        </div>
      </div>
      <div style={{background:"var(--bg2)",padding:"8px 12px",borderRadius:8,fontSize:11,color:"var(--fg2)",marginBottom:16}}>Updates from Slack workflow and manual entries. Syncs when you click Sync All. Slack workflow sends DMs at 5pm daily.</div>
      {/* Not Submitted callout */}
      {(()=>{const todayStr=today;const submitted=standups.filter(s=>String(s.standup_date).split('T')[0]===todayStr&&s.person!=="Efehan Maleri").map(s=>s.person);const allNames=userRoles.filter(ur=>ur.name!=="Efehan Maleri").map(ur=>ur.name);const missing=allNames.filter(n=>!submitted.includes(n));
        const nowH=new Date().getHours();
        return missing.length>0&&nowH>=10?<div className="af" style={{background:"#FEE2E215",border:"1px solid #FCA5A530",borderRadius:10,padding:12,marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"#EF4444",marginBottom:4,display:"flex",alignItems:"center",gap:6}}>{I.alert(12)} Not submitted today ({missing.length})</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{missing.map(n=><span key={n} style={{fontSize:10,padding:"3px 8px",borderRadius:99,background:"#FEE2E2",color:"#DC2626",fontWeight:600}}>{n.split(" ")[0]}</span>)}</div>
        </div>:null})()}
      {(()=>{
        const byDate={};standups.filter(s=>s.person!=="Efehan Maleri").forEach(s=>{const d=String(s.standup_date).split('T')[0];if(!byDate[d])byDate[d]=[];byDate[d].push(s)});
        const dates=Object.keys(byDate).sort((a,b)=>b.localeCompare(a));
        if(dates.length===0)return <div style={{textAlign:"center",padding:40,color:"var(--fg2)"}}>No standup updates yet. Click "+ Add Update" or wait for the 5pm Slack workflow.</div>;
        return dates.map(date=><div key={date} className="asl" style={{marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--fg)",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:4,height:16,borderRadius:2,background:"#3B82F6"}}/>
            {new Date(date+"T00:00:00").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
            <span style={{background:"var(--bg3)",borderRadius:99,padding:"1px 8px",fontSize:10,color:"var(--fg2)"}}>{byDate[date].length} updates</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
            {byDate[date].map((s,si)=><div key={s.id} className="ch asl" style={{background:"var(--card)",borderRadius:10,padding:14,border:"1px solid var(--border)",borderLeft:"4px solid "+(CL[N2D[s.person]]||"#6366F1"),animationDelay:si*50+"ms"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  {(()=>{const ur=userRoles.find(r=>r.name===s.person);const av=ur?.avatar_url;return av?<img src={av} style={{width:24,height:24,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:24,height:24,borderRadius:"50%",background:CL[N2D[s.person]]||"#6366F1",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:10,fontWeight:700}}>{s.person?.[0]}</span></div>})()}
                  <div><span style={{fontWeight:700,fontSize:12,color:"var(--fg)"}}>{s.person}</span><div style={{fontSize:9,color:"var(--fg2)"}}>{N2D[s.person]||"Team"}</div></div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:8,color:"var(--fg2)",background:"var(--bg3)",padding:"2px 6px",borderRadius:99}}>{s.source==="slack"?"Slack":s.source==="auto-digest"?"Auto":"Manual"}</span>
                  <button onClick={()=>setConfirmDlg({msg:"Delete this standup entry?",fn:()=>deleteStandup(s.id)})} className="act-del" style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontSize:11}}>✕</button>
                </div>
              </div>
              {/* Structured sections */}
              {(()=>{const comp=(s.completed||"").split("\n").filter(l=>l.trim());const next=(s.tomorrow||"").split("\n").filter(l=>l.trim());const block=(s.blockers||"").split("\n").filter(l=>l.trim()&&l!=="None"&&l!=="none");
                return <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {comp.length>0&&<div style={{background:"rgba(16,185,129,.06)",borderRadius:6,padding:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>{I.check(10)}<span style={{color:"#10B981",fontWeight:700,fontSize:9,textTransform:"uppercase"}}>Done ({comp.length})</span></div>
                  {comp.map((l,i)=><div key={i} style={{fontSize:11,color:"var(--fg)",paddingLeft:14,lineHeight:1.5,display:"flex",alignItems:"flex-start",gap:4}}><span style={{color:"#10B981",fontSize:8,marginTop:4}}>●</span>{l.replace(/^[+\-•]\s*/,"")}</div>)}
                </div>}
                {next.length>0&&<div style={{background:"rgba(59,130,246,.06)",borderRadius:6,padding:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>{I.zap(10)}<span style={{color:"#3B82F6",fontWeight:700,fontSize:9,textTransform:"uppercase"}}>In Progress / Next ({next.length})</span></div>
                  {next.map((l,i)=><div key={i} style={{fontSize:11,color:"var(--fg)",paddingLeft:14,lineHeight:1.5,display:"flex",alignItems:"flex-start",gap:4}}><span style={{color:"#3B82F6",fontSize:8,marginTop:4}}>●</span>{l.replace(/^[+\-•]\s*/,"")}</div>)}
                </div>}
                {block.length>0&&<div style={{background:"rgba(239,68,68,.06)",borderRadius:6,padding:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>{I.alert(10)}<span style={{color:"#EF4444",fontWeight:700,fontSize:9,textTransform:"uppercase"}}>Blockers ({block.length})</span></div>
                  {block.map((l,i)=><div key={i} style={{fontSize:11,color:"#EF4444",paddingLeft:14,lineHeight:1.5,fontWeight:600,display:"flex",alignItems:"flex-start",gap:4}}><span style={{fontSize:8,marginTop:4}}>●</span>{l.replace(/^[+\-•]\s*/,"")}</div>)}
                </div>}
                {comp.length===0&&next.length===0&&block.length===0&&<div style={{fontSize:11,color:"var(--fg2)",fontStyle:"italic"}}>No updates</div>}
              </div>})()}
            </div>)}
          </div>
        </div>);
      })()}
    </div>}

    {/* ═══ RACI ═══ */}
    {/* ─── VITALS TAB — unified org health hub (replaces KPIs/RACI/Risks/Performance/Open Roles) ─── */}
    {view==="vitals"&&<div className="af" style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{fontSize:18,fontWeight:800,color:"var(--fg)"}}>Vitals</div>
          <div style={{fontSize:11,color:"var(--fg2)"}}>Company health, accountability, and signals — all in one place</div>
        </div>
        <button onClick={async()=>{showToast("Computing metrics...");try{const r=await fetch('/api/compute-metrics');const d=await r.json();if(d.ok){showToast("Metrics refreshed");const{data}=await supabase.from('metrics').select('*').order('computed_at',{ascending:false});if(data){const latest={};data.forEach(r=>{if(!latest[r.dept])latest[r.dept]=r});setMetricsData(latest)}}else showToast("Compute failed","error")}catch(e){showToast("Compute failed","error")}}} className="btn-pop" style={{padding:"7px 14px",background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer"}}>↻ Recompute Now</button>
      </div>
      <div style={{display:"flex",gap:4,background:"var(--bg3)",borderRadius:8,padding:3,marginBottom:16,flexWrap:"wrap"}}>
        {[{id:"overview",l:"Overview"},{id:"departments",l:"Departments"},{id:"people",l:"People"},{id:"accountability",l:"Accountability"},{id:"risks",l:"Risks"},{id:"hiring",l:"Hiring"}].map(t=><button key={t.id} onClick={()=>setVitalsTab(t.id)} style={{padding:"7px 14px",borderRadius:6,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",background:vitalsTab===t.id?"var(--fg)":"transparent",color:vitalsTab===t.id?"var(--bg)":"var(--fg2)",transition:"all .2s"}}>{t.l}</button>)}
      </div>
    </div>}

    {/* VITALS · OVERVIEW — company acceleration + dept health summary */}
    {view==="vitals"&&vitalsTab==="overview"&&<div className="af" style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Big company acceleration */}
      {(()=>{const depts=metricsData?Object.values(metricsData):[];const totalCurrent=depts.reduce((s,d)=>s+(d.tasks_current||0),0);const totalPrior=depts.reduce((s,d)=>s+(d.tasks_prior||0),0);const accel=totalPrior===0?(totalCurrent>0?100:0):Math.round(((totalCurrent-totalPrior)/totalPrior)*100);const c=accel>5?"#10B981":accel<-5?"#EF4444":"#94A3B8";const arrow=accel>5?"↗":accel<-5?"↘":"→";
        return <div style={{background:"linear-gradient(135deg,var(--card),var(--bg2))",border:"1px solid var(--border)",borderRadius:14,padding:24}}>
          <div style={{fontSize:11,color:"var(--fg2)",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Company Acceleration · This Fortnight</div>
          {!metricsData?<div style={{fontSize:28,color:"var(--fg2)"}}>Awaiting first compute (runs daily at 9am UTC)</div>
          :<div style={{display:"flex",alignItems:"baseline",gap:12,flexWrap:"wrap"}}>
            <div style={{fontSize:48,fontWeight:800,color:c,lineHeight:1}}>{accel>0?"+":""}{accel}%</div>
            <div style={{fontSize:32,color:c,fontWeight:700}}>{arrow}</div>
            <div style={{fontSize:13,color:"var(--fg2)"}}>{totalCurrent} tasks done · {totalPrior} prior · {Object.keys(metricsData).length} depts tracked</div>
          </div>}
        </div>;
      })()}

      {/* Per-department health cards (ranked by accel) */}
      {metricsData&&<div>
        <div style={{fontSize:12,fontWeight:700,color:"var(--fg)",marginBottom:8}}>Departments — Ranked by Acceleration</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
          {Object.entries(metricsData).sort((a,b)=>(b[1].acceleration_pct||0)-(a[1].acceleration_pct||0)).map(([dept,d])=>{
            const accel=d.acceleration_pct||0;const c=accel>5?"#10B981":accel<-5?"#EF4444":"#94A3B8";const arrow=accel>5?"↗":accel<-5?"↘":"→";const cl=CL[dept]||"#6366F1";
            const deptRisks=risks.filter(r=>r.status==="ACTIVE"&&r.description?.toLowerCase().includes(dept.toLowerCase()));
            const accountable=raci.find(r=>r.dept===dept&&r.a)?.a||"—";
            return <div key={dept} onClick={()=>{setVitalsTab("departments")}} className="ch asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderLeft:"3px solid "+cl,borderRadius:12,padding:14,cursor:"pointer"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div style={{fontSize:13,fontWeight:700,color:"var(--fg)"}}>{dept}</div>
                <div style={{fontSize:16,fontWeight:800,color:c}}>{accel>0?"+":""}{accel}% {arrow}</div>
              </div>
              <div style={{fontSize:10,color:"var(--fg2)",marginBottom:6}}>{(d.velocity||0).toFixed(1)} tasks/wk this fortnight · {(d.prior_velocity||0).toFixed(1)} prior</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",fontSize:9,marginTop:8}}>
                <span style={{padding:"2px 6px",borderRadius:4,background:"var(--bg3)",color:"var(--fg2)"}}>Lead: {accountable}</span>
                {deptRisks.length>0&&<span style={{padding:"2px 6px",borderRadius:4,background:"#FEE2E2",color:"#DC2626",fontWeight:700}}>{deptRisks.length} risk{deptRisks.length>1?"s":""}</span>}
              </div>
            </div>;
          })}
        </div>
      </div>}

      {/* Top active risks */}
      {(()=>{const top=risks.filter(r=>r.status==="ACTIVE"&&(r.impact==="HIGH"||r.impact==="CRITICAL")).slice(0,5);if(top.length===0)return null;
        return <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:12,fontWeight:700,color:"var(--fg)"}}>Top Active Risks</div>
            <button onClick={()=>setVitalsTab("risks")} style={{background:"none",border:"none",color:"#3B82F6",fontSize:10,fontWeight:600,cursor:"pointer"}}>View all →</button>
          </div>
          {top.map(r=><div key={r.id} className="rh" style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
            <div><div style={{fontSize:11,fontWeight:600,color:"var(--fg)"}}>{r.description}</div><div style={{fontSize:9,color:"var(--fg2)"}}>Owner: {r.owner||"unassigned"}</div></div>
            <span style={{fontSize:9,padding:"3px 8px",borderRadius:99,background:r.impact==="CRITICAL"?"#7F1D1D":"#FEE2E2",color:r.impact==="CRITICAL"?"#fff":"#DC2626",fontWeight:700}}>{r.impact}</span>
          </div>)}
        </div>;
      })()}
    </div>}

    {view==="vitals"&&vitalsTab==="accountability"&&<div className="af" style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",justifyContent:"space-between"}}><div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>RACI Matrix</div><button onClick={()=>setAddModal("raci")} className="act-add" style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add</button></div>
      <div style={{background:"var(--bg2)",padding:"8px 12px",borderRadius:8,fontSize:11,color:"var(--fg2)"}}><b>R</b>=Responsible <b>A</b>=Accountable <b>C</b>=Consulted <b>I</b>=Informed <span style={{color:"#3B82F6"}}>[Suggest]</span>=PMO suggestion</div>
      {/* RACI Conflict Detection */}
      {(()=>{const noR=raci.filter(r=>!r.responsible);const noA=raci.filter(r=>!r.accountable);const both=raci.filter(r=>!r.responsible&&!r.accountable);
        return (noR.length>0||noA.length>0)?<div className="af" style={{background:"#FEF3C720",border:"1px solid #FDE68A50",borderRadius:10,padding:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"#D97706",marginBottom:4,display:"flex",alignItems:"center",gap:6}}>{I.alert(12)} {both.length+noR.length+noA.length-both.length} RACI conflicts</div>
          {both.length>0&&<div style={{fontSize:10,color:"#DC2626",marginBottom:2}}>No R or A: {both.slice(0,4).map(r=>r.task).join(", ")}{both.length>4?" +more":""}</div>}
          {noR.filter(r=>r.accountable).length>0&&<div style={{fontSize:10,color:"#D97706",marginBottom:2}}>Missing R: {noR.filter(r=>r.accountable).slice(0,4).map(r=>r.task).join(", ")}</div>}
          {noA.filter(r=>r.responsible).length>0&&<div style={{fontSize:10,color:"#D97706"}}>Missing A: {noA.filter(r=>r.responsible).slice(0,4).map(r=>r.task).join(", ")}</div>}
        </div>:null})()}
      {Object.keys(raciByDept).length===0&&<div className="af" style={{textAlign:"center",padding:40,background:"var(--card)",borderRadius:12,border:"1px dashed var(--border)"}}>
        <div style={{color:"var(--fg2)",marginBottom:4}}>{I.list(24)}</div>
        <div style={{fontSize:13,fontWeight:600,color:"var(--fg)",marginBottom:4}}>No RACI entries yet</div>
        <div style={{fontSize:11,color:"var(--fg2)"}}>Click "+ Add" to define responsibilities for each department.</div>
      </div>}
      {Object.entries(raciByDept).map(([dept,rows],di)=><div key={dept} className="asl" style={{animationDelay:di*80+"ms"}}><DeptHdr dept={dept}/><Tbl headers={["Task","R","A","C","I","Notes",""]} rows={rows.map(r=>[
        <InEdit value={r.task} onChange={v=>updateRaci(r.id,{task:v})}/>,
        <InEdit value={r.responsible} onChange={v=>updateRaci(r.id,{responsible:v})}/>,
        <InEdit value={r.accountable} onChange={v=>updateRaci(r.id,{accountable:v})}/>,
        <InEdit value={r.consulted} onChange={v=>updateRaci(r.id,{consulted:v})}/>,
        <InEdit value={r.informed} onChange={v=>updateRaci(r.id,{informed:v})}/>,
        <InEdit value={r.notes} onChange={v=>updateRaci(r.id,{notes:v})}/>,
        <button onClick={()=>setConfirmDlg({msg:"Delete this RACI entry?",fn:()=>deleteRaci(r.id)})} className="act-del" style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer"}}>✕</button>
      ])}/></div>)}
    </div>}

    {/* ═══ KPIs ═══ */}
    {view==="vitals"&&vitalsTab==="departments"&&<div className="af" style={{display:"flex",flexDirection:"column",gap:16,maxWidth:1100,margin:"0 auto"}}>
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
    {view==="vitals"&&vitalsTab==="risks"&&<div className="af">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>Risk Register</div><button onClick={()=>setAddModal("risk")} className="act-add btn-pop" style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add Risk</button></div>
      {risks.length===0?<div className="af" style={{textAlign:"center",padding:40,background:"var(--card)",borderRadius:12,border:"1px dashed var(--border)"}}><div style={{color:"var(--fg2)",marginBottom:4}}>{I.shield(24)}</div><div style={{fontSize:13,fontWeight:600,color:"var(--fg)",marginBottom:4}}>No risks logged</div><div style={{fontSize:11,color:"var(--fg2)"}}>Click "+ Add Risk" to start tracking project risks.</div></div>
      :<Tbl headers={["#","Risk","Impact","Status","Mitigation","Stage","Owner","Age","Linked",""]} ids={risks.map(r=>r.id)} onReorder={(a,b)=>reorder("risks",risks,setRisks,a,b)} rows={risks.map(r=>{
        const age=r.created_date?Math.floor((Date.now()-new Date(r.created_date).getTime())/86400000):r.created_at?Math.floor((Date.now()-new Date(r.created_at).getTime())/86400000):0;
        return[<b>{r.id}</b>,<InEdit value={r.description} onChange={v=>updateRisk(r.id,{description:v})}/>,<InEdit value={r.impact} onChange={v=>updateRisk(r.id,{impact:v})} type="select" options={IMP_OPT}/>,<InEdit value={r.status} onChange={v=>updateRisk(r.id,{status:v})} type="select" options={["ACTIVE","MITIGATING","FUTURE","CLOSED"]}/>,<InEdit value={r.mitigation||""} onChange={v=>updateRisk(r.id,{mitigation:v})}/>,<InEdit value={r.mitigation_status||"identified"} onChange={v=>updateRisk(r.id,{mitigation_status:v})} type="select" options={["identified","mitigating","resolved","accepted"]}/>,<InEdit value={r.owner||""} onChange={v=>updateRisk(r.id,{owner:v})}/>,<span style={{fontSize:10,color:age>14?"#EF4444":age>7?"#F59E0B":"var(--fg2)",fontWeight:age>14?700:400}}>{age}d</span>,<span style={{fontSize:11}}><InEdit value={r.linked_to||""} onChange={v=>updateRisk(r.id,{linked_to:v})}/>{r.linked_to&&tasks.find(t=>t.id===r.linked_to||t.name===r.linked_to)?<div style={{fontSize:9,color:"#6366F1",marginTop:2}}>{"→ "+tasks.find(t=>t.id===r.linked_to||t.name===r.linked_to).name}</div>:null}</span>,<button onClick={()=>setConfirmDlg({msg:"Delete this risk?",fn:()=>deleteRisk(r.id)})} className="act-del" style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer"}}>✕</button>]})}/>}
    </div>}

    {/* ═══ OPEN ROLES (dynamic from DB) ═══ */}
    {view==="vitals"&&vitalsTab==="hiring"&&<div className="af">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>Open Hiring Positions</div><button onClick={()=>setAddModal("role")} className="act-add" style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add Role</button></div>
      <Tbl headers={["Role","Status","Trigger / Blocker","Target",""]} ids={roles.map(r=>r.id)} onReorder={(a,b)=>reorder("roles",roles,setRoles,a,b)} rows={roles.map(r=>[
        <InEdit value={r.title} onChange={v=>updateRole(r.id,{title:v})}/>,
        <InEdit value={r.status} onChange={v=>updateRole(r.id,{status:v})} type="select" options={["Not opened","Interviewing","Blocked","Filled"]}/>,
        <InEdit value={r.trigger_blocker} onChange={v=>updateRole(r.id,{trigger_blocker:v})}/>,
        <InEdit value={r.target_date} onChange={v=>updateRole(r.id,{target_date:v})}/>,
        <button onClick={()=>setConfirmDlg({msg:"Delete this role?",fn:()=>deleteRole(r.id)})} className="act-del" style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer"}}>✕</button>
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
        <Tbl headers={["Type","Meeting","When","Duration","Owner","Attendees","Link","",""]} rows={meetings.filter(m=>["Weekly","Bi-weekly","Monthly"].includes(m.type)).map(m=>[
          <InEdit value={m.type} onChange={v=>updateMeeting(m.id,{type:v})} type="select" options={["Weekly","Bi-weekly","Monthly","Milestone"]}/>,
          <InEdit value={m.name} onChange={v=>updateMeeting(m.id,{name:v})}/>,
          <InEdit value={m.schedule} onChange={v=>updateMeeting(m.id,{schedule:v})}/>,
          <InEdit value={m.duration} onChange={v=>updateMeeting(m.id,{duration:v})}/>,
          <InEdit value={m.owner} onChange={v=>updateMeeting(m.id,{owner:v})}/>,
          <InEdit value={m.attendees} onChange={v=>updateMeeting(m.id,{attendees:v})}/>,<InEdit value={m.meeting_link||""} onChange={v=>updateMeeting(m.id,{meeting_link:v})} />,
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{m.calendar_link?<a href={m.calendar_link} target="_blank" rel="noopener" style={{fontSize:9,color:"#10B981",fontWeight:600,textDecoration:"none",background:"rgba(16,185,129,.08)",padding:"4px 8px",borderRadius:6,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:3}}>{I.calendar(10)} Cal</a>:(role==="admin"||userRoles.find(r=>r.email===user?.email)?.name==="Mesude Gökpınar")?<a href={"https://calendar.google.com/calendar/r/eventedit?text="+encodeURIComponent(m.name||"")+"&details="+encodeURIComponent("Owner: "+(m.owner||"")+"\nAttendees: "+(m.attendees||""))} target="_blank" rel="noopener" style={{fontSize:9,color:"#3B82F6",fontWeight:600,textDecoration:"none",background:"rgba(59,130,246,.08)",padding:"4px 8px",borderRadius:6,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:3}}>{I.calendar(10)} Add</a>:null}{m.attendees_emails&&isEditor()&&<button onClick={()=>sendMeetingReminder(m)} style={{fontSize:9,color:"#8B5CF6",fontWeight:600,border:"none",cursor:"pointer",background:"rgba(139,92,246,.08)",padding:"4px 8px",borderRadius:6,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:3}}>↗ Remind</button>}</div>,
          <button onClick={()=>setConfirmDlg({msg:"Delete this meeting?",fn:()=>deleteMeeting(m.id)})} className="act-del" style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer"}}>✕</button>
        ])}/>
      </div>}
      {/* Milestone section */}
      {(meetFilter==="all"||meetFilter==="milestone")&&<div>
        {meetFilter==="all"&&<div style={{fontSize:13,fontWeight:700,color:"var(--fg)",marginBottom:8,display:"flex",alignItems:"center",gap:6}}><div style={{width:4,height:16,borderRadius:2,background:"#F59E0B"}}/> Milestone-Gated Meetings</div>}
        <Tbl headers={["Type","Meeting","When","Duration","Owner","Attendees","Link","",""]} rows={meetings.filter(m=>m.type==="Milestone").map(m=>[
          <InEdit value={m.type} onChange={v=>updateMeeting(m.id,{type:v})} type="select" options={["Weekly","Bi-weekly","Monthly","Milestone"]}/>,
          <InEdit value={m.name} onChange={v=>updateMeeting(m.id,{name:v})}/>,
          <InEdit value={m.schedule} onChange={v=>updateMeeting(m.id,{schedule:v})}/>,
          <InEdit value={m.duration} onChange={v=>updateMeeting(m.id,{duration:v})}/>,
          <InEdit value={m.owner} onChange={v=>updateMeeting(m.id,{owner:v})}/>,
          <InEdit value={m.attendees} onChange={v=>updateMeeting(m.id,{attendees:v})}/>,<InEdit value={m.meeting_link||""} onChange={v=>updateMeeting(m.id,{meeting_link:v})} />,
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{m.calendar_link?<a href={m.calendar_link} target="_blank" rel="noopener" style={{fontSize:9,color:"#10B981",fontWeight:600,textDecoration:"none",background:"rgba(16,185,129,.08)",padding:"4px 8px",borderRadius:6,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:3}}>{I.calendar(10)} Cal</a>:(role==="admin"||userRoles.find(r=>r.email===user?.email)?.name==="Mesude Gökpınar")?<a href={"https://calendar.google.com/calendar/r/eventedit?text="+encodeURIComponent(m.name||"")+"&details="+encodeURIComponent("Owner: "+(m.owner||"")+"\nAttendees: "+(m.attendees||""))} target="_blank" rel="noopener" style={{fontSize:9,color:"#3B82F6",fontWeight:600,textDecoration:"none",background:"rgba(59,130,246,.08)",padding:"4px 8px",borderRadius:6,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:3}}>{I.calendar(10)} Add</a>:null}{m.attendees_emails&&isEditor()&&<button onClick={()=>sendMeetingReminder(m)} style={{fontSize:9,color:"#8B5CF6",fontWeight:600,border:"none",cursor:"pointer",background:"rgba(139,92,246,.08)",padding:"4px 8px",borderRadius:6,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:3}}>↗ Remind</button>}</div>,
          <button onClick={()=>setConfirmDlg({msg:"Delete this meeting?",fn:()=>deleteMeeting(m.id)})} className="act-del" style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer"}}>✕</button>
        ])}/>
      </div>}

      {/* ─── MEETING NOTES (from Fireflies) ─── */}
      <div style={{marginTop:16,background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--fg)",display:"flex",alignItems:"center",gap:6}}>{I.list(14)} Meeting Notes</div>
          <button onClick={()=>{setNotesLoading(true);fetch('/api/fireflies-sync').then(r=>r.json()).then(d=>{setMeetingNotes(d);setNotesLoading(false)}).catch(()=>{setNotesLoading(false);showToast("Failed to load notes","error")})}} className="btn-pop" style={{padding:"4px 12px",borderRadius:6,border:"1px solid var(--border)",background:"var(--bg3)",color:"var(--fg2)",fontSize:10,fontWeight:600,cursor:"pointer"}}>{notesLoading?"Loading...":"Sync from Fireflies"}</button>
        </div>
        {!meetingNotes&&<div style={{fontSize:10,color:"var(--fg2)",textAlign:"center",padding:16}}>Click "Sync from Fireflies" to pull meeting transcripts and action items. Set FIREFLIES_API_KEY in Vercel first.</div>}
        {meetingNotes&&meetingNotes.meetings?.length===0&&<div style={{fontSize:10,color:"var(--fg2)",textAlign:"center",padding:16}}>No recent meeting notes found.</div>}
        {meetingNotes&&meetingNotes.meetings?.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
          {meetingNotes.meetings.slice(0,6).map((m,i)=><div key={m.id||i} className="ch asl" style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:10,padding:12,animationDelay:i*40+"ms"}}>
            <div style={{fontSize:12,fontWeight:700,color:"var(--fg)",marginBottom:4}}>{m.title}</div>
            <div style={{fontSize:9,color:"var(--fg2)",marginBottom:6}}>{m.date} · {m.duration} · {m.speakers?.length||0} speakers</div>
            {m.summary&&<div style={{fontSize:10,color:"var(--fg)",marginBottom:8,lineHeight:1.4}}>{m.summary.slice(0,200)}...</div>}
            {m.actionItems?.length>0&&<div style={{marginBottom:6}}>
              <div style={{fontSize:9,fontWeight:700,color:"#3B82F6",marginBottom:3}}>Action Items ({m.actionItems.length})</div>
              {m.actionItems.slice(0,3).map((a,ai)=><div key={ai} style={{fontSize:9,color:"var(--fg2)",paddingLeft:8,borderLeft:"2px solid #3B82F6",marginBottom:2}}>{a.speaker}: {a.text?.slice(0,80)}</div>)}
            </div>}
            {m.firefliesUrl&&<a href={m.firefliesUrl} target="_blank" rel="noopener" style={{fontSize:9,color:"#3B82F6",textDecoration:"none",fontWeight:600,marginTop:6,display:"inline-block"}}>Open full transcript →</a>}
          </div>)}
        </div>}
      </div>

      {/* ─── MEETING SLOT FINDER ─── */}
      <div style={{marginTop:16,background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--fg)",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>{I.clock(14)} Find Available Slot</div>
        <div style={{fontSize:10,color:"var(--fg2)",marginBottom:12}}>Select attendees → see when everyone is available across timezones</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
          {userRoles.map(ur=>{const sel=slotAttendees.includes(ur.email);return <button key={ur.id} onClick={()=>setSlotAttendees(p=>sel?p.filter(e=>e!==ur.email):[...p,ur.email])} className="btn-pop" style={{padding:"4px 10px",borderRadius:6,border:sel?"2px solid #3B82F6":"1px solid var(--border)",background:sel?"rgba(59,130,246,.1)":"var(--bg2)",color:sel?"#3B82F6":"var(--fg2)",fontSize:10,fontWeight:sel?700:500,cursor:"pointer"}}>{ur.name?.split(" ")[0]}</button>})}
        </div>
        {slotAttendees.length>=2&&<button onClick={()=>{setSlotLoading(true);fetch('/api/calendar-slots',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({emails:slotAttendees,days:5})}).then(r=>r.json()).then(d=>{setSlotFinder(d);setSlotLoading(false)}).catch(()=>{setSlotLoading(false);showToast("Failed to load slots","error")})}} className="btn-pop" style={{padding:"8px 16px",borderRadius:8,background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",marginBottom:12}}>{slotLoading?"Finding slots...":"Find Available Slots"}</button>}
        {slotAttendees.length<2&&<div style={{fontSize:10,color:"var(--fg2)",fontStyle:"italic"}}>Select at least 2 people to find common slots</div>}
        {slotFinder&&slotFinder.slots&&<div style={{overflowX:"auto",marginTop:8}}>
          {!slotFinder.hasCalendarData&&<div style={{fontSize:9,color:"#F59E0B",marginBottom:8,padding:"6px 10px",background:"#FEF3C720",borderRadius:6}}>Showing working hours overlap only. Connect Google Calendar API for real free/busy data.</div>}
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
            <thead><tr><th style={{padding:6,textAlign:"left",color:"var(--fg2)",borderBottom:"2px solid var(--border)"}}>Time</th>
              {slotFinder.slots.map(day=><th key={day.date} style={{padding:6,textAlign:"center",color:"var(--fg)",borderBottom:"2px solid var(--border)"}}>{day.dayName}</th>)}
            </tr></thead>
            <tbody>{Array.from({length:14},(_,i)=>i+7).map(h=><tr key={h}>
              <td style={{padding:4,fontSize:9,color:"var(--fg2)",borderTop:"1px solid var(--border)"}}>{h>12?h-12:h}:00 {h>=12?"PM":"AM"}</td>
              {slotFinder.slots.map(day=>{const slot=day.slots?.find(s=>s.hour===h);if(!slot)return <td key={day.date+h} style={{borderTop:"1px solid var(--border)"}}/>;
                const bg=slot.allAvailable?"#DCFCE7":slot.someAvailable?"#FEF3C7":"#FEE2E2";
                return <td key={day.date+h} className="rh" style={{padding:4,borderTop:"1px solid var(--border)",background:bg+"80",textAlign:"center",cursor:slot.allAvailable?"pointer":"default"}} title={slot.attendees.map(a=>a.name+(a.available?" ✓":" ✗")).join(", ")} onClick={()=>{if(slot.allAvailable)window.open("https://calendar.google.com/calendar/r/eventedit?text=Meeting&dates="+day.date.replace(/-/g,"")+"T"+String(h).padStart(2,"0")+"0000/"+day.date.replace(/-/g,"")+"T"+String(h+1).padStart(2,"0")+"0000&details="+encodeURIComponent("Attendees: "+slot.attendees.map(a=>a.name).join(", ")))}}>
                  <div style={{fontSize:9,fontWeight:700,color:slot.allAvailable?"#166534":slot.someAvailable?"#92400E":"#991B1B"}}>{slot.availableCount}/{slot.attendees.length}</div>
                  {slot.allAvailable&&<div style={{fontSize:7,color:"#10B981",fontWeight:700}}>BOOK</div>}
                </td>})}
            </tr>)}</tbody>
          </table>
          <div style={{display:"flex",gap:12,marginTop:8,fontSize:9,color:"var(--fg2)"}}>
            <span style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:10,height:10,borderRadius:2,background:"#DCFCE7"}}/> All free — click to book</span>
            <span style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:10,height:10,borderRadius:2,background:"#FEF3C7"}}/> Partial</span>
            <span style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:10,height:10,borderRadius:2,background:"#FEE2E2"}}/> Conflict</span>
          </div>
        </div>}
      </div>
    </div>}

    {/* ═══ PERFORMANCE ═══ */}
    {view==="vitals"&&vitalsTab==="people"&&<div className="af">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>Performance</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setPerfLoading(true);fetch('/api/performance').then(r=>r.json()).then(d=>{setPerfMetrics(d);setPerfLoading(false);showToast("Performance synced from Linear + Asana")}).catch(()=>{setPerfLoading(false);showToast("Sync failed","error")})}} className="btn-pop" style={{background:"var(--bg3)",color:"var(--fg)",border:"1px solid var(--border)",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>{perfLoading?"Syncing...":"Sync from Linear + Asana"}</button>
          {canEdit&&<button className="act-add btn-pop" onClick={()=>setAddModal("perf")} style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add Review</button>}
        </div>
      </div>

      {/* Auto-populated metrics */}
      {perfMetrics&&<div className="af" style={{marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:"var(--fg)"}}>Auto-Generated — {perfMetrics.period}</div>
          <div style={{fontSize:9,color:"var(--fg2)"}}>Last synced: {new Date(perfMetrics.timestamp).toLocaleString('en-GB',{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'})}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
          {Object.entries(perfMetrics.people||{}).filter(([name])=>name!=="Efehan Maleri").sort((a,b)=>b[1].onTimeRate-a[1].onTimeRate).map(([name,d],i)=>{
            const ratingC=d.autoRating==="exceeds"?"#10B981":d.autoRating==="meets"?"#3B82F6":d.autoRating==="developing"?"#F59E0B":"#94A3B8";
            return <div key={name} className="ch asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:14,borderLeft:"4px solid "+ratingC,animationDelay:i*50+"ms"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:CL[N2D[name]]||"#6366F1",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:10,fontWeight:700}}>{name?.[0]}</span></div>
                  <div><div style={{fontSize:12,fontWeight:700,color:"var(--fg)"}}>{name}</div><div style={{fontSize:9,color:"var(--fg2)"}}>{N2D[name]||"Team"}</div></div>
                </div>
                <div style={{padding:"3px 8px",borderRadius:99,background:ratingC+"20",color:ratingC,fontSize:9,fontWeight:700,textTransform:"uppercase"}}>{d.autoRating}</div>
              </div>
              {/* Metrics grid */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
                <div style={{textAlign:"center",padding:6,background:"var(--bg2)",borderRadius:6}}>
                  <div style={{fontSize:16,fontWeight:800,color:"var(--fg)"}}>{d.assigned}</div>
                  <div style={{fontSize:8,color:"var(--fg2)"}}>Assigned</div>
                </div>
                <div style={{textAlign:"center",padding:6,background:"var(--bg2)",borderRadius:6}}>
                  <div style={{fontSize:16,fontWeight:800,color:"#10B981"}}>{d.completed}</div>
                  <div style={{fontSize:8,color:"var(--fg2)"}}>Done</div>
                </div>
                <div style={{textAlign:"center",padding:6,background:d.overdue>0?"#FEE2E220":"var(--bg2)",borderRadius:6}}>
                  <div style={{fontSize:16,fontWeight:800,color:d.overdue>0?"#EF4444":"var(--fg)"}}>{d.overdue}</div>
                  <div style={{fontSize:8,color:"var(--fg2)"}}>Overdue</div>
                </div>
              </div>
              {/* Progress bars */}
              <div style={{marginBottom:6}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"var(--fg2)",marginBottom:2}}><span>Completion rate</span><span style={{fontWeight:700,color:d.completionRate>=70?"#10B981":"#F59E0B"}}>{d.completionRate}%</span></div>
                <div style={{height:4,background:"var(--bg3)",borderRadius:2,overflow:"hidden"}}><div className="bar-g" style={{height:"100%",width:d.completionRate+"%",borderRadius:2,background:d.completionRate>=70?"#10B981":"#F59E0B"}}/></div>
              </div>
              <div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"var(--fg2)",marginBottom:2}}><span>On-time rate</span><span style={{fontWeight:700,color:d.onTimeRate>=80?"#10B981":d.onTimeRate>=60?"#F59E0B":"#EF4444"}}>{d.onTimeRate}%</span></div>
                <div style={{height:4,background:"var(--bg3)",borderRadius:2,overflow:"hidden"}}><div className="bar-g" style={{height:"100%",width:d.onTimeRate+"%",borderRadius:2,background:d.onTimeRate>=80?"#10B981":d.onTimeRate>=60?"#F59E0B":"#EF4444"}}/></div>
              </div>
              <div style={{display:"flex",gap:6,marginTop:8,fontSize:8,color:"var(--fg2)"}}>
                <span>{d.onTime} on time</span><span>{d.late} late</span><span>{d.inProgress} active</span>
              </div>
            </div>})}
        </div>
      </div>}
      {!perfMetrics&&<div className="af" style={{background:"var(--bg2)",borderRadius:10,padding:16,marginBottom:16,textAlign:"center"}}>
        <div style={{color:"var(--fg2)",marginBottom:4}}>{I.chart(20)}</div>
        <div style={{fontSize:12,fontWeight:600,color:"var(--fg)",marginBottom:4}}>Click "Sync from Linear + Asana" to auto-generate performance metrics</div>
        <div style={{fontSize:10,color:"var(--fg2)"}}>Pulls completion rates, on-time delivery, and overdue counts per person.</div>
      </div>}

      {/* Manual reviews */}
      {perf.length>0&&<div style={{marginTop:8}}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--fg)",marginBottom:8}}>Manual Reviews</div>
        {perf.filter(p=>p.person!=="Efehan Maleri").map((p,idx)=>{
        const wf=p.workflow_status||"not_started";const isSelf=userRoles.find(r=>r.email===user?.email)?.name===p.person;
        const wfC=wf==="complete"?"#10B981":wf==="manager_review"?"#8B5CF6":wf==="self_review"?"#3B82F6":"#94A3B8";
        const wfL=wf==="complete"?"Complete":wf==="manager_review"?"Manager Review":wf==="self_review"?"Self Review":"Not Started";
        return <div key={p.id} className="af ch" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,marginBottom:12,animationDelay:idx*60+"ms"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:CL[N2D[p.person]]||"#6366F1",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:12,fontWeight:700}}>{p.person?.[0]}</span></div>
            <div><InEdit value={p.person} onChange={v=>updatePerf(p.id,{person:v})}/><div style={{fontSize:10,color:"var(--fg2)"}}>{p.period}</div></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <Bdg bg={wfC+"20"} c={wfC}>{wfL}</Bdg>
            <InEdit value={p.rating} onChange={v=>updatePerf(p.id,{rating:v})} type="select" options={["pending","exceeds","meets","developing"]}/>
            <button onClick={()=>setConfirmDlg({msg:"Delete this review?",fn:()=>deletePerf(p.id)})} className="act-del" style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer"}}>✕</button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><div style={{fontSize:10,fontWeight:700,color:"var(--fg2)",marginBottom:4}}>Goals</div><InEdit value={p.goals||""} onChange={v=>updatePerf(p.id,{goals:v})}/></div>
          <div><div style={{fontSize:10,fontWeight:700,color:"var(--fg2)",marginBottom:4}}>Self Review {wf==="not_started"&&isSelf?"(fill this)":""}</div><InEdit value={p.self_review||""} onChange={v=>updatePerf(p.id,{self_review:v})}/></div>
          <div><div style={{fontSize:10,fontWeight:700,color:"var(--fg2)",marginBottom:4}}>Manager Review</div>{role==="admin"?<InEdit value={p.manager_review||""} onChange={v=>updatePerf(p.id,{manager_review:v})}/>:<span style={{fontSize:12,color:"var(--fg)"}}>{p.manager_review||"—"}</span>}</div>
          <div><div style={{fontSize:10,fontWeight:700,color:"var(--fg2)",marginBottom:4}}>Reviewer</div><InEdit value={p.reviewer||""} onChange={v=>updatePerf(p.id,{reviewer:v})}/></div>
        </div>
        {/* Workflow actions */}
        <div style={{display:"flex",gap:6,marginTop:10}}>
          {wf==="not_started"&&isSelf&&<button onClick={()=>updatePerf(p.id,{workflow_status:"self_review"})} className="btn-pop" style={{fontSize:10,padding:"5px 12px",borderRadius:6,border:"none",background:"#3B82F6",color:"#fff",cursor:"pointer",fontWeight:600}}>Start Self Review</button>}
          {wf==="self_review"&&isSelf&&p.self_review&&<button onClick={()=>{updatePerf(p.id,{workflow_status:"manager_review",submitted_at:new Date().toISOString()});showToast("Submitted for manager review")}} className="btn-pop" style={{fontSize:10,padding:"5px 12px",borderRadius:6,border:"none",background:"#8B5CF6",color:"#fff",cursor:"pointer",fontWeight:600}}>Submit for Review</button>}
          {wf==="manager_review"&&role==="admin"&&<button onClick={()=>{updatePerf(p.id,{workflow_status:"complete",reviewed_at:new Date().toISOString(),status:"reviewed"});showToast("Review complete")}} className="btn-pop" style={{fontSize:10,padding:"5px 12px",borderRadius:6,border:"none",background:"#10B981",color:"#fff",cursor:"pointer",fontWeight:600}}>Mark Complete</button>}
        </div>
      </div>})}
      </div>}
    </div>}

    {/* ═══ LEAVE (separate tab) ═══ */}
    {/* ═══ LEAVE TAB — SPOCK-STYLE ═══ */}
    {view==="leave"&&<div className="af">
      {(()=>{
        const me=userRoles.find(r=>r.email===user?.email);
        const myName=me?.name||user?.user_metadata?.full_name||user?.email?.split("@")[0]||"";
        const firstName=myName?.split(" ")[0];
        const yr=new Date().getFullYear();
        const today=new Date().toISOString().split("T")[0];
        const myEmail=user?.email||"";
        const isEfehan=myEmail.toLowerCase()==="efehan@attimo.com";
        const myBals=leaveBalances.filter(b=>b.email===myEmail);
        const myUpcoming=leaves.filter(l=>l.email===myEmail&&l.end_date>=today).sort((a,b)=>a.start_date.localeCompare(b.start_date));
        const onLeaveToday=leaves.filter(l=>l.status==="approved"&&l.start_date<=today&&l.end_date>=today);
        const upcomingHolidays=publicHolidays.filter(h=>(h.d||h.date)>=today).slice(0,10);
        const myTeam=userRoles.filter(r=>r.dept===me?.dept&&r.email!==myEmail);

        return <>
          {/* Welcome header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontSize:22,fontWeight:800,color:"var(--fg)"}}>Welcome, {firstName}</div>
              <div style={{fontSize:11,color:"var(--fg2)",marginTop:2}}>Your leave hub — apply, track, plan around the team.</div>
            </div>
            {!isEfehan&&<button onClick={()=>setAddModal("leave")} className="btn-pop" style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"9px 18px",borderRadius:10,fontWeight:700,fontSize:12,cursor:"pointer"}}>+ Request Leave</button>}
          </div>

          {/* Top row: On Leave Today + My Teams */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:14,marginBottom:16}}>
            {/* On Leave Today */}
            <div className="asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--fg)",marginBottom:10}}>On Leave Today</div>
              {onLeaveToday.length===0?<div style={{fontSize:11,color:"var(--fg2)",fontStyle:"italic"}}>Everyone is in today.</div>
              :<div style={{display:"flex",flexDirection:"column",gap:6}}>
                {onLeaveToday.map(l=>{const cl=CL[N2D[l.person]]||"#6366F1";
                  return <div key={l.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,background:"var(--bg2)"}}>
                    <div style={{width:24,height:24,borderRadius:"50%",background:cl,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#fff",flexShrink:0}}>{l.person?.[0]}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:600,color:"var(--fg)"}}>{l.person}</div>
                      <div style={{fontSize:9,color:"var(--fg2)"}}>{l.leave_type}{l.half_day?" (half day)":""}</div>
                    </div>
                  </div>;
                })}
              </div>}
            </div>

            {/* My Teams */}
            <div className="asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,animationDelay:"50ms"}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--fg)",marginBottom:10}}>My Team</div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:(CL[me?.dept]||"#6366F1")+"30",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:CL[me?.dept]||"#6366F1",flexShrink:0}}>{me?.dept?.[0]||"?"}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:"var(--fg)"}}>{me?.dept||"Unassigned"}</div>
                  <div style={{fontSize:9,color:"var(--fg2)"}}>{myTeam.length+1} member{myTeam.length===0?"":"s"} · Manager: {userRoles.find(u=>u.email===me?.manager_email)?.name||me?.manager_email||"—"}</div>
                </div>
              </div>
              {myTeam.length>0&&<div style={{marginTop:10,paddingTop:10,borderTop:"1px solid var(--border)",display:"flex",flexWrap:"wrap",gap:4}}>
                {myTeam.slice(0,6).map(m=><span key={m.id} style={{fontSize:9,padding:"2px 8px",borderRadius:99,background:"var(--bg2)",color:"var(--fg2)"}}>{m.name?.split(" ")[0]}</span>)}
                {myTeam.length>6&&<span style={{fontSize:9,padding:"2px 8px",color:"var(--fg2)"}}>+{myTeam.length-6}</span>}
              </div>}
            </div>
          </div>

          {/* Balances — Spock style */}
          {!isEfehan&&<div className="asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,marginBottom:16,animationDelay:"100ms"}}>
            <div style={{fontSize:13,fontWeight:700,color:"var(--fg)",marginBottom:12}}>Balances · {yr}</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{borderBottom:"1px solid var(--border)"}}>
                  <th style={{textAlign:"left",padding:"6px 10px",fontWeight:600,color:"var(--fg2)",fontSize:10}}>Leave Type</th>
                  <th style={{textAlign:"left",padding:"6px 10px",fontWeight:600,color:"var(--fg2)",fontSize:10}}>Spent</th>
                  <th style={{textAlign:"left",padding:"6px 10px",fontWeight:600,color:"var(--fg2)",fontSize:10}}>Allowance</th>
                  <th style={{textAlign:"left",padding:"6px 10px",fontWeight:600,color:"var(--fg2)",fontSize:10}}>Available</th>
                  <th style={{textAlign:"left",padding:"6px 10px",fontWeight:600,color:"var(--fg2)",fontSize:10}}>Monthly limit</th>
                  <th style={{textAlign:"left",padding:"6px 10px",fontWeight:600,color:"var(--fg2)",fontSize:10}}>Spent this month</th>
                  <th style={{textAlign:"left",padding:"6px 10px",fontWeight:600,color:"var(--fg2)",fontSize:10}}>Available this month</th>
                </tr></thead>
                <tbody>
                  {leaveTypes.map(t=>{
                    const b=myBals.find(x=>x.leave_type===t.key);
                    const spent=Number(b?.spent||0);
                    const allow=b?.allowance_override!=null?Number(b.allowance_override):t.annual_allowance;
                    const avail=allow!=null?Math.max(0,allow-spent):null;
                    const spentMo=Number(b?.spent_this_month||0);
                    const monthAvail=t.monthly_limit!=null?Math.max(0,t.monthly_limit-spentMo):null;
                    return <tr key={t.key} style={{borderBottom:"1px solid var(--border)"}}>
                      <td style={{padding:"8px 10px"}}><span style={{padding:"3px 10px",borderRadius:6,background:(t.color||"#6366F1")+"20",color:t.color||"#6366F1",fontWeight:600,fontSize:10}}>{t.display_name}</span></td>
                      <td style={{padding:"8px 10px",fontWeight:600}}>{spent} day{spent===1?"":"s"}</td>
                      <td style={{padding:"8px 10px",color:"var(--fg2)"}}>{allow!=null?`${allow} days`:"∞"}</td>
                      <td style={{padding:"8px 10px",fontWeight:700,color:avail===0?"#EF4444":avail!=null&&avail<3?"#F59E0B":"var(--fg)"}}>{avail!=null?`${avail} day${avail===1?"":"s"}`:"∞"}</td>
                      <td style={{padding:"8px 10px",color:"var(--fg2)"}}>{t.monthly_limit!=null?`${t.monthly_limit} days`:"—"}</td>
                      <td style={{padding:"8px 10px"}}>{spentMo} day{spentMo===1?"":"s"}</td>
                      <td style={{padding:"8px 10px",fontWeight:600,color:monthAvail===0?"#EF4444":"var(--fg)"}}>{monthAvail!=null?`${monthAvail} day${monthAvail===1?"":"s"}`:"—"}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>}

          {/* Bottom row: My Upcoming + Public Holidays */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:14,marginBottom:16}}>
            {!isEfehan&&<div className="asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,animationDelay:"150ms"}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--fg)",marginBottom:10}}>My Upcoming Leave</div>
              {myUpcoming.length===0?<div style={{fontSize:11,color:"var(--fg2)",fontStyle:"italic"}}>No upcoming leave booked.</div>
              :<div style={{display:"flex",flexDirection:"column",gap:8}}>
                {myUpcoming.map(l=>{
                  const t=leaveTypes.find(x=>x.key===l.leave_type)||{};
                  const dateLabel=l.start_date===l.end_date?fD(l.start_date):`${fD(l.start_date)} → ${fD(l.end_date)}`;
                  return <div key={l.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",borderRadius:8,background:"var(--bg2)"}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:600,color:"var(--fg)"}}>{dateLabel}</div>
                      <div style={{fontSize:9,color:"var(--fg2)"}}>{t.display_name||l.leave_type} · {l.half_day?"0.5 day":`${l.days} day${l.days>1?"s":""}`}{(l.status==="approved"||l.status==="rejected")&&l.approved_by?` · ${l.status==="approved"?"approved":"rejected"} by ${l.approved_by.split(" ")[0]}`:""}</div>
                    </div>
                    <span style={{fontSize:9,padding:"3px 8px",borderRadius:99,background:l.status==="approved"?"#DCFCE7":l.status==="rejected"?"#FEE2E2":"#FEF3C7",color:l.status==="approved"?"#166534":l.status==="rejected"?"#991B1B":"#92400E",fontWeight:700,letterSpacing:.5}}>{l.status.toUpperCase()}</span>
                  </div>;
                })}
              </div>}
            </div>}

            <div className="asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,animationDelay:"200ms"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:700,color:"var(--fg)"}}>Public Holidays</div>
                <span style={{fontSize:9,color:"var(--fg2)"}}>{holidaySource==="api"?"Live":"Fallback"}</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:280,overflowY:"auto"}}>
                {upcomingHolidays.map((h,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 8px",borderRadius:6,background:i%2===0?"var(--bg2)":"transparent",fontSize:11}}>
                  <span style={{color:"var(--fg)",fontWeight:600}}>{fD(h.d||h.date)} <span style={{color:"var(--fg2)",fontWeight:400}}>({new Date((h.d||h.date)+"T00:00:00").toLocaleDateString("en-US",{weekday:"short"})})</span></span>
                  <span style={{color:"var(--fg2)"}}>{h.l||h.name} <span style={{fontSize:9,padding:"1px 6px",borderRadius:4,background:(h.c||h.country)==="PK"?"#3B82F620":"#EC489920",color:(h.c||h.country)==="PK"?"#3B82F6":"#EC4899",fontWeight:700,marginLeft:4}}>{h.c||h.country}</span></span>
                </div>)}
              </div>
            </div>
          </div>

          {/* Admin section — all leave requests */}
          {isLeaveApprover&&<div className="asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,animationDelay:"250ms"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--fg)"}}>All Leave Requests</div>
              <span style={{fontSize:9,color:"var(--fg2)"}}>Approver view · {leaves.filter(l=>l.status==="pending").length} pending</span>
            </div>
            <Tbl headers={["Person","Type","Dates","Duration","Reason","Status","Approved By",""]} rows={leaves.slice().sort((a,b)=>(a.status==="pending"?-1:1)-(b.status==="pending"?-1:1)||b.start_date?.localeCompare(a.start_date||"")||0).slice(0,40).map(l=>[
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:20,height:20,borderRadius:"50%",background:CL[N2D[l.person]]||"#6366F1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:"#fff"}}>{l.person?.[0]}</div>
                <span style={{fontSize:11}}>{l.person}</span>
              </div>,
              <Bdg bg={(leaveTypes.find(t=>t.key===l.leave_type)?.color||"#6366F1")+"20"} c={leaveTypes.find(t=>t.key===l.leave_type)?.color||"#6366F1"}>{leaveTypes.find(t=>t.key===l.leave_type)?.display_name||l.leave_type}</Bdg>,
              <span style={{fontSize:10,color:"var(--fg)"}}>{l.start_date===l.end_date?fD(l.start_date):`${fD(l.start_date)} → ${fD(l.end_date)}`}</span>,
              <span style={{fontSize:10,color:"var(--fg2)"}}>{l.half_day?"0.5d":`${l.days}d`}</span>,
              <span style={{fontSize:9,color:"var(--fg2)",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",display:"inline-block",whiteSpace:"nowrap"}}>{l.reason||"—"}</span>,
              <InEdit value={l.status} onChange={v=>{updateLeave(l.id,{status:v,approved_by:v==="approved"||v==="rejected"?user?.user_metadata?.full_name||user?.email:"",approved_by_email:user?.email||""})}} type="select" options={["pending","approved","rejected","cancelled"]}/>,
              <span style={{fontSize:10,color:"var(--fg2)"}}>{l.approved_by||"—"}</span>,
              <button onClick={()=>setConfirmDlg({msg:"Delete this leave record?",fn:()=>deleteLeave(l.id)})} className="act-del" style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontSize:11}}>✕</button>
            ])}/>
          </div>}
        </>;
      })()}
    </div>}

    {/* Settings — Admin Only */}
    {/* ═══ ONBOARDING ═══ */}
    {view==="onboard"&&<div className="af">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>Onboarding Tracker</div>
        {canEdit&&<div style={{display:"flex",gap:8}}>
          <button onClick={()=>setOnboardModal("onboarding")} className="btn-pop" style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Onboarding</button>
          <button onClick={()=>setOnboardModal("offboarding")} className="btn-pop" style={{background:"linear-gradient(135deg,#EF4444,#F97316)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Offboarding</button>
        </div>}
      </div>

      {/* Sub-tabs: Onboarding | Offboarding */}
      <div style={{display:"flex",gap:4,marginBottom:16,background:"var(--bg3)",borderRadius:10,padding:3,width:"fit-content"}}>
        {[{id:"onboarding",l:"Onboarding"},{id:"offboarding",l:"Offboarding"}].map(t=>{
          const count=t.id==="offboarding"?[...new Set(onboarding.filter(o=>o.person?.includes("(offboarding)")).map(o=>o.person))].length:[...new Set(onboarding.filter(o=>!o.person?.includes("(offboarding)")).map(o=>o.person))].length;
          return <button key={t.id} onClick={()=>setOnboardTab(t.id)} style={{padding:"8px 16px",borderRadius:8,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .2s",background:onboardTab===t.id?(t.id==="offboarding"?"#EF4444":"#3B82F6"):"transparent",color:onboardTab===t.id?"#fff":"var(--fg2)"}}>{t.l}<span style={{marginLeft:6,background:onboardTab===t.id?"rgba(255,255,255,.25)":"var(--border)",borderRadius:99,padding:"1px 6px",fontSize:10}}>{count}</span></button>;
        })}
      </div>

      {/* Group by person (filtered by sub-tab) */}
      {(()=>{const byPerson={};onboarding.filter(o=>onboardTab==="offboarding"?o.person?.includes("(offboarding)"):!o.person?.includes("(offboarding)")).forEach(o=>{if(!byPerson[o.person])byPerson[o.person]=[];byPerson[o.person].push(o)});
        return Object.keys(byPerson).length===0?<div className="af" style={{textAlign:"center",padding:40,background:"var(--card)",borderRadius:12,border:"1px dashed var(--border)"}}>
          <div style={{color:"var(--fg2)",marginBottom:4}}>{I.users(24)}</div>
          <div style={{fontSize:13,fontWeight:600,color:"var(--fg)",marginBottom:4}}>No onboarding in progress</div>
          <div style={{fontSize:11,color:"var(--fg2)"}}>Click "+ Generate Onboarding" when a new hire is confirmed.</div>
        </div>
        :Object.entries(byPerson).map(([person,items],pi)=>{
          const done=items.filter(i=>i.status==="done").length;const total=items.length;const pct=Math.round(done/total*100);
          const byCat={};items.forEach(i=>{if(!byCat[i.category])byCat[i.category]=[];byCat[i.category].push(i)});
          const catIcons={accounts:I.user,documents:I.briefcase,orientation:I.list,tools:I.settings,general:I.grid};
          const catColors={accounts:"#3B82F6",documents:"#F59E0B",orientation:"#10B981",tools:"#8B5CF6",general:"#64748B"};
          return <div key={person} className="asl" style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,marginBottom:16,overflow:"hidden",animationDelay:pi*60+"ms"}}>
            {/* Person header with progress */}
            <div style={{padding:"14px 16px",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center",background:"var(--bg2)"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"#6366F1",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:13,fontWeight:700}}>{person?.[0]}</span></div>
                <div><div style={{fontSize:14,fontWeight:700,color:"var(--fg)"}}>{person}</div><div style={{fontSize:10,color:"var(--fg2)"}}>{done}/{total} complete</div></div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:80,height:6,background:"var(--bg3)",borderRadius:3,overflow:"hidden"}}><div className="bar-g" style={{height:"100%",width:pct+"%",borderRadius:3,background:pct===100?"#10B981":pct>50?"#F59E0B":"#3B82F6"}}/></div>
                <span style={{fontSize:12,fontWeight:800,color:pct===100?"#10B981":"var(--fg)"}}>{pct}%</span>
              </div>
            </div>
            {/* Items by category */}
            {Object.entries(byCat).map(([cat,citems])=><div key={cat} style={{padding:"10px 16px",borderBottom:"1px solid var(--border)"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                <span style={{color:catColors[cat]||"var(--fg2)"}}>{catIcons[cat]?catIcons[cat](12):null}</span>
                <span style={{fontSize:11,fontWeight:700,color:"var(--fg)",textTransform:"capitalize"}}>{cat}</span>
                <span style={{fontSize:9,color:"var(--fg2)"}}>{citems.filter(i=>i.status==="done").length}/{citems.length}</span>
              </div>
              {citems.map((item,ii)=><div key={item.id} className="rh" style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,marginBottom:2}}>
                <input type="checkbox" checked={item.status==="done"} onChange={()=>updateOnboardItem(item.id,{status:item.status==="done"?"pending":"done",completed_at:item.status==="done"?null:new Date().toISOString()})} style={{cursor:"pointer",accentColor:"#10B981"}}/>
                <span style={{flex:1,fontSize:11,color:item.status==="done"?"var(--fg2)":"var(--fg)",textDecoration:item.status==="done"?"line-through":"none"}}>{item.item}</span>
                <span style={{fontSize:9,color:"var(--fg2)",whiteSpace:"nowrap"}}>{item.assigned_to?.split(" ")[0]||""}</span>
                {item.status==="done"&&<span style={{fontSize:8,color:"#10B981",fontWeight:600}}>Done</span>}
                <button onClick={()=>setConfirmDlg({msg:"Delete onboarding item?",fn:()=>deleteOnboardItem(item.id)})} className="act-del" style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontSize:10}}>✕</button>
              </div>)}
            </div>)}
          </div>})})()}
    </div>}

    {/* ═══ HR DOCUMENTS ═══ */}
    {view==="hrdocs"&&<div className="af">
      {/* Documents header + sub-navigation */}
      <div style={{fontSize:18,fontWeight:800,color:"var(--fg)",marginBottom:2}}>Documents</div>
      <div style={{fontSize:11,color:"var(--fg2)",marginBottom:14}}>Company knowledge, Drive structure, and HR document tracking</div>
      <div style={{display:"flex",gap:4,background:"var(--bg3)",borderRadius:10,padding:3,width:"fit-content",marginBottom:20}}>
        <button onClick={()=>setDocsTab("knowledge")} style={{padding:"8px 18px",borderRadius:8,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .2s",background:docsTab==="knowledge"?"var(--fg)":"transparent",color:docsTab==="knowledge"?"var(--bg)":"var(--fg2)"}}>Knowledge</button>
        <button onClick={()=>setDocsTab("hrdocs")} style={{padding:"8px 18px",borderRadius:8,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .2s",background:docsTab==="hrdocs"?"var(--fg)":"transparent",color:docsTab==="hrdocs"?"var(--bg)":"var(--fg2)"}}>HR Docs</button>
      </div>

      {docsTab==="knowledge"&&<KnowledgeHub supabase={supabase} userRoles={userRoles} canEdit={canEdit}/>}

      {docsTab==="hrdocs"&&<div className="af">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
        <div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>Company Documents</div>
        {role==="admin"&&<button onClick={()=>setAddModal("drivefolder")} className="btn-pop" style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"5px 12px",borderRadius:6,fontWeight:600,fontSize:10,cursor:"pointer"}}>+ Add Folder</button>}
      </div>

      {/* Google Drive folder mirror — live links to actual Drive folders */}
      {driveFolders.length>0&&<div style={{marginBottom:24}}>
        <div style={{fontSize:11,color:"var(--fg2)",marginBottom:10}}>Live mirror of Google Drive — folders organized by department. Click any folder to open in Drive.</div>
        {(()=>{const byDept={};driveFolders.forEach(f=>{if(!byDept[f.dept])byDept[f.dept]=[];byDept[f.dept].push(f)});
          return Object.entries(byDept).map(([dept,folders])=>{const cl=CL[dept]||"#6366F1";
            return <div key={dept} style={{marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:700,color:"var(--fg)",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:3,height:14,borderRadius:2,background:cl}}/>{dept}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}}>
                {folders.map(f=><div key={f.id} className="ch" style={{background:"var(--card)",border:"1px solid var(--border)",borderLeft:"3px solid "+cl,borderRadius:10,padding:12,position:"relative"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                    <div style={{fontSize:18,color:cl,flexShrink:0}}>📁</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:"var(--fg)",marginBottom:2}}>{f.folder_name}</div>
                      {f.description&&<div style={{fontSize:9,color:"var(--fg2)",marginBottom:6}}>{f.description}</div>}
                      {f.folder_url?<a href={f.folder_url} target="_blank" rel="noopener" style={{fontSize:10,color:"#3B82F6",fontWeight:600,textDecoration:"none"}}>Open in Drive →</a>:<span style={{fontSize:10,color:"#F59E0B",fontWeight:600}}>⚠ URL not set</span>}
                    </div>
                    {role==="admin"&&<button onClick={async()=>{const url=prompt("Google Drive folder URL:",f.folder_url||"");if(url==null)return;await supabase.from('drive_folders').update({folder_url:url}).eq('id',f.id);const{data}=await supabase.from('drive_folders').select('*').order('sort_order');if(data)setDriveFolders(data);showToast("Folder URL updated")}} style={{background:"none",border:"none",color:"var(--fg2)",cursor:"pointer",fontSize:11,padding:2}}>✎</button>}
                  </div>
                </div>)}
              </div>
            </div>;
          });
        })()}
      </div>}

      {/* HR Documents tracker — per-person, existing */}
      <div style={{fontSize:13,fontWeight:700,color:"var(--fg)",marginBottom:8,marginTop:24}}>HR Document Tracker</div>
      <div style={{fontSize:10,color:"var(--fg2)",marginBottom:16}}>Track collected documents per team member. Red = missing, Yellow = uploaded, Green = verified.</div>

      {(()=>{const docTypes=['id_copy','cv','contract','verbis_consent','nda','bank_details','emergency_contact','photo'];
        const docLabels={id_copy:"ID Copy",cv:"CV",contract:"Contract",verbis_consent:"VERBIS",nda:"NDA",bank_details:"Bank",emergency_contact:"Emergency",photo:"Photo"};
        const byPerson={};hrDocs.forEach(d=>{if(!byPerson[d.person])byPerson[d.person]={};byPerson[d.person][d.doc_type]=d});
        const people=[...new Set(hrDocs.map(d=>d.person))].sort();

        return people.length===0?<div className="af" style={{textAlign:"center",padding:40,background:"var(--card)",borderRadius:12,border:"1px dashed var(--border)"}}>
          <div style={{color:"var(--fg2)",marginBottom:4}}>{I.briefcase(24)}</div>
          <div style={{fontSize:13,fontWeight:600,color:"var(--fg)",marginBottom:4}}>No documents tracked yet</div>
          <div style={{fontSize:11,color:"var(--fg2)"}}>Document records are auto-created when you generate onboarding for a new hire.</div>
        </div>
        :<div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,overflow:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead><tr style={{background:"var(--bg2)"}}>
              <th style={{padding:"10px 12px",textAlign:"left",fontWeight:700,color:"var(--fg)",borderBottom:"2px solid var(--border)"}}>Person</th>
              {docTypes.map(dt=><th key={dt} style={{padding:"10px 6px",textAlign:"center",fontWeight:600,color:"var(--fg2)",borderBottom:"2px solid var(--border)",fontSize:9}}>{docLabels[dt]}</th>)}
              <th style={{padding:"10px 6px",textAlign:"center",fontWeight:600,color:"var(--fg2)",borderBottom:"2px solid var(--border)",fontSize:9}}>Drive</th><th style={{padding:"10px 6px",textAlign:"center",fontWeight:600,color:"var(--fg2)",borderBottom:"2px solid var(--border)",fontSize:9}}>%</th>
            </tr></thead>
            <tbody>{people.map((person,pi)=>{
              const docs=byPerson[person]||{};const collected=Object.values(docs).filter(d=>d.status==="uploaded"||d.status==="verified").length;const verified=Object.values(docs).filter(d=>d.status==="verified").length;const total=Object.keys(docs).length||1;
              return <tr key={person} className="rh asl" style={{animationDelay:pi*30+"ms"}}>
                <td style={{padding:"8px 12px",fontWeight:600,color:"var(--fg)",borderBottom:"1px solid var(--border)"}}>{person}</td>
                {docTypes.map(dt=>{const doc=docs[dt];if(!doc)return <td key={dt} style={{padding:4,textAlign:"center",borderBottom:"1px solid var(--border)"}}>—</td>;
                  const stC=doc.status==="verified"?"#10B981":doc.status==="uploaded"?"#F59E0B":"#EF4444";
                  const stBg=doc.status==="verified"?"#DCFCE7":doc.status==="uploaded"?"#FEF3C7":"#FEE2E2";
                  return <td key={dt} style={{padding:4,textAlign:"center",borderBottom:"1px solid var(--border)"}}>
                    {canEdit?<select value={doc.status} onChange={e=>updateHrDoc(doc.id,{status:e.target.value,uploaded_at:e.target.value!=="missing"?new Date().toISOString():null,verified_by:e.target.value==="verified"?(user?.user_metadata?.full_name||""):""})} style={{background:stBg,color:stC,border:"none",borderRadius:4,padding:"2px 4px",fontSize:9,fontWeight:700,cursor:"pointer"}}>
                      <option value="missing">Missing</option><option value="uploaded">Uploaded</option><option value="verified">Verified</option>
                    </select>:<div style={{width:12,height:12,borderRadius:"50%",background:stC,margin:"0 auto"}} title={doc.status}/>}
                  </td>})}
                <td style={{padding:4,textAlign:"center",borderBottom:"1px solid var(--border)"}}>{(()=>{const ur=userRoles.find(r=>r.name===person);return ur&&ur.drive_folder?<a href={ur.drive_folder} target="_blank" rel="noopener" style={{fontSize:9,color:"#3B82F6",fontWeight:600}}>Open</a>:<span style={{fontSize:9,color:"var(--fg2)"}}>-</span>})()}</td><td style={{padding:4,textAlign:"center",borderBottom:"1px solid var(--border)",fontWeight:700,color:collected>=total?"#10B981":collected>0?"#F59E0B":"#EF4444",fontSize:10}}>{Math.round(collected/total*100)}%</td>
              </tr>})}
            </tbody>
          </table>
        </div>})()}
      </div>}
    </div>}

    {view==="settings"&&canSeeTab('settings')&&<div className="af">
      {/* Settings header + ERP-style sub-navigation */}
      <div style={{fontSize:18,fontWeight:800,color:"var(--fg)",marginBottom:2}}>Settings</div>
      <div style={{fontSize:11,color:"var(--fg2)",marginBottom:14}}>Workspace configuration and access control</div>
      <div style={{display:"flex",gap:4,background:"var(--bg3)",borderRadius:10,padding:3,width:"fit-content",marginBottom:20}}>
        <button onClick={()=>setSettingsTab("team")} style={{padding:"8px 18px",borderRadius:8,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .2s",background:settingsTab==="team"?"var(--fg)":"transparent",color:settingsTab==="team"?"var(--bg)":"var(--fg2)"}}>Team</button>
        {platformRole==='super_admin'&&<button onClick={()=>setSettingsTab("permissions")} style={{padding:"8px 18px",borderRadius:8,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .2s",background:settingsTab==="permissions"?"var(--fg)":"transparent",color:settingsTab==="permissions"?"var(--bg)":"var(--fg2)",display:"flex",alignItems:"center",gap:6}}>{I.shield(12)} Permissions</button>}
      </div>

      {settingsTab==="team"&&<div className="af">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:14,fontWeight:800,color:"var(--fg)"}}>User Roles</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={async()=>{showToast("Syncing team from Slack...");try{const res=await fetch('/api/availability');const d=await res.json();if(!d.users||!d.users.length){showToast("No Slack users found","error");return}let updated=0;const norm=s=>(s||"").toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/ş/g,'s').replace(/ç/g,'c').replace(/ğ/g,'g').replace(/ö/g,'o').replace(/ü/g,'u');for(const su of d.users){const match=userRoles.find(r=>r.email===su.email)||userRoles.find(r=>norm(r.name)===norm(su.name));if(!match)continue;const upd={};if(su.avatar)upd.avatar_url=su.avatar;if(su.tz)upd.timezone=su.tz;if(Object.keys(upd).length>0){await supabase.from('user_roles').update(upd).eq('id',match.id);updated++}}const{data:fresh}=await supabase.from('user_roles').select('*').order('created_at');if(fresh)setUserRoles(fresh);showToast(updated+" profiles updated from Slack")}catch(e){showToast("Slack sync failed","error")}}} className="btn-pop" style={{background:"var(--bg3)",color:"var(--fg)",border:"1px solid var(--border)",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>{I.users(12)} Sync from Slack</button>
          <button className="act-add btn-pop" onClick={()=>setAddModal("userrole")} style={{background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:8,fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add User</button>
        </div>
      </div>
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
      <Tbl headers={["","Email","Name","Access Level","Manager","Legacy","Department",""]} ids={userRoles.map(r=>r.id)} onReorder={(a,b)=>reorder('user_roles',userRoles,setUserRoles,a,b)} rows={userRoles.map(r=>[
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          {r.avatar_url?<img src={r.avatar_url} style={{width:28,height:28,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:28,height:28,borderRadius:"50%",background:CL[r.dept]||"#6366F1",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:10,fontWeight:700}}>{r.name?.[0]}</span></div>}
          <label style={{cursor:"pointer",fontSize:9,color:"#3B82F6"}}><input type="file" accept="image/*" style={{display:"none"}} onChange={e=>uploadAvatar(r.id,e.target.files?.[0])}/>edit</label>
        </div>,
        <InEdit value={r.email} onChange={v=>updateUserRole(r.id,{email:v})}/>,
        <InEdit value={r.name} onChange={v=>updateUserRole(r.id,{name:v})}/>,
        platformRole==='super_admin'?<select value={r.platform_role||"employee"} onChange={e=>updateUserRole(r.id,{platform_role:e.target.value})} style={{padding:"5px 8px",fontSize:11,fontWeight:600,borderRadius:6,border:"1px solid var(--border)",background:"var(--bg2)",color:"var(--fg)",cursor:"pointer"}}>{["super_admin","admin","manager","employee","intern"].map(p=><option key={p} value={p}>{p.replace("_"," ").replace(/\b\w/g,c=>c.toUpperCase())}</option>)}</select>:<Bdg bg={(r.platform_role==="super_admin"?"#3B82F6":r.platform_role==="admin"?"#8B5CF6":r.platform_role==="manager"?"#F59E0B":"#64748B")+"20"} c={r.platform_role==="super_admin"?"#3B82F6":r.platform_role==="admin"?"#8B5CF6":r.platform_role==="manager"?"#D97706":"#64748B"}>{(r.platform_role||"employee").replace("_"," ")}</Bdg>,
        <select value={r.manager_email||""} onChange={e=>updateUserRole(r.id,{manager_email:e.target.value||null})} style={{padding:"5px 8px",fontSize:10,fontWeight:500,borderRadius:6,border:"1px solid var(--border)",background:"var(--bg2)",color:"var(--fg)",cursor:"pointer",maxWidth:130}}>
          <option value="">— None —</option>
          {userRoles.filter(m=>m.email!==r.email).map(m=><option key={m.email} value={m.email}>{m.name?.split(" ")[0]} {m.name?.split(" ")[1]?.[0]||""}.</option>)}
        </select>,
        <InEdit value={r.role} onChange={v=>updateUserRole(r.id,{role:v})} type="select" options={["admin","editor","viewer"]}/>,
        <InEdit value={r.dept||""} onChange={v=>updateUserRole(r.id,{dept:v})}/>,
        <button onClick={()=>setConfirmDlg({msg:"Remove "+r.name+" from team?",fn:()=>deleteUserRole(r.id)})} className="act-del" style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer"}}>✕</button>
      ])}/>
      <div style={{marginTop:20,padding:16,background:"var(--bg3)",borderRadius:10}}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--fg)",marginBottom:8}}>Legacy Edit Roles</div>
        <div style={{fontSize:11,color:"var(--fg2)",lineHeight:1.8}}>
          <b style={{color:"#3B82F6"}}>admin</b> — Full access: view, add, edit, delete, manage users<br/>
          <b style={{color:"#F59E0B"}}>editor</b> — Can view, add, and edit. Cannot delete. Edits trigger Slack notifications.<br/>
          <b style={{color:"#94A3B8"}}>viewer</b> — Read-only access. No add, edit, or delete buttons visible.
        </div>
        {platformRole==='super_admin'&&<div style={{fontSize:10,color:"var(--fg2)",marginTop:8,paddingTop:8,borderTop:"1px solid var(--border)"}}>Tab visibility and granular permissions are managed in the <span onClick={()=>setSettingsTab("permissions")} style={{color:"#3B82F6",fontWeight:600,cursor:"pointer"}}>Permissions</span> section.</div>}
      </div>

      {/* Leave Quotas — global defaults + per-person override */}
      {role==="admin"&&<div style={{marginTop:20,border:"1px solid var(--border)",borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"12px 14px",background:"var(--bg2)",borderBottom:"1px solid var(--border)"}}>
          <div style={{fontSize:13,fontWeight:800,color:"var(--fg)"}}>Leave Quotas</div>
          <div style={{fontSize:10,color:"var(--fg2)",marginTop:2}}>Set the company default per leave type, then override for any individual (e.g. new hires). Blank = use default. Annual basis.</div>
        </div>
        {/* Global defaults row */}
        <div style={{padding:"10px 14px",borderBottom:"2px solid var(--border)",background:"var(--bg3)"}}>
          <div style={{fontSize:10,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Company Default (per year)</div>
          <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
            {leaveTypes.map(t=><div key={t.key} style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:11,fontWeight:600,color:t.color||"var(--fg)"}}>{t.display_name}</span>
              <input type="number" min="0" defaultValue={t.annual_allowance??""} onBlur={e=>updateLeaveTypeDefault(t.key,'annual_allowance',e.target.value)} style={{width:54,padding:"4px 6px",fontSize:11,borderRadius:6,border:"1px solid var(--border)",background:"var(--bg2)",color:"var(--fg)",textAlign:"center"}}/>
            </div>)}
          </div>
        </div>
        {/* Per-person override grid */}
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:480}}>
            <thead><tr style={{background:"var(--bg2)"}}>
              <th style={{padding:"8px 14px",textAlign:"left",fontSize:9,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:.5,borderBottom:"1px solid var(--border)"}}>Member</th>
              {leaveTypes.map(t=><th key={t.key} style={{padding:"8px 10px",textAlign:"center",fontSize:9,fontWeight:700,color:t.color||"var(--fg2)",textTransform:"uppercase",letterSpacing:.5,borderBottom:"1px solid var(--border)",minWidth:70}}>{t.display_name}</th>)}
            </tr></thead>
            <tbody>
              {userRoles.filter(u=>u.name!=="Efehan Maleri").sort((a,b)=>(a.name||"").localeCompare(b.name||"")).map((u,i)=><tr key={u.id} className="rh" style={{background:i%2?"var(--bg2)":"transparent"}}>
                <td style={{padding:"6px 14px",fontSize:11,fontWeight:600,color:"var(--fg)",borderBottom:"1px solid var(--border)"}}>{u.name}</td>
                {leaveTypes.map(t=>{const bal=leaveBalances.find(b=>b.email===u.email&&b.leave_type===t.key&&b.year===new Date().getFullYear());const ov=bal?.allowance_override;
                  return <td key={t.key} style={{padding:"4px 10px",textAlign:"center",borderBottom:"1px solid var(--border)"}}>
                    <input type="number" min="0" placeholder={t.annual_allowance??"∞"} defaultValue={ov??""} key={(ov??"")+"-"+u.id+t.key} onBlur={e=>{if(String(e.target.value)!==String(ov??""))setPersonQuota(u.email,t.key,e.target.value)}} title={ov!=null?`Override: ${ov}`:`Default: ${t.annual_allowance??"unlimited"}`} style={{width:50,padding:"4px 5px",fontSize:11,borderRadius:6,border:ov!=null?"1.5px solid #F59E0B":"1px solid var(--border)",background:"var(--bg2)",color:ov!=null?"#D97706":"var(--fg2)",textAlign:"center",fontWeight:ov!=null?700:400}}/>
                  </td>;})}
              </tr>)}
            </tbody>
          </table>
        </div>
        <div style={{padding:"8px 14px",fontSize:9,color:"var(--fg2)",display:"flex",gap:14,alignItems:"center"}}>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:11,height:11,borderRadius:4,border:"1.5px solid #F59E0B",display:"inline-block"}}/> Custom override</span>
          <span>Grey number = company default. Type a value to override; clear it to revert.</span>
        </div>
      </div>}
      </div>}

      {settingsTab==="permissions"&&platformRole==='super_admin'&&<div className="af">
        <PermissionsMatrix supabase={supabase} session={{user}}/>
      </div>}
    </div>}

    </div>
    <TicketPopup task={sel} tasks={tasks} onClose={()=>setSel(null)} onUpdate={updateTask} onDelete={deleteTask} setConfirmDlg={setConfirmDlg}/>
    {addModal==="task"&&<SmartAddTask onSave={addTask} onClose={()=>setAddModal(null)}/>}
    {onboardModal&&<OnboardModal initialMode={onboardModal} userRoles={userRoles} onboarding={onboarding} onboardCommon={ONBOARD_COMMON} onboardDept={ONBOARD_DEPT} offboardTemplate={OFFBOARD_TEMPLATE} onGenerate={generateOnboarding} onClose={()=>setOnboardModal(null)}/>}
    {addModal==="raci"&&<AddModal title="Add RACI" fields={[{key:"dept",label:"Department",type:"select",options:DEPT_OPT},{key:"task",label:"Task"},{key:"responsible",label:"R"},{key:"accountable",label:"A"},{key:"consulted",label:"C"},{key:"informed",label:"I"},{key:"notes",label:"Notes"},{key:"is_suggestion",label:"PMO Suggestion?",type:"select",options:["false","true"]}]} onSave={addRaci} onClose={()=>setAddModal(null)}/>}
    {addModal==="risk"&&<AddModal title="Add Risk" fields={[{key:"description",label:"Risk"},{key:"impact",label:"Impact",type:"select",options:IMP_OPT},{key:"owner",label:"Owner"},{key:"mitigation",label:"Mitigation"},{key:"linked_to",label:"Linked Task (name or ID)"}]} onSave={addRisk} onClose={()=>setAddModal(null)}/>}
    {addModal==="kpi"&&<AddModal title="Add KPI" fields={[{key:"dept",label:"Department",type:"select",options:DEPT_OPT},{key:"name",label:"KPI"},{key:"target",label:"Target"},{key:"current_value",label:"Current"},{key:"flag",label:"Status",type:"select",options:["green","yellow","red"]},{key:"review_rhythm",label:"Review",type:"select",options:["Weekly","Bi-Weekly","Monthly"]}]} onSave={addKpi} onClose={()=>setAddModal(null)}/>}
    {addModal==="role"&&<AddModal title="Add Role" fields={[{key:"title",label:"Role Title"},{key:"status",label:"Status",type:"select",options:["Not opened","Interviewing","Blocked","Filled"]},{key:"trigger_blocker",label:"Trigger / Blocker"},{key:"target_date",label:"Target Date"}]} onSave={addRole} onClose={()=>setAddModal(null)}/>}
    {addModal==="meeting"&&<MeetingModal userRoles={userRoles} onSave={addMeeting} onClose={()=>setAddModal(null)}/>}
    {addModal==="standup"&&<AddModal title="Add Standup Update" fields={[{key:"person",label:"Person",placeholder:"e.g. Talha"},{key:"completed",label:"What did you complete today?",placeholder:"Finished the API endpoints..."},{key:"tomorrow",label:"What are you working on tomorrow?",placeholder:"Starting the frontend..."},{key:"blockers",label:"Any blockers?",placeholder:"None"},{key:"standup_date",label:"Date",type:"date"}]} onSave={addStandup} onClose={()=>setAddModal(null)}/>}
    {addModal==="userrole"&&<AddModal title="Add User" fields={[{key:"email",label:"Google Email",placeholder:"name@attimo.com"},{key:"name",label:"Full Name"},{key:"role",label:"Role",type:"select",options:["admin","editor","viewer"]},{key:"dept",label:"Department",type:"select",options:DEPT_OPT}]} onSave={addUserRole} onClose={()=>setAddModal(null)}/>}
    {addModal==="drivefolder"&&<AddModal title="Add Drive Folder" fields={[{key:"dept",label:"Department",type:"select",options:["Leadership","Product","Development","Design","Marketing","AI/Science","PMO","HR","Finance"]},{key:"folder_name",label:"Folder Name"},{key:"folder_url",label:"Google Drive URL",placeholder:"https://drive.google.com/drive/folders/..."},{key:"description",label:"Description (optional)"}]} onSave={async v=>{if(!v.folder_name||!v.dept){showToast("Folder name and department required","error");return}const{data}=await supabase.from('drive_folders').insert({dept:v.dept,folder_name:v.folder_name,folder_url:v.folder_url||"",description:v.description||"",sort_order:driveFolders.length+1}).select();if(data)setDriveFolders(p=>[...p,...data]);showToast("Folder added");setAddModal(null)}} onClose={()=>setAddModal(null)}/>}
    {addModal==="perf"&&<AddModal title="Add Performance Review" fields={[{key:"person",label:"Person",placeholder:"e.g. Talha Mubeen"},{key:"period",label:"Period",placeholder:"e.g. Q2 2026"},{key:"goals",label:"Goals",placeholder:"Key objectives..."}]} onSave={addPerf} onClose={()=>setAddModal(null)}/>}
    {addModal==="leave"&&<LeaveRequestModal user={user} isAdmin={role==="admin"} onSave={addLeave} onClose={()=>{setAddModal(null);setLeavePreFill(null)}} leaves={leaves} userRoles={userRoles} holidays={publicHolidays} initialType={leavePreFill}/>}
    {addModal==="decision"&&<AddModal title="Add Decision" fields={[{key:"title",label:"Decision",placeholder:"What needs to be decided?"},{key:"owner",label:"Owner",placeholder:"Who decides?"},{key:"priority",label:"Priority",type:"select",options:["low","medium","high","critical"]},{key:"due_date",label:"Due Date",type:"date"},{key:"dept",label:"Department",type:"select",options:DEPT_OPT},{key:"context",label:"Context",placeholder:"Why it matters"}]} onSave={addDecision} onClose={()=>setAddModal(null)}/>}

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
              <div style={{position:"relative"}} className="avatar-open">
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
            {slk?.status_text&&<span style={{fontSize:11,color:"var(--fg2)"}}>{stripSlackEmoji(slk.status_text)}</span>}
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

    {/* Confirm Dialog Modal */}
    {confirmDlg&&<ConfirmDialog message={confirmDlg.msg} onConfirm={()=>{confirmDlg.fn();setConfirmDlg(null)}} onCancel={()=>setConfirmDlg(null)}/>}

    {/* Close user menu on outside click */}
    {/* user-menu backdrop relocated into header stacking context (see nav) */}

    {/* Toast notification */}
    {toast&&<div className={"asd "+(toast.type==="error"?"toast-error":"toast-success")} style={{position:"fixed",bottom:24,right:24,color:toast.type==="error"?"#fff":"var(--bg)",padding:"12px 20px",borderRadius:10,fontSize:13,fontWeight:600,boxShadow:"0 8px 30px rgba(0,0,0,.25)",zIndex:2000,display:"flex",alignItems:"center",gap:8}}>{toast.type==="error"?I.alert(14):I.check(14)}{toast.msg||toast}</div>}
    </div>{/* close main area */}
  </div>;
}
