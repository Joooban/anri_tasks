import { Card, CardTitle } from "@/components/ui/card";
import type { CompletionRate } from "@/lib/dashboard-queries";

export function CompletionRateCard({ week, month }: { week: CompletionRate; month: CompletionRate }) {
  return (
    <Card>
      <CardTitle className="mb-3">Completion rate</CardTitle>
      <div className="grid grid-cols-2 gap-4">
        <Stat label="This week" rate={week} />
        <Stat label="This month" rate={month} />
      </div>
    </Card>
  );
}

function Stat({ label, rate }: { label: string; rate: CompletionRate }) {
  return (
    <div>
      <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{rate.percent}%</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {label} · {rate.completed}/{rate.total} tasks
      </p>
    </div>
  );
}
