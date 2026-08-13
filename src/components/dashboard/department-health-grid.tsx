import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { HEALTH_COLORS } from "@/lib/constants";
import type { DepartmentHealth } from "@/lib/dashboard-queries";

export function DepartmentHealthGrid({ items }: { items: DepartmentHealth[] }) {
  return (
    <Card>
      <CardTitle className="mb-3">Department health</CardTitle>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.department.id}
            href={`/departments/${item.department.slug}`}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 p-2.5 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
          >
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${HEALTH_COLORS[item.health]}`} />
            <span className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {item.department.name}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
