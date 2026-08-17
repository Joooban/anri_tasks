import Link from "next/link";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { departmentColor } from "@/lib/constants";
import { formatDate } from "@/lib/format-datetime";
import type { Task } from "@/lib/types";

export interface TaskListItem extends Task {
  task_type: { name: string; color: string } | null;
  creator_department: { name: string } | null;
  active_assignee_label: string | null;
}

export function TaskCard({ task }: { task: TaskListItem }) {
  const deadline = task.deadline ? formatDate(task.deadline, { month: "short", day: "numeric" }) : null;

  return (
    <Link
      href={`/tasks/${task.id}`}
      className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{task.title}</h3>
        <TaskStatusBadge status={task.status} />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        {task.creator_department && (
          <span className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: departmentColor(task.creator_department_id) }}
            />
            {task.creator_department.name}
          </span>
        )}
        {task.task_type && <span>{task.task_type.name}</span>}
        {deadline && <span>Due {deadline}</span>}
        {task.active_assignee_label && (
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            Waiting on {task.active_assignee_label}
          </span>
        )}
      </div>
    </Link>
  );
}
