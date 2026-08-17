import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import clsx from "clsx";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { getPreview } from "@/lib/get-preview";
import { getDepartments, getFullAccountDepartments } from "@/lib/queries";
import { formatDate } from "@/lib/format-datetime";
import {
  getCompletionRate,
  completionRateTrend,
  getAllTimeCompletion,
  getTaskStatusBreakdown,
  getDepartmentCompletionExtremes,
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
    const [today, week, lastWeek, month, lastMonth, allTime, statusBreakdown, extremes, health, needsAttention, announcements] =
      await Promise.all([
        getCompletionRate(1),
        getCompletionRate(7),
        getCompletionRate(7, undefined, 7),
        getCompletionRate(30),
        getCompletionRate(30, undefined, 30),
        getAllTimeCompletion(),
        getTaskStatusBreakdown(),
        getDepartmentCompletionExtremes(30, departments),
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
      completion_rate: (
        <CompletionRateCard
          today={today}
          week={week}
          weekTrend={completionRateTrend(week, lastWeek)}
          month={month}
          monthTrend={completionRateTrend(month, lastMonth)}
          allTime={allTime}
          statusBreakdown={statusBreakdown}
          best={extremes.best}
          worst={extremes.worst}
        />
      ),
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
                    ? `Due ${formatDate(t.deadline, { month: "short", day: "numeric" })}`
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
            // company has 14, with genuinely long names), and the client
            // asked for announcements to span the full row too — both
            // always take the full row rather than a 50/50 split.
            // completion_rate and needs_attention are the only widgets that
            // still pair up 50/50 by default; [&>*]:h-full stretches
            // whichever widget's card to match its row partner's height
            // (a no-op for the full-width ones, since they have no partner).
            <div
              key={w}
              className={clsx("[&>*]:h-full", (w === "department_tiles" || w === "announcements") && "lg:col-span-2")}
            >
              {widgetMap[w]}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <DepartmentDashboard departmentId={profile.department_id} departmentName={current.department?.name ?? null} />;
}
