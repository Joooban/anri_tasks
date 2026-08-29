import type { StepStatus, TaskStatus } from "@/lib/types";

export const GOOGLE_WORKSPACE_DOMAIN = process.env.NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN ?? "";

export const TASK_STATUS_BADGE: Record<TaskStatus, string> = {
  to_do: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  pending_approval: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  blocked: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  cancelled: "bg-zinc-200 text-zinc-500 line-through dark:bg-zinc-800 dark:text-zinc-500",
};

export const STEP_STATUS_BADGE: Record<StepStatus, string> = {
  pending: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  active: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  pending_approval: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  blocked: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  skipped: "bg-zinc-200 text-zinc-500 line-through dark:bg-zinc-800 dark:text-zinc-500",
};

// Deterministic hue per department id so calendar entries and badges are
// color-coded consistently without storing a color on every department row.
export function departmentColor(departmentId: string | null | undefined): string {
  if (!departmentId) return "hsl(220 10% 60%)";
  let hash = 0;
  for (let i = 0; i < departmentId.length; i++) {
    hash = (hash * 31 + departmentId.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue} 65% 45%)`;
}

export function departmentColorSoft(departmentId: string | null | undefined): string {
  if (!departmentId) return "hsl(220 10% 90%)";
  let hash = 0;
  for (let i = 0; i < departmentId.length; i++) {
    hash = (hash * 31 + departmentId.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue} 70% 92%)`;
}

// Reuses the app's brand gold rather than an arbitrary new hue — a task
// currently held by the President should read as visually distinct from
// ordinary department work, not just another color in the department
// rotation, since it represents the top of the org's hierarchy.
export const PRESIDENT_TASK_COLOR = "#a8710a";

// Calendar task events use department color for normal work, but override
// it for anything that needs to stand out at a glance while scanning a
// month view — done (so it visibly stops competing for attention), blocked,
// and overdue all take priority over "which department is this." Below
// that, a task currently held by the President (isPresidentTask) takes
// priority over department color too, since who's holding it right now
// matters more here than which department they happen to belong to.
export function taskCalendarColor(
  status: TaskStatus,
  deadline: string | null,
  departmentId: string | null,
  isPresidentTask: boolean
): string {
  if (status === "done") return "hsl(220 10% 75%)";
  if (status === "blocked") return "hsl(0 70% 50%)";
  if (deadline && deadline < new Date().toISOString() && status !== "cancelled") return "hsl(25 85% 50%)";
  if (isPresidentTask) return PRESIDENT_TASK_COLOR;
  return departmentColor(departmentId);
}

export const HEALTH_COLORS = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
} as const;

export type HealthStatus = keyof typeof HEALTH_COLORS;

// Left-border + faint background tint for department cards — the status dot
// alone is easy to miss scanning a grid of 14 cards; this makes a troubled
// department readable at a glance without reading any text. Green stays
// unstyled (the default card border) so healthy departments don't compete
// for attention.
export const HEALTH_CARD_STYLES: Record<HealthStatus, string> = {
  green: "border-zinc-200 dark:border-zinc-800",
  yellow: "border-l-4 border-l-amber-400 border-zinc-200 bg-amber-50/40 dark:border-l-amber-500 dark:border-zinc-800 dark:bg-amber-950/10",
  red: "border-l-4 border-l-red-400 border-zinc-200 bg-red-50/40 dark:border-l-red-500 dark:border-zinc-800 dark:bg-red-950/10",
};

// task_types.color is one of these 7 (COLOR_OPTIONS, task-types-manager.tsx)
// but was captured on creation and never actually rendered anywhere —
// TaskCard, the task detail page, and the manager's own chip list all
// showed every type in the same flat gray regardless of the color picked.
// Dot for compact contexts (task cards), badge for the manager's chip list.
export const TASK_TYPE_COLORS: Record<string, { dot: string; badge: string }> = {
  zinc: { dot: "bg-zinc-400", badge: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  blue: { dot: "bg-blue-500", badge: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  amber: { dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  emerald: { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  red: { dot: "bg-red-500", badge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  violet: { dot: "bg-violet-500", badge: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
  pink: { dot: "bg-pink-500", badge: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300" },
};

export function taskTypeColor(color: string | null | undefined): { dot: string; badge: string } {
  return TASK_TYPE_COLORS[color ?? "zinc"] ?? TASK_TYPE_COLORS.zinc;
}

// Same reasons NeedsAttentionTask can carry (dashboard-queries.ts) — colored
// so "Needs attention" reads at a glance instead of requiring each line to
// be read, matching the badge language already used on task step statuses.
export const NEEDS_ATTENTION_BADGE: Record<"overdue" | "blocked" | "due_soon", string> = {
  overdue: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  blocked: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  due_soon: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};
