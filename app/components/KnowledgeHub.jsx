'use client';
// ═══════════════════════════════════════════════════════════════════════════
// KnowledgeHub — Documents > Knowledge sub-tab
// Folder tree (Drive hierarchy) + Notion Knowledge Hub + governance strip.
// Links only — content lives in Drive/Notion. Uses global animation classes.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';

const TYPE_COLORS = { Information:'#F59E0B', SOP:'#10B981', Decision:'#92400E', Meeting:'#8B5CF6', Research:'#EC4899', Notes:'#3B82F6' };
const STATUS_COLORS = { Draft:'#F59E0B', 'In Review':'#3B82F6', Accepted:'#10B981' };
const KIND_LABEL = { gdoc:'Doc', gsheet:'Sheet', gslides:'Slides', pdf:'PDF', notion:'Notion', file:'File', link:'Link' };
const KIND_COLORS = { gdoc:'#3B82F6', gsheet:'#10B981', gslides:'#F59E0B', pdf:'#EF4444', notion:'#64748B', file:'#94A3B8', link:'#94A3B8' };

const relTime = (d) => {
  if (!d) return '';
  const ms = Date.now() - new Date(d).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return h + 'h ago';
  const days = Math.floor(h / 24);
  if (days < 30) return days + 'd ago';
  return Math.floor(days / 30) + 'mo ago';
};

