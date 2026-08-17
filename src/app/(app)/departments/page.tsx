import { redirect } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { getFullAccountDepartments } from "@/lib/queries";
import { getMyPermissions, hasAnyPermission } from "@/lib/get-permissions";
import {
  getDepartmentHealthGrid,
  getCompletionRateTrend,
  getUpcomingBirthdays,
  getDocumentTemplates,
  type TrendBucket,
} from "@/lib/dashboard-queries";
import { HEALTH_COLORS } from "@/lib/constants";
import { Card, CardTitle } from "@/components/ui/card";
import { CompletionTrendChart } from "@/components/dashboard/completion-trend-chart";
import { UpcomingBirthdaysCard } from "@/components/departments/upcoming-birthdays-card";
import { DocumentTemplatesCard } from "@/components/departments/document-templates-card";

const TREND_BUCKETS: { value: TrendBucket; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ trend?: string }>;
}) {
  const current = await getCurrentProfile();
  if (!current) redirect("/login");

  const permissions = await getMyPermissions();
  if (!hasAnyPermission(permissions)) {
    redirect("/dashboard");
  }

  const { trend: trendParam } = await searchParams;
  const trend: TrendBucket = TREND_BUCKETS.some((b) => b.value === trendParam) ? (trendParam as TrendBucket) : "week";

  const departments = await getFullAccountDepartments();
  const [health, trendPoints, birthdays, templates] = await Promise.all([
    getDepartmentHealthGrid(departments),
    getCompletionRateTrend(trend),
    getUpcomingBirthdays(),
    getDocumentTemplates(),
  ]);

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
              {item.overdueCount} overdue · {item.blockedCount} blocked · {item.dueSoonCount} due soon ·{" "}
              {item.doneThisWeekCount} done this week
            </p>
          </Link>
        ))}
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <CardTitle>Completion rate trend</CardTitle>
          <div className="flex gap-1">
            {TREND_BUCKETS.map((b) => (
              <Link
                key={b.value}
                href={`/departments?trend=${b.value}`}
                className={clsx(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  trend === b.value
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                )}
              >
                {b.label}
              </Link>
            ))}
          </div>
        </div>
        <CompletionTrendChart points={trendPoints} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <UpcomingBirthdaysCard items={birthdays} />
        <DocumentTemplatesCard items={templates} canManage={permissions.has("manage_document_templates")} />
      </div>
    </div>
  );
}
