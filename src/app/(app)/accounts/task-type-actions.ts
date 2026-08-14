"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/friendly-error";

// Relies on the task_types_write RLS policy (0003_rls.sql), which is
// already scoped to is_boss_or_supervisor() on both USING and WITH CHECK —
// unlike the policies removed in 0019, there's no column-tampering risk
// here (any value written still requires being boss_boss/supervisor), so
// this doesn't need the RPC pattern the way role/task/announcement writes
// do. Same approach as updateAccount (accounts/actions.ts).

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Not signed in." } as const;

  const { data: caller } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!caller || (caller.role !== "boss_boss" && caller.role !== "supervisor")) {
    return { supabase, error: "Only the President or Supervisors can manage task types." } as const;
  }
  return { supabase, error: null } as const;
}

export async function addTaskType(name: string, color: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Enter a name." };

  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { error } = await supabase.from("task_types").insert({ name: trimmed, color: color || "zinc" });
  if (error) return { error: friendlyError(error, "We couldn't add that task type") };
  revalidatePath("/accounts");
  revalidatePath("/tasks/new");
  return { error: null };
}

export async function deleteTaskType(id: string) {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { error } = await supabase.from("task_types").delete().eq("id", id);
  if (error) return { error: friendlyError(error, "We couldn't delete that task type") };
  revalidatePath("/accounts");
  revalidatePath("/tasks/new");
  return { error: null };
}
