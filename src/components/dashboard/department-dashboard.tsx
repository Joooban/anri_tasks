import {
  getCompletionRate,
  getOverdueAndBlockedTasks,
  getUpcomingDeadlines,
  getAnnouncements,
  getRecentlyCompleted,
} from "@/lib/dashboard-queries";
import { createClient } from "@/lib/supabase/server";
import { CompletionRateCard } from "@/components/dashboard/completion-rate-card";
import { TaskMiniList } from "@/components/dashboard/task-mini-list";
import { AnnouncementsFeed } from "@/components/dashboard/announcements-feed";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";

export async function DepartmentDashboard({
  departmentId,
  departmentName,
}: {
  departmentId: string | null;
  departmentName: string | null;
}) {
  if (!departmentId) {
    return (
      <EmptyState>
        <p>No department assigned yet. Contact the Resident Manager.</p>
      </EmptyState>
    );
  }

  const [week, month, overdueBlocked, upcoming, announcements, completed] = await Promise.all([
    getCompletionRate(7, departmentId),
    getCompletionRate(30, departmentId),
    getOverdueAndBlockedTasks(departmentId),
    getUpcomingDeadlines(14, departmentId),
    getAnnouncements(departmentId),
    getRecentlyCompleted(8, departmentId),
  ]);

  const supabase = await createClient();
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const soon = new Date(nowDate.getTime() + 14 * 86_400_000).toISOString();
  const { data: meetings } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("department_id", departmentId)
    .gte("start_at", now)
    .lte("start_at", soon)
    .order("start_at")
    .limit(5);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {departmentName ?? "Department"} Dashboard
      </h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <CompletionRateCard week={week} month={month} />

        <Card>
          <CardTitle className="mb-3">Upcoming meetings</CardTitle>
          {!meetings || meetings.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No meetings scheduled.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {meetings.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-zinc-800 dark:text-zinc-200">{m.title}</span>
                  <span className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(m.start_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    {m.meeting_link && (
                      <a
                        href={m.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded bg-blue-600 px-2 py-0.5 text-white hover:bg-blue-700"
                      >
                        Join
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <TaskMiniList
          title="Overdue & blocked"
          emptyLabel="Nothing overdue or blocked. 🎉"
          items={overdueBlocked.map((t) => ({
            id: t.id,
            title: t.title,
            meta: t.status === "blocked" ? "Blocked" : "Overdue",
          }))}
        />

        <TaskMiniList
          title="Upcoming deadlines (14 days)"
          emptyLabel="No deadlines in the next two weeks."
          items={upcoming.map((t) => ({
            id: t.id,
            title: t.title,
            meta: new Date(t.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          }))}
        />

        <TaskMiniList
          title="Recently done"
          emptyLabel="No completed tasks yet."
          items={completed.map((t) => ({
            id: t.id,
            title: t.title,
            meta: new Date(t.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          }))}
        />

        <div className="lg:col-span-2">
          <AnnouncementsFeed items={announcements} />
        </div>
      </div>
    </div>
  );
}
