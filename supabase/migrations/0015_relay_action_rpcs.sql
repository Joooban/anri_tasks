-- Hardens the core relay workflow (mark done, confirm, block, unblock,
-- cancel, comment) the same way 0013/0014 hardened task/announcement/
-- meeting creation. task_assignees_update (0008) and task_comments_insert
-- (0003) both use is_assignee()/is_boss_or_supervisor()/can_act_on_step()
-- inside WITH CHECK — the exact pattern that mysteriously rejected valid
-- writes for non-boss_boss accounts elsewhere. This is the single most
-- important path to get right, since it's the actual day-to-day workflow
-- everyone but the President uses constantly. Each function replicates the
-- same authorization rule the RLS policy was meant to enforce, in
-- PL/pgSQL, then writes directly as the function owner.

-- Completing a step is restricted to its real assignee — no
-- Boss/Supervisor bypass, matching 0008's reasoning (misattribution risk).
create or replace function complete_step_rpc(p_assignee_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_row task_assignees%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row from task_assignees where id = p_assignee_id;
  if not found then
    raise exception 'Step not found';
  end if;

  if v_row.status <> 'active' then
    raise exception 'This step is not active';
  end if;

  if not (
    v_row.profile_id = auth.uid()
    or (v_row.department_id is not null and v_row.department_id = my_department_id())
  ) then
    raise exception 'Only this step''s assignee can complete it';
  end if;

  update task_assignees
    set status = case when v_row.requires_confirmation then 'pending_approval' else 'done' end,
        completed_at = now(),
        completed_by = auth.uid()
    where id = p_assignee_id;
end;
$$;

grant execute on function complete_step_rpc(uuid) to authenticated;

-- The next step's real assignee confirms a pending_approval step.
create or replace function confirm_step_rpc(p_assignee_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_row task_assignees%rowtype;
  v_next task_assignees%rowtype;
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

  if not found or not (
    v_next.profile_id = auth.uid()
    or (v_next.department_id is not null and v_next.department_id = my_department_id())
  ) then
    raise exception 'Only the next step''s assignee can confirm this';
  end if;

  update task_assignees set status = 'done', completed_at = now(), completed_by = auth.uid()
    where id = p_assignee_id;
end;
$$;

grant execute on function confirm_step_rpc(uuid) to authenticated;

-- Blocking/unblocking is a legitimate Boss/Supervisor override as well as
-- the assignee's own call.
create or replace function block_step_rpc(p_assignee_id uuid, p_notes text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_row task_assignees%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row from task_assignees where id = p_assignee_id;
  if not found then
    raise exception 'Step not found';
  end if;

  if not (
    is_boss_or_supervisor()
    or v_row.profile_id = auth.uid()
    or (v_row.department_id is not null and v_row.department_id = my_department_id())
  ) then
    raise exception 'Not authorized to block this step';
  end if;

  update task_assignees set status = 'blocked', notes = p_notes where id = p_assignee_id;
end;
$$;

grant execute on function block_step_rpc(uuid, text) to authenticated;

create or replace function unblock_step_rpc(p_assignee_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_row task_assignees%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row from task_assignees where id = p_assignee_id;
  if not found then
    raise exception 'Step not found';
  end if;

  if not (
    is_boss_or_supervisor()
    or v_row.profile_id = auth.uid()
    or (v_row.department_id is not null and v_row.department_id = my_department_id())
  ) then
    raise exception 'Not authorized to resume this step';
  end if;

  update task_assignees set status = 'active' where id = p_assignee_id;
  update tasks set status = 'in_progress' where id = v_row.task_id;
end;
$$;

grant execute on function unblock_step_rpc(uuid) to authenticated;

create or replace function cancel_task_rpc(p_task_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    is_boss_or_supervisor()
    or exists (select 1 from tasks where id = p_task_id and created_by = auth.uid())
  ) then
    raise exception 'Not authorized to cancel this task';
  end if;

  update tasks set status = 'cancelled' where id = p_task_id;
end;
$$;

grant execute on function cancel_task_rpc(uuid) to authenticated;

create or replace function add_task_comment_rpc(p_task_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    is_boss_or_supervisor()
    or exists (select 1 from tasks where id = p_task_id and created_by = auth.uid())
    or exists (
      select 1 from task_assignees a
      where a.task_id = p_task_id
        and (a.profile_id = auth.uid() or (a.department_id is not null and a.department_id = my_department_id()))
    )
  ) then
    raise exception 'Not authorized to comment on this task';
  end if;

  insert into task_comments (task_id, author_id, body) values (p_task_id, auth.uid(), p_body)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function add_task_comment_rpc(uuid, text) to authenticated;
