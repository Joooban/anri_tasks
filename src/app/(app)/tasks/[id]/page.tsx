import { notFound } from "next/navigation";
import Link from "next/link";
import { getTaskDetail } from "@/lib/queries";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { RelayChain } from "@/components/tasks/relay-chain";
import { CopyForViberButton } from "@/components/tasks/copy-for-viber-button";
import { CommentsSection } from "@/components/tasks/comments-section";
import { Card, CardTitle } from "@/components/ui/card";
import { cancelTask } from "@/app/(app)/tasks/[id]/actions";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, current] = await Promise.all([getTaskDetail(id), getCurrentProfile()]);

  if (!detail || !current) notFound();

  const { task, assignees, visibility, attachments, comments, auditLog } = detail;
  const { profile } = current;

  const supabase = await createClient();
  const attachmentsWithUrls = await Promise.all(
    attachments.map(async (a) => {
      const { data } = await supabase.storage.from("task-attachments").createSignedUrl(a.storage_path, 300);
      return { ...a, url: data?.signedUrl ?? null };
    })
  );

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
            Created by {task.creator?.full_name ?? task.creator?.email}
            {task.creator_department ? ` · ${task.creator_department.name}` : ""}
            {task.deadline &&
              ` · Due ${new Date(task.deadline).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}`}
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
                {v.department?.name ?? v.profile?.full_name ?? v.profile?.email}
              </span>
            ))}
          </div>
        </Card>
      )}

      {attachmentsWithUrls.length > 0 && (
        <Card>
          <CardTitle className="mb-2">Attachments</CardTitle>
          <ul className="flex flex-col gap-1.5">
            {attachmentsWithUrls.map((a) => (
              <li key={a.id}>
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {a.file_name}
                  </a>
                ) : (
                  <span className="text-sm text-zinc-400">{a.file_name} (unavailable)</span>
                )}
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
                {new Date(entry.created_at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              <span className="text-zinc-700 dark:text-zinc-300">
                {entry.actor?.full_name ?? entry.actor?.email ?? "System"} — {entry.action.replace(/_/g, " ")}
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
