import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { getFullAccountDepartments } from "@/lib/queries";
import { getDepartmentHealthGrid } from "@/lib/dashboard-queries";
import { HEALTH_COLORS } from "@/lib/constants";

export default async function DepartmentsPage() {
  const current = await getCurrentProfile();
  if (!current) redirect("/login");
  if (current.profile.role !== "boss_boss" && current.profile.role !== "supervisor") {
    redirect("/dashboard");
  }

  const departments = await getFullAccountDepartments();
  const health = await getDepartmentHealthGrid(departments);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Company Overview</h1>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {health.map((item) => (
          <Link
            key={item.department.id}
            href={`/departments/${item.department.slug}`}
            className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {item.department.name}
              </span>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${HEALTH_COLORS[item.health]}`} />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {item.overdueCount} overdue · {item.blockedCount} blocked · {item.dueSoonCount} due soon
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
