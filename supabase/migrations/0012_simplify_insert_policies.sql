-- Reverts announcements_insert and calendar_events_insert to simple
-- ownership-only checks, matching tasks_insert (0011). These used the same
-- my_role()/is_boss_or_supervisor()-in-WITH-CHECK pattern that mysteriously
-- rejected valid inserts for tasks_insert despite every underlying
-- condition independently verifying true — rather than wait to hit the same
-- bug here, the role/company-wide validation for these two moves to the
-- server actions (postAnnouncement, createMeeting) instead, same as tasks.
drop policy if exists announcements_insert on announcements;
create policy announcements_insert on announcements for insert
  to authenticated with check (author_id = auth.uid());

drop policy if exists calendar_events_insert on calendar_events;
create policy calendar_events_insert on calendar_events for insert
  to authenticated with check (created_by = auth.uid());
