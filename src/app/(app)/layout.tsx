import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { Sidebar } from "@/components/nav/sidebar";
import { TopBar } from "@/components/nav/top-bar";
import { signOut } from "@/app/actions/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const current = await getCurrentProfile();

  if (!current) {
    // Signed in with Google but no profile row yet (should be auto-created
    // by the handle_new_auth_user trigger) or the session is stale.
    redirect("/login");
  }

  const { profile, department } = current;

  if (profile.role === "employee" && !profile.department_id) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-center dark:bg-zinc-950">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Account pending setup
        </h1>
        <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          You&apos;re signed in as {profile.email}, but your department and role haven&apos;t
          been assigned yet. Contact the Resident Manager to finish setting up your account.
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Sign out
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar role={profile.role} departmentName={department?.name ?? null} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar fullName={profile.full_name} email={profile.email} role={profile.role} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
