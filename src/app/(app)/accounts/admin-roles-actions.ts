"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/friendly-error";
import type { AdminPermission } from "@/lib/permissions";

export async function createAdminRole(
  name: string,
  description: string,
  permissions: AdminPermission[],
  requiresApproval: boolean
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_admin_role_rpc", {
    p_name: name,
    p_description: description,
    p_permissions: permissions,
    p_requires_approval: requiresApproval,
  });

  if (error) return { error: friendlyError(error, "We couldn't create that role") };
  revalidatePath("/accounts");
  return { error: null };
}

export async function updateAdminRole(
  roleId: string,
  name: string,
  description: string,
  permissions: AdminPermission[],
  requiresApproval: boolean
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_admin_role_rpc", {
    p_role_id: roleId,
    p_name: name,
    p_description: description,
    p_permissions: permissions,
    p_requires_approval: requiresApproval,
  });

  if (error) return { error: friendlyError(error, "We couldn't update that role") };
  revalidatePath("/accounts");
  return { error: null };
}

export async function deleteAdminRole(roleId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_admin_role_rpc", { p_role_id: roleId });
  if (error) return { error: friendlyError(error, "We couldn't delete that role") };
  revalidatePath("/accounts");
  return { error: null };
}
