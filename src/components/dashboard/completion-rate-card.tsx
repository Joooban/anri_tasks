import { Card, CardTitle } from "@/components/ui/card";
import type { CompletionRate, DepartmentCompletionSummary } from "@/lib/dashboard-queries";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/types";

const STATUS_ORDER: TaskStatus[] = ["to_do", "in_progress", "pending_approval", "blocked", "done", "cancelled"];

export function CompletionRateCard({
  today,
  week,
  weekTrend,
  month,
  monthTrend,
  allTime,
  statusBreakdown,
  best,
  worst,
}: {
  today?: CompletionRate;
  week: CompletionRate;
  weekTrend?: number | null;
  month: CompletionRate;
  monthTrend?: number | null;
  allTime?: CompletionRate;
  statusBreakdown?: Record<TaskStatus, number>;
  best?: DepartmentCompletionSummary | null;
  worst?: DepartmentCompletionSummary | null;
}) {
  const statCount = 2 + (today ? 1 : 0) + (allTime ? 1 : 0);

  return (
    <Card>
      <CardTitle className="mb-3">Completion rate</CardTitle>
      <div
        className={`grid gap-4 ${
          statCount === 4 ? "grid-cols-2 sm:grid-cols-4" : statCount === 3 ? "grid-cols-3" : "grid-cols-2"
        }`}
      >
        {today && <Stat label="Today" rate={today} />}
        <Stat label="This week" rate={week} trend={weekTrend} />
        <Stat label="This month" rate={month} trend={monthTrend} />
        {allTime && <Stat label="All-time" rate={allTime} />}
      </div>

      {statusBreakdown && (
        <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <p className="mb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">Task breakdown</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
            {STATUS_ORDER.map((s) => (
              <span key={s}>
                {statusBreakdown[s]} {TASK_STATUS_LABELS[s]}
              </span>
            ))}
          </div>
        </div>
      )}

      {(best || worst) && (
        <div className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          {best && (
            <p>
              Top this month: <span className="font-medium text-zinc-900 dark:text-zinc-50">{best.name}</span> (
              {best.percent}%)
            </p>
          )}
          {worst && (
            <p className="mt-0.5">
              Needs focus: <span className="font-medium text-zinc-900 dark:text-zinc-50">{worst.name}</span> (
              {worst.percent}%)
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function Stat({ label, rate, trend }: { label: string; rate: CompletionRate; trend?: number | null }) {
  return (
    <div>
      <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{rate.percent}%</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {label} · {rate.completed}/{rate.total} tasks
        {trend != null && trend !== 0 && (
          <span className={trend > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}>
            {" "}
            {trend > 0 ? "+" : ""}
            {trend}%
          </span>
        )}
      </p>
    </div>
  );
}
