-- Third security review (this session). Three findings fixed here; the
-- app-side halves live in src/lib/supabase/middleware.ts and
-- src/app/auth/callback/route.ts.
--
-- 1. HIGH — removed/non-allowlisted accounts kept full access.
--    The allowlist (0022) and deactivation (0028) were only ever checked in
--    the OAuth callback. Nothing after sign-in looked at either, so:
--    - remove_user_rpc took someone off the allowlist but their existing
--      session (refresh tokens don't expire by default) kept working —
--      a "removed" employee could keep reading tasks, messages, the staff
--      directory, etc. until they happened to sign out.
--    - anyone with any Google account could get a real session by running
--      the PKCE flow themselves and exchanging the code without ever hitting
--      /auth/callback (it's a plain Supabase Auth endpoint, callable with
--      the public anon key). handle_new_auth_user would then provision them
--      a profile, and every `using (true)` policy (profiles, departments,
--      announcements, ...) was open to them.
--    Fixed in three layers: refuse to create the auth user at all when the
--    email isn't allowlisted; revoke all sessions on removal; and a
--    RESTRICTIVE "active member" policy on every table, ANDed with the
--    existing permissive ones, so even a still-valid access token for an
--    inactive account reads nothing. The permission helpers every RPC
--    authorizes with also return false/null for inactive accounts.
--
-- 2. HIGH — update_account_rpc let a manage_accounts Admin demote the
--    President. Its guard only checked the role being *granted*, never the
--    target's current role (remove_user_rpc already had the right check).
--
-- 3. MEDIUM — update_admin_role_rpc let a manage_roles Admin add
--    permissions to a role that's already assigned (including their own),
--    which takes effect immediately for every holder and sidesteps the
--    two-admin approval that assign_admin_role_rpc enforces for grants.

-- ---------------------------------------------------------------------------
-- 1a. Single definition of "may use the app right now".
-- ---------------------------------------------------------------------------
create or replace function is_active_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from profiles p
    join allowed_emails a on a.email = lower(p.email)
    where p.id = auth.uid() and p.deactivated_at is null
  );
$$;
grant execute on function is_active_member() to authenticated;

-- ---------------------------------------------------------------------------
-- 1b. Don't provision accounts for non-allowlisted emails at all. Raising
-- here aborts the auth.users insert, so Supabase Auth refuses the sign-up
-- and no session is ever issued. Existing auth users (including removed
-- ones, who still have an auth.users row) are covered by 1c/1d instead.
-- ---------------------------------------------------------------------------
create or replace function handle_new_auth_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from allowed_emails where email = lower(new.email)) then
    raise exception 'Email % is not on the allowlist', new.email;
  end if;

  insert into profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1c. Restrictive policies: AND-ed with every existing permissive policy,
