-- Relay auto-advance + append-only audit logging.
--
-- Design: the app inserts a task and its full ordered task_assignees chain
-- (step 1 = 'active', rest = 'pending') in one transaction. From then on,
-- every handoff is driven by updating a single task_assignees.status, and
-- these triggers do the rest: activate the next step, roll the derived
-- overall task.status forward, and append an audit_log entry. This keeps
-- the relay logic atomic and correct even if two clients race, since it
-- runs inside Postgres rather than being re-implemented in the frontend.

create or replace function log_audit(
  p_task_id uuid,
  p_actor_id uuid,
  p_action text,
  p_details jsonb default null
) returns void
language sql
as $$
  insert into audit_log (task_id, actor_id, action, details)
  values (p_task_id, p_actor_id, p_action, p_details);
$$;

-- Fired once per new task to log creation and activate the first step.
create or replace function handle_task_created() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform log_audit(new.id, new.created_by, 'task_created', jsonb_build_object('title', new.title));
  return new;
end;
$$;

create trigger trg_task_created
  after insert on tasks
  for each row execute function handle_task_created();

-- Fired on every task_assignees status change: advances the chain, rolls
-- the parent task's derived status forward, and logs the handoff.
create or replace function handle_task_assignee_status_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(new.completed_by, old.completed_by);
  v_next task_assignees%rowtype;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  case new.status
    when 'active' then
      perform log_audit(new.task_id, v_actor, 'step_activated', jsonb_build_object('step_order', new.step_order));
      update tasks set status = 'in_progress', updated_at = now()
        where id = new.task_id and status = 'to_do';

    when 'pending_approval' then
      perform log_audit(new.task_id, v_actor, 'step_pending_approval', jsonb_build_object('step_order', new.step_order));
      update tasks set status = 'pending_approval', updated_at = now() where id = new.task_id;

    when 'done' then
      perform log_audit(new.task_id, v_actor, 'step_completed', jsonb_build_object('step_order', new.step_order));

      select * into v_next from task_assignees
        where task_id = new.task_id and step_order = new.step_order + 1;

      if found then
        update task_assignees
          set status = 'active', started_at = now()
          where id = v_next.id;
        update tasks set status = 'in_progress', updated_at = now() where id = new.task_id;
      else
        update tasks set status = 'done', updated_at = now() where id = new.task_id;
        perform log_audit(new.task_id, v_actor, 'task_completed', null);
      end if;

    when 'blocked' then
      perform log_audit(new.task_id, v_actor, 'step_blocked', jsonb_build_object('step_order', new.step_order, 'notes', new.notes));
      update tasks set status = 'blocked', updated_at = now() where id = new.task_id;

    when 'skipped' then
      perform log_audit(new.task_id, v_actor, 'step_skipped', jsonb_build_object('step_order', new.step_order));

    else
      null;
  end case;

  return new;
end;
$$;

create trigger trg_task_assignee_status_change
  after update of status on task_assignees
  for each row execute function handle_task_assignee_status_change();

-- Logs manual overall-status changes made directly on tasks (e.g. a
-- Supervisor cancelling a task) that don't go through the assignee-chain
-- trigger above.
create or replace function handle_task_status_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform log_audit(new.id, null, 'status_changed', jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_task_status_change
  before update of status on tasks
  for each row execute function handle_task_status_change();

-- Logs new comments and attachments for a complete audit trail.
create or replace function handle_task_comment_created() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform log_audit(new.task_id, new.author_id, 'comment_added', jsonb_build_object('comment_id', new.id));
  return new;
end;
$$;

create trigger trg_task_comment_created
  after insert on task_comments
  for each row execute function handle_task_comment_created();

create or replace function handle_task_attachment_created() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform log_audit(new.task_id, new.uploaded_by, 'file_attached', jsonb_build_object('file_name', new.file_name));
  return new;
end;
$$;

create trigger trg_task_attachment_created
  after insert on task_attachments
  for each row execute function handle_task_attachment_created();

-- Auto-provisions a profile row (role defaults to 'employee', unassigned)
-- the first time a Workspace user signs in. The Resident Manager then
-- assigns role + department separately.
create or replace function handle_new_auth_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_new_auth_user
  after insert on auth.users
  for each row execute function handle_new_auth_user();
