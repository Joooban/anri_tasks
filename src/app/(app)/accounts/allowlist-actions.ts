"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/friendly-error";

export async function addAllowedEmail(email: string) {
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes("@")) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_allowed_email_rpc", { p_email: trimmed });
  if (error) return { error: friendlyError(error, "We couldn't add that email") };
  revalidatePath("/accounts");
  return { error: null };
}

export async function removeAllowedEmail(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_allowed_email_rpc", { p_email: email });
  if (error) return { error: friendlyError(error, "We couldn't remove that email") };
  revalidatePath("/accounts");
  return { error: null };
}
