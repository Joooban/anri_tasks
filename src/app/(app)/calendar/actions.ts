"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/friendly-error";

export interface CreateMeetingState {
  error: string | null;
}

export async function createMeeting(
  _prevState: CreateMeetingState,
  formData: FormData
): Promise<CreateMeetingState> {
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
  const startAt = String(formData.get("start_at") ?? "");
  const endAt = (formData.get("end_at") as string) || null;
  const meetingLink = (formData.get("meeting_link") as string) || null;
  const description = (formData.get("description") as string) || null;
  const isCompanyWide = formData.get("company_wide") === "on";
  const canPostCompanyWide = profile.role === "boss_boss" || profile.role === "supervisor";

  // Fast-fail checks for a friendlier error before hitting the DB — the
  // RPC (create_meeting_rpc, see 0014) re-validates all of this itself
  // regardless, since a client-side check is UX only.
  if (profile.role === "employee") return { error: "Employees can't add meetings." };
  if (isCompanyWide && !canPostCompanyWide) return { error: "Only the President or Supervisors can post company-wide." };
  if (!title || !startAt) return { error: "Title and start time are required." };

  const { data: eventId, error } = await supabase.rpc("create_meeting_rpc", {
    p_title: title,
    p_description: description,
    p_start_at: new Date(startAt).toISOString(),
    p_end_at: endAt ? new Date(endAt).toISOString() : null,
    p_meeting_link: meetingLink,
    p_company_wide: isCompanyWide,
  });

  if (error || !eventId) return { error: friendlyError(error, "We couldn't save that meeting") };
  revalidatePath("/calendar");
  return { error: null };
}
