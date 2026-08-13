-- Reverses 0016's Boss/Supervisor escape hatch — that gave the President
-- the final call on work that was never his to confirm, which contradicts
-- the whole point of assignee-only completion. The actual fix: when a step
-- has nobody to hand off to (no next step exists — the terminal-step
-- misconfiguration case), the step's OWN assignee — the person who
-- submitted it, not an admin — can finalize it themselves. This isn't
-- "confirming your own work" in the accountability sense; it's
-- acknowledging there's no one to confirm it, so it stands as done.

-- confirm_step_rpc goes back to strictly requiring a real next-step
-- assignee — no bypass for anyone, including Boss/Supervisor.
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

  if not found then
    raise exception 'This step has no next assignee to confirm it — use "Finish anyway" instead';
  end if;

  if not (
    v_next.profile_id = auth.uid()
    or (v_next.department_id is not null and v_next.department_id = my_department_id())
  ) then
    raise exception 'Only the next step''s assignee can confirm this';
  end if;

  update task_assignees set status = 'done', completed_at = now(), completed_by = auth.uid()
    where id = p_assignee_id;
end;
$$;

-- New: only callable by the step's own assignee, and only when there is
-- genuinely no next step to hand off to.
create or replace function finish_unconfirmable_step_rpc(p_assignee_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_row task_assignees%rowtype;
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

  select exists(
    select 1 from task_assignees where task_id = v_row.task_id and step_order = v_row.step_order + 1
  ) into v_has_next;

  if v_has_next then
    raise exception 'This step has a next assignee — they need to confirm it, not you';
  end if;

  if not (
    v_row.profile_id = auth.uid()
    or (v_row.department_id is not null and v_row.department_id = my_department_id())
  ) then
    raise exception 'Only this step''s own assignee can finalize it';
  end if;

  update task_assignees set status = 'done', completed_at = now(), completed_by = auth.uid()
    where id = p_assignee_id;
end;
$$;

grant execute on function finish_unconfirmable_step_rpc(uuid) to authenticated;
