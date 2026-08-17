import { Card, CardTitle } from "@/components/ui/card";
import type { UpcomingBirthday } from "@/lib/dashboard-queries";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function UpcomingBirthdaysCard({ items }: { items: UpcomingBirthday[] }) {
  return (
    <Card>
      <CardTitle className="mb-3">Upcoming birthdays</CardTitle>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No birthdays on file for the next 30 days — add them from Accounts.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((b) => (
            <li key={b.profileId} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-zinc-800 dark:text-zinc-200">{b.name}</span>
              <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                {b.daysUntil === 0 ? "Today" : `${MONTH_NAMES[b.month - 1]} ${b.day}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
