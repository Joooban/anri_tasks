import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { getDepartments, getProfiles } from "@/lib/queries";
import { AccountsTable } from "@/components/accounts/accounts-table";

export default async function AccountsPage() {
  const current = await getCurrentProfile();
  if (!current) redirect("/login");
  if (current.profile.role !== "boss_boss" && current.profile.role !== "supervisor") {
    redirect("/dashboard");
  }

  const [profiles, departments] = await Promise.all([getProfiles(), getDepartments()]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Accounts</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Assign role and department for anyone who has signed in. New sign-ins start as an
          unassigned Employee until you set them up here.
        </p>
      </div>
      <AccountsTable profiles={profiles} departments={departments} myProfileId={current.profile.id} />
    </div>
  );
}
