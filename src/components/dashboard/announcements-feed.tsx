import { Card, CardTitle } from "@/components/ui/card";
import type { AnnouncementItem } from "@/lib/dashboard-queries";

export function AnnouncementsFeed({ items }: { items: AnnouncementItem[] }) {
  return (
    <Card>
      <CardTitle className="mb-3">Announcements</CardTitle>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No announcements yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="border-b border-zinc-100 pb-3 last:border-0 last:pb-0 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                {item.pinned && <span className="text-amber-500">📌</span>}
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{item.title}</p>
              </div>
              <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{item.body}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {item.department?.name ?? "Company-wide"} · {item.author?.full_name ?? item.author?.email} ·{" "}
                {new Date(item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
