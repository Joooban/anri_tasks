import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/get-current-profile";

const ROLE_COOKIE = "preview_role";
const DEPT_COOKIE = "preview_department_id";

export type PreviewRole = "department" | "employee";

export interface Preview {
  role: PreviewRole;
  departmentId: string;
}

// Boss/Supervisor can "look through" any department's view without a
// separate login — since they already have full read access via RLS, this
// is purely a UI-layer lens (which dashboard/nav renders), never a real
// permission grant. Stored in cookies so it survives navigation but never
// touches the database. Only ever honored for a real boss_boss/supervisor
// session, even if a stale cookie is somehow present.
export async function getPreview(): Promise<Preview | null> {
  const cookieStore = await cookies();
  const role = cookieStore.get(ROLE_COOKIE)?.value as PreviewRole | undefined;
  const departmentId = cookieStore.get(DEPT_COOKIE)?.value;
  if (!role || !departmentId) return null;

  const current = await getCurrentProfile();
  if (!current || (current.profile.role !== "boss_boss" && current.profile.role !== "supervisor")) {
    return null;
  }

  return { role, departmentId };
}

export { ROLE_COOKIE, DEPT_COOKIE };
