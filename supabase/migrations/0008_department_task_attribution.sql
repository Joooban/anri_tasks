-- Fixes two related problems:
--
-- 1. Department-scoped stats (completion rate, done-counts, health, etc.)
--    were keyed on tasks.creator_department_id only. A task the President
--    or Supervisor assigns to a department they don't belong to (the
--    common case — that's most cross-department delegation) never counted
--    toward that department's stats, since the creator has no department.
--    task_departments below attributes a task to every department that's
--    either its creator OR anywhere in its assignee chain.
--
-- 2. Boss/Supervisor could mark ANY step done/confirmed on anyone's
--    behalf, not just steps actually assigned to them — which both
--    contradicts the point of a relay handoff (accountability for who
--    really did the work) and would misattribute the audit trail. They
--    keep the ability to block/unblock a stuck step and cancel a task
--    (administrative overrides), but completing or confirming a step is
--    now restricted to its real assignee.

create view task_departments with (security_invoker = true) as
  select id as task_id, creator_department_id as department_id
  from tasks
  where creator_department_id is not null
  union
  select task_id, department_id
  from task_assignees
  where department_id is not null;

grant select on task_departments to authenticated;

-- Assignee check with no Boss/Supervisor bypass, for the one place that
-- bypass is no longer appropriate: actually completing a step.
create or replace function is_assignee(p_department_id uuid, p_profile_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    (p_profile_id is not null and p_profile_id = auth.uid())
    or (p_department_id is not null and p_department_id = my_department_id());
$$;

drop policy task_assignees_update on task_assignees;
create policy task_assignees_update on task_assignees for update
  to authenticated
  using (
    is_assignee(department_id, profile_id)
    or is_boss_or_supervisor()
    or (
      status = 'pending_approval'
      and exists (
        select 1 from task_assignees nxt
        where nxt.task_id = task_assignees.task_id
          and nxt.step_order = task_assignees.step_order + 1
          and is_assignee(nxt.department_id, nxt.profile_id)
      )
    )
  )
  with check (
    is_assignee(department_id, profile_id)
    -- Boss/Supervisor may still block a stuck step or resume it — not
    -- complete it on the assignee's behalf.
    or (is_boss_or_supervisor() and status in ('blocked', 'active'))
    -- The next step's real assignee confirming a pending_approval step.
    or exists (
      select 1 from task_assignees nxt
      where nxt.task_id = task_assignees.task_id
        and nxt.step_order = task_assignees.step_order + 1
        and is_assignee(nxt.department_id, nxt.profile_id)
    )
  );
