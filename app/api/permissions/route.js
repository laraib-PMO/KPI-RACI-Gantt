// ═══════════════════════════════════════════════════════════════════════════
// /api/permissions — RBAC Permissions Engine API
// Enterprise-grade: auth-verified, server-side role checks, lockout prevention
//
// GET  — Returns effective permissions for authenticated user
//         Super Admin also gets full matrix data
// POST — Mutations (super_admin only):
//         toggle_permission, set_override, remove_override,
//         assign_role, create_role, update_role, delete_role
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const VALID_FIELDS = ['can_view', 'can_add', 'can_edit', 'can_delete', 'can_approve'];
const ROLE_KEY_REGEX = /^[a-z][a-z0-9_]{1,48}$/;

// ─── Auth helper: verify JWT + resolve user ─────────────────────────────
async function verifyAuth(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();

  // Also check cookie (Supabase stores session in sb-*-auth-token)
  if (!token) {
    return { error: 'Missing authorization token', status: 401 };
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { error: 'Invalid or expired token', status: 401 };
  }

  const { data: userRole, error: roleErr } = await supabase
    .from('user_roles')
    .select('email, name, platform_role, role')
    .eq('email', user.email)
    .single();

  if (roleErr || !userRole) {
    return { error: 'User not found in user_roles', status: 403 };
  }

  return { user: { ...user, ...userRole } };
}

// ─── Validate tab_key exists ────────────────────────────────────────────
async function validateTabKey(tab_key) {
  const { data } = await supabase
    .from('platform_tabs')
    .select('tab_key')
    .eq('tab_key', tab_key)
    .single();
  return !!data;
}

// ─── Validate role_key exists ───────────────────────────────────────────
async function validateRoleKey(role_key) {
  const { data } = await supabase
    .from('platform_roles')
    .select('role_key')
    .eq('role_key', role_key)
    .single();
  return !!data;
}

// ─── Count super admins ─────────────────────────────────────────────────
async function countSuperAdmins() {
  const { count } = await supabase
    .from('user_roles')
    .select('*', { count: 'exact', head: true })
    .eq('platform_role', 'super_admin');
  return count || 0;
}


