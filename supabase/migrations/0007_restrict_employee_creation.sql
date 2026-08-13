-- Employees can act on work assigned to them (steps, comments) but should
-- not be able to create new tasks, announcements, or calendar events — the
-- brief attributes creation to "Departments" (department accounts and up),
-- not individual staff. Re-creates the three affected policies with a role
-- check added; drops first since Postgres has no CREATE POLICY OR REPLACE.

drop policy tasks_insert on tasks;
create policy tasks_insert on tasks for insert
  to authenticated with check (
    created_by = auth.uid()
    and my_role() <> 'employee'
  );

drop policy announcements_insert on announcements;
create policy announcements_insert on announcements for insert
  to authenticated with check (
    author_id = auth.uid()
    and (
      is_boss_or_supervisor()
      or (department_id is not null and department_id = my_department_id() and my_role() = 'department')
    )
  );

-- Also tightens a real gap: the original policy let ANY authenticated user
-- post a company-wide (department_id is null) calendar event, since that
-- branch had no role check at all.
drop policy calendar_events_insert on calendar_events;
create policy calendar_events_insert on calendar_events for insert
  to authenticated with check (
    created_by = auth.uid()
    and (
      is_boss_or_supervisor()
      or (my_role() = 'department' and department_id is not null and department_id = my_department_id())
    )
  );
