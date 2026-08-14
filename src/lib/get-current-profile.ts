import { createClient } from "@/lib/supabase/server";
import type { Department, Profile, Role } from "@/lib/types";

export interface CurrentUser {
  profile: Profile;
  department: Department | null;
}

// Fetches the signed-in user's profile row (role, department) plus their
// department record. Returns null if there is no session or the profile
// row hasn't been provisioned yet by the Resident Manager.
export async function getCurrentProfile(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  // role is a plain `text` column (CHECK-constrained, not a native enum),
  // so the generated type is just `string` — narrowed since every
  // consumer expects the real Role union.
  const typedProfile: Profile = { ...profile, role: profile.role as Role };

  let department: Department | null = null;
  if (profile.department_id) {
    const { data } = await supabase
      .from("departments")
      .select("*")
      .eq("id", profile.department_id)
      .maybeSingle();
    department = data ?? null;
  }

  return { profile: typedProfile, department };
}
