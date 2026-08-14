-- Adds edit/delete for announcements and a permanent-delete option for
-- cancelled tasks, following the same SECURITY DEFINER RPC pattern as every
-- other write path (0013-0015) since RLS WITH CHECK policies proved
-- unreliable for non-boss_boss accounts.

-- Only the original author can edit their own announcement's content.
create or replace function update_announcement_rpc(
  p_id uuid,
  p_title text,
  p_body text,
  p_pinned boolean,
  p_publish_at timestamptz,
  p_expires_at timestamptz
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from announcements where id = p_id and author_id = auth.uid()) then
    raise exception 'Only the original author can edit this announcement';
  end if;

  update announcements
    set title = p_title,
        body = p_body,
        pinned = p_pinned,
        publish_at = coalesce(p_publish_at, publish_at),
        expires_at = p_expires_at
    where id = p_id;
end;
$$;

grant execute on function update_announcement_rpc(uuid, text, text, boolean, timestamptz, timestamptz) to authenticated;

-- Deleting is also available to Boss/Supervisor as a moderation action —
-- same authorization is_boss_or_supervisor() already grants for cancelling
-- other people's tasks, not a new override.
create or replace function delete_announcement_rpc(p_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    is_boss_or_supervisor()
    or exists (select 1 from announcements where id = p_id and author_id = auth.uid())
  ) then
    raise exception 'Not authorized to delete this announcement';
  end if;

  delete from announcements where id = p_id;
end;
$$;

grant execute on function delete_announcement_rpc(uuid) to authenticated;

-- Permanently removes a task that's already cancelled. Same authorization
-- as cancelling it in the first place (creator or Boss/Supervisor) — this
-- is cleanup of something already cancelled, not a new kind of override.
-- All child rows (task_assignees, task_comments, task_attachments,
-- task_visibility, audit_log) cascade on delete per their FKs (0001).
create or replace function delete_cancelled_task_rpc(p_task_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from tasks where id = p_task_id and status = 'cancelled') then
    raise exception 'Only cancelled tasks can be permanently deleted';
  end if;

  if not (
    is_boss_or_supervisor()
    or exists (select 1 from tasks where id = p_task_id and created_by = auth.uid())
  ) then
    raise exception 'Not authorized to delete this task';
  end if;

  delete from tasks where id = p_task_id;
end;
$$;

grant execute on function delete_cancelled_task_rpc(uuid) to authenticated;
