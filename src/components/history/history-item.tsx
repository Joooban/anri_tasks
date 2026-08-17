"use client";

import { useState } from "react";
import Link from "next/link";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { DeleteTaskButton } from "@/components/tasks/delete-task-button";
import { PersonLabel } from "@/components/ui/person-label";
import { formatDate, formatDateTime } from "@/lib/format-datetime";
import type { TaskStatus } from "@/lib/types";

export interface HistoryAuditEntry {
  id: string;
  action: string;
  created_at: string;
  actor: { full_name: string | null; email: string; department: { name: string } | null } | null;
}

export function HistoryItem({
  id,
  title,
  status,
  departmentName,
  updatedAt,
  deadline,
  auditLog,
  canDelete,
}: {
  id: string;
  title: string;
  status: TaskStatus;
  departmentName: string | null;
  updatedAt: string;
  deadline?: string | null;
  auditLog: HistoryAuditEntry[];
  canDelete?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link href={`/tasks/${id}`} className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
            {title}
          </Link>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {departmentName ?? "—"} · Updated{" "}
            {formatDate(updatedAt, { month: "short", day: "numeric", year: "numeric" })}
            {deadline && ` · Due ${formatDate(deadline, { month: "short", day: "numeric", year: "numeric" })}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TaskStatusBadge status={status} />
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            {open ? "Hide trail" : "Show trail"}
          </button>
          {canDelete && <DeleteTaskButton taskId={id} />}
        </div>
      </div>

      {open && (
        <ul className="mt-3 flex flex-col gap-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {auditLog.length === 0 ? (
            <li className="text-xs text-zinc-400">No audit entries.</li>
          ) : (
            auditLog.map((entry) => (
              <li key={entry.id} className="flex items-baseline gap-2 text-xs">
                <span className="text-zinc-400">
                  {formatDateTime(entry.created_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
                <span className="text-zinc-700 dark:text-zinc-300">
                  {entry.actor ? <PersonLabel person={entry.actor} /> : "System"} — {entry.action.replace(/_/g, " ")}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
