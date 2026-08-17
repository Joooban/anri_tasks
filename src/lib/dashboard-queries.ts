import { startOfDay, startOfWeek, startOfMonth, startOfYear, subDays, subWeeks, subMonths, subYears, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { decrypt } from "@/lib/encryption";
import type { HealthStatus } from "@/lib/constants";
import type { Department, TaskStatus } from "@/lib/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// A task counts toward a department's stats if that department created it
// OR is anywhere in its assignee chain (see task_departments view,
// 0008_department_task_attribution.sql) — not just creator, since the most
// common case is a task the President/Supervisor assigns to a department
// they don't themselves belong to.
async function getDepartmentTaskIds(supabase: SupabaseClient, departmentId: string): Promise<string[]> {
  const { data } = await supabase.from("task_departments").select("task_id").eq("department_id", departmentId);
  // task_departments is a view (0008_department_task_attribution.sql), so
  // its columns are generated as nullable regardless of the underlying
  // (always non-null) source data — filtering rather than asserting stays
  // correct even if that ever stops being true.
  const ids = (data ?? []).map((r) => r.task_id).filter((id): id is string => id !== null);
  return Array.from(new Set(ids));
}

export interface CompletionRate {
  completed: number;
  total: number;
  percent: number;
}

// Completion rate over tasks created in the `days`-day window ending
// `offsetDays` ago (offsetDays = 0, the default, means "ending now") —
// optionally scoped to one department. The offset exists so a caller can
// pull the *previous* period's rate for a trend comparison (e.g.
// offsetDays = 7 with days = 7 is "the week before this week").
export async function getCompletionRate(days: number, departmentId?: string, offsetDays = 0): Promise<CompletionRate> {
  const supabase = await createClient();
  const since = new Date(Date.now() - (days + offsetDays) * 86_400_000).toISOString();
  const until = offsetDays > 0 ? new Date(Date.now() - offsetDays * 86_400_000).toISOString() : null;

  let query = supabase.from("tasks").select("status", { count: "exact" }).gte("created_at", since);
  if (until) query = query.lt("created_at", until);
  if (departmentId) {
    const taskIds = await getDepartmentTaskIds(supabase, departmentId);
    if (taskIds.length === 0) return { completed: 0, total: 0, percent: 0 };
    query = query.in("id", taskIds);
  }

  const { data } = await query;
  const total = data?.length ?? 0;
  const completed = data?.filter((t) => t.status === "done").length ?? 0;
  return { completed, total, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
}

// Percentage-point delta vs. the previous period — null (rather than a
// misleading number) when the previous period had no tasks to compare
// against at all.
export function completionRateTrend(current: CompletionRate, previous: CompletionRate): number | null {
  if (previous.total === 0) return null;
  return current.percent - previous.percent;
}

// No date filter at all — the lifetime record, not a rolling window.
export async function getAllTimeCompletion(departmentId?: string): Promise<CompletionRate> {
  const supabase = await createClient();
  let query = supabase.from("tasks").select("status", { count: "exact" });
  if (departmentId) {
    const taskIds = await getDepartmentTaskIds(supabase, departmentId);
    if (taskIds.length === 0) return { completed: 0, total: 0, percent: 0 };
    query = query.in("id", taskIds);
  }

  const { data } = await query;
  const total = data?.length ?? 0;
  const completed = data?.filter((t) => t.status === "done").length ?? 0;
  return { completed, total, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
}

const STATUS_ORDER: TaskStatus[] = ["to_do", "in_progress", "pending_approval", "blocked", "done", "cancelled"];

// Snapshot of every task that currently exists, grouped by status —
// company-wide composition, not scoped to any time window.
export async function getTaskStatusBreakdown(departmentId?: string): Promise<Record<TaskStatus, number>> {
  const supabase = await createClient();
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<TaskStatus, number>;

  let query = supabase.from("tasks").select("status");
  if (departmentId) {
    const taskIds = await getDepartmentTaskIds(supabase, departmentId);
    if (taskIds.length === 0) return counts;
    query = query.in("id", taskIds);
  }

  const { data } = await query;
  for (const t of data ?? []) {
    const status = t.status as TaskStatus;
    if (status in counts) counts[status] += 1;
  }
  return counts;
}

export interface DepartmentCompletionSummary {
  name: string;
  percent: number;
}

// Best/worst completion rate this period among departments that actually
// had tasks in it — departments with zero tasks are excluded rather than
// counted as 0%, since that would just surface "nobody assigned this
// department anything" as if it were poor performance.
export async function getDepartmentCompletionExtremes(
  days: number,
  departments: Department[]
): Promise<{ best: DepartmentCompletionSummary | null; worst: DepartmentCompletionSummary | null }> {
  const fullAccountDepts = departments.filter((d) => d.has_account);
  const results = await Promise.all(
    fullAccountDepts.map(async (d) => ({ name: d.name, rate: await getCompletionRate(days, d.id) }))
  );
  const withTasks = results.filter((r) => r.rate.total > 0);
  if (withTasks.length === 0) return { best: null, worst: null };

  const sorted = [...withTasks].sort((a, b) => b.rate.percent - a.rate.percent);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  return {
    best: { name: best.name, percent: best.rate.percent },
    worst: best === worst ? null : { name: worst.name, percent: worst.rate.percent },
  };
}

export interface CompletedTask {
  id: string;
  title: string;
  updated_at: string;
}

// Most recently completed tasks, optionally scoped to one department — the
// "tasks done" list called out separately from the completion-rate percent
// in the project brief's department dashboard requirements.
export async function getRecentlyCompleted(limit = 8, departmentId?: string): Promise<CompletedTask[]> {
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select("id,title,updated_at")
    .eq("status", "done")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (departmentId) {
    const taskIds = await getDepartmentTaskIds(supabase, departmentId);
    if (taskIds.length === 0) return [];
    query = query.in("id", taskIds);
  }

  const { data } = await query;
  return (data ?? []).map((t) => ({ ...t, title: decrypt(t.title) }));
}

export interface NeedsAttentionTask {
  id: string;
  title: string;
  status: string;
  deadline: string | null;
  creator_department: { name: string } | null;
  reason: "overdue" | "blocked" | "due_soon";
}

// Replaces the old separate "Overdue & Blocked" and "Upcoming Deadlines"
// widgets (client feedback: the two were near-duplicates competing for the
// same dashboard real estate) — one query, one ranked list, tagged with why
// each task showed up so the UI can still label it distinctly.
export async function getNeedsAttentionTasks(days = 14, departmentId?: string): Promise<NeedsAttentionTask[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const untilIso = new Date(Date.now() + days * 86_400_000).toISOString();

  let query = supabase
    .from("tasks")
    .select("id,title,status,deadline,creator_department:departments(name)")
    .not("status", "in", "(done,cancelled)")
    .or(`status.eq.blocked,deadline.lt.${nowIso},and(deadline.gte.${nowIso},deadline.lte.${untilIso})`)
    .order("deadline", { ascending: true, nullsFirst: false });

  if (departmentId) {
    const taskIds = await getDepartmentTaskIds(supabase, departmentId);
    if (taskIds.length === 0) return [];
    query = query.in("id", taskIds);
  }

  const { data } = await query;
  const reasonRank = { overdue: 0, blocked: 1, due_soon: 2 };
  return ((data ?? []) as unknown as Omit<NeedsAttentionTask, "reason">[])
    .map((t) => {
      const reason: NeedsAttentionTask["reason"] =
        t.deadline && t.deadline < nowIso ? "overdue" : t.status === "blocked" ? "blocked" : "due_soon";
      return { ...t, title: decrypt(t.title), reason };
    })
    .sort((a, b) => reasonRank[a.reason] - reasonRank[b.reason] || (a.deadline ?? "").localeCompare(b.deadline ?? ""));
}

export interface DepartmentHealth {
  department: Department;
  health: HealthStatus;
  overdueCount: number;
  blockedCount: number;
  dueSoonCount: number;
  doneThisWeekCount: number;
}

export async function getDepartmentHealthGrid(departments: Department[]): Promise<DepartmentHealth[]> {
  const supabase = await createClient();
  const now = new Date();
  const soon = new Date(now.getTime() + 2 * 86_400_000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const nowIso = now.toISOString();

  const fullAccountDepts = departments.filter((d) => d.has_account);

  const results = await Promise.all(
    fullAccountDepts.map(async (dept) => {
      const taskIds = await getDepartmentTaskIds(supabase, dept.id);
      if (taskIds.length === 0) {
        return { department: dept, health: "green" as HealthStatus, overdueCount: 0, blockedCount: 0, dueSoonCount: 0, doneThisWeekCount: 0 };
      }

      const [{ data }, { count: doneThisWeekCount }] = await Promise.all([
        supabase.from("tasks").select("status,deadline").in("id", taskIds).not("status", "in", "(done,cancelled)"),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .in("id", taskIds)
          .eq("status", "done")
          .gte("updated_at", weekAgo),
      ]);

      const tasks = data ?? [];
      const overdueCount = tasks.filter((t) => t.deadline && t.deadline < nowIso).length;
      const blockedCount = tasks.filter((t) => t.status === "blocked").length;
      const dueSoonCount = tasks.filter((t) => t.deadline && t.deadline >= nowIso && t.deadline <= soon).length;

      const health: HealthStatus = overdueCount > 0 || blockedCount > 0 ? "red" : dueSoonCount > 0 ? "yellow" : "green";

      return { department: dept, health, overdueCount, blockedCount, dueSoonCount, doneThisWeekCount: doneThisWeekCount ?? 0 };
    })
  );

  return results;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
  publish_at: string;
  expires_at: string | null;
  author_id: string;
  department: { name: string } | null;
  author: { full_name: string | null; email: string } | null;
}

export async function getAnnouncements(departmentId?: string | null): Promise<AnnouncementItem[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  let query = supabase
    .from("announcements")
    .select("*, department:departments(name), author:profiles(full_name,email)")
    .lte("publish_at", nowIso)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("pinned", { ascending: false })
    .order("publish_at", { ascending: false })
    .limit(20);

  if (departmentId) {
    query = query.or(`department_id.is.null,department_id.eq.${departmentId}`);
  }

  const { data } = await query;
  return ((data ?? []) as unknown as AnnouncementItem[]).map((a) => ({
    ...a,
    title: decrypt(a.title),
    body: decrypt(a.body),
  }));
}

export type TrendBucket = "day" | "week" | "month" | "year";

// How many buckets back each granularity shows — enough to see a real trend
// without the chart becoming unreadable (30 days, ~1 quarter of weeks, a
// year of months, a few years).
const TREND_PERIODS: Record<TrendBucket, number> = { day: 30, week: 12, month: 12, year: 5 };

function bucketStart(bucket: TrendBucket, date: Date): Date {
  switch (bucket) {
    case "day":
      return startOfDay(date);
    case "week":
      return startOfWeek(date, { weekStartsOn: 1 });
    case "month":
      return startOfMonth(date);
    case "year":
      return startOfYear(date);
  }
}

function subPeriod(bucket: TrendBucket, date: Date, n: number): Date {
  switch (bucket) {
    case "day":
      return subDays(date, n);
    case "week":
      return subWeeks(date, n);
    case "month":
      return subMonths(date, n);
    case "year":
      return subYears(date, n);
  }
}

function bucketLabel(bucket: TrendBucket, date: Date): string {
  switch (bucket) {
    case "day":
    case "week":
      return format(date, "MMM d");
    case "month":
      return format(date, "MMM yyyy");
    case "year":
      return format(date, "yyyy");
  }
}

export interface CompletionTrendPoint {
  label: string;
  completed: number;
  total: number;
  percent: number;
}

// A task counts in whichever bucket its created_at falls into, "completed"
// meaning its *current* status is done — same definition getCompletionRate
// already uses for a single period, just repeated across a range of them.
export async function getCompletionRateTrend(bucket: TrendBucket, departmentId?: string): Promise<CompletionTrendPoint[]> {
  const supabase = await createClient();
  const periods = TREND_PERIODS[bucket];
  const now = new Date();
  const rangeStart = bucketStart(bucket, subPeriod(bucket, now, periods - 1));

  let query = supabase.from("tasks").select("status,created_at").gte("created_at", rangeStart.toISOString());
  if (departmentId) {
    const taskIds = await getDepartmentTaskIds(supabase, departmentId);
    if (taskIds.length === 0) {
      return Array.from({ length: periods }, (_, i) => ({
        label: bucketLabel(bucket, bucketStart(bucket, subPeriod(bucket, now, periods - 1 - i))),
        completed: 0,
        total: 0,
        percent: 0,
      }));
    }
    query = query.in("id", taskIds);
  }

  const { data } = await query;
  const tasks = data ?? [];

  const points: CompletionTrendPoint[] = [];
  for (let k = periods - 1; k >= 0; k--) {
    const bStart = bucketStart(bucket, subPeriod(bucket, now, k));
    const bEnd = bucketStart(bucket, subPeriod(bucket, now, k - 1));
    const inBucket = tasks.filter((t) => t.created_at >= bStart.toISOString() && t.created_at < bEnd.toISOString());
    const completed = inBucket.filter((t) => t.status === "done").length;
    const total = inBucket.length;
    points.push({ label: bucketLabel(bucket, bStart), completed, total, percent: total === 0 ? 0 : Math.round((completed / total) * 100) });
  }
  return points;
}

export interface UpcomingBirthday {
  profileId: string;
  name: string;
  month: number;
  day: number;
  daysUntil: number;
}

// Month/day only (see 0025_profile_birthday.sql) — no birth year is stored,
// so this only ever reports "when," never age.
export async function getUpcomingBirthdays(days = 30): Promise<UpcomingBirthday[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,full_name,email,birthday_month,birthday_day")
    .not("birthday_month", "is", null)
    .not("birthday_day", "is", null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();

  return (data ?? [])
    .map((p) => {
      const month = p.birthday_month as number;
      const day = p.birthday_day as number;
      let next = new Date(year, month - 1, day);
      if (next < today) next = new Date(year + 1, month - 1, day);
      const daysUntil = Math.round((next.getTime() - today.getTime()) / 86_400_000);
      return { profileId: p.id, name: p.full_name || p.email, month, day, daysUntil };
    })
    .filter((p) => p.daysUntil <= days)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

export interface DocumentTemplateItem {
  id: string;
  fileName: string;
  storagePath: string;
  createdAt: string;
  uploadedBy: string | null;
  downloadUrl: string | null;
}

// Signed URLs are generated with the service role client rather than relying
// on storage.objects RLS, matching the lesson from task attachments — see
// the upload path in tasks/actions.ts for why WITH CHECK policies involving
// a relation lookup aren't trusted here. Writes go through the same client,
// gated by an app-level role check (departments/template-actions.ts), not a
// storage policy.
export async function getDocumentTemplates(): Promise<DocumentTemplateItem[]> {
  const supabase = await createClient();
  const serviceRole = createServiceRoleClient();
  const { data } = await supabase
    .from("document_templates")
    .select("id,file_name,storage_path,created_at,uploader:profiles(full_name,email)")
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    file_name: string;
    storage_path: string;
    created_at: string;
    uploader: { full_name: string | null; email: string } | null;
  }>;

  return Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await serviceRole.storage
        .from("document-templates")
        .createSignedUrl(row.storage_path, 300);
      return {
        id: row.id,
        fileName: row.file_name,
        storagePath: row.storage_path,
        createdAt: row.created_at,
        uploadedBy: row.uploader?.full_name ?? row.uploader?.email ?? null,
        downloadUrl: signed?.signedUrl ?? null,
      };
    })
  );
}
