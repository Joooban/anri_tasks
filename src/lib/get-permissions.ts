import { createClient } from "@/lib/supabase/server";
import type { AdminPermission } from "@/lib/permissions";

// One round trip for every permission key the caller currently holds
// (get_my_permissions_rpc — 0027_admin_roles_and_permissions.sql), instead
// of a has_permission() call per key. Returns an empty set for a signed-out
// caller rather than erroring, since several pages call this before their
// own auth check runs.
export async function getMyPermissions(): Promise<Set<AdminPermission>> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_my_permissions_rpc");
  return new Set((data ?? []) as AdminPermission[]);
}

export function hasAnyPermission(permissions: Set<AdminPermission>): boolean {
  return permissions.size > 0;
}
