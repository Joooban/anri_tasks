import { createClient } from "@/lib/supabase/server";
import type { AdminRole } from "@/lib/types";
import type { AdminPermission } from "@/lib/permissions";

export interface AdminRoleWithPermissions extends AdminRole {
  permissions: AdminPermission[];
}

export async function getAdminRoles(): Promise<AdminRoleWithPermissions[]> {
  const supabase = await createClient();
  const [{ data: roles }, { data: perms }] = await Promise.all([
    supabase.from("admin_roles").select("*").order("name"),
    supabase.from("admin_role_permissions").select("role_id,permission"),
  ]);

  const permsByRole = new Map<string, AdminPermission[]>();
  for (const p of perms ?? []) {
    const list = permsByRole.get(p.role_id) ?? [];
    list.push(p.permission as AdminPermission);
    permsByRole.set(p.role_id, list);
  }

  return (roles ?? []).map((r) => ({ ...r, permissions: permsByRole.get(r.id) ?? [] }));
}

export interface PendingApprovalItem {
  id: string;
  target_profile_id: string;
  target: { full_name: string | null; email: string; nickname: string | null } | null;
  requestedRole: { name: string } | null;
  requestedBy: { full_name: string | null; email: string; nickname: string | null } | null;
  created_at: string;
}

// requires is_any_admin() per admin_approval_requests_select (0027) — an
// empty result for a non-admin caller just means they can't see any, not
// that none exist.
export async function getPendingApprovalRequests(): Promise<PendingApprovalItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_approval_requests")
    .select(
      "id,target_profile_id,created_at,target:profiles!admin_approval_requests_target_profile_id_fkey(full_name,email,nickname),requestedRole:admin_roles(name),requestedBy:profiles!admin_approval_requests_requested_by_fkey(full_name,email,nickname)"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as PendingApprovalItem[];
}

// Count-only variant of getPendingApprovalRequests, for the sidebar badge —
// avoids pulling every request's target/requester names just to show a
// number. Same RLS scoping (admin_approval_requests_select, is_any_admin());
// callers should still gate on the approve_admin_requests permission
// specifically before showing this, since seeing a count isn't the same as
// being able to act on it.
export async function getPendingApprovalCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("admin_approval_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}

export interface AdminAuditEntry {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
  actor: { full_name: string | null; email: string; nickname: string | null } | null;
}

// task_id is null for every admin-management action (see the new RPCs in
// 0027) — distinct from the per-task audit trail shown on History/task
// detail pages. RLS (audit_log_select, tightened in 0027) already restricts
// the null branch to is_any_admin().
export async function getAdminAuditLog(limit = 100): Promise<AdminAuditEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id,action,details,created_at,actor:profiles(full_name,email,nickname)")
    .is("task_id", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as AdminAuditEntry[];
}
