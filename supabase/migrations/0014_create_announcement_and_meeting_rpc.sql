-- Same defensive move as 0013, applied to the two other creation paths that
-- still relied on plain ownership-only RLS policies (announcements_insert,
-- calendar_events_insert). Since the root cause behind tasks_insert's
-- rejection for non-boss_boss accounts was never identified, these were
-- untested against the same failure mode — rather than leave that gap,
-- both move to the same SECURITY DEFINER RPC pattern.
create or replace function create_announcement_rpc(
  p_title text,
  p_body text,
  p_pinned boolean,
  p_company_wide boolean,
  p_publish_at timestamptz,
  p_expires_at timestamptz
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from profiles where id = auth.uid();
  if not found then
    raise exception 'No profile found for this account';
  end if;

  if v_profile.role = 'employee' then
    raise exception 'Employees cannot post announcements';
  end if;

  if p_company_wide and v_profile.role not in ('boss_boss', 'supervisor') then
    raise exception 'Only the President or Supervisors can post company-wide';
  end if;

  if not p_company_wide and v_profile.department_id is null then
    raise exception 'No department to post under';
  end if;

  insert into announcements (department_id, author_id, title, body, pinned, publish_at, expires_at)
  values (
    case when p_company_wide then null else v_profile.department_id end,
    v_profile.id,
    p_title,
    p_body,
    p_pinned,
    coalesce(p_publish_at, now()),
    p_expires_at
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function create_announcement_rpc(text, text, boolean, boolean, timestamptz, timestamptz) to authenticated;

create or replace function create_meeting_rpc(
  p_title text,
  p_description text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_meeting_link text,
  p_company_wide boolean
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from profiles where id = auth.uid();
  if not found then
    raise exception 'No profile found for this account';
  end if;

  if v_profile.role = 'employee' then
    raise exception 'Employees cannot add meetings';
  end if;

  if p_company_wide and v_profile.role not in ('boss_boss', 'supervisor') then
    raise exception 'Only the President or Supervisors can post company-wide';
  end if;

  insert into calendar_events (title, description, department_id, start_at, end_at, meeting_link, created_by)
  values (
    p_title,
    p_description,
    case when p_company_wide then null else v_profile.department_id end,
    p_start_at,
    p_end_at,
    p_meeting_link,
    v_profile.id
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function create_meeting_rpc(text, text, timestamptz, timestamptz, text, boolean) to authenticated;
