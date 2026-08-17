-- Client feedback: downloadable official document templates on Company
-- Overview. Metadata table + a private storage bucket, mirroring
-- task-attachments (0004_seed.sql) — except templates aren't sensitive
-- per-task data, so no application-level encryption here.
--
-- No write RLS policies on the table or bucket, on purpose: all writes go
-- through the service-role client from departments/template-actions.ts,
-- gated by an app-level role check, the same pattern the task-attachment
-- upload path already uses (see the comment there) after a WITH CHECK
-- policy involving a relation lookup silently rejected valid writes
-- elsewhere in this project. Read access is a plain policy since it has no
-- such lookup — just "any authenticated user."
create table document_templates (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_path text not null,
  uploaded_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter table document_templates enable row level security;

create policy document_templates_select on document_templates for select
  to authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'document-templates', 'document-templates', false, 26214400,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do nothing;
