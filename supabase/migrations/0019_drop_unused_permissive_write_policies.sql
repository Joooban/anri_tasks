-- Security review finding (critical): profiles_update_self let any
-- authenticated user update their OWN row with no column restriction —
-- including `role` and `department_id`. Since is_boss_or_supervisor() and
-- every RPC's authorization check reads profiles.role for auth.uid(), any
-- employee could grant themselves boss_boss (President-level access to
-- everything in the app) with a single direct API call, completely
-- bypassing the Accounts admin page. Confirmed via grep: no app code
-- anywhere calls this policy (self profile editing was never built as a
-- feature), so dropping it costs no functionality.
--
-- Same root issue, lower severity: every UPDATE/DELETE policy below was
-- superseded by a SECURITY DEFINER RPC (0013-0018) that bypasses RLS
-- entirely for its own writes — but the original permissive policy was
-- never dropped, leaving it fully callable directly via the Supabase
-- client SDK (same public anon key + a real session) using whatever
-- column values the caller wants, since none of them had a WITH CHECK
-- restricting which columns/values are allowed. E.g. tasks_update let
-- anyone holding the active step directly set any column on the task row
-- (not just the status transition the RPCs intend), bypassing every
-- validation the RPCs perform. Confirmed via grep: no app code directly
-- calls .update()/.delete() on any of these tables — everything already
-- goes through the RPCs, which run as the function owner and are
-- unaffected by dropping the underlying table policy.
--
-- With RLS enabled and no remaining policy for a given command, Postgres
-- denies that command by default for the `authenticated` role — exactly
-- what's wanted here: force every write through an audited RPC.

drop policy if exists profiles_update_self on profiles;

drop policy if exists tasks_update on tasks;
drop policy if exists tasks_delete on tasks;

drop policy if exists task_assignees_update on task_assignees;
drop policy if exists task_assignees_delete on task_assignees;

drop policy if exists task_visibility_delete on task_visibility;

drop policy if exists task_attachments_delete on task_attachments;

drop policy if exists announcements_delete on announcements;

drop policy if exists calendar_events_update on calendar_events;
drop policy if exists calendar_events_delete on calendar_events;
