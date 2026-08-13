"use client";

import { useState, useTransition } from "react";
import { saveBossDashboardPrefs } from "@/app/(app)/dashboard/actions";
import { BOSS_DASHBOARD_WIDGETS, BOSS_DASHBOARD_WIDGET_LABELS, type BossDashboardWidget } from "@/lib/types";

export function WidgetCatalog({
  enabledWidgets,
  widgetOrder,
}: {
  enabledWidgets: BossDashboardWidget[];
  widgetOrder: BossDashboardWidget[];
}) {
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState(widgetOrder);
  const [enabled, setEnabled] = useState(new Set(enabledWidgets));
  const [pending, startTransition] = useTransition();

  function toggle(widget: BossDashboardWidget) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(widget)) next.delete(widget);
      else next.add(widget);
      return next;
    });
  }

  function move(widget: BossDashboardWidget, dir: -1 | 1) {
    setOrder((prev) => {
      const index = prev.indexOf(widget);
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      await saveBossDashboardPrefs(order.filter((w) => enabled.has(w)), order);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Customize
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Customize dashboard widgets
      </p>
      <ul className="flex flex-col gap-1.5">
        {order.map((widget) => (
          <li
            key={widget}
            className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-1.5 dark:bg-zinc-800/50"
          >
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={enabled.has(widget)} onChange={() => toggle(widget)} />
              {BOSS_DASHBOARD_WIDGET_LABELS[widget]}
            </label>
            <div className="flex gap-1">
              <button onClick={() => move(widget, -1)} className="rounded p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                ↑
              </button>
              <button onClick={() => move(widget, 1)} className="rounded p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                ↓
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <button
          disabled={pending}
          onClick={save}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Save
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-400">
        Showing {BOSS_DASHBOARD_WIDGETS.length} available widgets. Full custom widget building is a
        phase-2 idea.
      </p>
    </div>
  );
}
