import { createClient } from "@/lib/supabase/server";
import type { Department, Profile, TaskType } from "@/lib/types";
import type { TaskListItem } from "@/components/tasks/task-card";

const TASK_LIST_SELECT = `
  *,
  task_type:task_types(name,color),
  creator_department:departments(name),
  task_assignees(step_order,status,department:departments(name),profile:profiles!task_assignees_profile_id_fkey(full_name,email,department:departments(name)))
`;

export async function getTaskList(options?: {
  status?: string;
  departmentId?: string;
}): Promise<TaskListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select(TASK_LIST_SELECT)
    .order("created_at", { ascending: false });

  if (options?.status) query = query.eq("status", options.status);
  if (options?.departmentId) query = query.eq("creator_department_id", options.departmentId);

  const { data } = await query;
  if (!data) return [];

  return data.map((row) => {
    const assignees = (row.task_assignees ?? []) as Array<{
      step_order: number;
      status: string;
      department: { name: string } | null;
      profile: { full_name: string | null; email: string; department: { name: string } | null } | null;
    }>;
    const active = assignees
      .sort((a, b) => a.step_order - b.step_order)
      .find((a) => a.status === "active" || a.status === "pending_approval");

    const activeAssigneeName = active
      ? (active.department?.name ?? active.profile?.full_name ?? active.profile?.email ?? null)
      : null;
    // Only individual assignees get a department tag here — a department
    // assignee's name already IS the department.
    const activeAssigneeDept = active && !active.department ? active.profile?.department?.name : null;
    const active_assignee_label = activeAssigneeName
      ? activeAssigneeDept
        ? `${activeAssigneeName} · ${activeAssigneeDept}`
        : activeAssigneeName
      : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rest: Record<string, unknown> = { ...(row as any) };
    delete rest.task_assignees;
    return { ...rest, active_assignee_label } as unknown as TaskListItem;
  });
}

export async function getDepartments(): Promise<Department[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("departments").select("*").order("sort_order");
  return data ?? [];
}

export async function getFullAccountDepartments(): Promise<Department[]> {
  const departments = await getDepartments();
  return departments.filter((d) => d.has_account);
}

export async function getProfiles(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").order("full_name");
  return data ?? [];
}

export async function getTaskTypes(): Promise<TaskType[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("task_types").select("*").order("name");
  return data ?? [];
}

export interface NamedRef {
  full_name: string | null;
  email: string;
  department: { name: string } | null;
}

export interface TaskDetailAssignee {
  id: string;
  step_order: number;
  assignee_type: "department" | "individual";
  department_id: string | null;
  profile_id: string | null;
  status: string;
  requires_confirmation: boolean;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  department: { name: string } | null;
  profile: NamedRef | null;
  completed_by_profile: NamedRef | null;
}

export async function getTaskDetail(id: string) {
  const supabase = await createClient();

  const [{ data: task }, { data: assignees }, { data: visibility }, { data: attachments }, { data: comments }, { data: auditLog }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "*, task_type:task_types(name,color), creator_department:departments(name), creator:profiles(full_name,email,department:departments(name))"
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("task_assignees")
        .select(
          "*, department:departments(name), profile:profiles!task_assignees_profile_id_fkey(full_name,email,department:departments(name)), completed_by_profile:profiles!task_assignees_completed_by_fkey(full_name,email,department:departments(name))"
        )
        .eq("task_id", id)
        .order("step_order"),
      supabase
        .from("task_visibility")
        .select("*, department:departments(name), profile:profiles(full_name,email,department:departments(name))")
        .eq("task_id", id),
      supabase
        .from("task_attachments")
        .select("*, uploader:profiles(full_name,email,department:departments(name))")
        .eq("task_id", id)
        .order("created_at"),
      supabase
        .from("task_comments")
        .select("*, author:profiles(full_name,email,department:departments(name))")
        .eq("task_id", id)
        .order("created_at"),
      supabase
        .from("audit_log")
        .select("*, actor:profiles(full_name,email,department:departments(name))")
        .eq("task_id", id)
        .order("created_at"),
    ]);

  if (!task) return null;

  return {
    task,
    assignees: (assignees ?? []) as unknown as TaskDetailAssignee[],
    visibility: visibility ?? [],
    attachments: attachments ?? [],
    comments: comments ?? [],
    auditLog: auditLog ?? [],
  };
}
