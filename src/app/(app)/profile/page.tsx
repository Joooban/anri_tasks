import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { Card, CardTitle } from "@/components/ui/card";
import { NicknameForm } from "@/components/profile/nickname-form";
import { ROLE_LABELS } from "@/lib/types";

export default async function ProfilePage() {
  const current = await getCurrentProfile();
  if (!current) redirect("/login");

  const { profile, department } = current;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">My Profile</h1>

      <Card>
        <CardTitle className="mb-3">Account</CardTitle>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Signed in as</dt>
            <dd className="text-zinc-900 dark:text-zinc-50">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Role</dt>
            <dd className="text-zinc-900 dark:text-zinc-50">{ROLE_LABELS[profile.role]}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Department</dt>
            <dd className="text-zinc-900 dark:text-zinc-50">{department?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Google account name</dt>
            <dd className="text-zinc-900 dark:text-zinc-50">{profile.full_name || "—"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-zinc-400">
          Role, department, and birthday are managed by an admin — see Accounts.
        </p>
      </Card>

      <Card>
        <CardTitle className="mb-1">Display name</CardTitle>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Shown instead of your Google account name everywhere in the app — comments, tasks,
          messages, and the activity trail. Leave blank to just use your Google name.
        </p>
        <NicknameForm currentNickname={profile.nickname} />
      </Card>
    </div>
  );
}