// ═══════════════════════════════════════════════════════════════════════════
// GET — Read permissions
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req) {
  try {
    const auth = await verifyAuth(req);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const { user } = auth;

    // Effective permissions for the current user (everyone gets this)
    const { data: effective, error: effErr } = await supabase
      .rpc('get_effective_permissions', { p_email: user.email });

    if (effErr) {
      console.error('[permissions] get_effective_permissions error:', effErr);
      return Response.json({ error: 'Failed to load permissions' }, { status: 500 });
    }

    const result = {
      user_email: user.email,
      platform_role: user.platform_role,
      effective_permissions: effective
    };

    // Super Admin gets the full matrix for the Settings UI
    if (user.platform_role === 'super_admin') {
      const [rolesRes, tabsRes, matrixRes, overridesRes, usersRes] = await Promise.all([
        supabase.from('platform_roles').select('*').order('sort_order'),
        supabase.from('platform_tabs').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('role_permissions').select('*'),
        supabase.from('user_permission_overrides').select('*'),
        supabase.from('user_roles').select('email, name, dept, platform_role, role, employment_type, avatar_url').order('name')
      ]);

      result.admin_data = {
        roles: rolesRes.data || [],
        tabs: tabsRes.data || [],
        matrix: matrixRes.data || [],
        overrides: overridesRes.data || [],
        users: usersRes.data || []
      };
    }

    return Response.json(result);
  } catch (err) {
    console.error('[permissions] GET error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// POST — Mutations (super_admin only)
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req) {
  try {
    const auth = await verifyAuth(req);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const { user } = auth;

    // Server-side super_admin gate — non-negotiable
    if (user.platform_role !== 'super_admin') {
      return Response.json(
        { error: 'Forbidden: only Super Admin can modify permissions' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action } = body;

    if (!action) {
      return Response.json({ error: 'Missing action' }, { status: 400 });
    }

    switch (action) {
      case 'toggle_permission':
        return await handleTogglePermission(body, user);
      case 'set_override':
        return await handleSetOverride(body, user);
      case 'remove_override':
        return await handleRemoveOverride(body);
      case 'assign_role':
        return await handleAssignRole(body, user);
      case 'create_role':
        return await handleCreateRole(body);
      case 'update_role':
        return await handleUpdateRole(body);
      case 'delete_role':
        return await handleDeleteRole(body);
      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error('[permissions] POST error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}


// ─── Action handlers ────────────────────────────────────────────────────

async function handleTogglePermission({ role_key, tab_key, field, value }) {
  // Validate inputs
  if (!role_key || !tab_key || !field) {
    return Response.json({ error: 'Missing role_key, tab_key, or field' }, { status: 400 });
  }
  if (!VALID_FIELDS.includes(field)) {
    return Response.json({ error: `Invalid field: ${field}. Must be one of: ${VALID_FIELDS.join(', ')}` }, { status: 400 });
  }
  if (typeof value !== 'boolean') {
    return Response.json({ error: 'Value must be a boolean' }, { status: 400 });
  }
  if (!(await validateRoleKey(role_key))) {
    return Response.json({ error: `Role not found: ${role_key}` }, { status: 404 });
  }
  if (!(await validateTabKey(tab_key))) {
    return Response.json({ error: `Tab not found: ${tab_key}` }, { status: 404 });
  }

  // Prevent removing super_admin's own settings access (lockout guard)
  if (role_key === 'super_admin' && tab_key === 'settings' && field === 'can_view' && value === false) {
    return Response.json(
      { error: 'Cannot remove Super Admin access to Settings — lockout prevention' },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from('role_permissions')
    .update({ [field]: value })
    .eq('role_key', role_key)
    .eq('tab_key', tab_key)
    .select()
    .single();

  if (error) {
    // Row might not exist yet (new role + tab combo) — upsert
    const { data: upserted, error: upsertErr } = await supabase
      .from('role_permissions')
      .upsert({
        role_key, tab_key,
        can_view: false, can_add: false, can_edit: false, can_delete: false, can_approve: false,
        [field]: value
      }, { onConflict: 'role_key,tab_key' })
      .select()
      .single();

    if (upsertErr) {
      console.error('[permissions] toggle_permission upsert error:', upsertErr);
      return Response.json({ error: 'Failed to update permission' }, { status: 500 });
    }
    return Response.json({ ok: true, data: upserted });
  }

  return Response.json({ ok: true, data });
}


async function handleSetOverride({ user_email, tab_key, field, value, note }, grantor) {
  if (!user_email || !tab_key || !field) {
    return Response.json({ error: 'Missing user_email, tab_key, or field' }, { status: 400 });
  }
  if (!VALID_FIELDS.includes(field)) {
    return Response.json({ error: `Invalid field: ${field}` }, { status: 400 });
  }
  if (value !== null && typeof value !== 'boolean') {
    return Response.json({ error: 'Value must be boolean or null (null clears the override)' }, { status: 400 });
  }
  if (!(await validateTabKey(tab_key))) {
    return Response.json({ error: `Tab not found: ${tab_key}` }, { status: 404 });
  }

  // Check target user exists
  const { data: targetUser } = await supabase
    .from('user_roles')
    .select('email')
    .eq('email', user_email)
    .single();

  if (!targetUser) {
    return Response.json({ error: `User not found: ${user_email}` }, { status: 404 });
  }

  // Upsert the override row
  const { data: existing } = await supabase
    .from('user_permission_overrides')
    .select('*')
    .eq('user_email', user_email)
    .eq('tab_key', tab_key)
    .single();

  if (existing) {
    // Update existing override — set the specific field
    const updates = { [field]: value, granted_by: grantor.email, granted_at: new Date().toISOString() };
    if (note !== undefined) updates.note = note;

    const { data, error } = await supabase
      .from('user_permission_overrides')
      .update(updates)
      .eq('user_email', user_email)
      .eq('tab_key', tab_key)
      .select()
      .single();

    if (error) {
      console.error('[permissions] set_override update error:', error);
      return Response.json({ error: 'Failed to update override' }, { status: 500 });
    }

    // If all fields are null, delete the row (no override needed)
    if ([data.can_view, data.can_add, data.can_edit, data.can_delete, data.can_approve].every(v => v === null)) {
      await supabase.from('user_permission_overrides').delete().eq('id', data.id);
      return Response.json({ ok: true, action: 'removed_empty_override' });
    }

    return Response.json({ ok: true, data });
  } else {
    // Insert new override
    const row = {
      user_email, tab_key,
      can_view: null, can_add: null, can_edit: null, can_delete: null, can_approve: null,
      [field]: value,
      granted_by: grantor.email,
      note: note || null
    };

    const { data, error } = await supabase
      .from('user_permission_overrides')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('[permissions] set_override insert error:', error);
      return Response.json({ error: 'Failed to create override' }, { status: 500 });
    }
    return Response.json({ ok: true, data });
  }
}


async function handleRemoveOverride({ user_email, tab_key }) {
  if (!user_email || !tab_key) {
    return Response.json({ error: 'Missing user_email or tab_key' }, { status: 400 });
  }

  const { error } = await supabase
    .from('user_permission_overrides')
    .delete()
    .eq('user_email', user_email)
    .eq('tab_key', tab_key);

  if (error) {
    console.error('[permissions] remove_override error:', error);
    return Response.json({ error: 'Failed to remove override' }, { status: 500 });
  }

  return Response.json({ ok: true });
}


async function handleAssignRole({ user_email, platform_role }, grantor) {
  if (!user_email || !platform_role) {
    return Response.json({ error: 'Missing user_email or platform_role' }, { status: 400 });
  }

  // Validate role exists
  if (!(await validateRoleKey(platform_role))) {
    return Response.json({ error: `Role not found: ${platform_role}` }, { status: 404 });
  }

  // Check target user exists
  const { data: targetUser } = await supabase
    .from('user_roles')
    .select('email, platform_role')
    .eq('email', user_email)
    .single();

  if (!targetUser) {
    return Response.json({ error: `User not found: ${user_email}` }, { status: 404 });
  }

  // LOCKOUT PREVENTION: if demoting a super_admin, ensure at least 1 remains
  if (targetUser.platform_role === 'super_admin' && platform_role !== 'super_admin') {
    const count = await countSuperAdmins();
    if (count <= 1) {
      return Response.json(
        { error: 'Cannot demote the last Super Admin — at least one must exist' },
        { status: 409 }
      );
    }
  }

  const { data, error } = await supabase
    .from('user_roles')
    .update({ platform_role })
    .eq('email', user_email)
    .select('email, name, platform_role')
    .single();

  if (error) {
    console.error('[permissions] assign_role error:', error);
    return Response.json({ error: 'Failed to assign role' }, { status: 500 });
  }

  return Response.json({ ok: true, data });
}


async function handleCreateRole({ role_key, display_name, description }) {
  if (!role_key || !display_name) {
    return Response.json({ error: 'Missing role_key or display_name' }, { status: 400 });
  }
  if (!ROLE_KEY_REGEX.test(role_key)) {
    return Response.json(
      { error: 'role_key must be lowercase letters, numbers, underscores. 2-49 chars. Start with letter.' },
      { status: 400 }
    );
  }

  // Check for duplicate
  const exists = await validateRoleKey(role_key);
  if (exists) {
    return Response.json({ error: `Role already exists: ${role_key}` }, { status: 409 });
  }

  // Get max sort_order
  const { data: maxRow } = await supabase
    .from('platform_roles')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const nextSort = (maxRow?.sort_order || 0) + 1;

  // Insert role
  const { data: role, error: roleErr } = await supabase
    .from('platform_roles')
    .insert({
      role_key,
      display_name,
      description: description || null,
      is_system: false,
      sort_order: nextSort
    })
    .select()
    .single();

  if (roleErr) {
    console.error('[permissions] create_role error:', roleErr);
    return Response.json({ error: 'Failed to create role' }, { status: 500 });
  }

  // Seed permission rows for all active tabs (all false by default)
  const { data: tabs } = await supabase
    .from('platform_tabs')
    .select('tab_key')
    .eq('is_active', true);

  if (tabs?.length) {
    const rows = tabs.map(t => ({
      role_key,
      tab_key: t.tab_key,
      can_view: false, can_add: false, can_edit: false, can_delete: false, can_approve: false
    }));

    const { error: seedErr } = await supabase
      .from('role_permissions')
      .insert(rows);

    if (seedErr) {
      console.error('[permissions] seed new role permissions error:', seedErr);
    }
  }

  return Response.json({ ok: true, data: role });
}


async function handleUpdateRole({ role_key, display_name, description }) {
  if (!role_key) {
    return Response.json({ error: 'Missing role_key' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('platform_roles')
    .select('*')
    .eq('role_key', role_key)
    .single();

  if (!existing) {
    return Response.json({ error: `Role not found: ${role_key}` }, { status: 404 });
  }

  // System roles: allow display_name/description change but not key change
  const updates = {};
  if (display_name !== undefined) updates.display_name = display_name;
  if (description !== undefined) updates.description = description;

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('platform_roles')
    .update(updates)
    .eq('role_key', role_key)
    .select()
    .single();

  if (error) {
    console.error('[permissions] update_role error:', error);
    return Response.json({ error: 'Failed to update role' }, { status: 500 });
  }

  return Response.json({ ok: true, data });
}


async function handleDeleteRole({ role_key }) {
  if (!role_key) {
    return Response.json({ error: 'Missing role_key' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('platform_roles')
    .select('*')
    .eq('role_key', role_key)
    .single();

  if (!existing) {
    return Response.json({ error: `Role not found: ${role_key}` }, { status: 404 });
  }

  // Cannot delete system roles
  if (existing.is_system) {
    return Response.json(
      { error: `Cannot delete system role: ${existing.display_name}` },
      { status: 409 }
    );
  }

  // Check no users are assigned to this role
  const { count } = await supabase
    .from('user_roles')
    .select('*', { count: 'exact', head: true })
    .eq('platform_role', role_key);

  if (count > 0) {
    return Response.json(
      { error: `Cannot delete role "${existing.display_name}" — ${count} user(s) still assigned. Reassign them first.` },
      { status: 409 }
    );
  }

  // Delete (cascade removes role_permissions rows)
  const { error } = await supabase
    .from('platform_roles')
    .delete()
    .eq('role_key', role_key);

  if (error) {
    console.error('[permissions] delete_role error:', error);
    return Response.json({ error: 'Failed to delete role' }, { status: 500 });
  }

  return Response.json({ ok: true });
}
