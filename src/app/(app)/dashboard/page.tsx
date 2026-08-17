import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { getPreview } from "@/lib/get-preview";
import { getDepartments, getFullAccountDepartments } from "@/lib/queries";
import {
  getCompletionRate,
  getDepartmentHealthGrid,
  getNeedsAttentionTasks,
  getAnnouncements,
} from "@/lib/dashboard-queries";
import { createClient } from "@/lib/supabase/server";
import { CompletionRateCard } from "@/components/dashboard/completion-rate-card";
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
    const [today, week, month, health, needsAttention, announcements] = await Promise.all([
      getCompletionRate(1),
      getCompletionRate(7),
      getCompletionRate(30),
      getDepartmentHealthGrid(departments),
      getNeedsAttentionTasks(),
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
        // Stored as plain text[] columns — only ever written by
        // widget-catalog.tsx using BossDashboardWidget values, so this
        // narrowing reflects a real app-level invariant the DB schema
        // itself doesn't (and can't, for a text[] column) express.
        enabledWidgets = prefs.enabled_widgets as BossDashboardWidget[];
        widgetOrder = prefs.widget_order as BossDashboardWidget[];
      }
    }

    const widgetMap: Record<BossDashboardWidget, ReactNode> = {
      completion_rate: <CompletionRateCard today={today} week={week} month={month} />,
      needs_attention: (
        <TaskMiniList
          title="Needs attention"
          emptyLabel="Nothing overdue, blocked, or due soon."
          items={needsAttention.map((t) => ({
            id: t.id,
            title: t.title,
            meta:
              t.reason === "overdue"
                ? "Overdue"
                : t.reason === "blocked"
                  ? "Blocked"
                  : t.deadline
                    ? `Due ${new Date(t.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                    : "",
          }))}
        />
      ),
      announcements: <AnnouncementsFeed items={announcements} currentUserId={profile.id} canModerate />,
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
            // department_tiles needs room to list every department (this
            // company has 14, with genuinely long names) — forcing it into
            // a 50/50 split next to a small stat card never looks balanced,
            // so it always takes the full row. Everything else pairs up
            // normally at half-width.
            <div key={w} className={w === "department_tiles" ? "lg:col-span-2" : ""}>
              {widgetMap[w]}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <DepartmentDashboard departmentId={profile.department_id} departmentName={current.department?.name ?? null} />;
}
