"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/friendly-error";

// update_my_nickname_rpc only ever touches the caller's own nickname
// column (0034_profile_nickname.sql) — no way to reach role, department,
// or anything else, so this doesn't reopen the self-edit hole that
// profiles_update_self caused (dropped in 0019).
export async function updateNickname(nickname: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_nickname_rpc", { p_nickname: nickname });
  if (error) return { error: friendlyError(error, "We couldn't update your nickname") };
  revalidatePath("/", "layout");
  return { error: null };
}
