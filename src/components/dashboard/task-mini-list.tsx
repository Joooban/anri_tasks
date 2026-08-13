import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";

interface MiniItem {
  id: string;
  title: string;
  meta: string;
}

export function TaskMiniList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: MiniItem[];
  emptyLabel: string;
}) {
  return (
    <Card>
      <CardTitle className="mb-3">{title}</CardTitle>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/tasks/${item.id}`}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <span className="truncate text-zinc-800 dark:text-zinc-200">{item.title}</span>
                <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">{item.meta}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
