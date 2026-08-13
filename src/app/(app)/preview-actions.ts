"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { ROLE_COOKIE, DEPT_COOKIE, type PreviewRole } from "@/lib/get-preview";

export async function setPreview(formData: FormData) {
  const current = await getCurrentProfile();
  if (!current || (current.profile.role !== "boss_boss" && current.profile.role !== "supervisor")) {
    return;
  }

  const role = formData.get("preview_role") as PreviewRole;
  const departmentId = formData.get("preview_department_id") as string;
  if (!role || !departmentId) return;

  const cookieStore = await cookies();
  cookieStore.set(ROLE_COOKIE, role, { path: "/", sameSite: "lax" });
  cookieStore.set(DEPT_COOKIE, departmentId, { path: "/", sameSite: "lax" });
  redirect("/dashboard");
}

export async function clearPreview() {
  const cookieStore = await cookies();
  cookieStore.delete(ROLE_COOKIE);
  cookieStore.delete(DEPT_COOKIE);
  redirect("/dashboard");
}
