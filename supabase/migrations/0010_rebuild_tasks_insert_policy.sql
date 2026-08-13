-- Clean rebuild of tasks_insert. Every individual piece of the previous
-- policy (created_by = auth.uid(), my_role() <> 'employee', the combined
-- expression, the role, the JWT) checked out correct in isolation via
-- direct RPC calls, yet the real insert kept failing 42501 even after a
-- full project restart. Rather than keep debugging an invisible cause,
-- this drops the policy and introduces a fresh, distinctly-named helper
-- function so nothing about the old objects is reused.
create or replace function can_create_task() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid()) <> 'employee', false);
$$;

grant execute on function can_create_task() to authenticated;

drop policy if exists tasks_insert on tasks;
create policy tasks_insert on tasks for insert
  to authenticated with check (
    created_by = auth.uid() and can_create_task()
  );
