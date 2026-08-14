"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/encryption";
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

  // Fast-fail checks for a friendlier error before hitting the DB — the
  // RPC (create_announcement_rpc, see 0014) re-validates all of this
  // itself regardless, since a client-side check is UX only.
  if (profile.role === "employee") return { error: "Employees can't post announcements." };
  if (companyWide && !canPostCompanyWide) return { error: "Only the President or Supervisors can post company-wide." };
  if (!title || !body) return { error: "Title and body are required." };
  if (!companyWide && !profile.department_id) return { error: "No department to post under." };
  if (publishAtRaw && expiresAtRaw && expiresAtRaw <= publishAtRaw) {
    return { error: "The expiry time has to be after the publish time." };
  }

  const { data: announcementId, error } = await supabase.rpc("create_announcement_rpc", {
    p_title: encrypt(title),
    p_body: encrypt(body),
    p_pinned: pinned,
    p_company_wide: companyWide,
    p_publish_at: publishAtRaw,
    p_expires_at: expiresAtRaw,
  });

  if (error || !announcementId) return { error: friendlyError(error, "We couldn't post the announcement") };
  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateAnnouncement(
  _prevState: PostAnnouncementState,
  formData: FormData
): Promise<PostAnnouncementState> {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const pinned = formData.get("pinned") === "on";
  const publishAtRaw = (formData.get("publish_at") as string) || null;
  const expiresAtRaw = (formData.get("expires_at") as string) || null;

  if (!id) return { error: "Missing announcement." };
  if (!title || !body) return { error: "Title and body are required." };
  if (publishAtRaw && expiresAtRaw && expiresAtRaw <= publishAtRaw) {
    return { error: "The expiry time has to be after the publish time." };
  }

  const { error } = await supabase.rpc("update_announcement_rpc", {
    p_id: id,
    p_title: encrypt(title),
    p_body: encrypt(body),
    p_pinned: pinned,
    p_publish_at: publishAtRaw,
    p_expires_at: expiresAtRaw,
  });

  if (error) return { error: friendlyError(error, "We couldn't update the announcement") };
  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteAnnouncement(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_announcement_rpc", { p_id: id });
  if (error) return { error: friendlyError(error, "We couldn't delete the announcement") };
  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  return { error: null };
}
