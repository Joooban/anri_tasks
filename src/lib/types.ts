// Core domain types for the ANRI Task Management System.
// Mirrors the schema in supabase/migrations/0001_schema.sql.

export type Role = "boss_boss" | "supervisor" | "department" | "employee";

export type TaskStatus =
  | "to_do"
  | "in_progress"
  | "pending_approval"
  | "done"
  | "blocked"
  | "cancelled";

export type StepStatus =
  | "pending"
  | "active"
  | "pending_approval"
  | "done"
  | "blocked"
  | "skipped";

export type AssigneeType = "department" | "individual";

export const ROLE_LABELS: Record<Role, string> = {
  boss_boss: "President",
  supervisor: "Supervisor",
  department: "Department",
  employee: "Employee",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  to_do: "To Do",
  in_progress: "In Progress",
  pending_approval: "Pending Approval",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
};

export const STEP_STATUS_LABELS: Record<StepStatus, string> = {
  pending: "Pending",
  active: "Active",
  pending_approval: "Pending Approval",
  done: "Done",
  blocked: "Blocked",
  skipped: "Skipped",
};

export interface Department {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  has_account: boolean;
  sort_order: number;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  department_id: string | null;
  avatar_url: string | null;
  birthday_month: number | null;
  birthday_day: number | null;
  created_at: string;
}

export interface TaskType {
  id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  task_type_id: string | null;
  created_by: string;
  creator_department_id: string | null;
  deadline: string | null;
  status: TaskStatus;
  is_personal: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskAssignee {
  id: string;
  task_id: string;
  step_order: number;
  assignee_type: AssigneeType;
  department_id: string | null;
  profile_id: string | null;
  status: StepStatus;
  requires_confirmation: boolean;
  started_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
}

export interface TaskVisibility {
  id: string;
  task_id: string;
  department_id: string | null;
  profile_id: string | null;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  task_id: string;
  actor_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  department_id: string | null;
  author_id: string;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  department_id: string | null;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  meeting_link: string | null;
  created_by: string;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export const BOSS_DASHBOARD_WIDGETS = [
  "completion_rate",
  "needs_attention",
  "announcements",
  "department_tiles",
] as const;

export type BossDashboardWidget = (typeof BOSS_DASHBOARD_WIDGETS)[number];

export const BOSS_DASHBOARD_WIDGET_LABELS: Record<BossDashboardWidget, string> = {
  completion_rate: "Company-wide Completion Rate",
  needs_attention: "Needs Attention (Overdue, Blocked & Due Soon)",
  announcements: "Company Announcements",
  department_tiles: "Department Drill-down Tiles",
};

export interface BossDashboardPrefs {
  profile_id: string;
  enabled_widgets: BossDashboardWidget[];
  widget_order: BossDashboardWidget[];
}
