-- Client feedback: Department Health and Department Tiles showed near-
-- identical info (retiring Department Health, keeping Tiles as the
-- drill-down), and Overdue & Blocked / Upcoming Deadlines were two competing
-- widgets that make more sense merged into one "Needs Attention" list — see
-- lib/types.ts's BOSS_DASHBOARD_WIDGETS.
--
-- Existing boss_dashboard_prefs rows may reference the retired widget keys
-- ('department_health', 'overdue_blocked', 'upcoming_deadlines'). Rather
-- than rewrite each array in place (fiddly to do losslessly in SQL, and
-- there are only ever a handful of these rows — one per Boss Boss user who
-- customized their dashboard), just clear them; the app already falls back
-- to the full default widget set whenever no prefs row exists
-- (dashboard/page.tsx), so anyone affected just gets the new defaults and
-- can re-customize.
delete from boss_dashboard_prefs;

alter table boss_dashboard_prefs
  alter column enabled_widgets set default array['completion_rate','needs_attention','announcements','department_tiles'],
  alter column widget_order set default array['completion_rate','needs_attention','announcements','department_tiles'];
