import Link from "next/link";
import { getTaskList } from "@/lib/queries";
import { TaskCard } from "@/components/tasks/task-card";
import { EmptyState } from "@/components/ui/card";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/types";
import clsx from "clsx";

const STATUS_FILTERS: (TaskStatus | "all")[] = [
  "all",
  "to_do",
  "in_progress",
  "pending_approval",
  "blocked",
  "done",
  "cancelled",
];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const tasks = await getTaskList({ status: status && status !== "all" ? status : undefined });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Tasks</h1>
        <Link
          href="/tasks/new"
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          + New Task
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((s) => (
          <Link
            key={s}
            href={s === "all" ? "/tasks" : `/tasks?status=${s}`}
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-medium",
              (status ?? "all") === s
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            )}
          >
            {s === "all" ? "All" : TASK_STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      {tasks.length === 0 ? (
        <EmptyState>
          <p>No tasks here yet.</p>
          <Link href="/tasks/new" className="text-zinc-900 underline dark:text-zinc-50">
            Create the first one
          </Link>
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
