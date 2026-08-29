import Link from "next/link";
import clsx from "clsx";
import { Card, CardTitle } from "@/components/ui/card";
import { HEALTH_COLORS, HEALTH_CARD_STYLES } from "@/lib/constants";
import type { DepartmentHealth } from "@/lib/dashboard-queries";

export function DepartmentTiles({ items }: { items: DepartmentHealth[] }) {
  return (
    <Card>
      <CardTitle className="mb-3">Departments</CardTitle>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.department.id}
            href={`/departments/${item.department.slug}`}
            className={clsx(
              "flex flex-col gap-1 rounded-xl border p-3 hover:border-brand hover:shadow-sm dark:hover:border-brand",
              HEALTH_CARD_STYLES[item.health]
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {item.department.name}
              </span>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${HEALTH_COLORS[item.health]}`} />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {item.overdueCount} overdue · {item.blockedCount} blocked · {item.dueSoonCount} due soon ·{" "}
              {item.doneThisWeekCount} done this week
            </p>
          </Link>
        ))}
      </div>
    </Card>
  );
}
