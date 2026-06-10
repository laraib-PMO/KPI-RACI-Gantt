'use client';
// ═══════════════════════════════════════════════════════════════════════════
// PermissionsMatrix — Settings tab RBAC management UI
// Renders inside the Settings tab of page.jsx
// Enterprise-grade: role matrix, user assignment, per-user overrides
//
// Usage in page.jsx:
//   import PermissionsMatrix from './components/PermissionsMatrix';
//   ...
//   {activeTab === 'Settings' && (
//     <PermissionsMatrix supabase={supabase} session={session} />
//   )}
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';

const PERM_FIELDS = [
  { key: 'can_view',    label: 'View',    short: 'V'  },
  { key: 'can_add',     label: 'Add',     short: 'A'  },
  { key: 'can_edit',    label: 'Edit',    short: 'E'  },
  { key: 'can_delete',  label: 'Delete',  short: 'D'  },
  { key: 'can_approve', label: 'Approve', short: 'Ap' },
];

export default function PermissionsMatrix({ supabase, session }) {
  // ─── State ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // string key of cell being saved
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const [roles, setRoles] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [matrix, setMatrix] = useState({}); // { `${role_key}::${tab_key}`: { can_view, ... } }
  const [overrides, setOverrides] = useState([]); // raw overrides array
  const [users, setUsers] = useState([]);

  const [activeSection, setActiveSection] = useState('matrix');
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  // Modals
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleKey, setNewRoleKey] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  const currentEmail = session?.user?.email;

  // ─── Toast helper ───────────────────────────────────────────────────
  const flash = useCallback((msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ─── Fetch all data ─────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = (await supabase.auth.getSession())?.data?.session?.access_token;
      const res = await fetch('/api/permissions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');

      if (!json.admin_data) {
        setError('Access denied: Super Admin required');
        return;
      }

      const { roles: r, tabs: t, matrix: m, overrides: o, users: u } = json.admin_data;
      setRoles(r);
      setTabs(t);
      setUsers(u);
      setOverrides(o);

      // Index matrix by role_key::tab_key
      const mx = {};
      m.forEach(row => { mx[`${row.role_key}::${row.tab_key}`] = row; });
      setMatrix(mx);

      if (!selectedRole && r.length) setSelectedRole(r[0].role_key);
      if (!selectedUser && u.length) setSelectedUser(u[0].email);
    } catch (err) {
      console.error('[PermissionsMatrix] fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedRole, selectedUser]);

  useEffect(() => { fetchData(); }, []);

  // ─── API mutation helper ────────────────────────────────────────────
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

  // ─── Toggle a role permission cell ──────────────────────────────────
  const togglePerm = async (role_key, tab_key, field) => {
    const cellKey = `${role_key}::${tab_key}`;
    const current = matrix[cellKey]?.[field] || false;
    const newVal = !current;

    // Optimistic update
    setSaving(`${cellKey}::${field}`);
    setMatrix(prev => ({
      ...prev,
      [cellKey]: { ...prev[cellKey], [field]: newVal }
    }));

    try {
      await apiPost({ action: 'toggle_permission', role_key, tab_key, field, value: newVal });
    } catch (err) {
      // Revert
      setMatrix(prev => ({
        ...prev,
        [cellKey]: { ...prev[cellKey], [field]: current }
      }));
      flash(err.message, true);
    } finally {
      setSaving(null);
    }
  };

  // ─── Assign role to user ────────────────────────────────────────────
  const assignRole = async (email, platform_role) => {
    setSaving(`assign::${email}`);
    const prevUsers = [...users];
    setUsers(u => u.map(x => x.email === email ? { ...x, platform_role } : x));

    try {
      await apiPost({ action: 'assign_role', user_email: email, platform_role });
      flash(`Role updated`);
    } catch (err) {
      setUsers(prevUsers);
      flash(err.message, true);
    } finally {
      setSaving(null);
    }
  };

  // ─── Toggle user override ──────────────────────────────────────────
  const toggleOverride = async (email, tab_key, field) => {
    const existing = overrides.find(o => o.user_email === email && o.tab_key === tab_key);
    const currentVal = existing?.[field]; // null, true, or false

    // Cycle: null → true → false → null
    let newVal;
    if (currentVal === null || currentVal === undefined) newVal = true;
    else if (currentVal === true) newVal = false;
    else newVal = null;

    setSaving(`override::${email}::${tab_key}::${field}`);

    try {
      await apiPost({
        action: 'set_override',
        user_email: email,
        tab_key,
        field,
        value: newVal,
        note: null
      });
      await fetchData(); // Refresh to get clean state
      flash('Override updated');
    } catch (err) {
      flash(err.message, true);
    } finally {
      setSaving(null);
    }
  };

  // ─── Remove all overrides for a user+tab ────────────────────────────
  const removeOverride = async (email, tab_key) => {
    setSaving(`remove::${email}::${tab_key}`);
    try {
      await apiPost({ action: 'remove_override', user_email: email, tab_key });
      setOverrides(prev => prev.filter(o => !(o.user_email === email && o.tab_key === tab_key)));
      flash('Override removed');
    } catch (err) {
      flash(err.message, true);
    } finally {
      setSaving(null);
    }
  };

  // ─── Create role ────────────────────────────────────────────────────
  const createRole = async () => {
    if (!newRoleKey || !newRoleName) return;
    try {
      await apiPost({ action: 'create_role', role_key: newRoleKey, display_name: newRoleName, description: newRoleDesc });
      setShowCreateRole(false);
      setNewRoleKey('');
      setNewRoleName('');
      setNewRoleDesc('');
      await fetchData();
      flash('Role created');
    } catch (err) {
      flash(err.message, true);
    }
  };

  // ─── Delete role ────────────────────────────────────────────────────
  const deleteRole = async (role_key) => {
    try {
      await apiPost({ action: 'delete_role', role_key });
      setShowDeleteConfirm(null);
      if (selectedRole === role_key) setSelectedRole(roles[0]?.role_key);
      await fetchData();
      flash('Role deleted');
    } catch (err) {
      flash(err.message, true);
    }
  };

  // ─── Get user's base role permissions for override comparison ───────
  const getUserBasePerms = (email) => {
    const user = users.find(u => u.email === email);
    if (!user) return {};
    const base = {};
    tabs.forEach(t => {
      const rp = matrix[`${user.platform_role}::${t.tab_key}`];
      base[t.tab_key] = rp || {};
    });
    return base;
  };

  const getOverride = (email, tab_key) =>
    overrides.find(o => o.user_email === email && o.tab_key === tab_key);

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  if (loading) return <div style={S.loadWrap}><div style={S.spinner} /><span style={S.loadText}>Loading permissions engine...</span></div>;
  if (error) return <div style={S.errorWrap}>{error}</div>;

  const activeRoleObj = roles.find(r => r.role_key === selectedRole);

  return (
    <div style={S.root}>
      {/* Toast */}
      {toast && (
        <div style={{ ...S.toast, background: toast.isError ? 'var(--danger, #dc3545)' : 'var(--success, #28a745)' }}>
          {toast.msg}
        </div>
      )}

      {/* Section tabs */}
      <div style={S.sectionTabs}>
        {[
          { key: 'matrix', label: 'Permission Matrix' },
          { key: 'users', label: 'Team Roles' },
          { key: 'overrides', label: 'User Overrides' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            style={{
              ...S.sectionTab,
              ...(activeSection === s.key ? S.sectionTabActive : {})
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ─── PERMISSION MATRIX ─────────────────────────────────────── */}
      {activeSection === 'matrix' && (
        <div style={S.section}>
          {/* Role selector */}
          <div style={S.roleBar}>
            <div style={S.rolePills}>
              {roles.map(r => (
                <button
                  key={r.role_key}
                  onClick={() => setSelectedRole(r.role_key)}
                  style={{
                    ...S.rolePill,
                    ...(selectedRole === r.role_key ? S.rolePillActive : {})
                  }}
                >
                  {r.display_name}
                  {r.is_system && <span style={S.systemBadge}>System</span>}
                </button>
              ))}
            </div>
            <button onClick={() => setShowCreateRole(true)} style={S.addBtn}>+ New Role</button>
          </div>

          {/* Role description + actions */}
          {activeRoleObj && (
            <div style={S.roleInfo}>
              <span style={S.roleDesc}>{activeRoleObj.description || 'No description'}</span>
              <span style={S.roleUserCount}>
                {users.filter(u => u.platform_role === selectedRole).length} user(s) assigned
              </span>
              {!activeRoleObj.is_system && (
                <button
                  onClick={() => setShowDeleteConfirm(selectedRole)}
                  style={S.deleteBtn}
                >
                  Delete Role
                </button>
              )}
            </div>
          )}

          {/* The matrix grid */}
          <div style={S.matrixWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={{ ...S.th, ...S.thTab }}>Tab</th>
                  {PERM_FIELDS.map(f => (
                    <th key={f.key} style={S.th} title={f.label}>{f.short}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabs.map((t, i) => {
                  const cellBase = `${selectedRole}::${t.tab_key}`;
                  return (
                    <tr key={t.tab_key} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                      <td style={S.tdTab}>{t.display_name}</td>
                      {PERM_FIELDS.map(f => {
                        const val = matrix[cellBase]?.[f.key] || false;
                        const isSaving = saving === `${cellBase}::${f.key}`;
                        return (
                          <td key={f.key} style={S.tdCell}>
                            <button
                              onClick={() => togglePerm(selectedRole, t.tab_key, f.key)}
                              disabled={isSaving}
                              style={{
                                ...S.toggle,
                                ...(val ? S.toggleOn : S.toggleOff),
                                ...(isSaving ? S.toggleSaving : {})
                              }}
                              title={`${f.label}: ${val ? 'Granted' : 'Denied'}`}
                            >
                              {val ? '\u2713' : ''}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TEAM ROLES ────────────────────────────────────────────── */}
      {activeSection === 'users' && (
        <div style={S.section}>
          <div style={S.roleDistribution}>
            {roles.map(r => (
              <span key={r.role_key} style={S.distChip}>
                {r.display_name}: {users.filter(u => u.platform_role === r.role_key).length}
              </span>
            ))}
          </div>

          <div style={S.matrixWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={{ ...S.th, textAlign: 'left' }}>Name</th>
                  <th style={{ ...S.th, textAlign: 'left' }}>Email</th>
                  <th style={{ ...S.th, textAlign: 'left' }}>Dept</th>
                  <th style={{ ...S.th, textAlign: 'left' }}>Type</th>
                  <th style={{ ...S.th, textAlign: 'left', minWidth: 150 }}>Platform Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.email} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                    <td style={S.tdUser}>{u.name}</td>
                    <td style={S.tdEmail}>{u.email}</td>
                    <td style={S.tdDept}>{u.dept}</td>
                    <td style={S.tdType}>{u.employment_type === 'intern' ? 'Intern' : u.employment_type === 'full_time' ? 'Full-time' : u.employment_type || '-'}</td>
                    <td style={S.tdRole}>
                      <select
                        value={u.platform_role || 'employee'}
                        onChange={(e) => assignRole(u.email, e.target.value)}
                        disabled={saving === `assign::${u.email}`}
                        style={S.roleSelect}
                      >
                        {roles.map(r => (
                          <option key={r.role_key} value={r.role_key}>{r.display_name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── USER OVERRIDES ────────────────────────────────────────── */}
      {activeSection === 'overrides' && (
        <div style={S.section}>
          <div style={S.overrideHeader}>
            <select
              value={selectedUser || ''}
              onChange={e => setSelectedUser(e.target.value)}
              style={S.userSelect}
            >
              {users.map(u => (
                <option key={u.email} value={u.email}>{u.name} ({u.platform_role})</option>
              ))}
            </select>
            <span style={S.overrideHint}>
              Click a cell to cycle: inherit → grant → deny → inherit. Orange cells = active override.
            </span>
          </div>

          {selectedUser && (() => {
            const basePerms = getUserBasePerms(selectedUser);
            return (
              <div style={S.matrixWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={{ ...S.th, ...S.thTab }}>Tab</th>
                      {PERM_FIELDS.map(f => (
                        <th key={f.key} style={S.th} title={f.label}>{f.short}</th>
                      ))}
                      <th style={S.th}>Override</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabs.map((t, i) => {
                      const ov = getOverride(selectedUser, t.tab_key);
                      const base = basePerms[t.tab_key] || {};
                      const hasAnyOverride = ov && PERM_FIELDS.some(f => ov[f.key] !== null && ov[f.key] !== undefined);

                      return (
                        <tr key={t.tab_key} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                          <td style={S.tdTab}>{t.display_name}</td>
                          {PERM_FIELDS.map(f => {
                            const ovVal = ov?.[f.key];
                            const baseVal = base[f.key] || false;
                            const isOverridden = ovVal !== null && ovVal !== undefined;
                            const effectiveVal = isOverridden ? ovVal : baseVal;
                            const cellSaving = saving === `override::${selectedUser}::${t.tab_key}::${f.key}`;

                            return (
                              <td key={f.key} style={S.tdCell}>
                                <button
                                  onClick={() => toggleOverride(selectedUser, t.tab_key, f.key)}
                                  disabled={cellSaving}
                                  style={{
                                    ...S.toggle,
                                    ...(effectiveVal ? S.toggleOn : S.toggleOff),
                                    ...(isOverridden ? S.toggleOverridden : {}),
                                    ...(cellSaving ? S.toggleSaving : {})
                                  }}
                                  title={
                                    isOverridden
                                      ? `Override: ${ovVal ? 'Granted' : 'Denied'} (base: ${baseVal ? 'Granted' : 'Denied'})`
                                      : `Inherited from role: ${baseVal ? 'Granted' : 'Denied'}`
                                  }
                                >
                                  {effectiveVal ? '\u2713' : isOverridden ? '\u2717' : ''}
                                </button>
                              </td>
                            );
                          })}
                          <td style={S.tdCell}>
                            {hasAnyOverride && (
                              <button
                                onClick={() => removeOverride(selectedUser, t.tab_key)}
                                style={S.clearBtn}
                                title="Remove all overrides for this tab"
                              >
                                Clear
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {/* Override metadata */}
                {overrides.filter(o => o.user_email === selectedUser).length > 0 && (
                  <div style={S.overrideMeta}>
                    <strong style={{ fontSize: 13 }}>Active overrides:</strong>
                    {overrides.filter(o => o.user_email === selectedUser).map(o => (
                      <div key={o.id} style={S.overrideRow}>
                        <span style={S.overrideTab}>{tabs.find(t => t.tab_key === o.tab_key)?.display_name || o.tab_key}</span>
                        <span style={S.overrideFields}>
                          {PERM_FIELDS.filter(f => o[f.key] !== null && o[f.key] !== undefined)
                            .map(f => `${f.label}: ${o[f.key] ? 'Grant' : 'Deny'}`)
                            .join(', ')}
                        </span>
                        {o.granted_by && <span style={S.overrideGranted}>by {o.granted_by}</span>}
                        {o.note && <span style={S.overrideNote}>{o.note}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ─── CREATE ROLE MODAL ─────────────────────────────────────── */}
      {showCreateRole && (
        <div style={S.modalOverlay} onClick={() => setShowCreateRole(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <h3 style={S.modalTitle}>Create New Role</h3>
            <div style={S.formGroup}>
              <label style={S.formLabel}>Display Name</label>
              <input
                style={S.formInput}
                value={newRoleName}
                onChange={e => {
                  setNewRoleName(e.target.value);
                  setNewRoleKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''));
                }}
                placeholder="e.g. Team Lead"
              />
            </div>
            <div style={S.formGroup}>
              <label style={S.formLabel}>System Key</label>
              <input
                style={{ ...S.formInput, fontFamily: 'monospace', fontSize: 13 }}
                value={newRoleKey}
                onChange={e => setNewRoleKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="e.g. team_lead"
              />
              <span style={S.formHint}>Lowercase, letters/numbers/underscores only</span>
            </div>
            <div style={S.formGroup}>
              <label style={S.formLabel}>Description (optional)</label>
              <input
                style={S.formInput}
                value={newRoleDesc}
                onChange={e => setNewRoleDesc(e.target.value)}
                placeholder="What this role is for"
              />
            </div>
            <div style={S.modalActions}>
              <button onClick={() => setShowCreateRole(false)} style={S.cancelBtn}>Cancel</button>
              <button
                onClick={createRole}
                disabled={!newRoleKey || !newRoleName}
                style={{
                  ...S.confirmBtn,
                  opacity: (!newRoleKey || !newRoleName) ? 0.5 : 1
                }}
              >
                Create Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRM MODAL ──────────────────────────────────── */}
      {showDeleteConfirm && (
        <div style={S.modalOverlay} onClick={() => setShowDeleteConfirm(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <h3 style={S.modalTitle}>Delete Role</h3>
            <p style={S.modalText}>
              Are you sure you want to delete "{roles.find(r => r.role_key === showDeleteConfirm)?.display_name}"?
              This cannot be undone. All permission rows for this role will be removed.
            </p>
            <p style={S.modalText}>
              Users currently assigned: {users.filter(u => u.platform_role === showDeleteConfirm).length}
              {users.filter(u => u.platform_role === showDeleteConfirm).length > 0 &&
                ' — reassign them first before deleting.'}
            </p>
            <div style={S.modalActions}>
              <button onClick={() => setShowDeleteConfirm(null)} style={S.cancelBtn}>Cancel</button>
              <button
                onClick={() => deleteRole(showDeleteConfirm)}
                disabled={users.filter(u => u.platform_role === showDeleteConfirm).length > 0}
                style={{
                  ...S.dangerBtn,
                  opacity: users.filter(u => u.platform_role === showDeleteConfirm).length > 0 ? 0.5 : 1
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// STYLES — inline, uses CSS custom properties from page.jsx theme
// ═══════════════════════════════════════════════════════════════════════════

const S = {
  root: {
    width: '100%',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: 'var(--fg, #1a1a2e)',
  },

  // Loading
  loadWrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
    padding: 60, color: 'var(--fg, #888)',
  },
  spinner: {
    width: 20, height: 20, border: '2px solid var(--border, #ddd)',
    borderTopColor: 'var(--accent, #4f46e5)', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadText: { fontSize: 14, opacity: 0.7 },
  errorWrap: {
    padding: 40, textAlign: 'center', color: 'var(--danger, #dc3545)',
    fontSize: 14, fontWeight: 500,
  },

  // Toast
  toast: {
    position: 'fixed', top: 20, right: 20, zIndex: 9999,
    padding: '10px 20px', borderRadius: 6, color: '#fff',
    fontSize: 13, fontWeight: 500, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    animation: 'fadeIn 0.2s ease',
  },

  // Section tabs
  sectionTabs: {
    display: 'flex', gap: 2, marginBottom: 20,
    borderBottom: '1px solid var(--border, #e5e7eb)',
    paddingBottom: 0,
  },
  sectionTab: {
    padding: '10px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
    background: 'none', border: 'none', borderBottom: '2px solid transparent',
    color: 'var(--fg, #666)', transition: 'all 0.15s',
    marginBottom: -1,
  },
  sectionTabActive: {
    color: 'var(--accent, #4f46e5)',
    borderBottomColor: 'var(--accent, #4f46e5)',
    fontWeight: 600,
  },

  // Section container
  section: { },

  // Role bar
  roleBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12, flexWrap: 'wrap', gap: 8,
  },
  rolePills: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  rolePill: {
    padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
    background: 'var(--card, #f9fafb)', border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 6, color: 'var(--fg, #374151)', transition: 'all 0.15s',
    display: 'flex', alignItems: 'center', gap: 6,
  },
  rolePillActive: {
    background: 'var(--accent, #4f46e5)', color: '#fff',
    borderColor: 'var(--accent, #4f46e5)',
  },
  systemBadge: {
    fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
    padding: '1px 5px', borderRadius: 3,
    background: 'rgba(255,255,255,0.2)', opacity: 0.8,
  },
  addBtn: {
    padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
    background: 'none', border: '1px dashed var(--border, #d1d5db)',
    borderRadius: 6, color: 'var(--fg, #6b7280)', transition: 'all 0.15s',
  },

  // Role info
  roleInfo: {
    display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16,
    padding: '8px 12px', borderRadius: 6, fontSize: 12,
    background: 'var(--card, #f9fafb)', border: '1px solid var(--border, #e5e7eb)',
    flexWrap: 'wrap',
  },
  roleDesc: { color: 'var(--fg, #6b7280)', flex: 1 },
  roleUserCount: { color: 'var(--fg, #9ca3af)', fontSize: 11, fontWeight: 500 },
  deleteBtn: {
    padding: '4px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
    background: 'none', border: '1px solid var(--danger, #fca5a5)',
    borderRadius: 4, color: 'var(--danger, #dc3545)', transition: 'all 0.15s',
  },

  // Table
  matrixWrap: { overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border, #e5e7eb)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    padding: '10px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.05em', color: 'var(--fg, #6b7280)',
    borderBottom: '2px solid var(--border, #e5e7eb)',
    textAlign: 'center', whiteSpace: 'nowrap',
    background: 'var(--card, #f9fafb)',
  },
  thTab: { textAlign: 'left', minWidth: 130 },
  rowEven: { background: 'transparent' },
  rowOdd: { background: 'var(--card, rgba(0,0,0,0.02))' },
  tdTab: {
    padding: '8px 12px', fontWeight: 500, color: 'var(--fg, #374151)',
    borderBottom: '1px solid var(--border, #f3f4f6)',
  },
  tdCell: {
    padding: '6px 8px', textAlign: 'center',
    borderBottom: '1px solid var(--border, #f3f4f6)',
  },

  // Toggle button
  toggle: {
    width: 28, height: 28, borderRadius: 4, cursor: 'pointer',
    border: '1.5px solid var(--border, #d1d5db)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 700, transition: 'all 0.12s',
    lineHeight: 1,
  },
  toggleOn: {
    background: '#059669', borderColor: '#059669', color: '#fff',
  },
  toggleOff: {
    background: 'transparent', borderColor: 'var(--border, #d1d5db)', color: 'transparent',
  },
  toggleOverridden: {
    boxShadow: '0 0 0 2px #f59e0b',
    borderColor: '#f59e0b',
  },
  toggleSaving: { opacity: 0.5, cursor: 'wait' },

  // Users table
  tdUser: {
    padding: '10px 12px', fontWeight: 500, color: 'var(--fg, #374151)',
    borderBottom: '1px solid var(--border, #f3f4f6)',
  },
  tdEmail: {
    padding: '10px 12px', fontSize: 12, color: 'var(--fg, #6b7280)',
    fontFamily: 'monospace', borderBottom: '1px solid var(--border, #f3f4f6)',
  },
  tdDept: {
    padding: '10px 12px', fontSize: 12, color: 'var(--fg, #6b7280)',
    borderBottom: '1px solid var(--border, #f3f4f6)',
  },
  tdType: {
    padding: '10px 12px', fontSize: 12, color: 'var(--fg, #9ca3af)',
    borderBottom: '1px solid var(--border, #f3f4f6)',
  },
  tdRole: {
    padding: '8px 12px', borderBottom: '1px solid var(--border, #f3f4f6)',
  },
  roleSelect: {
    padding: '6px 10px', fontSize: 12, borderRadius: 4, width: '100%',
    border: '1px solid var(--border, #d1d5db)',
    background: 'var(--card, #fff)', color: 'var(--fg, #374151)',
    cursor: 'pointer',
  },

  // Role distribution
  roleDistribution: {
    display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap',
  },
  distChip: {
    padding: '4px 12px', fontSize: 12, fontWeight: 500, borderRadius: 12,
    background: 'var(--card, #f3f4f6)', color: 'var(--fg, #6b7280)',
    border: '1px solid var(--border, #e5e7eb)',
  },

  // Override section
  overrideHeader: {
    display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap',
  },
  userSelect: {
    padding: '8px 12px', fontSize: 13, borderRadius: 6, minWidth: 250,
    border: '1px solid var(--border, #d1d5db)',
    background: 'var(--card, #fff)', color: 'var(--fg, #374151)',
  },
  overrideHint: { fontSize: 11, color: 'var(--fg, #9ca3af)', fontStyle: 'italic' },
  clearBtn: {
    padding: '3px 8px', fontSize: 10, fontWeight: 600, cursor: 'pointer',
    background: 'none', border: '1px solid var(--border, #d1d5db)',
    borderRadius: 3, color: 'var(--fg, #9ca3af)', transition: 'all 0.15s',
  },
  overrideMeta: {
    padding: '12px 16px', borderTop: '1px solid var(--border, #e5e7eb)',
    display: 'flex', flexDirection: 'column', gap: 6,
    background: 'var(--card, #fffbeb)',
  },
  overrideRow: {
    display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, flexWrap: 'wrap',
  },
  overrideTab: { fontWeight: 600, minWidth: 90 },
  overrideFields: { color: 'var(--fg, #6b7280)' },
  overrideGranted: { color: 'var(--fg, #9ca3af)', fontSize: 11 },
  overrideNote: { color: '#b45309', fontSize: 11, fontStyle: 'italic' },

  // Modals
  modalOverlay: {
    position: 'fixed', inset: 0, zIndex: 9998,
    background: 'rgba(0,0,0,0.5)', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: 'var(--bg, #fff)', borderRadius: 12,
    padding: 28, width: 420, maxWidth: '90vw',
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
  },
  modalTitle: {
    margin: '0 0 20px 0', fontSize: 16, fontWeight: 600,
    color: 'var(--fg, #1a1a2e)',
  },
  modalText: {
    margin: '0 0 12px 0', fontSize: 13, lineHeight: 1.5,
    color: 'var(--fg, #6b7280)',
  },
  modalActions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 },

  // Form
  formGroup: { marginBottom: 16 },
  formLabel: {
    display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4,
    color: 'var(--fg, #374151)',
  },
  formInput: {
    width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6,
    border: '1px solid var(--border, #d1d5db)',
    background: 'var(--card, #fff)', color: 'var(--fg, #374151)',
    boxSizing: 'border-box',
  },
  formHint: { display: 'block', fontSize: 11, color: 'var(--fg, #9ca3af)', marginTop: 3 },

  // Buttons
  cancelBtn: {
    padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
    background: 'var(--card, #f9fafb)', border: '1px solid var(--border, #d1d5db)',
    borderRadius: 6, color: 'var(--fg, #6b7280)',
  },
  confirmBtn: {
    padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    background: 'var(--accent, #4f46e5)', border: 'none',
    borderRadius: 6, color: '#fff',
  },
  dangerBtn: {
    padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    background: 'var(--danger, #dc3545)', border: 'none',
    borderRadius: 6, color: '#fff',
  },
};
