-- Fixes a real deadlock: a task whose LAST chain step has
-- requires_confirmation = true gets stuck in 'pending_approval' forever,
-- since confirm_step_rpc looks for step_order + 1 and there's no such step
-- — no one could ever confirm it. Two changes:
--
-- 1. create_task_rpc now defensively forces requires_confirmation = false
--    on the last step of any new chain, regardless of what the client
--    sends (the UI also prevents checking it now, but this is the actual
--    guarantee).
-- 2. confirm_step_rpc gains an admin escape hatch: if a step somehow has
--    no next step (existing stuck tasks, or any future edge case), only
--    Boss/Supervisor can clear it — there's no legitimate assignee who
--    ever could, so this isn't the same "completing someone else's work"
--    concern that keeps Boss/Supervisor out of normal confirmations.

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

  insert into tasks (title, description, task_type_id, created_by, creator_department_id, deadline, is_personal)
  values (p_title, p_description, p_task_type_id, v_profile.id, v_profile.department_id, p_deadline, p_is_personal)
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

create or replace function confirm_step_rpc(p_assignee_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_row task_assignees%rowtype;
  v_next task_assignees%rowtype;
  v_has_next boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row from task_assignees where id = p_assignee_id;
  if not found then
    raise exception 'Step not found';
  end if;

  if v_row.status <> 'pending_approval' then
    raise exception 'This step is not pending approval';
  end if;

  select * into v_next from task_assignees
    where task_id = v_row.task_id and step_order = v_row.step_order + 1;
  v_has_next := found;

  if v_has_next then
    if not (
      v_next.profile_id = auth.uid()
      or (v_next.department_id is not null and v_next.department_id = my_department_id())
    ) then
      raise exception 'Only the next step''s assignee can confirm this';
    end if;
  else
    -- No next step exists to confirm it — a data state that should no
    -- longer be creatable, but may already exist. Only an admin can clear
    -- it.
    if not is_boss_or_supervisor() then
      raise exception 'This step has no next assignee to confirm it — contact the President or a Supervisor';
    end if;
  end if;

  update task_assignees set status = 'done', completed_at = now(), completed_by = auth.uid()
    where id = p_assignee_id;
end;
$$;
