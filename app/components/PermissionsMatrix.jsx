'use client';
// ═══════════════════════════════════════════════════════════════════════════
// PermissionsMatrix — Access Control (Settings > Permissions, Super Admin only)
// Compact, animated, matches Attimo Ops Hub design system.
// Uses global animation classes injected by page.jsx: af, asl, rh, btn-pop, asc
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';

const PERM_FIELDS = [
  { key: 'can_view',    label: 'View',    hint: 'Can open and see this module' },
  { key: 'can_add',     label: 'Add',     hint: 'Can create new records' },
  { key: 'can_edit',    label: 'Edit',    hint: 'Can modify existing records' },
  { key: 'can_delete',  label: 'Delete',  hint: 'Can remove records' },
  { key: 'can_approve', label: 'Approve', hint: 'Can approve or reject requests' },
];

const ROLE_COLORS = { super_admin:'#3B82F6', admin:'#8B5CF6', manager:'#F59E0B', employee:'#10B981', intern:'#64748B' };

export default function PermissionsMatrix({ supabase, session }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const [roles, setRoles] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [overrides, setOverrides] = useState([]);
  const [users, setUsers] = useState([]);

  const [section, setSection] = useState('matrix');
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  const [showCreateRole, setShowCreateRole] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleKey, setNewRoleKey] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  const flash = useCallback((msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = (await supabase.auth.getSession())?.data?.session?.access_token;
      const res = await fetch('/api/permissions', { headers: { 'Authorization': `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      if (!json.admin_data) { setError('Access restricted to Super Admin.'); return; }
      const { roles: r, tabs: t, matrix: m, overrides: o, users: u } = json.admin_data;
      setRoles(r); setTabs(t); setUsers(u); setOverrides(o);
      const mx = {};
      m.forEach(row => { mx[`${row.role_key}::${row.tab_key}`] = row; });
      setMatrix(mx);
      setSelectedRole(prev => prev || r[0]?.role_key);
      setSelectedUser(prev => prev || u[0]?.email);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [supabase]);

  useEffect(() => { fetchData(); }, []);

  const apiPost = async (body) => {
    const token = (await supabase.auth.getSession())?.data?.session?.access_token;
    const res = await fetch('/api/permissions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Request failed');
    return json;
  };

  const togglePerm = async (role_key, tab_key, field) => {
    const cellKey = `${role_key}::${tab_key}`;
    const current = matrix[cellKey]?.[field] || false;
    const newVal = !current;
    setSaving(`${cellKey}::${field}`);
    setMatrix(prev => ({ ...prev, [cellKey]: { ...prev[cellKey], [field]: newVal } }));
    try { await apiPost({ action: 'toggle_permission', role_key, tab_key, field, value: newVal }); }
    catch (err) {
      setMatrix(prev => ({ ...prev, [cellKey]: { ...prev[cellKey], [field]: current } }));
      flash(err.message, true);
    } finally { setSaving(null); }
  };

  const assignRole = async (email, platform_role) => {
    setSaving(`assign::${email}`);
    const prevUsers = [...users];
    setUsers(u => u.map(x => x.email === email ? { ...x, platform_role } : x));
    try { await apiPost({ action: 'assign_role', user_email: email, platform_role }); flash('Role updated'); }
    catch (err) { setUsers(prevUsers); flash(err.message, true); }
    finally { setSaving(null); }
  };

  const toggleOverride = async (email, tab_key, field) => {
    const existing = overrides.find(o => o.user_email === email && o.tab_key === tab_key);
    const currentVal = existing?.[field];
    let newVal;
    if (currentVal === null || currentVal === undefined) newVal = true;
    else if (currentVal === true) newVal = false;
    else newVal = null;
    setSaving(`ov::${email}::${tab_key}::${field}`);
    try { await apiPost({ action: 'set_override', user_email: email, tab_key, field, value: newVal, note: null }); await fetchData(); }
    catch (err) { flash(err.message, true); }
    finally { setSaving(null); }
  };

  const removeOverride = async (email, tab_key) => {
    setSaving(`rm::${email}::${tab_key}`);
    try {
      await apiPost({ action: 'remove_override', user_email: email, tab_key });
      setOverrides(prev => prev.filter(o => !(o.user_email === email && o.tab_key === tab_key)));
      flash('Reset to role default');
    } catch (err) { flash(err.message, true); }
    finally { setSaving(null); }
  };

  const createRole = async () => {
    if (!newRoleKey || !newRoleName) return;
    try {
      await apiPost({ action: 'create_role', role_key: newRoleKey, display_name: newRoleName, description: newRoleDesc });
      setShowCreateRole(false); setNewRoleKey(''); setNewRoleName(''); setNewRoleDesc('');
      await fetchData(); flash('Role created');
    } catch (err) { flash(err.message, true); }
  };

  const deleteRole = async (role_key) => {
    try {
      await apiPost({ action: 'delete_role', role_key });
      setShowDeleteConfirm(null);
      if (selectedRole === role_key) setSelectedRole(roles[0]?.role_key);
      await fetchData(); flash('Role deleted');
    } catch (err) { flash(err.message, true); }
  };

  const getOverride = (email, tab_key) => overrides.find(o => o.user_email === email && o.tab_key === tab_key);
  const getBase = (email) => {
    const u = users.find(x => x.email === email);
    const base = {};
    tabs.forEach(t => { base[t.tab_key] = matrix[`${u?.platform_role}::${t.tab_key}`] || {}; });
    return base;
  };

  // ─── Render ─────────────────────────────────────────────────────────

  if (loading) return <div className="af" style={{padding:32,textAlign:"center"}}><div style={{width:24,height:24,border:"2px solid var(--border)",borderTopColor:"#3B82F6",borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 8px"}}/><span style={{fontSize:10,color:"var(--fg2)"}}>Loading access control...</span></div>;
  if (error) return <div className="af" style={{padding:32,textAlign:"center",fontSize:11,color:"#EF4444",fontWeight:600}}>{error}</div>;

  const activeRoleObj = roles.find(r => r.role_key === selectedRole);
  const roleUserCount = users.filter(u => u.platform_role === selectedRole).length;
  const rc = ROLE_COLORS[selectedRole] || '#6366F1';

  // Compact toggle cell: 16px, scales on hover via btn-pop
  const cell = (on, overridden, busy) => ({
    width: 16, height: 16, borderRadius: 5, cursor: "pointer", padding: 0,
    border: overridden ? "2px solid #F59E0B" : on ? "none" : "1.5px solid var(--border)",
    background: on ? "#10B981" : "transparent",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    transition: "all .15s cubic-bezier(.22,1,.36,1)", opacity: busy ? .35 : 1,
  });
  const ck = <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>;
  const xx = <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="3.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
  const th = {padding:"7px 8px",textAlign:"center",fontSize:8,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:.8,borderBottom:"1px solid var(--border)",minWidth:48};
  const thL = {...th,textAlign:"left",paddingLeft:12,minWidth:110};
  const td = {padding:"5px 8px",textAlign:"center",borderBottom:"1px solid var(--border)"};
  const tdL = {padding:"6px 12px",fontSize:11,fontWeight:600,color:"var(--fg)",borderBottom:"1px solid var(--border)"};

  return (
    <div style={{fontSize:11,color:"var(--fg)"}}>
      {toast && <div className="asd" style={{position:"fixed",bottom:24,right:24,zIndex:2100,padding:"9px 16px",borderRadius:9,color:"#fff",fontSize:11,fontWeight:600,background:toast.isError?"#EF4444":"#10B981",boxShadow:"0 8px 30px rgba(0,0,0,.25)"}}>{toast.msg}</div>}

      {/* Section pills */}
      <div className="af" style={{display:"flex",gap:3,background:"var(--bg3)",borderRadius:8,padding:2,width:"fit-content",marginBottom:14}}>
        {[{k:'matrix',l:'Roles'},{k:'users',l:'Assignment'},{k:'overrides',l:'Exceptions'}].map(s=>
          <button key={s.k} onClick={()=>setSection(s.k)} className="tab-btn" style={{padding:"5px 14px",borderRadius:6,border:"none",fontSize:10,fontWeight:600,cursor:"pointer",transition:"all .2s",background:section===s.k?"var(--fg)":"transparent",color:section===s.k?"var(--bg)":"var(--fg2)"}}>{s.l}</button>
        )}
      </div>

      {/* ─── ROLES & PERMISSIONS ─────────────────────────────────────── */}
      {section==='matrix'&&<div className="af">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:6}}>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {roles.map((r,i)=>{
              const active=selectedRole===r.role_key;
              const c=ROLE_COLORS[r.role_key]||'#6366F1';
              return <button key={r.role_key} onClick={()=>setSelectedRole(r.role_key)} className="btn-pop asl" style={{padding:"4px 11px",borderRadius:7,fontSize:10,fontWeight:600,cursor:"pointer",border:active?"1.5px solid "+c:"1px solid var(--border)",background:active?c+"12":"var(--card)",color:active?c:"var(--fg2)",transition:"all .15s",animationDelay:i*40+"ms"}}>
                {r.display_name}
              </button>;
            })}
          </div>
          <button onClick={()=>setShowCreateRole(true)} className="btn-pop" style={{padding:"4px 11px",borderRadius:7,border:"1px dashed var(--border)",background:"transparent",color:"var(--fg2)",fontSize:10,fontWeight:600,cursor:"pointer"}}>+ Role</button>
        </div>

        {activeRoleObj&&<div className="asd" style={{display:"flex",alignItems:"center",gap:10,padding:"7px 12px",borderRadius:8,background:"var(--bg2)",borderLeft:"3px solid "+rc,marginBottom:10,flexWrap:"wrap"}}>
          <span style={{fontSize:10,color:"var(--fg2)",flex:1,minWidth:180}}>{activeRoleObj.description||"No description"}</span>
          <span style={{fontSize:9,color:rc,fontWeight:700}}>{roleUserCount} member{roleUserCount===1?"":"s"}</span>
          {activeRoleObj.is_system?<span style={{fontSize:8,fontWeight:700,padding:"1px 6px",borderRadius:4,background:"var(--bg3)",color:"var(--fg2)",letterSpacing:.5}}>SYSTEM</span>
          :<button onClick={()=>setShowDeleteConfirm(selectedRole)} style={{padding:"2px 8px",borderRadius:5,border:"1px solid #FCA5A5",background:"transparent",color:"#EF4444",fontSize:9,fontWeight:600,cursor:"pointer"}}>Delete</button>}
        </div>}

        <div className="asc" style={{border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:"var(--bg2)"}}>
              <th style={thL}>Module</th>
              {PERM_FIELDS.map(f=><th key={f.key} title={f.hint} style={th}>{f.label}</th>)}
            </tr></thead>
            <tbody>
              {tabs.map((t,i)=>{
                const cb=`${selectedRole}::${t.tab_key}`;
                return <tr key={t.tab_key} className="rh asl" style={{animationDelay:i*22+"ms"}}>
                  <td style={tdL}>{t.display_name}</td>
                  {PERM_FIELDS.map(f=>{
                    const val=matrix[cb]?.[f.key]||false;
                    const busy=saving===`${cb}::${f.key}`;
                    return <td key={f.key} style={td}>
                      <button onClick={()=>togglePerm(selectedRole,t.tab_key,f.key)} disabled={busy} className="btn-pop" title={`${f.label}: ${val?"Allowed":"Off"}`} style={cell(val,false,busy)}>{val?ck:null}</button>
                    </td>;
                  })}
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <div style={{fontSize:9,color:"var(--fg2)",marginTop:8,display:"flex",gap:14}}>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:11,height:11,borderRadius:4,background:"#10B981",display:"inline-flex",alignItems:"center",justifyContent:"center"}}><svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg></span> Allowed</span>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:11,height:11,borderRadius:4,border:"1.5px solid var(--border)",display:"inline-block"}}/> Off — click to toggle</span>
        </div>
      </div>}

      {/* ─── TEAM ASSIGNMENT ─────────────────────────────────────────── */}
      {section==='users'&&<div className="af">
        <div style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap"}}>
          {roles.map((r,i)=>{const c=ROLE_COLORS[r.role_key]||'#6366F1';const n=users.filter(u=>u.platform_role===r.role_key).length;
            return <span key={r.role_key} className="asl" style={{padding:"3px 10px",fontSize:9,fontWeight:600,borderRadius:99,background:c+"12",color:c,animationDelay:i*40+"ms"}}>{r.display_name} {n}</span>;
          })}
        </div>
        <div className="asc" style={{border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:"var(--bg2)"}}>
              <th style={thL}>Member</th>
              <th style={{...th,textAlign:"left",paddingLeft:12}}>Dept</th>
              <th style={{...th,textAlign:"left",paddingLeft:12,minWidth:130}}>Access Level</th>
            </tr></thead>
            <tbody>
              {users.map((u,i)=>{const c=ROLE_COLORS[u.platform_role]||'#6366F1';
                return <tr key={u.email} className="rh asl" style={{animationDelay:i*22+"ms"}}>
                  <td style={{...tdL,display:"flex",alignItems:"center",gap:8}}>
                    {u.avatar_url?<img src={u.avatar_url} style={{width:22,height:22,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:22,height:22,borderRadius:"50%",background:c,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{color:"#fff",fontSize:8,fontWeight:700}}>{u.name?.[0]}</span></div>}
                    <div><div style={{fontSize:11,fontWeight:600}}>{u.name}</div><div style={{fontSize:8,color:"var(--fg2)"}}>{u.email}</div></div>
                  </td>
                  <td style={{padding:"6px 12px",fontSize:10,color:"var(--fg2)",borderBottom:"1px solid var(--border)"}}>{u.dept||"—"}</td>
                  <td style={{padding:"5px 12px",borderBottom:"1px solid var(--border)"}}>
                    <select value={u.platform_role||'employee'} onChange={e=>assignRole(u.email,e.target.value)} disabled={saving===`assign::${u.email}`} style={{padding:"4px 8px",fontSize:10,fontWeight:600,borderRadius:6,border:"1px solid var(--border)",background:"var(--bg2)",color:c,cursor:"pointer",minWidth:120}}>
                      {roles.map(r=><option key={r.role_key} value={r.role_key}>{r.display_name}</option>)}
                    </select>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>}

      {/* ─── INDIVIDUAL EXCEPTIONS ───────────────────────────────────── */}
      {section==='overrides'&&<div className="af">
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
          <select value={selectedUser||''} onChange={e=>setSelectedUser(e.target.value)} style={{padding:"6px 10px",fontSize:11,fontWeight:600,borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",minWidth:220}}>
            {users.map(u=><option key={u.email} value={u.email}>{u.name} — {roles.find(r=>r.role_key===u.platform_role)?.display_name||u.platform_role}</option>)}
          </select>
        </div>
        <div style={{fontSize:9,color:"var(--fg2)",marginBottom:10}}>Click a cell to cycle: role default → allow → block → default. <span style={{color:"#F59E0B",fontWeight:600}}>Orange outline</span> = exception active.</div>

        {selectedUser&&(()=>{
          const base=getBase(selectedUser);
          return <div className="asc" style={{border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:"var(--bg2)"}}>
                <th style={thL}>Module</th>
                {PERM_FIELDS.map(f=><th key={f.key} style={th}>{f.label}</th>)}
                <th style={{...th,minWidth:44}}/>
              </tr></thead>
              <tbody>
                {tabs.map((t,i)=>{
                  const ov=getOverride(selectedUser,t.tab_key);
                  const hasOv=ov&&PERM_FIELDS.some(f=>ov[f.key]!==null&&ov[f.key]!==undefined);
                  return <tr key={t.tab_key} className="rh asl" style={{animationDelay:i*22+"ms"}}>
                    <td style={tdL}>{t.display_name}</td>
                    {PERM_FIELDS.map(f=>{
                      const ovVal=ov?.[f.key];
                      const isOv=ovVal!==null&&ovVal!==undefined;
                      const eff=isOv?ovVal:(base[t.tab_key]?.[f.key]||false);
                      const busy=saving===`ov::${selectedUser}::${t.tab_key}::${f.key}`;
                      return <td key={f.key} style={td}>
                        <button onClick={()=>toggleOverride(selectedUser,t.tab_key,f.key)} disabled={busy} className="btn-pop" title={isOv?`Exception: ${ovVal?"Allowed":"Blocked"}`:`Role default: ${eff?"Allowed":"Off"}`} style={cell(eff,isOv,busy)}>{eff?ck:isOv?xx:null}</button>
                      </td>;
                    })}
                    <td style={td}>
                      {hasOv&&<button onClick={()=>removeOverride(selectedUser,t.tab_key)} style={{padding:"2px 7px",fontSize:8,fontWeight:600,borderRadius:5,border:"1px solid var(--border)",background:"transparent",color:"var(--fg2)",cursor:"pointer"}}>Reset</button>}
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>;
        })()}
      </div>}

      {/* ─── CREATE ROLE MODAL ───────────────────────────────────────── */}
      {showCreateRole&&<div className="af modal-overlay" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:2050,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}} onClick={()=>setShowCreateRole(false)}>
        <div className="asc" onClick={e=>e.stopPropagation()} style={{background:"var(--card)",borderRadius:14,padding:20,width:"min(380px,92vw)",border:"1px solid var(--border)",boxShadow:"0 25px 60px rgba(0,0,0,.3)"}}>
          <div style={{fontSize:14,fontWeight:800,color:"var(--fg)",marginBottom:14}}>Create New Role</div>
          <label style={{fontSize:10,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Role Name</label>
          <input value={newRoleName} onChange={e=>{setNewRoleName(e.target.value);setNewRoleKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,''))}} placeholder="e.g. Team Lead" style={{width:"100%",padding:"7px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:11,background:"var(--bg2)",color:"var(--fg)",boxSizing:"border-box",marginBottom:10}}/>
          <label style={{fontSize:10,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Description <span style={{fontWeight:400}}>(optional)</span></label>
          <input value={newRoleDesc} onChange={e=>setNewRoleDesc(e.target.value)} placeholder="What this role is for" style={{width:"100%",padding:"7px 10px",border:"1px solid var(--border)",borderRadius:7,fontSize:11,background:"var(--bg2)",color:"var(--fg)",boxSizing:"border-box",marginBottom:5}}/>
          <div style={{fontSize:8,color:"var(--fg2)",marginBottom:14}}>New roles start with no permissions — configure them in the matrix after creation.</div>
          <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
            <button onClick={()=>setShowCreateRole(false)} style={{padding:"7px 14px",borderRadius:7,border:"1px solid var(--border)",background:"transparent",color:"var(--fg2)",fontSize:11,cursor:"pointer"}}>Cancel</button>
            <button onClick={createRole} disabled={!newRoleKey||!newRoleName} className="btn-pop" style={{padding:"7px 14px",borderRadius:7,border:"none",background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",opacity:(!newRoleKey||!newRoleName)?.5:1}}>Create</button>
          </div>
        </div>
      </div>}

      {/* ─── DELETE ROLE CONFIRM ─────────────────────────────────────── */}
      {showDeleteConfirm&&<div className="af modal-overlay" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:2050,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}} onClick={()=>setShowDeleteConfirm(null)}>
        <div className="asc" onClick={e=>e.stopPropagation()} style={{background:"var(--card)",borderRadius:14,padding:20,width:"min(360px,92vw)",border:"1px solid var(--border)",boxShadow:"0 25px 60px rgba(0,0,0,.3)"}}>
          <div style={{fontSize:14,fontWeight:800,color:"var(--fg)",marginBottom:8}}>Delete Role</div>
          {(()=>{const cnt=users.filter(u=>u.platform_role===showDeleteConfirm).length;
            return <>
              <p style={{fontSize:11,color:"var(--fg2)",margin:"0 0 6px",lineHeight:1.5}}>Delete "{roles.find(r=>r.role_key===showDeleteConfirm)?.display_name}"? This cannot be undone.</p>
              {cnt>0&&<p style={{fontSize:10,color:"#EF4444",fontWeight:600,margin:"0 0 10px"}}>{cnt} member{cnt===1?" is":"s are"} still assigned — reassign them first.</p>}
              <div style={{display:"flex",gap:6,justifyContent:"flex-end",marginTop:10}}>
                <button onClick={()=>setShowDeleteConfirm(null)} style={{padding:"7px 14px",borderRadius:7,border:"1px solid var(--border)",background:"transparent",color:"var(--fg2)",fontSize:11,cursor:"pointer"}}>Cancel</button>
                <button onClick={()=>deleteRole(showDeleteConfirm)} disabled={cnt>0} className="btn-pop" style={{padding:"7px 14px",borderRadius:7,border:"none",background:"#EF4444",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",opacity:cnt>0?.5:1}}>Delete</button>
              </div>
            </>;
          })()}
        </div>
      </div>}
    </div>
  );
}
