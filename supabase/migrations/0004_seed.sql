-- Seed data: department structure from the project brief (section 3) and a
-- starter set of task types. Re-runnable via ON CONFLICT DO NOTHING.

-- ---------------------------------------------------------------------------
-- Full accounts (has_account = true), all top-level for now. The brief lists
-- "Mine Engineering and Tenement" and "Equipment Operations and Motorpool
-- Management" as sub-units but does not say which department they nest
-- under — confirm with the client and set parent_id before go-live.
-- ---------------------------------------------------------------------------
insert into departments (name, slug, has_account, sort_order) values
  ('Community Relations Office', 'community-relations', true, 10),
  ('Tenement and Compliance Systems Office', 'tenement-compliance-systems', true, 20),
  ('Human Resources Office', 'human-resources', true, 30),
  ('General Contractor', 'general-contractor', true, 40),
  ('Mine Operations and Equipment Department', 'mine-operations-equipment', true, 50),
  ('Mine Safety and Health Department', 'mine-safety-health', true, 60),
  ('Mine Environmental Protection and Enhancement Department', 'mine-environmental-protection', true, 70),
  ('Mine Quality Assurance Department', 'mine-quality-assurance', true, 80),
  ('Mine Accounting and Finance Department', 'mine-accounting-finance', true, 90),
  ('Mine Admin and Technical Service Department', 'mine-admin-technical-service', true, 100),
  ('Mine Engineering and Tenement', 'mine-engineering-tenement', true, 110),
  ('Equipment Operations and Motorpool Management', 'equipment-operations-motorpool', true, 120)
on conflict (slug) do nothing;

-- Filter-tag sub-units under General Contractor (no separate login; the
-- account holder filters by these tags).
insert into departments (name, slug, parent_id, has_account, sort_order)
select 'Mine Production and Shipment Department', 'mine-production-shipment', id, false, 10
from departments where slug = 'general-contractor'
on conflict (slug) do nothing;

insert into departments (name, slug, parent_id, has_account, sort_order)
select 'Mine Admin and Equipment Department', 'mine-admin-equipment', id, false, 20
from departments where slug = 'general-contractor'
on conflict (slug) do nothing;

-- NOTE: the brief also mentions "various deeper sub-boxes across
-- departments" (Safety/Health Sections, Planning & Cost Control, Tenement &
-- Survey, Equipment Operations/Maintenance, Pollution Control, Forestry &
-- Nursery, Mine Security, Construction & General Services, Admin
-- Management, Property/Asset/Supply) without specifying which parent
-- department each nests under. Deliberately NOT seeded here to avoid
-- guessing the org chart wrong — confirm the mapping with the client, then
-- add them as `insert into departments (..., parent_id, has_account) ...`
-- rows pointing at the correct parent.

-- ---------------------------------------------------------------------------
-- Task types — placeholder categories pending client confirmation (see
-- project brief open items). Editable by Supervisor/Boss from the app.
-- ---------------------------------------------------------------------------
insert into task_types (name, color) values
  ('General', 'zinc'),
  ('Maintenance', 'amber'),
  ('Compliance', 'blue'),
  ('Safety', 'red'),
  ('Administrative', 'violet'),
  ('Operations', 'emerald')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Private storage bucket for task attachments — never public, always
-- accessed via short-lived signed URLs from the app.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

-- Storage RLS: any user who can view the parent task can read/write its
-- attachment files. Path convention enforced by the app: task-attachments/<task_id>/<filename>.
create policy task_attachments_storage_select on storage.objects for select
  to authenticated using (
    bucket_id = 'task-attachments'
    and can_view_task((storage.foldername(name))[1]::uuid)
  );

create policy task_attachments_storage_insert on storage.objects for insert
  to authenticated with check (
    bucket_id = 'task-attachments'
    and can_view_task((storage.foldername(name))[1]::uuid)
  );

create policy task_attachments_storage_delete on storage.objects for delete
  to authenticated using (
    bucket_id = 'task-attachments'
    and (is_boss_or_supervisor() or owner = auth.uid())
  );
