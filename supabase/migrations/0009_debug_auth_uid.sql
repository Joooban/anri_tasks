-- TEMPORARY diagnostic only — not part of the app schema. Run
-- `drop function debug_auth_uid(); drop function debug_check_tasks_insert(uuid); drop function debug_try_insert_task(uuid);`
-- once the tasks_insert RLS mystery is solved.

drop function if exists debug_auth_uid();

create or replace function debug_auth_uid() returns table (
  uid uuid,
  jwt_role text,
  db_role text,
  my_role_result text,
  profile_role_direct text
)
language sql stable as $$
  select
    auth.uid(),
    auth.role(),
    current_user::text,
    my_role(),
    (select role from profiles where id = auth.uid());
$$;

grant execute on function debug_auth_uid() to authenticated, anon;

drop function if exists debug_check_tasks_insert(uuid);

create or replace function debug_check_tasks_insert(p_created_by uuid) returns table (
  expression_result boolean,
  auth_uid uuid,
  my_role_result text
)
language sql stable as $$
  select
    (p_created_by = auth.uid() and my_role() <> 'employee'),
    auth.uid(),
    my_role();
$$;

grant execute on function debug_check_tasks_insert(uuid) to authenticated;

-- Attempts an actual real INSERT into tasks (then deletes it immediately),
-- running as SECURITY INVOKER (the default) so RLS applies exactly as it
-- would for the real app request — no simulation, the genuine thing. Any
-- failure is caught and returned as text instead of aborting.
drop function if exists debug_try_insert_task(uuid);

create or replace function debug_try_insert_task(p_created_by uuid) returns text
language plpgsql as $$
declare
  v_id uuid;
  v_error text;
  v_state text;
begin
  begin
    insert into tasks (title, created_by) values ('DEBUG TEST TASK', p_created_by) returning id into v_id;
    delete from tasks where id = v_id;
    return 'SUCCESS: inserted and cleaned up, id=' || v_id::text;
  exception when others then
    get stacked diagnostics v_error = message_text, v_state = returned_sqlstate;
    return 'FAILED: sqlstate=' || v_state || ' message=' || v_error;
  end;
end;
$$;

grant execute on function debug_try_insert_task(uuid) to authenticated;
