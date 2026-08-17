-- Security-review finding (functional, not access-control): 0016 added a
-- defensive guarantee to create_task_rpc — force requires_confirmation =
-- false on a chain's LAST step, regardless of what the client sends —
-- because a task whose last step needs confirmation can never actually be
-- confirmed (confirm_step_rpc looks for step_order + 1, which doesn't
-- exist for the last step) and gets stuck in 'pending_approval'.
--
-- 0023 (this session, fixing the unrelated to_do/in_progress status bug)
-- replaced create_task_rpc from an older base that predated 0016's fix,
-- silently reverting it — confirmed directly against the live function
-- body, which no longer has the v_chain_length variable or the terminal-
-- step override at all. The app's UI (assignee-chain-editor.tsx) still
-- independently normalizes this before submitting, so it hasn't caused a
-- real stuck task since — but the DB is supposed to be the actual
-- guarantee here (same "frontend checks are UX only" principle this
-- project already applies to access control), not just something that
-- happens to be true because the current UI behaves. Restored.
create or replace function create_task_rpc(
  p_title text,
  p_description text,
  p_task_type_id uuid,
  p_deadline timestamptz,
  p_is_personal boolean,
  p_chain jsonb,
  p_visibility jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles%rowtype;
  v_task_id uuid;
  v_step jsonb;
  v_index int := 0;
  v_chain_length int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from profiles where id = auth.uid();
  if not found then
    raise exception 'No profile found for this account';
  end if;

  if v_profile.role = 'employee' then
    raise exception 'Employees cannot create tasks';
  end if;

  v_chain_length := jsonb_array_length(p_chain);
  if v_chain_length < 1 then
    raise exception 'At least one assignee is required';
  end if;

  insert into tasks (title, description, task_type_id, created_by, creator_department_id, deadline, is_personal, status)
  values (p_title, p_description, p_task_type_id, v_profile.id, v_profile.department_id, p_deadline, p_is_personal, 'in_progress')
  returning id into v_task_id;

  for v_step in select * from jsonb_array_elements(p_chain)
  loop
    insert into task_assignees (
      task_id, step_order, assignee_type, department_id, profile_id,
      requires_confirmation, status, started_at
    )
    values (
      v_task_id,
      v_index + 1,
      v_step->>'assignee_type',
      (v_step->>'department_id')::uuid,
      (v_step->>'profile_id')::uuid,
      case when v_index = v_chain_length - 1 then false else (v_step->>'requires_confirmation')::boolean end,
      case when v_index = 0 then 'active' else 'pending' end,
      case when v_index = 0 then now() else null end
    );
    v_index := v_index + 1;
  end loop;

  insert into task_visibility (task_id, department_id, profile_id)
  select v_task_id, (v->>'department_id')::uuid, (v->>'profile_id')::uuid
  from jsonb_array_elements(p_visibility) as v;

  insert into audit_log (task_id, actor_id, action, details)
  values (v_task_id, v_profile.id, 'step_activated', jsonb_build_object('step_order', 1));

  return v_task_id;
end;
$$;

grant execute on function create_task_rpc(text, text, uuid, timestamptz, boolean, jsonb, jsonb) to authenticated;
