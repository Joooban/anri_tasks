import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { getPreview } from "@/lib/get-preview";
import { getDepartments, getFullAccountDepartments } from "@/lib/queries";
import {
  getCompletionRate,
  getDepartmentHealthGrid,
  getOverdueAndBlockedTasks,
  getUpcomingDeadlines,
  getAnnouncements,
} from "@/lib/dashboard-queries";
import { createClient } from "@/lib/supabase/server";
import { CompletionRateCard } from "@/components/dashboard/completion-rate-card";
import { DepartmentHealthGrid } from "@/components/dashboard/department-health-grid";
import { DepartmentTiles } from "@/components/dashboard/department-tiles";
import { TaskMiniList } from "@/components/dashboard/task-mini-list";
import { AnnouncementsFeed } from "@/components/dashboard/announcements-feed";
import { WidgetCatalog } from "@/components/dashboard/widget-catalog";
import { DepartmentDashboard } from "@/components/dashboard/department-dashboard";
import { BOSS_DASHBOARD_WIDGETS, type BossDashboardWidget } from "@/lib/types";

export default async function DashboardPage() {
  const current = await getCurrentProfile();
  if (!current) redirect("/login");
  const { profile } = current;

  const preview =
    profile.role === "boss_boss" || profile.role === "supervisor" ? await getPreview() : null;

  if (preview) {
    const departments = await getDepartments();
    const previewDepartment = departments.find((d) => d.id === preview.departmentId);
    return (
      <DepartmentDashboard
        departmentId={preview.departmentId}
        departmentName={previewDepartment?.name ?? null}
      />
    );
  }

  if (profile.role === "boss_boss" || profile.role === "supervisor") {
    const departments = await getFullAccountDepartments();
    const [week, month, health, overdueBlocked, upcoming, announcements] = await Promise.all([
      getCompletionRate(7),
      getCompletionRate(30),
      getDepartmentHealthGrid(departments),
      getOverdueAndBlockedTasks(),
      getUpcomingDeadlines(14),
      getAnnouncements(),
    ]);

    let enabledWidgets: BossDashboardWidget[] = [...BOSS_DASHBOARD_WIDGETS];
    let widgetOrder: BossDashboardWidget[] = [...BOSS_DASHBOARD_WIDGETS];

    if (profile.role === "boss_boss") {
      const supabase = await createClient();
      const { data: prefs } = await supabase
        .from("boss_dashboard_prefs")
        .select("*")
        .eq("profile_id", profile.id)
        .maybeSingle();
      if (prefs) {
        enabledWidgets = prefs.enabled_widgets;
        widgetOrder = prefs.widget_order;
      }
    }

    const widgetMap: Record<BossDashboardWidget, ReactNode> = {
      completion_rate: <CompletionRateCard week={week} month={month} />,
      department_health: <DepartmentHealthGrid items={health} />,
      overdue_blocked: (
        <TaskMiniList
          title="Overdue & blocked"
          emptyLabel="Nothing overdue or blocked. 🎉"
          items={overdueBlocked.map((t) => ({
            id: t.id,
            title: t.title,
            meta: t.status === "blocked" ? "Blocked" : t.creator_department?.name ?? "",
          }))}
        />
      ),
      upcoming_deadlines: (
        <TaskMiniList
          title="Upcoming deadlines (14 days)"
          emptyLabel="No deadlines in the next two weeks."
          items={upcoming.map((t) => ({
            id: t.id,
            title: t.title,
            meta: new Date(t.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          }))}
        />
      ),
      announcements: <AnnouncementsFeed items={announcements} />,
      department_tiles: <DepartmentTiles items={health} />,
    };

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {profile.role === "boss_boss" ? "Company Overview" : "Supervisor Dashboard"}
          </h1>
          {profile.role === "boss_boss" && (
            <WidgetCatalog enabledWidgets={enabledWidgets} widgetOrder={widgetOrder} />
          )}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {widgetOrder.filter((w) => enabledWidgets.includes(w)).map((w) => (
            <div key={w} className={w === "department_tiles" || w === "overdue_blocked" ? "lg:col-span-2" : ""}>
              {widgetMap[w]}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <DepartmentDashboard departmentId={profile.department_id} departmentName={current.department?.name ?? null} />;
}
