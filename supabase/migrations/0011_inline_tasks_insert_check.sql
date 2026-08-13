-- Every function-based version of this check (my_role(), can_create_task())
-- proved correct in isolation via RPC yet failed for the real insert —
-- disabling RLS entirely made task creation succeed, confirming RLS really
-- is the blocker, and narrowing it to something specific about a function
-- call inside WITH CHECK during an actual INSERT. This version does the
-- profiles lookup inline instead of through a function, to rule that out.
drop policy if exists tasks_insert on tasks;
create policy tasks_insert on tasks for insert
  to authenticated with check (
    created_by = auth.uid()
    and (select role from profiles where id = auth.uid()) <> 'employee'
  );
