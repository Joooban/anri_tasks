-- Replaces the Workspace-domain restriction with an email allowlist. The
-- domain check (auth/callback/route.ts) only works when everyone shares a
-- company domain — this company doesn't have one, employees sign in with
-- their own personal email addresses, so there's no domain to check
-- against. Without *some* gate, anyone with any Google account can sign
-- in and, per profiles_select ("to authenticated using (true)"), read the
-- full staff directory (name/email/role/department) — a real PII exposure
-- once this is deployed somewhere reachable by more than just testers.
--
-- Table is intentionally not exposed via any plain RLS policy — every
-- access goes through a SECURITY DEFINER RPC, matching the established
-- pattern (PROJECT_CONTEXT.md) rather than trusting a table-level policy.
create table allowed_emails (
  email text primary key,
  added_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table allowed_emails enable row level security;
-- No policies: RLS enabled with zero policies denies all direct access for
-- every role, including authenticated — the RPCs below are the only way in.

-- Grandfathers in everyone who already has a profile (i.e. has already
-- signed in during testing) so this migration can't lock out existing
-- accounts, including the President's own.
insert into allowed_emails (email)
select email from profiles
on conflict do nothing;

-- Called from the OAuth callback, before the signing-in user necessarily
-- has any role — must work regardless of who's asking, so it's granted to
-- anon as well as authenticated.
create or replace function is_email_allowed(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from allowed_emails where email = lower(p_email));
$$;
grant execute on function is_email_allowed(text) to anon, authenticated;

create or replace function list_allowed_emails_rpc()
returns table (email text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not is_boss_or_supervisor() then
    raise exception 'Not authorized';
  end if;
  return query select a.email, a.created_at from allowed_emails a order by a.created_at desc;
end;
$$;
grant execute on function list_allowed_emails_rpc() to authenticated;

create or replace function add_allowed_email_rpc(p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_boss_or_supervisor() then
    raise exception 'Not authorized';
  end if;
  insert into allowed_emails (email, added_by) values (lower(trim(p_email)), auth.uid())
    on conflict (email) do nothing;
end;
$$;
grant execute on function add_allowed_email_rpc(text) to authenticated;

create or replace function remove_allowed_email_rpc(p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_boss_or_supervisor() then
    raise exception 'Not authorized';
  end if;
  delete from allowed_emails where email = lower(trim(p_email));
end;
$$;
grant execute on function remove_allowed_email_rpc(text) to authenticated;
