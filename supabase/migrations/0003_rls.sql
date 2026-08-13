-- Row Level Security. This is the real access-control boundary — frontend
-- checks are UX only, every table below enforces access at the database.

-- ---------------------------------------------------------------------------
-- Helper functions. SECURITY DEFINER + stable so they can be safely called
-- from inside a table's own RLS policy (e.g. profiles) without recursing
-- back through that table's RLS.
-- ---------------------------------------------------------------------------
create or replace function my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function my_department_id() returns uuid
language sql stable security definer set search_path = public as $$
  select department_id from profiles where id = auth.uid();
$$;

create or replace function is_boss_or_supervisor() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid()) in ('boss_boss','supervisor'), false);
$$;

-- A user can view a task if: they created it, they're Boss/Supervisor, any
-- step in the chain targets their department or them personally, or an
-- explicit task_visibility row targets their department or them personally.
create or replace function can_view_task(p_task_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
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
    );
$$;

-- True while it is this user's turn to act on the given step (their own
-- individual assignment, or a member of the assigned department).
create or replace function can_act_on_step(p_department_id uuid, p_profile_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    is_boss_or_supervisor()
    or (p_profile_id is not null and p_profile_id = auth.uid())
    or (p_department_id is not null and p_department_id = my_department_id());
$$;

-- ---------------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------------
alter table departments enable row level security;

create policy departments_select on departments for select
  to authenticated using (true);

create policy departments_write on departments for all
  to authenticated using (is_boss_or_supervisor()) with check (is_boss_or_supervisor());

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;

-- Every signed-in user can see the (minimal) profiles list — needed to pick
-- individual assignees across departments and to render names in the chain.
create policy profiles_select on profiles for select
  to authenticated using (true);

create policy profiles_update_self on profiles for update
  to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_admin_write on profiles for update
  to authenticated using (is_boss_or_supervisor()) with check (is_boss_or_supervisor());

-- ---------------------------------------------------------------------------
-- task_types
-- ---------------------------------------------------------------------------
alter table task_types enable row level security;

create policy task_types_select on task_types for select
  to authenticated using (true);

create policy task_types_write on task_types for all
  to authenticated using (is_boss_or_supervisor()) with check (is_boss_or_supervisor());

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
alter table tasks enable row level security;

create policy tasks_select on tasks for select
  to authenticated using (can_view_task(id));

create policy tasks_insert on tasks for insert
  to authenticated with check (created_by = auth.uid());

-- Updates: creator, Boss/Supervisor, or whoever can currently act on the
-- active step. Kept permissive at the row level — the app only exposes the
-- fields relevant to each actor's role.
create policy tasks_update on tasks for update
  to authenticated using (
    created_by = auth.uid()
    or is_boss_or_supervisor()
    or exists (
      select 1 from task_assignees a
      where a.task_id = tasks.id and a.status in ('active','pending_approval')
        and can_act_on_step(a.department_id, a.profile_id)
    )
  );

create policy tasks_delete on tasks for delete
  to authenticated using (is_boss_or_supervisor());

-- ---------------------------------------------------------------------------
-- task_assignees
-- ---------------------------------------------------------------------------
alter table task_assignees enable row level security;

create policy task_assignees_select on task_assignees for select
  to authenticated using (can_view_task(task_id));

create policy task_assignees_insert on task_assignees for insert
  to authenticated with check (
    exists (select 1 from tasks t where t.id = task_id and t.created_by = auth.uid())
    or is_boss_or_supervisor()
  );

-- A step can only be updated by whoever can currently act on it (its own
-- assignee, for marking done/blocked), by Boss/Supervisor, or — while the
-- step is 'pending_approval' — by the *next* step's assignee, since it's
-- their confirmation that finalizes the handoff (see project brief: "the
-- next person in the chain must confirm before a step counts as Done").
create policy task_assignees_update on task_assignees for update
  to authenticated using (
    can_act_on_step(department_id, profile_id)
    or is_boss_or_supervisor()
    or (
      status = 'pending_approval'
      and exists (
        select 1 from task_assignees nxt
        where nxt.task_id = task_assignees.task_id
          and nxt.step_order = task_assignees.step_order + 1
          and can_act_on_step(nxt.department_id, nxt.profile_id)
      )
    )
  );

create policy task_assignees_delete on task_assignees for delete
  to authenticated using (
    exists (select 1 from tasks t where t.id = task_id and t.created_by = auth.uid())
    or is_boss_or_supervisor()
  );

-- ---------------------------------------------------------------------------
-- task_visibility
-- ---------------------------------------------------------------------------
alter table task_visibility enable row level security;

create policy task_visibility_select on task_visibility for select
  to authenticated using (can_view_task(task_id));

create policy task_visibility_insert on task_visibility for insert
  to authenticated with check (
    exists (select 1 from tasks t where t.id = task_id and t.created_by = auth.uid())
    or is_boss_or_supervisor()
  );

create policy task_visibility_delete on task_visibility for delete
  to authenticated using (
    exists (select 1 from tasks t where t.id = task_id and t.created_by = auth.uid())
    or is_boss_or_supervisor()
  );

-- ---------------------------------------------------------------------------
-- task_attachments
-- ---------------------------------------------------------------------------
alter table task_attachments enable row level security;

create policy task_attachments_select on task_attachments for select
  to authenticated using (can_view_task(task_id));

create policy task_attachments_insert on task_attachments for insert
  to authenticated with check (can_view_task(task_id) and uploaded_by = auth.uid());

create policy task_attachments_delete on task_attachments for delete
  to authenticated using (
    uploaded_by = auth.uid()
    or is_boss_or_supervisor()
    or exists (select 1 from tasks t where t.id = task_id and t.created_by = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- audit_log: append-only. SELECT only, no update/delete policy exists for
-- any role, so history can never be edited or erased through the API.
-- ---------------------------------------------------------------------------
alter table audit_log enable row level security;

create policy audit_log_select on audit_log for select
  to authenticated using (task_id is null or can_view_task(task_id));

create policy audit_log_insert on audit_log for insert
  to authenticated with check (task_id is null or can_view_task(task_id));

-- ---------------------------------------------------------------------------
-- announcements
-- ---------------------------------------------------------------------------
alter table announcements enable row level security;

create policy announcements_select on announcements for select
  to authenticated using (
    department_id is null
    or department_id = my_department_id()
    or is_boss_or_supervisor()
  );

create policy announcements_insert on announcements for insert
  to authenticated with check (
    author_id = auth.uid()
    and (
      is_boss_or_supervisor()
      or (department_id is not null and department_id = my_department_id())
    )
  );

create policy announcements_delete on announcements for delete
  to authenticated using (author_id = auth.uid() or is_boss_or_supervisor());

-- ---------------------------------------------------------------------------
-- calendar_events: shared company calendar, so all authenticated users can
-- see every entry; only the owning department (or Boss/Supervisor) can
-- create/edit/delete.
-- ---------------------------------------------------------------------------
alter table calendar_events enable row level security;

create policy calendar_events_select on calendar_events for select
  to authenticated using (true);

create policy calendar_events_insert on calendar_events for insert
  to authenticated with check (
    created_by = auth.uid()
    and (is_boss_or_supervisor() or department_id is null or department_id = my_department_id())
  );

create policy calendar_events_update on calendar_events for update
  to authenticated using (created_by = auth.uid() or is_boss_or_supervisor());

create policy calendar_events_delete on calendar_events for delete
  to authenticated using (created_by = auth.uid() or is_boss_or_supervisor());

-- ---------------------------------------------------------------------------
-- task_comments
-- ---------------------------------------------------------------------------
alter table task_comments enable row level security;

create policy task_comments_select on task_comments for select
  to authenticated using (can_view_task(task_id));

create policy task_comments_insert on task_comments for insert
  to authenticated with check (
    author_id = auth.uid()
    and (
      is_boss_or_supervisor()
      or exists (select 1 from tasks t where t.id = task_id and t.created_by = auth.uid())
      or exists (
        select 1 from task_assignees a
        where a.task_id = task_id and can_act_on_step(a.department_id, a.profile_id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- boss_dashboard_prefs
-- ---------------------------------------------------------------------------
alter table boss_dashboard_prefs enable row level security;

create policy boss_dashboard_prefs_all on boss_dashboard_prefs for all
  to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
