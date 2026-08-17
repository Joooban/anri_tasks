-- Bug: a freshly created task's status stayed 'to_do' (the column
-- default) even though its first chain step is inserted as already
-- 'active' — because trg_task_assignee_status_change only fires "after
-- update of status", never on insert. The status-advancing logic in
-- handle_task_assignee_status_change() (0002) only runs when a step's
-- status *changes* via UPDATE, which never happens for the first step at
-- creation time. For a single-step chain this meant status went straight
-- to_do -> done, skipping in_progress entirely; for a multi-step chain it
-- meant the task showed to_do for the entire time the first assignee was
-- working on it, only correcting once step 2 activated.

-- Fix going forward: set the task's initial status explicitly at creation
-- time, matching the reality that its first step is already actionable,
-- instead of relying on a trigger that structurally can't fire yet.
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

  if jsonb_array_length(p_chain) < 1 then
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
      (v_step->>'requires_confirmation')::boolean,
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

-- One-time correction for existing tasks already stuck in this state:
-- still 'to_do' despite their first step already being active.
update tasks
set status = 'in_progress', updated_at = now()
where status = 'to_do'
  and exists (
    select 1 from task_assignees
    where task_id = tasks.id and status = 'active'
  );
