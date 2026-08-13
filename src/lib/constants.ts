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

export const HEALTH_COLORS = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
} as const;

export type HealthStatus = keyof typeof HEALTH_COLORS;
