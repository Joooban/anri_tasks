import { createClient } from "@/lib/supabase/server";
import { getFullAccountDepartments } from "@/lib/queries";
import { HistoryItem } from "@/components/history/history-item";
import { EmptyState } from "@/components/ui/card";
import Link from "next/link";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string; from?: string; to?: string }>;
}) {
  const { department, from, to } = await searchParams;
  const supabase = await createClient();
  const departments = await getFullAccountDepartments();

  let query = supabase
    .from("tasks")
    .select("id,title,status,updated_at,creator_department_id,creator_department:departments(name)")
    .in("status", ["done", "cancelled"])
    .order("updated_at", { ascending: false })
    .limit(100);

  if (department) query = query.eq("creator_department_id", department);
  // Date-only inputs, interpreted as calendar-day bounds server-side — a
  // few hours of timezone fuzziness at the boundary is an acceptable
  // trade-off for a history filter (unlike task deadlines, nothing here
  // depends on exact precision).
  if (from) query = query.gte("updated_at", new Date(`${from}T00:00:00`).toISOString());
  if (to) query = query.lte("updated_at", new Date(`${to}T23:59:59.999`).toISOString());

  const { data: tasks } = await query;
  const taskIds = (tasks ?? []).map((t) => t.id);

  const { data: auditRows } = taskIds.length
    ? await supabase
        .from("audit_log")
        .select("id,task_id,action,created_at,actor:profiles(full_name,email,department:departments(name))")
        .in("task_id", taskIds)
        .order("created_at")
    : { data: [] };

  const auditByTask = new Map<string, typeof auditRows>();
  for (const row of auditRows ?? []) {
    const list = auditByTask.get(row.task_id) ?? [];
    list.push(row);
    auditByTask.set(row.task_id, list);
  }

  const hasFilters = Boolean(department || from || to);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">History</h1>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-1">
          <label htmlFor="department" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Department
          </label>
          <select
            id="department"
            name="department"
            defaultValue={department ?? ""}
            className="h-8 min-w-[10rem] rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            From
          </label>
          <input
            id="from"
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            To
          </label>
          <input
            id="to"
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <button
          type="submit"
          className="flex h-8 items-center rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Filter
        </button>

        {hasFilters && (
          <Link
            href="/history"
            className="flex h-8 items-center rounded-md px-3 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            Clear
          </Link>
        )}
      </form>

      {!tasks || tasks.length === 0 ? (
        <EmptyState>
          <p>{hasFilters ? "No tasks match these filters." : "No completed or cancelled tasks yet."}</p>
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
