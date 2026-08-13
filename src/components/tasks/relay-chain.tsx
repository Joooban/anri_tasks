"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { STEP_STATUS_BADGE } from "@/lib/constants";
import { STEP_STATUS_LABELS, type Role } from "@/lib/types";
import { completeStep, confirmStep, blockStep, unblockStep } from "@/app/(app)/tasks/[id]/actions";
import type { TaskDetailAssignee } from "@/lib/queries";

function formatTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function stepLabel(step: TaskDetailAssignee) {
  return step.department?.name ?? step.profile?.full_name ?? step.profile?.email ?? "Unassigned";
}

export function RelayChain({
  taskId,
  steps,
  myProfileId,
  myDepartmentId,
  myRole,
}: {
  taskId: string;
  steps: TaskDetailAssignee[];
  myProfileId: string;
  myDepartmentId: string | null;
  myRole: Role;
}) {
  const isPrivileged = myRole === "boss_boss" || myRole === "supervisor";

  // No privileged bypass here on purpose: completing or confirming a step
  // is attributed to whoever clicks it (completed_by in the audit trail),
  // so it has to actually be that step's assignee — otherwise the
  // President completing HR's step on their behalf would misrepresent who
  // did the work. Matches the task_assignees_update RLS policy
  // (0008_department_task_attribution.sql).
  function isRealAssignee(step: TaskDetailAssignee): boolean {
    if (step.profile_id === myProfileId) return true;
    return Boolean(step.department_id) && step.department_id === myDepartmentId;
  }

  // Blocking/unblocking a stuck step is a legitimate administrative
  // override, unlike completing someone else's work — Boss/Supervisor keep
  // this.
  function canBlockOrUnblock(step: TaskDetailAssignee): boolean {
    return isRealAssignee(step) || isPrivileged;
  }

  return (
    <ol className="flex flex-col gap-2">
      {steps.map((step, index) => (
        <StepRow
          key={step.id}
          taskId={taskId}
          step={step}
          isFirst={index === 0}
          canCompleteThis={isRealAssignee(step)}
          canBlockOrUnblockThis={canBlockOrUnblock(step)}
          canConfirmThis={
            step.status === "pending_approval" &&
            (() => {
              const next = steps.find((s) => s.step_order === step.step_order + 1);
              return next ? isRealAssignee(next) : false;
            })()
          }
        />
      ))}
    </ol>
  );
}

function StepRow({
  taskId,
  step,
  canCompleteThis,
  canBlockOrUnblockThis,
  canConfirmThis,
}: {
  taskId: string;
  step: TaskDetailAssignee;
  isFirst: boolean;
  canCompleteThis: boolean;
  canBlockOrUnblockThis: boolean;
  canConfirmThis: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [blocking, setBlocking] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ error: string | null }>) {
    startTransition(async () => {
      const res = await action();
      setError(res.error);
      if (!res.error) setBlocking(false);
    });
  }

  const isActive = step.status === "active";
  const isPendingApproval = step.status === "pending_approval";
  const isBlocked = step.status === "blocked";
  const isDone = step.status === "done";

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              isDone
                ? "bg-emerald-500 text-white"
                : isActive || isPendingApproval
                  ? "bg-blue-500 text-white"
                  : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
            }`}
          >
            {step.step_order}
          </span>
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{stepLabel(step)}</p>
            {step.requires_confirmation && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Requires next step&apos;s confirmation</p>
            )}
          </div>
        </div>
        <Badge className={STEP_STATUS_BADGE[step.status as keyof typeof STEP_STATUS_BADGE]}>
          {STEP_STATUS_LABELS[step.status as keyof typeof STEP_STATUS_LABELS]}
        </Badge>
      </div>

      {(step.completed_at || step.started_at) && (
        <p className="pl-8 text-xs text-zinc-400">
          {step.completed_at
            ? `Completed ${formatTime(step.completed_at)}${step.completed_by_profile ? ` by ${step.completed_by_profile.full_name ?? step.completed_by_profile.email}` : ""}`
            : `Started ${formatTime(step.started_at)}`}
        </p>
      )}

      {step.notes && <p className="pl-8 text-xs text-red-500">{step.notes}</p>}

      {error && <p className="pl-8 text-xs text-red-500">{error}</p>}

      {isActive && (canCompleteThis || canBlockOrUnblockThis) && (
        <div className="flex flex-wrap gap-2 pl-8">
          {canCompleteThis && (
            <button
              disabled={pending}
              onClick={() => run(() => completeStep(taskId, step.id))}
              className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {step.requires_confirmation ? "Submit for confirmation" : "Mark done"}
            </button>
          )}
          {canBlockOrUnblockThis && (
            <button
              disabled={pending}
              onClick={() => setBlocking((v) => !v)}
              className="rounded-lg bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-400"
            >
              Mark blocked
            </button>
          )}
        </div>
      )}

      {isActive && canBlockOrUnblockThis && blocking && (
        <div className="flex flex-wrap items-center gap-2 pl-8">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason (optional)"
            className="min-w-[12rem] flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            disabled={pending}
            onClick={() => run(() => blockStep(taskId, step.id, notes))}
            className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            Confirm block
          </button>
        </div>
      )}

      {isBlocked && canBlockOrUnblockThis && (
        <div className="pl-8">
          <button
            disabled={pending}
            onClick={() => run(() => unblockStep(taskId, step.id))}
            className="rounded-lg bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Resume (unblock)
          </button>
        </div>
      )}

      {isPendingApproval && canConfirmThis && (
        <div className="pl-8">
          <button
            disabled={pending}
            onClick={() => run(() => confirmStep(taskId, step.id))}
            className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-60"
          >
            Confirm &amp; complete
          </button>
        </div>
      )}
    </li>
  );
}
