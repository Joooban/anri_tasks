import { createClient } from "@/lib/supabase/server";
import type { HealthStatus } from "@/lib/constants";
import type { Department } from "@/lib/types";

export interface CompletionRate {
  completed: number;
  total: number;
  percent: number;
}

// Completion rate over tasks created or updated in the last `days` days,
// optionally scoped to one department.
export async function getCompletionRate(days: number, departmentId?: string): Promise<CompletionRate> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  let query = supabase.from("tasks").select("status", { count: "exact" }).gte("created_at", since);
  if (departmentId) query = query.eq("creator_department_id", departmentId);

  const { data } = await query;
  const total = data?.length ?? 0;
  const completed = data?.filter((t) => t.status === "done").length ?? 0;
  return { completed, total, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
}

export interface OverdueBlockedTask {
  id: string;
  title: string;
  status: string;
  deadline: string | null;
  creator_department: { name: string } | null;
}

export async function getOverdueAndBlockedTasks(departmentId?: string): Promise<OverdueBlockedTask[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  let query = supabase
    .from("tasks")
    .select("id,title,status,deadline,creator_department:departments(name)")
    .not("status", "in", "(done,cancelled)")
    .or(`status.eq.blocked,deadline.lt.${nowIso}`)
    .order("deadline", { ascending: true });

  if (departmentId) query = query.eq("creator_department_id", departmentId);

  const { data } = await query;
  return (data ?? []) as unknown as OverdueBlockedTask[];
}

export interface UpcomingDeadlineTask {
  id: string;
  title: string;
  deadline: string;
  creator_department: { name: string } | null;
}

export async function getUpcomingDeadlines(days = 14, departmentId?: string): Promise<UpcomingDeadlineTask[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const until = new Date(Date.now() + days * 86_400_000).toISOString();

  let query = supabase
    .from("tasks")
    .select("id,title,deadline,creator_department:departments(name)")
    .not("status", "in", "(done,cancelled)")
    .gte("deadline", now)
    .lte("deadline", until)
    .order("deadline", { ascending: true });

  if (departmentId) query = query.eq("creator_department_id", departmentId);

  const { data } = await query;
  return (data ?? []) as unknown as UpcomingDeadlineTask[];
}

export interface DepartmentHealth {
  department: Department;
  health: HealthStatus;
  overdueCount: number;
  blockedCount: number;
  dueSoonCount: number;
}

export async function getDepartmentHealthGrid(departments: Department[]): Promise<DepartmentHealth[]> {
  const supabase = await createClient();
  const now = new Date();
  const soon = new Date(now.getTime() + 2 * 86_400_000).toISOString();
  const nowIso = now.toISOString();

  const fullAccountDepts = departments.filter((d) => d.has_account);

  const results = await Promise.all(
    fullAccountDepts.map(async (dept) => {
      const { data } = await supabase
        .from("tasks")
        .select("status,deadline")
        .eq("creator_department_id", dept.id)
        .not("status", "in", "(done,cancelled)");

      const tasks = data ?? [];
      const overdueCount = tasks.filter((t) => t.deadline && t.deadline < nowIso).length;
      const blockedCount = tasks.filter((t) => t.status === "blocked").length;
      const dueSoonCount = tasks.filter((t) => t.deadline && t.deadline >= nowIso && t.deadline <= soon).length;

      const health: HealthStatus = overdueCount > 0 || blockedCount > 0 ? "red" : dueSoonCount > 0 ? "yellow" : "green";

      return { department: dept, health, overdueCount, blockedCount, dueSoonCount };
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
  department: { name: string } | null;
  author: { full_name: string | null; email: string } | null;
}

export async function getAnnouncements(departmentId?: string | null): Promise<AnnouncementItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("announcements")
    .select("*, department:departments(name), author:profiles(full_name,email)")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  if (departmentId) {
    query = query.or(`department_id.is.null,department_id.eq.${departmentId}`);
  }

  const { data } = await query;
  return (data ?? []) as unknown as AnnouncementItem[];
}
