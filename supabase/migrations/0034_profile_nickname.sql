-- Self-service nickname — some employees sign in with a personal Google
-- account whose display name isn't their real/preferred name, and there
-- was no way to fix that without an admin editing it for them (self-
-- profile editing was removed entirely in 0019 after profiles_update_self
-- was found to let anyone grant themselves boss_boss). This RPC only ever
-- touches the caller's own nickname column — no way to reach role,
-- department, or anything else, so it doesn't reopen that hole.
alter table profiles add column nickname text;

create or replace function update_my_nickname_rpc(p_nickname text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  update profiles set nickname = nullif(trim(coalesce(p_nickname, '')), '') where id = auth.uid();
end;
$$;
grant execute on function update_my_nickname_rpc(text) to authenticated;
