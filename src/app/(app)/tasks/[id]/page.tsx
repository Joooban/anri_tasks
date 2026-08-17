import { notFound } from "next/navigation";
import Link from "next/link";
import { getTaskDetail } from "@/lib/queries";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { RelayChain } from "@/components/tasks/relay-chain";
import { CopyForViberButton } from "@/components/tasks/copy-for-viber-button";
import { CommentsSection } from "@/components/tasks/comments-section";
import { DeleteTaskButton } from "@/components/tasks/delete-task-button";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { PersonLabel } from "@/components/ui/person-label";
import { formatDateTime } from "@/lib/format-datetime";
import { cancelTask } from "@/app/(app)/tasks/[id]/actions";

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attachmentError?: string }>;
}) {
  const { id } = await params;
  const { attachmentError } = await searchParams;
  const [detail, current] = await Promise.all([getTaskDetail(id), getCurrentProfile()]);

  if (!current) notFound();

  if (!detail) {
    // RLS returns no row either way for "this task doesn't exist" and
    // "it exists but you're not authorized to see it" — a shared link
    // (CopyForViberButton) landing on the second case shouldn't look like
    // a broken/dead link, so a service-role existence check distinguishes
    // them here and gives a real explanation instead of a bare 404.
    const serviceRole = createServiceRoleClient();
    const { data: exists } = await serviceRole.from("tasks").select("id").eq("id", id).maybeSingle();
    if (!exists) notFound();

    return (
      <EmptyState>
        <p>You don&apos;t have access to this task.</p>
        <p className="text-xs text-zinc-400">
          Ask the task creator or your supervisor to add you if you think this is a mistake.
        </p>
        <Link href="/tasks" className="text-zinc-900 underline dark:text-zinc-50">
          Back to tasks
        </Link>
      </EmptyState>
    );
  }

  const { task, assignees, visibility, attachments, comments, auditLog } = detail;
  const { profile } = current;

  const activeStep = assignees.find((a) => a.status === "active" || a.status === "pending_approval");
  const activeAssigneeLabel = activeStep
    ? activeStep.department?.name ?? activeStep.profile?.full_name ?? activeStep.profile?.email ?? null
    : null;

  const canManage = profile.role === "boss_boss" || profile.role === "supervisor" || task.created_by === profile.id;

  async function cancelTaskAction() {
    "use server";
    await cancelTask(task.id);
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      {attachmentError && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          The task was created, but this attachment failed to upload: {attachmentError}. Try adding it again.
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <TaskStatusBadge status={task.status} />
            {task.task_type && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{task.task_type.name}</span>
            )}
          </div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{task.title}</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Created by <PersonLabel person={task.creator} />
            {task.deadline &&
              ` · Due ${formatDateTime(task.deadline, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CopyForViberButton
            taskId={task.id}
            title={task.title}
            status={task.status}
            deadline={task.deadline}
            activeAssigneeLabel={activeAssigneeLabel}
          />
          {canManage && task.status !== "cancelled" && task.status !== "done" && (
            <form action={cancelTaskAction}>
              <button
                type="submit"
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                Cancel task
              </button>
            </form>
          )}
          {canManage && task.status === "cancelled" && (
            <DeleteTaskButton taskId={task.id} redirectTo="/tasks" />
          )}
        </div>
      </div>

      {task.description && (
        <Card>
          <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{task.description}</p>
        </Card>
      )}

      <Card>
        <CardTitle className="mb-3">Assignee chain</CardTitle>
        <RelayChain
          taskId={task.id}
          steps={assignees}
          myProfileId={profile.id}
          myDepartmentId={profile.department_id}
          myRole={profile.role}
        />
      </Card>

      {visibility.length > 0 && (
        <Card>
          <CardTitle className="mb-2">Also visible to</CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {visibility.map((v) => (
              <span
                key={v.id}
                className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {v.department?.name ?? (v.profile ? <PersonLabel person={v.profile} /> : null)}
              </span>
            ))}
          </div>
        </Card>
      )}

      {attachments.length > 0 && (
        <Card>
          <CardTitle className="mb-2">Attachments</CardTitle>
          <ul className="flex flex-col gap-1.5">
            {attachments.map((a) => (
              <li key={a.id}>
                <a
                  href={`/tasks/${task.id}/attachments/${a.id}`}
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  {a.file_name}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardTitle className="mb-3">Comments</CardTitle>
        <CommentsSection taskId={task.id} comments={comments} />
      </Card>

      <Card>
        <CardTitle className="mb-3">Audit trail</CardTitle>
        <ul className="flex flex-col gap-2">
          {auditLog.map((entry) => (
            <li key={entry.id} className="flex items-baseline gap-2 text-xs">
              <span className="text-zinc-400">
                {formatDateTime(entry.created_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
              <span className="text-zinc-700 dark:text-zinc-300">
                {entry.actor ? <PersonLabel person={entry.actor} /> : "System"} — {entry.action.replace(/_/g, " ")}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Link href="/tasks" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
        ← Back to tasks
      </Link>
    </div>
  );
}
