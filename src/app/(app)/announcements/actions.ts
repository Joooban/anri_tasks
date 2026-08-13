"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/friendly-error";

export interface PostAnnouncementState {
  error: string | null;
}

export async function postAnnouncement(
  _prevState: PostAnnouncementState,
  formData: FormData
): Promise<PostAnnouncementState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, department_id, role")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "No profile found." };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const pinned = formData.get("pinned") === "on";
  const companyWide = formData.get("company_wide") === "on";
  const publishAtRaw = (formData.get("publish_at") as string) || null;
  const expiresAtRaw = (formData.get("expires_at") as string) || null;
  const canPostCompanyWide = profile.role === "boss_boss" || profile.role === "supervisor";

  // Enforced here, not via a role check in the announcements_insert RLS
  // policy — see the note in tasks/actions.ts createTask for why.
  if (profile.role === "employee") return { error: "Employees can't post announcements." };
  if (companyWide && !canPostCompanyWide) return { error: "Only the President or Supervisors can post company-wide." };
  if (!title || !body) return { error: "Title and body are required." };
  if (!companyWide && !profile.department_id) return { error: "No department to post under." };
  if (publishAtRaw && expiresAtRaw && expiresAtRaw <= publishAtRaw) {
    return { error: "The expiry time has to be after the publish time." };
  }

  const { error } = await supabase.from("announcements").insert({
    department_id: companyWide && canPostCompanyWide ? null : profile.department_id,
    author_id: profile.id,
    title,
    body,
    pinned,
    // Leave unset to post immediately (column defaults to now()); a future
    // timestamp here holds the announcement back until that moment.
    ...(publishAtRaw ? { publish_at: publishAtRaw } : {}),
    // Leave unset for an announcement with no expiry.
    expires_at: expiresAtRaw,
  });

  if (error) return { error: friendlyError(error, "We couldn't post the announcement") };
  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  return { error: null };
}
