"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/friendly-error";
import type { Role } from "@/lib/types";

// RLS (profiles_admin_write in 0003_rls.sql) already restricts this update
// to boss_boss/supervisor callers — this check is a friendlier first line
// of defense so a non-admin gets a clear message instead of a DB error.
export async function updateAccount(profileId: string, role: Role, departmentId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: caller } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!caller || (caller.role !== "boss_boss" && caller.role !== "supervisor")) {
    return { error: "Only the President or Supervisors can manage accounts." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role, department_id: departmentId })
    .eq("id", profileId);

  if (error) return { error: friendlyError(error, "We couldn't update that account") };
  revalidatePath("/accounts");
  return { error: null };
}
