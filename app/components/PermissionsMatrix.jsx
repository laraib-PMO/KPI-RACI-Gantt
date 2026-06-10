'use client';
// ═══════════════════════════════════════════════════════════════════════════
// PermissionsMatrix — Access Control (Settings > Permissions)
// Super Admin only. Three sections: Roles & Permissions, Team Assignment,
// Per-User Overrides. Styled to match Attimo Ops Hub design system.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';

const PERM_FIELDS = [
  { key: 'can_view',    label: 'View',    hint: 'Can open and see this tab' },
  { key: 'can_add',     label: 'Add',     hint: 'Can create new records' },
  { key: 'can_edit',    label: 'Edit',    hint: 'Can modify existing records' },
  { key: 'can_delete',  label: 'Delete',  hint: 'Can remove records' },
  { key: 'can_approve', label: 'Approve', hint: 'Can approve or reject requests' },
];

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
    setTimeout(() => setToast(null), 2800);
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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
    try {
      await apiPost({ action: 'toggle_permission', role_key, tab_key, field, value: newVal });
    } catch (err) {
      setMatrix(prev => ({ ...prev, [cellKey]: { ...prev[cellKey], [field]: current } }));
      flash(err.message, true);
    } finally { setSaving(null); }
  };

  const assignRole = async (email, platform_role) => {
    setSaving(`assign::${email}`);
    const prevUsers = [...users];
    setUsers(u => u.map(x => x.email === email ? { ...x, platform_role } : x));
    try {
      await apiPost({ action: 'assign_role', user_email: email, platform_role });
      flash('Role updated');
    } catch (err) {
      setUsers(prevUsers);
      flash(err.message, true);
    } finally { setSaving(null); }
  };

  const toggleOverride = async (email, tab_key, field) => {
    const existing = overrides.find(o => o.user_email === email && o.tab_key === tab_key);
    const currentVal = existing?.[field];
    let newVal;
    if (currentVal === null || currentVal === undefined) newVal = true;
    else if (currentVal === true) newVal = false;
    else newVal = null;
    setSaving(`override::${email}::${tab_key}::${field}`);
    try {
      await apiPost({ action: 'set_override', user_email: email, tab_key, field, value: newVal, note: null });
      await fetchData();
    } catch (err) {
      flash(err.message, true);
    } finally { setSaving(null); }
  };

  const removeOverride = async (email, tab_key) => {
    setSaving(`remove::${email}::${tab_key}`);
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
      await fetchData();
      flash('Role created');
    } catch (err) { flash(err.message, true); }
  };

  const deleteRole = async (role_key) => {
    try {
      await apiPost({ action: 'delete_role', role_key });
      setShowDeleteConfirm(null);
      if (selectedRole === role_key) setSelectedRole(roles[0]?.role_key);
      await fetchData();
      flash('Role deleted');
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

  if (loading) return <div style={{padding:40,textAlign:"center",fontSize:12,color:"var(--fg2)"}}>Loading access control...</div>;
  if (error) return <div style={{padding:40,textAlign:"center",fontSize:12,color:"#EF4444",fontWeight:600}}>{error}</div>;

  const activeRoleObj = roles.find(r => r.role_key === selectedRole);
  const roleUserCount = users.filter(u => u.platform_role === selectedRole).length;

  const cellBtn = (on, overridden, isSaving) => ({
    width: 22, height: 22, borderRadius: 6, cursor: "pointer",
    border: overridden ? "2px solid #F59E0B" : on ? "none" : "1.5px solid var(--border)",
    background: on ? "#10B981" : "var(--bg2)",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    transition: "all .15s", opacity: isSaving ? .4 : 1, padding: 0,
  });
  const checkSvg = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>;
  const xSvg = <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

  return (
    <div style={{fontSize:12,color:"var(--fg)"}}>
      {toast && <div style={{position:"fixed",bottom:24,right:24,zIndex:2100,padding:"10px 18px",borderRadius:10,color:"#fff",fontSize:12,fontWeight:600,background:toast.isError?"#EF4444":"#10B981",boxShadow:"0 8px 30px rgba(0,0,0,.25)"}}>{toast.msg}</div>}

      {/* Section navigation */}
      <div style={{display:"flex",gap:4,background:"var(--bg3)",borderRadius:10,padding:3,width:"fit-content",marginBottom:18}}>
        {[{k:'matrix',l:'Roles & Permissions'},{k:'users',l:'Team Assignment'},{k:'overrides',l:'Individual Exceptions'}].map(s=>
          <button key={s.k} onClick={()=>setSection(s.k)} style={{padding:"7px 16px",borderRadius:8,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",transition:"all .2s",background:section===s.k?"var(--fg)":"transparent",color:section===s.k?"var(--bg)":"var(--fg2)"}}>{s.l}</button>
        )}
      </div>

      {/* ─── ROLES & PERMISSIONS ─────────────────────────────────────── */}
      {section==='matrix'&&<div>
        {/* Role selector */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {roles.map(r=>{
              const active=selectedRole===r.role_key;
              return <button key={r.role_key} onClick={()=>setSelectedRole(r.role_key)} style={{padding:"6px 14px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",border:active?"2px solid #3B82F6":"1px solid var(--border)",background:active?"rgba(59,130,246,.08)":"var(--card)",color:active?"#3B82F6":"var(--fg2)",transition:"all .15s",display:"flex",alignItems:"center",gap:6}}>
                {r.display_name}
                {r.is_system&&<span style={{fontSize:8,fontWeight:700,padding:"1px 5px",borderRadius:4,background:active?"rgba(59,130,246,.15)":"var(--bg3)",color:active?"#3B82F6":"var(--fg2)",letterSpacing:.5}}>SYSTEM</span>}
              </button>;
            })}
          </div>
          <button onClick={()=>setShowCreateRole(true)} className="btn-pop" style={{padding:"6px 14px",borderRadius:8,border:"1px dashed var(--border)",background:"transparent",color:"var(--fg2)",fontSize:11,fontWeight:600,cursor:"pointer"}}>+ New Role</button>
        </div>

        {/* Role info card */}
        {activeRoleObj&&<div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:10,background:"var(--bg2)",border:"1px solid var(--border)",marginBottom:14,flexWrap:"wrap"}}>
          <span style={{fontSize:11,color:"var(--fg2)",flex:1,minWidth:200}}>{activeRoleObj.description||"No description"}</span>
          <span style={{fontSize:10,color:"var(--fg2)",fontWeight:600}}>{roleUserCount} member{roleUserCount===1?"":"s"}</span>
          {!activeRoleObj.is_system&&<button onClick={()=>setShowDeleteConfirm(selectedRole)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid #FCA5A5",background:"transparent",color:"#EF4444",fontSize:10,fontWeight:600,cursor:"pointer"}}>Delete Role</button>}
        </div>}

        {/* Matrix table — full word headers */}
        <div style={{border:"1px solid var(--border)",borderRadius:12,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:"var(--bg2)"}}>
              <th style={{padding:"10px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:.5,borderBottom:"1px solid var(--border)"}}>Module</th>
              {PERM_FIELDS.map(f=><th key={f.key} title={f.hint} style={{padding:"10px 8px",textAlign:"center",fontSize:10,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:.5,borderBottom:"1px solid var(--border)",minWidth:64}}>{f.label}</th>)}
            </tr></thead>
            <tbody>
              {tabs.map((t,i)=>{
                const cellBase=`${selectedRole}::${t.tab_key}`;
                return <tr key={t.tab_key} className="rh" style={{background:i%2?"var(--bg2)":"transparent"}}>
                  <td style={{padding:"9px 14px",fontSize:12,fontWeight:600,color:"var(--fg)",borderBottom:"1px solid var(--border)"}}>{t.display_name}</td>
                  {PERM_FIELDS.map(f=>{
                    const val=matrix[cellBase]?.[f.key]||false;
                    const isSaving=saving===`${cellBase}::${f.key}`;
                    return <td key={f.key} style={{padding:"7px 8px",textAlign:"center",borderBottom:"1px solid var(--border)"}}>
                      <button onClick={()=>togglePerm(selectedRole,t.tab_key,f.key)} disabled={isSaving} title={`${f.label}: ${val?"Allowed":"Not allowed"}`} style={cellBtn(val,false,isSaving)}>{val?checkSvg:null}</button>
                    </td>;
                  })}
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <div style={{fontSize:10,color:"var(--fg2)",marginTop:10,display:"flex",gap:16,flexWrap:"wrap"}}>
          <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:14,height:14,borderRadius:4,background:"#10B981",display:"inline-flex",alignItems:"center",justifyContent:"center"}}><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></span> Allowed</span>
          <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:14,height:14,borderRadius:4,border:"1.5px solid var(--border)",background:"var(--bg2)",display:"inline-block"}}/> Not allowed — click to toggle</span>
        </div>
      </div>}

      {/* ─── TEAM ASSIGNMENT ─────────────────────────────────────────── */}
      {section==='users'&&<div>
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          {roles.map(r=><span key={r.role_key} style={{padding:"4px 12px",fontSize:10,fontWeight:600,borderRadius:99,background:"var(--bg2)",color:"var(--fg2)",border:"1px solid var(--border)"}}>{r.display_name} · {users.filter(u=>u.platform_role===r.role_key).length}</span>)}
        </div>
        <div style={{border:"1px solid var(--border)",borderRadius:12,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:"var(--bg2)"}}>
              {["Member","Department","Access Level"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:.5,borderBottom:"1px solid var(--border)"}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {users.map((u,i)=><tr key={u.email} className="rh" style={{background:i%2?"var(--bg2)":"transparent"}}>
                <td style={{padding:"9px 14px",borderBottom:"1px solid var(--border)"}}>
                  <div style={{fontSize:12,fontWeight:600,color:"var(--fg)"}}>{u.name}</div>
                  <div style={{fontSize:9,color:"var(--fg2)"}}>{u.email}</div>
                </td>
                <td style={{padding:"9px 14px",fontSize:11,color:"var(--fg2)",borderBottom:"1px solid var(--border)"}}>{u.dept||"—"}</td>
                <td style={{padding:"9px 14px",borderBottom:"1px solid var(--border)"}}>
                  <select value={u.platform_role||'employee'} onChange={e=>assignRole(u.email,e.target.value)} disabled={saving===`assign::${u.email}`} style={{padding:"6px 10px",fontSize:11,fontWeight:600,borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",cursor:"pointer",minWidth:140}}>
                    {roles.map(r=><option key={r.role_key} value={r.role_key}>{r.display_name}</option>)}
                  </select>
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </div>}

      {/* ─── INDIVIDUAL EXCEPTIONS ───────────────────────────────────── */}
      {section==='overrides'&&<div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6,flexWrap:"wrap"}}>
          <select value={selectedUser||''} onChange={e=>setSelectedUser(e.target.value)} style={{padding:"8px 12px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",minWidth:240}}>
            {users.map(u=><option key={u.email} value={u.email}>{u.name} — {roles.find(r=>r.role_key===u.platform_role)?.display_name||u.platform_role}</option>)}
          </select>
        </div>
        <div style={{fontSize:10,color:"var(--fg2)",marginBottom:14}}>Grant or block specific permissions for one person, on top of their role. Click a cell to cycle: role default → allow → block → role default. Orange outline = exception active.</div>

        {selectedUser&&(()=>{
          const base=getBase(selectedUser);
          return <div style={{border:"1px solid var(--border)",borderRadius:12,overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:"var(--bg2)"}}>
                <th style={{padding:"10px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:.5,borderBottom:"1px solid var(--border)"}}>Module</th>
                {PERM_FIELDS.map(f=><th key={f.key} style={{padding:"10px 8px",textAlign:"center",fontSize:10,fontWeight:700,color:"var(--fg2)",textTransform:"uppercase",letterSpacing:.5,borderBottom:"1px solid var(--border)",minWidth:64}}>{f.label}</th>)}
                <th style={{padding:"10px 8px",borderBottom:"1px solid var(--border)"}}/>
              </tr></thead>
              <tbody>
                {tabs.map((t,i)=>{
                  const ov=getOverride(selectedUser,t.tab_key);
                  const hasOv=ov&&PERM_FIELDS.some(f=>ov[f.key]!==null&&ov[f.key]!==undefined);
                  return <tr key={t.tab_key} className="rh" style={{background:i%2?"var(--bg2)":"transparent"}}>
                    <td style={{padding:"9px 14px",fontSize:12,fontWeight:600,color:"var(--fg)",borderBottom:"1px solid var(--border)"}}>{t.display_name}</td>
                    {PERM_FIELDS.map(f=>{
                      const ovVal=ov?.[f.key];
                      const isOv=ovVal!==null&&ovVal!==undefined;
                      const effective=isOv?ovVal:(base[t.tab_key]?.[f.key]||false);
                      const cs=saving===`override::${selectedUser}::${t.tab_key}::${f.key}`;
                      return <td key={f.key} style={{padding:"7px 8px",textAlign:"center",borderBottom:"1px solid var(--border)"}}>
                        <button onClick={()=>toggleOverride(selectedUser,t.tab_key,f.key)} disabled={cs} title={isOv?`Exception: ${ovVal?"Allowed":"Blocked"}`:`Role default: ${effective?"Allowed":"Not allowed"}`} style={cellBtn(effective,isOv,cs)}>{effective?checkSvg:isOv?xSvg:null}</button>
                      </td>;
                    })}
                    <td style={{padding:"7px 8px",textAlign:"center",borderBottom:"1px solid var(--border)"}}>
                      {hasOv&&<button onClick={()=>removeOverride(selectedUser,t.tab_key)} style={{padding:"3px 8px",fontSize:9,fontWeight:600,borderRadius:6,border:"1px solid var(--border)",background:"transparent",color:"var(--fg2)",cursor:"pointer"}}>Reset</button>}
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>;
        })()}
      </div>}

      {/* ─── CREATE ROLE MODAL ───────────────────────────────────────── */}
      {showCreateRole&&<div className="modal-overlay" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:2050,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowCreateRole(false)}>
        <div className="asc" onClick={e=>e.stopPropagation()} style={{background:"var(--card)",borderRadius:16,padding:24,width:"min(400px,92vw)",border:"1px solid var(--border)",boxShadow:"0 25px 60px rgba(0,0,0,.3)"}}>
          <div style={{fontSize:15,fontWeight:800,color:"var(--fg)",marginBottom:16}}>Create New Role</div>
          <label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Role Name</label>
          <input value={newRoleName} onChange={e=>{setNewRoleName(e.target.value);setNewRoleKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,''))}} placeholder="e.g. Team Lead" style={{width:"100%",padding:"8px 12px",border:"1px solid var(--border)",borderRadius:8,fontSize:12,background:"var(--bg2)",color:"var(--fg)",boxSizing:"border-box",marginBottom:12}}/>
          <label style={{fontSize:11,fontWeight:600,color:"var(--fg2)",display:"block",marginBottom:4}}>Description <span style={{fontWeight:400}}>(optional)</span></label>
          <input value={newRoleDesc} onChange={e=>setNewRoleDesc(e.target.value)} placeholder="What this role is for" style={{width:"100%",padding:"8px 12px",border:"1px solid var(--border)",borderRadius:8,fontSize:12,background:"var(--bg2)",color:"var(--fg)",boxSizing:"border-box",marginBottom:6}}/>
          <div style={{fontSize:9,color:"var(--fg2)",marginBottom:16}}>New roles start with no permissions — configure them in the matrix after creation.</div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button onClick={()=>setShowCreateRole(false)} style={{padding:"8px 16px",borderRadius:8,border:"1px solid var(--border)",background:"transparent",color:"var(--fg2)",fontSize:12,cursor:"pointer"}}>Cancel</button>
            <button onClick={createRole} disabled={!newRoleKey||!newRoleName} className="btn-pop" style={{padding:"8px 16px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",opacity:(!newRoleKey||!newRoleName)?.5:1}}>Create Role</button>
          </div>
        </div>
      </div>}

      {/* ─── DELETE ROLE CONFIRM ─────────────────────────────────────── */}
      {showDeleteConfirm&&<div className="modal-overlay" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:2050,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowDeleteConfirm(null)}>
        <div className="asc" onClick={e=>e.stopPropagation()} style={{background:"var(--card)",borderRadius:16,padding:24,width:"min(380px,92vw)",border:"1px solid var(--border)",boxShadow:"0 25px 60px rgba(0,0,0,.3)"}}>
          <div style={{fontSize:15,fontWeight:800,color:"var(--fg)",marginBottom:10}}>Delete Role</div>
          {(()=>{const cnt=users.filter(u=>u.platform_role===showDeleteConfirm).length;
            return <>
              <p style={{fontSize:12,color:"var(--fg2)",margin:"0 0 8px",lineHeight:1.5}}>Delete "{roles.find(r=>r.role_key===showDeleteConfirm)?.display_name}"? This cannot be undone.</p>
              {cnt>0&&<p style={{fontSize:11,color:"#EF4444",fontWeight:600,margin:"0 0 12px"}}>{cnt} member{cnt===1?" is":"s are"} still assigned to this role — reassign them in Team Assignment first.</p>}
              <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:12}}>
                <button onClick={()=>setShowDeleteConfirm(null)} style={{padding:"8px 16px",borderRadius:8,border:"1px solid var(--border)",background:"transparent",color:"var(--fg2)",fontSize:12,cursor:"pointer"}}>Cancel</button>
                <button onClick={()=>deleteRole(showDeleteConfirm)} disabled={cnt>0} style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#EF4444",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",opacity:cnt>0?.5:1}}>Delete</button>
              </div>
            </>;
          })()}
        </div>
      </div>}
    </div>
  );
}