-- so nothing an inactive account's token can reach directly returns rows
-- or accepts writes. SECURITY DEFINER RPCs bypass these by design — 1d
-- covers them.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'departments', 'profiles', 'task_types', 'tasks', 'task_assignees',
    'task_visibility', 'task_attachments', 'audit_log', 'announcements',
    'calendar_events', 'task_comments', 'boss_dashboard_prefs',
    'document_templates', 'admin_roles', 'admin_role_permissions',
    'admin_approval_requests', 'conversations', 'conversation_participants',
    'messages', 'personal_files'
  ] loop
    execute format('drop policy if exists %I on %I', t || '_active_member_only', t);
    execute format(
      'create policy %I on %I as restrictive for all to authenticated using (is_active_member()) with check (is_active_member())',
      t || '_active_member_only', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1d. The helpers every RPC authorizes with. An inactive account gets no
-- role, no department, no permissions and no conversations, so every RPC
-- that already checks one of these refuses them without per-RPC edits.
-- ---------------------------------------------------------------------------
create or replace function my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and is_active_member();
$$;

create or replace function my_department_id() returns uuid
language sql stable security definer set search_path = public as $$
  select department_id from profiles where id = auth.uid() and is_active_member();
$$;

create or replace function is_boss_or_supervisor() returns boolean
language sql stable security definer set search_path = public as $$
  select is_active_member()
    and coalesce((select role from profiles where id = auth.uid()) in ('boss_boss','supervisor'), false);
$$;

create or replace function has_permission(p_permission text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_active_member() and (
    is_boss_or_supervisor()
    or exists (
      select 1
      from profiles p
      join admin_role_permissions arp on arp.role_id = p.admin_role_id
      where p.id = auth.uid() and arp.permission = p_permission
    )
  );
$$;

create or replace function is_any_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select is_active_member() and (
    is_boss_or_supervisor()
    or exists (
      select 1
      from profiles p
      join admin_role_permissions arp on arp.role_id = p.admin_role_id
      where p.id = auth.uid()
    )
  );
$$;

create or replace function can_view_task(p_task_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_active_member() and (
    is_boss_or_supervisor()
    or exists (select 1 from tasks t where t.id = p_task_id and t.created_by = auth.uid())
    or exists (
      select 1 from task_assignees a
      where a.task_id = p_task_id
        and (a.profile_id = auth.uid() or (a.department_id is not null and a.department_id = my_department_id()))
    )
    or exists (
      select 1 from task_visibility v
      where v.task_id = p_task_id
        and (v.profile_id = auth.uid() or (v.department_id is not null and v.department_id = my_department_id()))
    )
  );
$$;

create or replace function can_act_on_step(p_department_id uuid, p_profile_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_active_member() and (
    is_boss_or_supervisor()
    or (p_profile_id is not null and p_profile_id = auth.uid())
    or (p_department_id is not null and p_department_id = my_department_id())
  );
$$;

-- Also gates the realtime.messages broadcast policy (0033).
create or replace function is_conversation_participant(p_conversation_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_active_member() and exists (
    select 1 from conversation_participants
    where conversation_id = p_conversation_id and profile_id = auth.uid()
  );
$$;

-- create_conversation_rpc only checked auth.uid() is not null, so it's the
-- one RPC the helpers above don't already cover. Also refuses to pull a
-- removed account into a new conversation.
create or replace function create_conversation_rpc(p_participant_ids uuid[], p_is_group boolean, p_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_conversation_id uuid;
  v_participant uuid;
  v_all_participants uuid[];
begin
  if not is_active_member() then
    raise exception 'Not authenticated';
  end if;
  if array_length(p_participant_ids, 1) is null or array_length(p_participant_ids, 1) < 1 then
    raise exception 'At least one other participant is required';
  end if;
  if exists (
    select 1 from unnest(p_participant_ids) as x
    left join profiles p on p.id = x
    where p.id is null or p.deactivated_at is not null
  ) then
    raise exception 'One or more participants are not active accounts';
  end if;

  v_all_participants := array(select distinct x from unnest(array_append(p_participant_ids, auth.uid())) as x);

  if not p_is_group and array_length(p_participant_ids, 1) = 1 then
    select cp1.conversation_id into v_conversation_id
    from conversation_participants cp1
    join conversation_participants cp2 on cp2.conversation_id = cp1.conversation_id
    join conversations c on c.id = cp1.conversation_id
    where c.is_group = false
      and cp1.profile_id = auth.uid()
      and cp2.profile_id = p_participant_ids[1]
      and (select count(*) from conversation_participants where conversation_id = cp1.conversation_id) = 2
    limit 1;

    if v_conversation_id is not null then
      return v_conversation_id;
    end if;
  end if;

  insert into conversations (is_group, name, created_by)
  values (p_is_group, nullif(trim(coalesce(p_name, '')), ''), auth.uid())
  returning id into v_conversation_id;

  foreach v_participant in array v_all_participants loop
    insert into conversation_participants (conversation_id, profile_id) values (v_conversation_id, v_participant)
    on conflict do nothing;
  end loop;

  return v_conversation_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1e. Removing a user now also signs them out everywhere. Deleting their
-- auth.sessions rows invalidates every refresh token (cascade) and makes
-- auth.getUser() — which the middleware calls on every request — reject
-- their current access token immediately.
-- ---------------------------------------------------------------------------
create or replace function remove_user_rpc(p_profile_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_role text;
begin
  if not has_permission('manage_accounts') then
    raise exception 'Not authorized to manage accounts';
  end if;

  if p_profile_id = auth.uid() then
    raise exception 'You cannot remove your own account';
  end if;

  select email, role into v_email, v_role from profiles where id = p_profile_id;
  if v_email is null then
    raise exception 'Account not found';
  end if;

  if v_role in ('boss_boss', 'supervisor') and not is_boss_or_supervisor() then
    raise exception 'Only the President or a Supervisor can remove a President/Supervisor account';
  end if;

  delete from allowed_emails where email = lower(v_email);
  update profiles set deactivated_at = now() where id = p_profile_id;
  delete from auth.sessions where user_id = p_profile_id;

  insert into audit_log (actor_id, action, details)
  values (auth.uid(), 'user_removed', jsonb_build_object('target_profile_id', p_profile_id, 'email', v_email));
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. update_account_rpc: also guard on the target's *current* role, same
-- rule remove_user_rpc already applies.
-- ---------------------------------------------------------------------------
create or replace function update_account_rpc(
  p_profile_id uuid,
  p_role text,
  p_department_id uuid,
  p_birthday_month smallint,
  p_birthday_day smallint
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_current_role text;
begin
  if not has_permission('manage_accounts') then
    raise exception 'Not authorized to manage accounts';
  end if;

  if p_role in ('boss_boss', 'supervisor') and not is_boss_or_supervisor() then
    raise exception 'Only the President or a Supervisor can grant President/Supervisor-level access';
  end if;

  select role into v_current_role from profiles where id = p_profile_id;
  if v_current_role is null then
    raise exception 'Account not found';
  end if;
  if v_current_role in ('boss_boss', 'supervisor') and v_current_role is distinct from p_role
     and not is_boss_or_supervisor() then
    raise exception 'Only the President or a Supervisor can change a President/Supervisor account''s role';
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

-- ---------------------------------------------------------------------------
-- 3. update_admin_role_rpc: a non-President editor can still rename a role
-- or remove permissions from it, but can't widen one that's already held by
-- anyone — that would grant access without going through approval.
-- ---------------------------------------------------------------------------
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

  if not is_boss_or_supervisor()
     and exists (select 1 from profiles where admin_role_id = p_role_id)
     and exists (
       select 1 from unnest(p_permissions) as x(perm)
       where x.perm not in (select permission from admin_role_permissions where role_id = p_role_id)
     ) then
    raise exception 'This role is assigned to at least one account — only the President or a Supervisor can add permissions to it';
  end if;

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

-- ---------------------------------------------------------------------------
-- 4. Removing an allowlisted email now revokes access immediately (see
-- 1c), not just at next sign-in — so remove_allowed_email_rpc gets the same
-- President/Supervisor guard remove_user_rpc has, plus a self-lockout
-- guard. (list/add are unchanged from 0027; only remove is redefined.)
-- ---------------------------------------------------------------------------
create or replace function remove_allowed_email_rpc(p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_permission('manage_allowlist') then
    raise exception 'Not authorized';
  end if;
  if not is_boss_or_supervisor() and exists (
    select 1 from profiles
    where lower(email) = lower(trim(p_email)) and role in ('boss_boss', 'supervisor')
  ) then
    raise exception 'Only the President or a Supervisor can remove a President/Supervisor email';
  end if;
  if exists (select 1 from profiles where id = auth.uid() and lower(email) = lower(trim(p_email))) then
    raise exception 'You cannot remove your own email';
  end if;
  delete from allowed_emails where email = lower(trim(p_email));
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Message size cap. The body arrives already encrypted, so this caps the
-- ciphertext: 5000 plaintext chars (MAX_MESSAGE_LENGTH, src/lib/constants.ts)
-- is at most ~27k chars once UTF-8 encoded, encrypted and base64'd.
-- ---------------------------------------------------------------------------
create or replace function send_message_rpc(p_conversation_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_message_id uuid;
begin
  if not is_conversation_participant(p_conversation_id) then
    raise exception 'Not a participant in this conversation';
  end if;
  if trim(p_body) = '' then
    raise exception 'Message cannot be empty';
  end if;
  if length(p_body) > 30000 then
    raise exception 'Message is too long';
  end if;

  insert into messages (conversation_id, sender_id, body) values (p_conversation_id, auth.uid(), p_body)
  returning id into v_message_id;

  update conversations set last_message_at = now() where id = p_conversation_id;

  update conversation_participants set last_read_at = now()
    where conversation_id = p_conversation_id and profile_id = auth.uid();

  return v_message_id;
end;
$$;
