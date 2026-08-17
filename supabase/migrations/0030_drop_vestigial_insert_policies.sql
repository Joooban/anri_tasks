-- Security review finding, same class as 0019 (which cleaned up UPDATE/
-- DELETE policies left active after their writes moved to an RPC) — this
-- time on the INSERT side, which was never audited the same way.
--
-- tasks_insert, announcements_insert, and calendar_events_insert currently
-- have NO role check at all in production (confirmed directly against
-- pg_policies, not just migration-file history — their role checks were
-- progressively simplified away during the "mysterious RLS rejection" saga
-- in 0007-0012, ending with plain created_by/author_id = auth.uid()). Since
-- every real creation path (create_task_rpc, create_announcement_rpc,
-- create_meeting_rpc) is SECURITY DEFINER and bypasses RLS entirely for its
-- own inserts, these policies serve no legitimate purpose for the app —
-- they only remain fully callable directly via the client SDK, letting any
-- authenticated Employee create tasks, post company-wide announcements, or
-- schedule company-wide meetings by bypassing the app and calling
-- `.from(table).insert()` directly, skipping every rule the RPCs enforce.
--
-- task_assignees_insert and task_visibility_insert have the same shape of
-- gap (a task's creator could insert chain/visibility rows directly,
-- bypassing whatever validation create_task_rpc performs when building the
-- chain). task_attachments_insert is the same pattern but lower severity —
-- redundant besides, since attachment uploads already go through the
-- service-role client specifically because this exact `can_view_task()`-
-- in-WITH-CHECK shape has a documented history of being unreliable here.
--
-- Confirmed via the same method as 0019: no app code anywhere calls
-- .from(these tables).insert() directly — every create path uses the
-- corresponding RPC (or, for attachments, the service-role client, which
-- bypasses RLS regardless of this policy's existence). Dropping these
-- costs no functionality; RLS enabled + zero remaining insert policy means
-- Postgres denies direct inserts by default for `authenticated`, forcing
-- everything through an audited RPC — exactly the intended state.
drop policy if exists tasks_insert on tasks;
drop policy if exists announcements_insert on announcements;
drop policy if exists calendar_events_insert on calendar_events;
drop policy if exists task_assignees_insert on task_assignees;
drop policy if exists task_visibility_insert on task_visibility;
drop policy if exists task_attachments_insert on task_attachments;

-- Lower-severity hygiene cleanup found in the same review, while here:
-- three debug/diagnostic functions from the original RLS-debugging saga
-- (0009) were never removed and are still callable by any authenticated
-- user. debug_try_insert_task in particular performs a real INSERT+DELETE
-- against the live tasks table (invoker-rights, so it was already
-- constrained by tasks_insert — which no longer exists after this
-- migration, so it would now just always fail — but a leftover function
-- that writes to production on every call has no reason to still exist
-- regardless). can_create_task() (0010) is dead code: no policy or RPC has
-- referenced it since 0011/0012 replaced tasks_insert/announcements_insert
-- with different checks.
drop function if exists debug_auth_uid();
drop function if exists debug_check_tasks_insert(uuid);
drop function if exists debug_try_insert_task(uuid);
drop function if exists can_create_task();
