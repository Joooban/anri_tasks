"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/friendly-error";
import { nullableRpcArg } from "@/lib/rpc-utils";
import type { Role } from "@/lib/types";

// Authorization now lives in update_account_rpc (has_permission('manage_accounts'))
// rather than a plain RLS-gated .update() — see 0027_admin_roles_and_permissions.sql
// for why (profiles_admin_write was dropped in that migration, same class of
// fix as 0019: a write policy left active after its writes move to an RPC
// stays fully callable with no restriction on which columns get set).
export async function updateAccount(
  profileId: string,
  role: Role,
  departmentId: string | null,
  birthdayMonth: number | null,
  birthdayDay: number | null
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_account_rpc", {
    p_profile_id: profileId,
    p_role: role,
    p_department_id: nullableRpcArg(departmentId),
    p_birthday_month: nullableRpcArg(birthdayMonth),
    p_birthday_day: nullableRpcArg(birthdayDay),
  });

  if (error) return { error: friendlyError(error, "We couldn't update that account") };
  revalidatePath("/accounts");
  revalidatePath("/departments");
  return { error: null };
}

// Returns { status: "applied" } or { status: "pending", request_id } — a
// grant of a requires_approval role by a non-boss_boss/supervisor caller
// creates a pending admin_approval_requests row instead of applying right
// away (assign_admin_role_rpc, 0027).
export async function assignAdminRole(profileId: string, adminRoleId: string | null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_admin_role_rpc", {
    p_profile_id: profileId,
    p_admin_role_id: nullableRpcArg(adminRoleId),
  });

  if (error) return { error: friendlyError(error, "We couldn't update that account's Admin role"), status: null };
  revalidatePath("/accounts");
  return { error: null, status: (data as { status: "applied" | "pending" } | null)?.status ?? null };
}

export async function removeUser(profileId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_user_rpc", { p_profile_id: profileId });
  if (error) return { error: friendlyError(error, "We couldn't remove that account") };
  revalidatePath("/accounts");
  return { error: null };
}

export async function reactivateUser(profileId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reactivate_user_rpc", { p_profile_id: profileId });
  if (error) return { error: friendlyError(error, "We couldn't reactivate that account") };
  revalidatePath("/accounts");
  return { error: null };
}
