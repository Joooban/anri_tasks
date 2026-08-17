-- Admin roles & permissions. Client feedback: "Add an Admin Access Level
-- account type... with self-defined user roles and configure what each role
-- can access and manage." See PROJECT_CONTEXT.md for the full design
-- rationale; summary here:
--
-- Additive, not destructive: every existing is_boss_or_supervisor() check
-- touched by this migration becomes has_permission('key'), which is always
-- "is_boss_or_supervisor() OR (custom admin role grants this key)" — so
-- nothing changes for any existing boss_boss/supervisor/department/employee
-- account. This only adds a new, optional capability layer that can be
-- granted to any account via a custom "admin role."
--
-- Scoped to admin/account management only (accounts, departments, task
-- types, the allowlist, document templates, announcement moderation, and
-- managing this permission system itself) — task-relay authorization
-- (can_view_task, complete/confirm/block/cancel step RPCs, etc.) is
-- deliberately untouched. That's not what was asked for, and every one of
-- those was already hardened against admin overrides earlier this project
-- per direct client correction (see 0017's self-resolve pattern).
--
-- "Self-defined roles" + "Permission Templates" are the same object here:
-- an admin_roles row is a named, reusable, editable bundle of permissions.
-- Creating one is defining a role; assigning it to someone is using the
-- template. The permission catalog itself (admin_role_permissions' check
-- constraint below) is fixed, not admin-inventable — each key corresponds
-- to real enforcement code, so an invented key would just do nothing.

create table admin_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  requires_approval boolean not null default false,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table admin_role_permissions (
  role_id uuid not null references admin_roles(id) on delete cascade,
  permission text not null check (permission in (
    'manage_accounts',
    'manage_departments',
    'manage_task_types',
    'manage_allowlist',
    'manage_document_templates',
    'moderate_announcements',
    'manage_roles',
    'approve_admin_requests'
  )),
  primary key (role_id, permission)
);

alter table profiles add column admin_role_id uuid references admin_roles(id) on delete set null;

-- A sensitive grant (requires_approval = true on the target role) lands
-- here instead of applying immediately — see assign_admin_role_rpc below.
create table admin_approval_requests (
  id uuid primary key default gen_random_uuid(),
  target_profile_id uuid not null references profiles(id),
  requested_admin_role_id uuid references admin_roles(id),
  requested_by uuid not null references profiles(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table admin_roles enable row level security;
alter table admin_role_permissions enable row level security;
alter table admin_approval_requests enable row level security;

-- ---------------------------------------------------------------------------
-- has_permission(): the one function every new/updated policy and RPC below
-- calls (including the SELECT policies right after it, which is why these
-- function definitions come before any policy that references them —
-- Postgres resolves a policy's function call at creation time). Callable
-- directly from the app via supabase.rpc() too.
-- ---------------------------------------------------------------------------
create or replace function has_permission(p_permission text) returns boolean
language sql stable security definer set search_path = public as $$
  select
    is_boss_or_supervisor()
    or exists (
      select 1
      from profiles p
      join admin_role_permissions arp on arp.role_id = p.admin_role_id
      where p.id = auth.uid() and arp.permission = p_permission
    );
$$;
grant execute on function has_permission(text) to authenticated;

-- Coarse "can this account see the Accounts / Company Overview area at all"
-- check — individual cards within those pages still gate on the specific
-- has_permission() key they need.
create or replace function is_any_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select
    is_boss_or_supervisor()
    or exists (
      select 1
      from profiles p
      join admin_role_permissions arp on arp.role_id = p.admin_role_id
      where p.id = auth.uid()
    );
$$;
grant execute on function is_any_admin() to authenticated;

-- Every permission key the caller currently holds, in one round trip —
-- the app calls this once per page load instead of has_permission() per key.
create or replace function get_my_permissions_rpc() returns text[]
language sql stable security definer set search_path = public as $$
  select case
    when is_boss_or_supervisor() then array[
      'manage_accounts', 'manage_departments', 'manage_task_types', 'manage_allowlist',
      'manage_document_templates', 'moderate_announcements', 'manage_roles', 'approve_admin_requests'
    ]
    else coalesce(
      (select array_agg(arp.permission) from profiles p
       join admin_role_permissions arp on arp.role_id = p.admin_role_id
       where p.id = auth.uid()),
      array[]::text[]
    )
  end;
$$;
grant execute on function get_my_permissions_rpc() to authenticated;

-- Read access is plain policies (role names/permissions/pending requests
-- aren't sensitive the way task content is, and the accounts UI needs to
-- list them directly) — all writes go through the RPCs below, matching the
-- established convention (RLS WITH CHECK policies involving a lookup have a
-- documented history of silently rejecting valid writes in this project).
create policy admin_roles_select on admin_roles for select
  to authenticated using (true);

create policy admin_role_permissions_select on admin_role_permissions for select
  to authenticated using (true);

create policy admin_approval_requests_select on admin_approval_requests for select
  to authenticated using (is_any_admin());

-- ---------------------------------------------------------------------------
-- Admin role CRUD — "self-defining roles" / "permission templates."
-- ---------------------------------------------------------------------------
create or replace function create_admin_role_rpc(
  p_name text,
  p_description text,
  p_permissions text[],
  p_requires_approval boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_role_id uuid;
  v_perm text;
  v_requires_approval boolean;
begin
  if not has_permission('manage_roles') then
    raise exception 'Not authorized to manage roles';
  end if;

  if trim(p_name) = '' then
    raise exception 'Role name is required';
  end if;

  -- A role that can manage roles/permissions or approve sensitive grants is
  -- as powerful as this system gets — always requires two-admin approval to
  -- grant, regardless of what the creator specified, rather than trusting
  -- every role author to remember to flag it themselves.
  v_requires_approval := p_requires_approval or 'manage_roles' = any(p_permissions) or 'approve_admin_requests' = any(p_permissions);

  insert into admin_roles (name, description, requires_approval, created_by)
  values (trim(p_name), nullif(trim(coalesce(p_description, '')), ''), v_requires_approval, auth.uid())
  returning id into v_role_id;

  foreach v_perm in array p_permissions loop
    insert into admin_role_permissions (role_id, permission) values (v_role_id, v_perm);
  end loop;

  insert into audit_log (actor_id, action, details)
  values (auth.uid(), 'admin_role_created', jsonb_build_object('role_id', v_role_id, 'name', p_name, 'permissions', p_permissions));

  return v_role_id;
end;
$$;
grant execute on function create_admin_role_rpc(text, text, text[], boolean) to authenticated;

create or replace function update_admin_role_rpc(
  p_role_id uuid,
  p_name text,
  p_description text,
  p_permissions text[],
  p_requires_approval boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_perm text;
  v_requires_approval boolean;
begin
  if not has_permission('manage_roles') then
    raise exception 'Not authorized to manage roles';
  end if;

  if trim(p_name) = '' then
    raise exception 'Role name is required';
  end if;

  -- Same forced-approval rule as create_admin_role_rpc.
  v_requires_approval := p_requires_approval or 'manage_roles' = any(p_permissions) or 'approve_admin_requests' = any(p_permissions);

  update admin_roles
    set name = trim(p_name),
        description = nullif(trim(coalesce(p_description, '')), ''),
        requires_approval = v_requires_approval,
        updated_at = now()
    where id = p_role_id;

  delete from admin_role_permissions where role_id = p_role_id;
  foreach v_perm in array p_permissions loop
    insert into admin_role_permissions (role_id, permission) values (p_role_id, v_perm);
  end loop;

  insert into audit_log (actor_id, action, details)
  values (auth.uid(), 'admin_role_updated', jsonb_build_object('role_id', p_role_id, 'name', p_name, 'permissions', p_permissions));
end;
$$;
grant execute on function update_admin_role_rpc(uuid, text, text, text[], boolean) to authenticated;

create or replace function delete_admin_role_rpc(p_role_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  if not has_permission('manage_roles') then
    raise exception 'Not authorized to manage roles';
  end if;

  if exists (select 1 from profiles where admin_role_id = p_role_id) then
    raise exception 'This role is still assigned to at least one account — reassign or remove them first';
  end if;

  select name into v_name from admin_roles where id = p_role_id;
  delete from admin_roles where id = p_role_id;

  insert into audit_log (actor_id, action, details)
  values (auth.uid(), 'admin_role_deleted', jsonb_build_object('role_id', p_role_id, 'name', v_name));
end;
$$;
grant execute on function delete_admin_role_rpc(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Account management — replaces the plain profiles UPDATE in
-- accounts/actions.ts (see profiles_admin_write drop below).
-- ---------------------------------------------------------------------------
create or replace function update_account_rpc(
  p_profile_id uuid,
  p_role text,
  p_department_id uuid,
  p_birthday_month smallint,
  p_birthday_day smallint
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_permission('manage_accounts') then
    raise exception 'Not authorized to manage accounts';
  end if;

  -- manage_accounts is meant to be one narrow permission among several —
  -- letting a non-boss_boss/supervisor Admin grant the plain `role` column
  -- itself (which bypasses has_permission() entirely via is_boss_or_supervisor())
  -- would let them casually hand out full, ungated access to everything in
  -- the app, far beyond what manage_accounts alone is supposed to mean. Only
  -- an existing boss_boss/supervisor can promote someone into that tier.
  if p_role in ('boss_boss', 'supervisor') and not is_boss_or_supervisor() then
    raise exception 'Only the President or a Supervisor can grant President/Supervisor-level access';
  end if;

  update profiles
    set role = p_role,
        department_id = p_department_id,
        birthday_month = p_birthday_month,
        birthday_day = p_birthday_day
    where id = p_profile_id;

  insert into audit_log (actor_id, action, details)
  values (auth.uid(), 'account_updated', jsonb_build_object(
    'target_profile_id', p_profile_id, 'role', p_role, 'department_id', p_department_id
  ));
end;
$$;
grant execute on function update_account_rpc(uuid, text, uuid, smallint, smallint) to authenticated;

-- Granting a sensitive admin role (requires_approval = true) creates a
-- pending request instead of applying immediately, unless the caller is
-- boss_boss/supervisor — the President's own grants always apply right
-- away (confirmed with the client: two-admin approval exists to check an
-- Admin granting access to another Admin, not to gate the President, who
-- has no one above them to seek approval from). Removing/downgrading (null)
-- is never sensitive, so it always applies immediately regardless of caller.
create or replace function assign_admin_role_rpc(p_profile_id uuid, p_admin_role_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_requires_approval boolean;
  v_request_id uuid;
begin
  if not has_permission('manage_accounts') then
    raise exception 'Not authorized to manage accounts';
  end if;

  if p_admin_role_id is null then
    update profiles set admin_role_id = null where id = p_profile_id;
    insert into audit_log (actor_id, action, details)
    values (auth.uid(), 'admin_role_removed', jsonb_build_object('target_profile_id', p_profile_id));
    return jsonb_build_object('status', 'applied');
  end if;

  select requires_approval into v_requires_approval from admin_roles where id = p_admin_role_id;
  if v_requires_approval is null then
    raise exception 'Role not found';
  end if;

  if v_requires_approval and not is_boss_or_supervisor() then
    insert into admin_approval_requests (target_profile_id, requested_admin_role_id, requested_by)
    values (p_profile_id, p_admin_role_id, auth.uid())
    returning id into v_request_id;

    insert into audit_log (actor_id, action, details)
    values (auth.uid(), 'admin_role_grant_requested', jsonb_build_object(
      'target_profile_id', p_profile_id, 'admin_role_id', p_admin_role_id, 'request_id', v_request_id
    ));

    return jsonb_build_object('status', 'pending', 'request_id', v_request_id);
  end if;

  update profiles set admin_role_id = p_admin_role_id where id = p_profile_id;
  insert into audit_log (actor_id, action, details)
  values (auth.uid(), 'admin_role_assigned', jsonb_build_object('target_profile_id', p_profile_id, 'admin_role_id', p_admin_role_id));

  return jsonb_build_object('status', 'applied');
end;
$$;
grant execute on function assign_admin_role_rpc(uuid, uuid) to authenticated;

create or replace function approve_admin_role_request_rpc(p_request_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_request admin_approval_requests%rowtype;
begin
  if not has_permission('approve_admin_requests') then
    raise exception 'Not authorized to approve admin requests';
  end if;

  select * into v_request from admin_approval_requests where id = p_request_id and status = 'pending';
  if not found then
    raise exception 'Request not found or already resolved';
  end if;

  if v_request.requested_by = auth.uid() then
    raise exception 'You cannot approve your own request — a second admin must review it';
  end if;

  update profiles set admin_role_id = v_request.requested_admin_role_id where id = v_request.target_profile_id;

  update admin_approval_requests
    set status = 'approved', resolved_by = auth.uid(), resolved_at = now()
    where id = p_request_id;

  insert into audit_log (actor_id, action, details)
  values (auth.uid(), 'admin_role_grant_approved', jsonb_build_object(
    'request_id', p_request_id, 'target_profile_id', v_request.target_profile_id, 'admin_role_id', v_request.requested_admin_role_id
  ));
end;
$$;
grant execute on function approve_admin_role_request_rpc(uuid) to authenticated;

create or replace function reject_admin_role_request_rpc(p_request_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_request admin_approval_requests%rowtype;
begin
  if not has_permission('approve_admin_requests') then
    raise exception 'Not authorized to approve admin requests';
  end if;

  select * into v_request from admin_approval_requests where id = p_request_id and status = 'pending';
  if not found then
    raise exception 'Request not found or already resolved';
  end if;

  if v_request.requested_by = auth.uid() then
    raise exception 'You cannot resolve your own request — a second admin must review it';
  end if;

  update admin_approval_requests
    set status = 'rejected', resolved_by = auth.uid(), resolved_at = now()
    where id = p_request_id;

  insert into audit_log (actor_id, action, details)
  values (auth.uid(), 'admin_role_grant_rejected', jsonb_build_object(
    'request_id', p_request_id, 'target_profile_id', v_request.target_profile_id,
    'admin_role_id', v_request.requested_admin_role_id, 'reason', p_reason
  ));
end;
$$;
grant execute on function reject_admin_role_request_rpc(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Extend existing admin-management policies/RPCs to also accept the new
-- permission system. has_permission() always includes is_boss_or_supervisor()
-- (see its definition above), so this changes nothing for any existing
-- account — it only adds a second way in for custom-role holders.
-- ---------------------------------------------------------------------------
drop policy if exists departments_write on departments;
create policy departments_write on departments for all
  to authenticated using (has_permission('manage_departments')) with check (has_permission('manage_departments'));

drop policy if exists task_types_write on task_types;
create policy task_types_write on task_types for all
  to authenticated using (has_permission('manage_task_types')) with check (has_permission('manage_task_types'));

create or replace function list_allowed_emails_rpc()
returns table (email text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not has_permission('manage_allowlist') then
    raise exception 'Not authorized';
  end if;
  return query select a.email, a.created_at from allowed_emails a order by a.created_at desc;
end;
$$;
grant execute on function list_allowed_emails_rpc() to authenticated;

create or replace function add_allowed_email_rpc(p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_permission('manage_allowlist') then
    raise exception 'Not authorized';
  end if;
  insert into allowed_emails (email, added_by) values (lower(trim(p_email)), auth.uid())
    on conflict (email) do nothing;
end;
$$;
grant execute on function add_allowed_email_rpc(text) to authenticated;

create or replace function remove_allowed_email_rpc(p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_permission('manage_allowlist') then
    raise exception 'Not authorized';
  end if;
  delete from allowed_emails where email = lower(trim(p_email));
end;
$$;
grant execute on function remove_allowed_email_rpc(text) to authenticated;

create or replace function delete_announcement_rpc(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    has_permission('moderate_announcements')
    or exists (select 1 from announcements where id = p_id and author_id = auth.uid())
  ) then
    raise exception 'Not authorized to delete this announcement';
  end if;

  delete from announcements where id = p_id;
end;
$$;
grant execute on function delete_announcement_rpc(uuid) to authenticated;

-- profiles_admin_write is superseded by update_account_rpc/assign_admin_role_rpc
-- above — same class of fix as 0019: a write policy left active after its
-- writes moved to an RPC stays fully callable directly via the client SDK
-- with no restriction on which columns get set, which defeats the point of
-- moving authorization into the RPC in the first place.
drop policy if exists profiles_admin_write on profiles;

-- audit_log_select's original "task_id is null or can_view_task(task_id)"
-- (0003_rls.sql) was written when nothing actually inserted a task_id-null
-- row, so the null branch was dead — every new RPC above inserts exactly
-- that shape for admin-activity logging, which would otherwise make all of
-- it readable by any authenticated user, not just admins. Tightened to
-- require is_any_admin() for the null case. audit_log_insert similarly
-- tightened to deny direct (non-RPC) task_id-null inserts entirely — every
-- legitimate one already goes through a SECURITY DEFINER RPC, which bypasses
-- RLS as the function owner and is unaffected by this.
drop policy if exists audit_log_select on audit_log;
create policy audit_log_select on audit_log for select
  to authenticated using (
    (task_id is null and is_any_admin())
    or (task_id is not null and can_view_task(task_id))
  );

drop policy if exists audit_log_insert on audit_log;
create policy audit_log_insert on audit_log for insert
  to authenticated with check (task_id is not null and can_view_task(task_id));