export default function KnowledgeHub({ supabase, userRoles, canEdit }) {
  const [folders, setFolders] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(null); // 'drive' | 'notion'
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [openFolders, setOpenFolders] = useState({});
  const [showRegister, setShowRegister] = useState(false);
  const [reg, setReg] = useState({ title:'', url:'', folder_id:'', doc_type:'Information', status:'Draft', owner_email:'' });

  const flash = useCallback((msg, isError=false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchAll = useCallback(async () => {
    const [f, d] = await Promise.all([
      supabase.from('drive_folders').select('*').order('sort_order'),
      supabase.from('knowledge_docs').select('*').order('last_edited', { ascending: false }),
    ]);
    if (f.data) setFolders(f.data);
    if (d.data) setDocs(d.data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchAll(); }, []);

  const runSync = async (which) => {
    setSyncing(which);
    try {
      const res = await fetch(`/api/${which}-sync`, { method: 'POST' });
      const d = await res.json();
      if (d.ok) {
        flash(which === 'notion'
          ? `Notion synced — ${d.synced} pages`
          : `Drive synced — ${d.synced_files} files${d.subfolders_discovered ? `, ${d.subfolders_discovered} new subfolders` : ''}`);
        if (d.failed?.length) flash(`${d.failed.length} item(s) failed — see console`, true), console.warn(`[${which}-sync] failed:`, d.failed);
        await fetchAll();
      } else flash(d.error || 'Sync failed', true);
    } catch (e) { flash(`${which} sync unreachable — route deployed?`, true); }
    setSyncing(null);
  };

  const registerDoc = async () => {
    if (!reg.title.trim() || !reg.url.trim()) { flash('Title and link are required', true); return; }
    // Auto-detect kind from URL
    const u = reg.url;
    const kind = u.includes('docs.google.com/document') ? 'gdoc'
      : u.includes('docs.google.com/spreadsheets') ? 'gsheet'
      : u.includes('docs.google.com/presentation') ? 'gslides'
      : u.includes('notion.so') || u.includes('notion.site') ? 'notion'
      : u.endsWith('.pdf') ? 'pdf' : 'link';
    const owner = userRoles.find(r => r.email === reg.owner_email);
    const { error } = await supabase.from('knowledge_docs').insert({
      title: reg.title.trim(), url: u.trim(),
      folder_id: reg.folder_id || null,
      dept: folders.find(f => String(f.id) === String(reg.folder_id))?.dept || null,
      doc_type: reg.doc_type, file_kind: kind, status: reg.status,
      owner_email: reg.owner_email || null, owner_name: owner?.name || null,
      source: 'manual', source_id: 'manual-' + Date.now(),
    });
    if (error) flash(error.message, true);
    else { flash('Document registered'); setShowRegister(false); setReg({ title:'', url:'', folder_id:'', doc_type:'Information', status:'Draft', owner_email:'' }); fetchAll(); }
  };

  const updateDocStatus = async (id, status) => {
    setDocs(p => p.map(d => d.id === id ? { ...d, status } : d));
    await supabase.from('knowledge_docs').update({ status, last_reviewed: new Date().toISOString().split('T')[0] }).eq('id', id);
  };

  // ─── Derived data ──────────────────────────────────────────────────
  const q = search.toLowerCase().trim();
  const matches = (d) => !q || d.title?.toLowerCase().includes(q) || d.owner_name?.toLowerCase().includes(q) || d.doc_type?.toLowerCase().includes(q);
  const filteredDocs = useMemo(() => docs.filter(matches), [docs, q]);

  const gov = useMemo(() => {
    const stale = d => d.status === 'Accepted' && d.last_edited && (Date.now() - new Date(d.last_edited).getTime()) > 60 * 864e5;
    return {
      total: docs.length,
      drafts: docs.filter(d => d.status === 'Draft').length,
      review: docs.filter(d => d.status === 'In Review').length,
      accepted: docs.filter(d => d.status === 'Accepted').length,
      stale: docs.filter(stale).length,
      orphaned: docs.filter(d => !d.owner_email && !d.owner_name).length,
    };
  }, [docs]);

  const topFolders = folders.filter(f => !f.parent_id);
  const childrenOf = (id) => folders.filter(f => f.parent_id === id);
  const docsIn = (folderId) => filteredDocs.filter(d => String(d.folder_id) === String(folderId));
  const docsInTree = (folder) => { // count incl. subfolders
    let n = docsIn(folder.id).length;
    childrenOf(folder.id).forEach(c => { n += docsInTree(c); });
    return n;
  };
  const notionDocs = filteredDocs.filter(d => d.source === 'notion');

  // ─── Doc row ───────────────────────────────────────────────────────
  const DocRow = ({ d, i }) => (
    <div className="rh asl" style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 10px', borderRadius:6, animationDelay:(i*18)+'ms' }}>
      <span style={{ fontSize:7, fontWeight:700, padding:'1px 5px', borderRadius:3, background:(KIND_COLORS[d.file_kind]||'#94A3B8')+'18', color:KIND_COLORS[d.file_kind]||'#94A3B8', flexShrink:0, minWidth:28, textAlign:'center' }}>{KIND_LABEL[d.file_kind]||'Link'}</span>
      <a href={d.url} target="_blank" rel="noopener" style={{ flex:1, fontSize:11, fontWeight:500, color:'var(--fg)', textDecoration:'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} onMouseEnter={e=>e.target.style.color='#3B82F6'} onMouseLeave={e=>e.target.style.color='var(--fg)'}>{d.title}</a>
      {d.doc_type && d.source !== 'drive' && <span style={{ fontSize:8, fontWeight:600, padding:'1px 6px', borderRadius:99, background:(TYPE_COLORS[d.doc_type]||'#64748B')+'18', color:TYPE_COLORS[d.doc_type]||'#64748B', flexShrink:0 }}>{d.doc_type}</span>}
      {canEdit && d.source !== 'drive'
        ? <select value={d.status||'Draft'} onChange={e=>updateDocStatus(d.id, e.target.value)} style={{ fontSize:8, fontWeight:700, padding:'1px 4px', borderRadius:99, border:'none', background:(STATUS_COLORS[d.status]||'#94A3B8')+'18', color:STATUS_COLORS[d.status]||'#94A3B8', cursor:'pointer', flexShrink:0 }}>{['Draft','In Review','Accepted'].map(s=><option key={s}>{s}</option>)}</select>
        : d.source !== 'drive' && <span style={{ fontSize:8, fontWeight:700, padding:'1px 6px', borderRadius:99, background:(STATUS_COLORS[d.status]||'#94A3B8')+'18', color:STATUS_COLORS[d.status]||'#94A3B8', flexShrink:0 }}>{d.status}</span>}
      <span style={{ fontSize:9, color:'var(--fg2)', flexShrink:0, minWidth:90, textAlign:'right' }} title={d.last_edited||''}>
        {d.last_edited ? relTime(d.last_edited) : ''}{d.owner_name ? ` · ${d.owner_name.split(' ')[0]}` : ''}
      </span>
    </div>
  );

  // ─── Folder node (recursive) ───────────────────────────────────────
  const FolderNode = ({ f, depth }) => {
    const open = openFolders[f.id] ?? (depth === 0 && q.length > 0);
    const kids = childrenOf(f.id);
    const inside = docsIn(f.id);
    const treeCount = docsInTree(f);
    const ownerName = userRoles.find(u => u.email === f.owner_email)?.name?.split(' ')[0];
    if (q && treeCount === 0) return null;
    return (
      <div style={{ marginLeft: depth * 14 }}>
        <div className="rh" onClick={() => setOpenFolders(p => ({ ...p, [f.id]: !open }))} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:8, cursor:'pointer', borderLeft: depth===0 ? '3px solid #3B82F6' : '3px solid transparent', background: depth===0 ? 'var(--bg2)' : 'transparent', marginBottom:2 }}>
          <span style={{ fontSize:9, color:'var(--fg2)', width:10, transition:'transform .2s', transform: open?'rotate(90deg)':'rotate(0)', display:'inline-block' }}>{'>'}</span>
          <span style={{ fontSize: depth===0?12:11, fontWeight: depth===0?700:600, color:'var(--fg)', flex:1 }}>{f.folder_name}</span>
          {ownerName && depth===0 && <span style={{ fontSize:8, color:'var(--fg2)', padding:'1px 6px', borderRadius:99, background:'var(--bg3)' }}>{ownerName}</span>}
          <span style={{ fontSize:9, color:'var(--fg2)', fontWeight:600 }}>{treeCount}</span>
          {f.folder_url && <a href={f.folder_url} target="_blank" rel="noopener" onClick={e=>e.stopPropagation()} style={{ fontSize:8, color:'#3B82F6', fontWeight:600, textDecoration:'none' }}>Drive</a>}
        </div>
        {open && <div className="af">
          {inside.map((d, i) => <DocRow key={d.id} d={d} i={i} />)}
          {kids.map(c => <FolderNode key={c.id} f={c} depth={depth + 1} />)}
          {inside.length === 0 && kids.length === 0 && <div style={{ fontSize:9, color:'var(--fg2)', fontStyle:'italic', padding:'4px 24px' }}>No documents registered yet</div>}
        </div>}
      </div>
    );
  };

  if (loading) return <div className="af" style={{ padding:32, textAlign:'center', fontSize:11, color:'var(--fg2)' }}>Loading knowledge registry...</div>;

  return (
    <div className="af" style={{ fontSize:12, color:'var(--fg)' }}>
      {toast && <div className="asd" style={{ position:'fixed', bottom:24, right:24, zIndex:2100, padding:'9px 16px', borderRadius:9, color:'#fff', fontSize:11, fontWeight:600, background: toast.isError?'#EF4444':'#10B981', boxShadow:'0 8px 30px rgba(0,0,0,.25)' }}>{toast.msg}</div>}

      {/* Governance strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))', gap:8, marginBottom:14 }}>
        {[
          { l:'Total', v:gov.total, c:'#3B82F6' },
          { l:'Draft', v:gov.drafts, c:'#F59E0B' },
          { l:'In Review', v:gov.review, c:'#8B5CF6' },
          { l:'Accepted', v:gov.accepted, c:'#10B981' },
          { l:'Stale 60d+', v:gov.stale, c: gov.stale>0?'#EF4444':'#94A3B8' },
          { l:'No Owner', v:gov.orphaned, c: gov.orphaned>0?'#EF4444':'#94A3B8' },
        ].map((m,i)=>(
          <div key={m.l} className="asl stat-card" style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px', borderLeft:'3px solid '+m.c, animationDelay:i*45+'ms' }}>
            <div style={{ fontSize:18, fontWeight:800, color:m.c }}>{m.v}</div>
            <div style={{ fontSize:8, fontWeight:600, color:'var(--fg2)', textTransform:'uppercase', letterSpacing:.5 }}>{m.l}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search documents, owners, types..." style={{ flex:1, minWidth:200, padding:'8px 12px', fontSize:11, borderRadius:8, border:'1px solid var(--border)', background:'var(--bg2)', color:'var(--fg)' }}/>
        <button onClick={()=>runSync('notion')} disabled={!!syncing} className="btn-pop" style={{ padding:'7px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--fg)', fontSize:10, fontWeight:600, cursor:'pointer', opacity:syncing?'.5':1 }}>{syncing==='notion'?'Syncing...':'Sync Notion'}</button>
        <button onClick={()=>runSync('drive')} disabled={!!syncing} className="btn-pop" style={{ padding:'7px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--fg)', fontSize:10, fontWeight:600, cursor:'pointer', opacity:syncing?'.5':1 }}>{syncing==='drive'?'Syncing...':'Sync Drive'}</button>
        {canEdit && <button onClick={()=>setShowRegister(true)} className="btn-pop" style={{ padding:'7px 14px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#3B82F6,#8B5CF6)', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>+ Register Document</button>}
      </div>

      {/* Drive folder tree */}
      <div className="asc" style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:12, marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--fg)', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
          Google Drive
          <span style={{ fontSize:8, color:'var(--fg2)', fontWeight:400 }}>files stay in Drive — links only</span>
        </div>
        {topFolders.map(f => <FolderNode key={f.id} f={f} depth={0} />)}
        {topFolders.length === 0 && <div style={{ fontSize:10, color:'var(--fg2)', padding:8 }}>No folders — run SQL migration 08 to seed the hierarchy.</div>}
      </div>

      {/* Notion Knowledge Hub */}
      <div className="asc" style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
          <span style={{ fontSize:11, fontWeight:700, color:'var(--fg)' }}>Notion Knowledge Hub</span>
          <span style={{ fontSize:8, color:'var(--fg2)' }}>{notionDocs.length} pages</span>
          <div style={{ flex:1 }}/>
          <a href="https://app.notion.com/p/0f07d424bc2882f88f5f812612d9fc7c" target="_blank" rel="noopener" style={{ fontSize:9, color:'#3B82F6', fontWeight:600, textDecoration:'none' }}>Open in Notion</a>
        </div>
        {notionDocs.length === 0
          ? <div style={{ fontSize:10, color:'var(--fg2)', padding:8 }}>Nothing synced yet — set NOTION_API_KEY in Vercel and click Sync Notion.</div>
          : notionDocs.map((d, i) => <DocRow key={d.id} d={d} i={i} />)}
      </div>

      {/* Register modal */}
      {showRegister && <div className="af modal-overlay" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:2050, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }} onClick={()=>setShowRegister(false)}>
        <div className="asc" onClick={e=>e.stopPropagation()} style={{ background:'var(--card)', borderRadius:14, padding:20, width:'min(420px,92vw)', border:'1px solid var(--border)', boxShadow:'0 25px 60px rgba(0,0,0,.3)' }}>
          <div style={{ fontSize:14, fontWeight:800, color:'var(--fg)', marginBottom:14 }}>Register Document</div>
          <label style={{ fontSize:10, fontWeight:600, color:'var(--fg2)', display:'block', marginBottom:4 }}>Title</label>
          <input value={reg.title} onChange={e=>setReg(p=>({...p,title:e.target.value}))} placeholder="e.g. Q3 GTM Strategy" style={{ width:'100%', padding:'7px 10px', border:'1px solid var(--border)', borderRadius:7, fontSize:11, background:'var(--bg2)', color:'var(--fg)', boxSizing:'border-box', marginBottom:10 }}/>
          <label style={{ fontSize:10, fontWeight:600, color:'var(--fg2)', display:'block', marginBottom:4 }}>Link (Drive, Notion, anything)</label>
          <input value={reg.url} onChange={e=>setReg(p=>({...p,url:e.target.value}))} placeholder="https://..." style={{ width:'100%', padding:'7px 10px', border:'1px solid var(--border)', borderRadius:7, fontSize:11, background:'var(--bg2)', color:'var(--fg)', boxSizing:'border-box', marginBottom:10 }}/>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            <div>
              <label style={{ fontSize:10, fontWeight:600, color:'var(--fg2)', display:'block', marginBottom:4 }}>Folder</label>
              <select value={reg.folder_id} onChange={e=>setReg(p=>({...p,folder_id:e.target.value}))} style={{ width:'100%', padding:'7px 8px', border:'1px solid var(--border)', borderRadius:7, fontSize:11, background:'var(--bg2)', color:'var(--fg)' }}>
                <option value="">— None —</option>
                {folders.map(f=><option key={f.id} value={f.id}>{f.parent_id?'  - ':''}{f.folder_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:10, fontWeight:600, color:'var(--fg2)', display:'block', marginBottom:4 }}>Type</label>
              <select value={reg.doc_type} onChange={e=>setReg(p=>({...p,doc_type:e.target.value}))} style={{ width:'100%', padding:'7px 8px', border:'1px solid var(--border)', borderRadius:7, fontSize:11, background:'var(--bg2)', color:'var(--fg)' }}>
                {Object.keys(TYPE_COLORS).map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:10, fontWeight:600, color:'var(--fg2)', display:'block', marginBottom:4 }}>Status</label>
              <select value={reg.status} onChange={e=>setReg(p=>({...p,status:e.target.value}))} style={{ width:'100%', padding:'7px 8px', border:'1px solid var(--border)', borderRadius:7, fontSize:11, background:'var(--bg2)', color:'var(--fg)' }}>
                {['Draft','In Review','Accepted'].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:10, fontWeight:600, color:'var(--fg2)', display:'block', marginBottom:4 }}>Owner</label>
              <select value={reg.owner_email} onChange={e=>setReg(p=>({...p,owner_email:e.target.value}))} style={{ width:'100%', padding:'7px 8px', border:'1px solid var(--border)', borderRadius:7, fontSize:11, background:'var(--bg2)', color:'var(--fg)' }}>
                <option value="">— None —</option>
                {userRoles.map(u=><option key={u.email} value={u.email}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
            <button onClick={()=>setShowRegister(false)} style={{ padding:'7px 14px', borderRadius:7, border:'1px solid var(--border)', background:'transparent', color:'var(--fg2)', fontSize:11, cursor:'pointer' }}>Cancel</button>
            <button onClick={registerDoc} className="btn-pop" style={{ padding:'7px 14px', borderRadius:7, border:'none', background:'linear-gradient(135deg,#3B82F6,#8B5CF6)', color:'#fff', fontSize:11, fontWeight:600, cursor:'pointer' }}>Register</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
