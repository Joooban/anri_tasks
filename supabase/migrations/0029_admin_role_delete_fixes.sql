-- delete_admin_role_rpc (0027) only checked profiles.admin_role_id for
-- whether a role was "in use," but admin_approval_requests.requested_admin_role_id
-- also references admin_roles(id) with the default ON DELETE NO ACTION —
-- so a role that was ever the subject of an approval request (even a
-- long-resolved one) silently failed to delete with a raw foreign-key-
-- violation error, no matter what the app-level "not assigned to anyone"
-- check said. Historical requests should keep their record (who requested
-- what, when, and the outcome) even after the role itself is later
-- deleted, so the fix is ON DELETE SET NULL rather than blocking deletion.
alter table admin_approval_requests
  drop constraint admin_approval_requests_requested_admin_role_id_fkey,
  add constraint admin_approval_requests_requested_admin_role_id_fkey
    foreign key (requested_admin_role_id) references admin_roles(id) on delete set null;

-- Also guard against deleting a role that has a genuinely *pending* (not
-- yet resolved) request against it — approving it later would otherwise
-- silently apply a null admin_role_id instead of the role the requester
-- actually asked for, which isn't what "approve" should mean.
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

  if exists (select 1 from admin_approval_requests where requested_admin_role_id = p_role_id and status = 'pending') then
    raise exception 'This role has a pending approval request — resolve it first';
  end if;

  select name into v_name from admin_roles where id = p_role_id;
  delete from admin_roles where id = p_role_id;

  insert into audit_log (actor_id, action, details)
  values (auth.uid(), 'admin_role_deleted', jsonb_build_object('role_id', p_role_id, 'name', v_name));
end;
$$;
grant execute on function delete_admin_role_rpc(uuid) to authenticated;
