"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  const canPostCompanyWide = profile.role === "boss_boss" || profile.role === "supervisor";

  if (!title || !body) return { error: "Title and body are required." };
  if (!companyWide && !profile.department_id) return { error: "No department to post under." };

  const { error } = await supabase.from("announcements").insert({
    department_id: companyWide && canPostCompanyWide ? null : profile.department_id,
    author_id: profile.id,
    title,
    body,
    pinned,
  });

  if (error) return { error: error.message };
  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  return { error: null };
}
