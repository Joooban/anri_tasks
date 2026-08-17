// Fixed catalog — mirrors the check constraint on admin_role_permissions.permission
// (0027_admin_roles_and_permissions.sql). Not admin-inventable: each key maps to
// real enforcement code (an RLS policy or an RPC's has_permission() check), so a
// key outside this list would just do nothing anywhere in the app.
export const ADMIN_PERMISSIONS = [
  "manage_accounts",
  "manage_departments",
  "manage_task_types",
  "manage_allowlist",
  "manage_document_templates",
  "moderate_announcements",
  "manage_roles",
  "approve_admin_requests",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const ADMIN_PERMISSION_LABELS: Record<AdminPermission, string> = {
  manage_accounts: "Manage accounts (roles, departments, remove users)",
  manage_departments: "Manage departments",
  manage_task_types: "Manage task types",
  manage_allowlist: "Manage the sign-in allowlist",
  manage_document_templates: "Manage document templates",
  moderate_announcements: "Moderate announcements (delete others')",
  manage_roles: "Manage Admin roles & permissions",
  approve_admin_requests: "Approve sensitive Admin role grants",
};
