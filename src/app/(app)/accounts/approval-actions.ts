"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/friendly-error";

export async function approveAdminRoleRequest(requestId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_admin_role_request_rpc", { p_request_id: requestId });
  if (error) return { error: friendlyError(error, "We couldn't approve that request") };
  revalidatePath("/accounts");
  return { error: null };
}

export async function rejectAdminRoleRequest(requestId: string, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_admin_role_request_rpc", { p_request_id: requestId, p_reason: reason });
  if (error) return { error: friendlyError(error, "We couldn't reject that request") };
  revalidatePath("/accounts");
  return { error: null };
}
