-- ANRI Task Management System — core schema
-- Run in order: 0001_schema.sql, 0002_functions_triggers.sql, 0003_rls.sql, 0004_seed.sql

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- departments: self-referencing so a filter-tag sub-unit can be promoted to
-- a full account later by flipping has_account and creating a user, with no
-- schema change.
-- ---------------------------------------------------------------------------
create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references departments(id) on delete set null,
  has_account boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index departments_parent_id_idx on departments(parent_id);

-- ---------------------------------------------------------------------------
-- profiles: one row per auth.users row. Provisioned by the Resident Manager
-- (role + department_id start null/employee until assigned).
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'employee' check (role in ('boss_boss','supervisor','department','employee')),
  department_id uuid references departments(id) on delete set null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create index profiles_department_id_idx on profiles(department_id);

-- ---------------------------------------------------------------------------
-- task_types: lookup table rather than a hardcoded enum — exact categories
-- are still TBD with the client (see project brief open items), so this is
-- editable by Supervisors/Boss without a migration.
-- ---------------------------------------------------------------------------
create table task_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default 'zinc'
);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  task_type_id uuid references task_types(id) on delete set null,
  created_by uuid not null references profiles(id),
  creator_department_id uuid references departments(id),
  deadline timestamptz,
  status text not null default 'to_do' check (status in ('to_do','in_progress','pending_approval','done','blocked','cancelled')),
  is_personal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_status_idx on tasks(status);
create index tasks_deadline_idx on tasks(deadline);
create index tasks_creator_department_id_idx on tasks(creator_department_id);
create index tasks_created_by_idx on tasks(created_by);

-- ---------------------------------------------------------------------------
-- task_assignees: the ordered relay/handoff chain. Exactly one row per step;
-- step 1 starts 'active', the rest start 'pending' and activate in order.
-- ---------------------------------------------------------------------------
create table task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  step_order int not null,
  assignee_type text not null check (assignee_type in ('department','individual')),
  department_id uuid references departments(id),
  profile_id uuid references profiles(id),
  status text not null default 'pending' check (status in ('pending','active','pending_approval','done','blocked','skipped')),
  requires_confirmation boolean not null default false,
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references profiles(id),
  notes text,
  unique (task_id, step_order),
  constraint task_assignees_target_check check (
    (assignee_type = 'department' and department_id is not null and profile_id is null) or
    (assignee_type = 'individual' and profile_id is not null and department_id is null)
  )
);

create index task_assignees_task_id_idx on task_assignees(task_id);
create index task_assignees_department_id_status_idx on task_assignees(department_id, status);
create index task_assignees_profile_id_status_idx on task_assignees(profile_id, status);

-- ---------------------------------------------------------------------------
-- task_visibility: extra viewers beyond the assignee chain (e.g. "visible to
-- this individual employee" without them being a step in the relay).
-- ---------------------------------------------------------------------------
create table task_visibility (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  department_id uuid references departments(id),
  profile_id uuid references profiles(id),
  constraint task_visibility_target_check check (
    (department_id is not null and profile_id is null) or
    (department_id is null and profile_id is not null)
  )
);

create index task_visibility_task_id_idx on task_visibility(task_id);
create index task_visibility_department_id_idx on task_visibility(department_id);
create index task_visibility_profile_id_idx on task_visibility(profile_id);

-- ---------------------------------------------------------------------------
-- task_attachments: metadata only — files live in a private Storage bucket,
-- always served via signed URLs.
-- ---------------------------------------------------------------------------
create table task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index task_attachments_task_id_idx on task_attachments(task_id);

-- ---------------------------------------------------------------------------
-- audit_log: append-only. No update/delete policies are ever defined for
-- this table (see 0003_rls.sql) so history cannot be edited, only appended.
-- ---------------------------------------------------------------------------
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  actor_id uuid references profiles(id),
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_task_id_idx on audit_log(task_id);
create index audit_log_created_at_idx on audit_log(created_at);

-- ---------------------------------------------------------------------------
-- announcements: department_id null = company-wide (Supervisor/Boss only).
-- ---------------------------------------------------------------------------
create table announcements (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references departments(id),
  author_id uuid not null references profiles(id),
  title text not null,
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create index announcements_department_id_idx on announcements(department_id);

-- ---------------------------------------------------------------------------
-- calendar_events: meetings and other non-task calendar entries. Task
-- deadlines are derived from tasks.deadline at query time, not duplicated
-- here.
-- ---------------------------------------------------------------------------
create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  department_id uuid references departments(id),
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  meeting_link text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index calendar_events_start_at_idx on calendar_events(start_at);
create index calendar_events_department_id_idx on calendar_events(department_id);

-- ---------------------------------------------------------------------------
-- task_comments: Supervisors/Boss can comment on any task; assignees and the
-- creator can comment on their own tasks. (Highlight-and-annotate is a
-- phase-2 feature layered on top of this table.)
-- ---------------------------------------------------------------------------
create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index task_comments_task_id_idx on task_comments(task_id);

-- ---------------------------------------------------------------------------
-- boss_dashboard_prefs: one row per Boss Boss user storing which optional
-- widgets are enabled and in what order (toggle/reorder catalog, not a full
-- drag-and-drop builder — see project brief section 7).
-- ---------------------------------------------------------------------------
create table boss_dashboard_prefs (
  profile_id uuid primary key references profiles(id) on delete cascade,
  enabled_widgets text[] not null default array[
    'completion_rate','department_health','overdue_blocked','upcoming_deadlines','announcements','department_tiles'
  ],
  widget_order text[] not null default array[
    'completion_rate','department_health','overdue_blocked','upcoming_deadlines','announcements','department_tiles'
  ]
);
