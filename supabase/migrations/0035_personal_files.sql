-- Client feedback (this session): "a repository for each person to store
-- their files." Scoped with the user as fully private — no admin bypass —
-- same deliberate stance as messaging (0032_messaging.sql): personal
-- storage, not a company record, so nobody but the owner sees it, not even
-- the President.
--
-- Mirrors task-attachments' encrypted-at-rest pattern (tasks/actions.ts,
-- 0004_seed.sql), not document_templates' plain one — this is private
-- personal content, the same class of thing task attachments already are,
-- not a company-wide reference form.
create table personal_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  created_at timestamptz not null default now()
);

create index personal_files_owner_id_idx on personal_files(owner_id);

alter table personal_files enable row level security;

create policy personal_files_select on personal_files for select
  to authenticated using (owner_id = auth.uid());

-- No insert/update/delete policies, on purpose — writes go through the
-- service-role client from profile/files-actions.ts, with ownership
-- checked in application code before every call. Same reasoning as
-- document_templates/task_attachments: a WITH CHECK policy involving a
-- lookup has a documented history in this project of silently rejecting
-- valid writes (see PROJECT_CONTEXT.md), and this table's own check
-- (owner_id = auth.uid()) is trivial enough that the app-level check is
-- just as safe without that risk.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('personal-files', 'personal-files', false, 26214400, array['application/octet-stream'])
on conflict (id) do nothing;

-- Storage path convention: <owner_id>/<uuid>-<filename> — lets these
-- policies check ownership from the path alone, as a defense-in-depth
-- backstop behind the app-level check (same shape as task-attachments'
-- storage policies keying off the task_id folder segment).
create policy personal_files_storage_select on storage.objects for select
  to authenticated using (
    bucket_id = 'personal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy personal_files_storage_insert on storage.objects for insert
  to authenticated with check (
    bucket_id = 'personal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy personal_files_storage_delete on storage.objects for delete
  to authenticated using (
    bucket_id = 'personal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
