import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { getPreview } from "@/lib/get-preview";
import { getDepartments } from "@/lib/queries";
import { AppShell } from "@/components/nav/app-shell";
import { SignOutButton } from "@/components/nav/sign-out-button";

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
        <SignOutButton className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200" />
      </div>
    );
  }

  const canPreview = profile.role === "boss_boss" || profile.role === "supervisor";
  const preview = canPreview ? await getPreview() : null;
  const departments = canPreview ? await getDepartments() : [];
  const previewDepartment = preview ? departments.find((d) => d.id === preview.departmentId) : null;

  // What the Sidebar renders is driven by the effective (possibly
  // previewed) role/department. Real identity — used for auth, RLS, and
  // everything the server actions do — never changes; this only swaps what
  // gets rendered.
  const effectiveRole = preview?.role ?? profile.role;
  const effectiveDepartmentName = preview ? (previewDepartment?.name ?? null) : (department?.name ?? null);

  return (
    <AppShell
      role={effectiveRole}
      departmentName={effectiveDepartmentName}
      canPreview={canPreview}
      isPreviewing={preview !== null}
      departments={departments}
      fullName={profile.full_name}
      email={profile.email}
      topBarRole={profile.role}
      previewInfo={preview && previewDepartment ? { role: preview.role, departmentName: previewDepartment.name } : null}
    >
      {children}
    </AppShell>
  );
}
