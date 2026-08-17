import Link from "next/link";
import { getTaskList, getFullAccountDepartments } from "@/lib/queries";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { getPreview } from "@/lib/get-preview";
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
  searchParams: Promise<{ status?: string; department?: string }>;
}) {
  const { status, department } = await searchParams;
  const current = await getCurrentProfile();
  const preview =
    current?.profile.role === "boss_boss" || current?.profile.role === "supervisor"
      ? await getPreview()
      : null;

  const departments = await getFullAccountDepartments();

  const tasks = await getTaskList({
    status: status && status !== "all" ? status : undefined,
    // The department filter picked from the dropdown below takes priority
    // over the preview department — while previewing, RLS doesn't narrow
    // anything on its own (see comment below), so without an explicit
    // choice it falls back to the department being previewed.
    departmentId: department || preview?.departmentId,
  });
  const canCreate = current?.profile.role !== "employee" && !preview;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Tasks</h1>
        {canCreate && (
          <Link
            href="/tasks/new"
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + New Task
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <Link
              key={s}
              href={{
                pathname: "/tasks",
                query: { ...(s !== "all" ? { status: s } : {}), ...(department ? { department } : {}) },
              }}
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

        <form className="flex items-center gap-1.5">
          {status && <input type="hidden" name="status" value={status} />}
          <select
            name="department"
            defaultValue={department ?? ""}
            className="h-7 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-7 rounded-md bg-zinc-100 px-2.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Filter
          </button>
        </form>
      </div>

      {tasks.length === 0 ? (
        <EmptyState>
          <p>No tasks here yet.</p>
          {canCreate && (
            <Link href="/tasks/new" className="text-zinc-900 underline dark:text-zinc-50">
              Create the first one
            </Link>
          )}
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
