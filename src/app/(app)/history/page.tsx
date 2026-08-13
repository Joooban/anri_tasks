import { createClient } from "@/lib/supabase/server";
import { getFullAccountDepartments } from "@/lib/queries";
import { HistoryItem } from "@/components/history/history-item";
import { EmptyState } from "@/components/ui/card";
import clsx from "clsx";
import Link from "next/link";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string }>;
}) {
  const { department } = await searchParams;
  const supabase = await createClient();
  const departments = await getFullAccountDepartments();

  let query = supabase
    .from("tasks")
    .select("id,title,status,updated_at,creator_department_id,creator_department:departments(name)")
    .in("status", ["done", "cancelled"])
    .order("updated_at", { ascending: false })
    .limit(100);

  if (department) query = query.eq("creator_department_id", department);

  const { data: tasks } = await query;
  const taskIds = (tasks ?? []).map((t) => t.id);

  const { data: auditRows } = taskIds.length
    ? await supabase
        .from("audit_log")
        .select("id,task_id,action,created_at,actor:profiles(full_name,email)")
        .in("task_id", taskIds)
        .order("created_at")
    : { data: [] };

  const auditByTask = new Map<string, typeof auditRows>();
  for (const row of auditRows ?? []) {
    const list = auditByTask.get(row.task_id) ?? [];
    list.push(row);
    auditByTask.set(row.task_id, list);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">History</h1>

      <div className="flex flex-wrap gap-1.5">
        <Link
          href="/history"
          className={clsx(
            "rounded-full px-3 py-1 text-xs font-medium",
            !department
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
          )}
        >
          All departments
        </Link>
        {departments.map((d) => (
          <Link
            key={d.id}
            href={`/history?department=${d.id}`}
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-medium",
              department === d.id
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
            )}
          >
            {d.name}
          </Link>
        ))}
      </div>

      {!tasks || tasks.length === 0 ? (
        <EmptyState>
          <p>No completed or cancelled tasks yet.</p>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((t) => (
            <HistoryItem
              key={t.id}
              id={t.id}
              title={t.title}
              status={t.status}
              departmentName={(t.creator_department as unknown as { name: string } | null)?.name ?? null}
              updatedAt={t.updated_at}
              auditLog={(auditByTask.get(t.id) ?? []) as never}
            />
          ))}
        </div>
      )}
    </div>
  );
}
