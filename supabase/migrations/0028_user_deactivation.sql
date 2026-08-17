-- Client feedback: "President-level access is currently limited to view-only
-- and cannot remove users." Soft-delete only — profiles.id is referenced by
-- tasks.created_by, audit_log.actor_id, task_comments.author_id, and others
-- with no cascade/set-null, so a hard DELETE would break historical records
-- for anyone who's ever done anything in the system. "Removing" a user
-- instead revokes their ability to sign back in, reusing the allowlist gate
-- already built for onboarding (0022) rather than adding new sign-in-
-- blocking logic to the OAuth callback.
alter table profiles add column deactivated_at timestamptz;

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

  -- Same reasoning as update_account_rpc's role guard: manage_accounts
  -- alone shouldn't let a non-boss_boss/supervisor Admin remove a
  -- President/Supervisor account.
  if v_role in ('boss_boss', 'supervisor') and not is_boss_or_supervisor() then
    raise exception 'Only the President or a Supervisor can remove a President/Supervisor account';
  end if;

  delete from allowed_emails where email = lower(v_email);
  update profiles set deactivated_at = now() where id = p_profile_id;

  insert into audit_log (actor_id, action, details)
  values (auth.uid(), 'user_removed', jsonb_build_object('target_profile_id', p_profile_id, 'email', v_email));
end;
$$;
grant execute on function remove_user_rpc(uuid) to authenticated;

create or replace function reactivate_user_rpc(p_profile_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
begin
  if not has_permission('manage_accounts') then
    raise exception 'Not authorized to manage accounts';
  end if;

  select email into v_email from profiles where id = p_profile_id;
  if v_email is null then
    raise exception 'Account not found';
  end if;

  insert into allowed_emails (email, added_by) values (lower(v_email), auth.uid())
    on conflict (email) do nothing;
  update profiles set deactivated_at = null where id = p_profile_id;

  insert into audit_log (actor_id, action, details)
  values (auth.uid(), 'user_reactivated', jsonb_build_object('target_profile_id', p_profile_id, 'email', v_email));
end;
$$;
grant execute on function reactivate_user_rpc(uuid) to authenticated;
