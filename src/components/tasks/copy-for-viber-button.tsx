"use client";

import { useState } from "react";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/types";
import { formatDateTime } from "@/lib/format-datetime";

export function CopyForViberButton({
  taskId,
  title,
  status,
  deadline,
  activeAssigneeLabel,
}: {
  taskId: string;
  title: string;
  status: TaskStatus;
  deadline: string | null;
  activeAssigneeLabel: string | null;
}) {
  const [copied, setCopied] = useState(false);

  function buildText() {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const lines = [
      title,
      `Status: ${TASK_STATUS_LABELS[status]}`,
      activeAssigneeLabel ? `Waiting on: ${activeAssigneeLabel}` : null,
      deadline
        ? `Deadline: ${formatDateTime(deadline, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
        : null,
      `${siteUrl}/tasks/${taskId}`,
    ].filter(Boolean);
    return lines.join("\n");
  }

  async function handleClick() {
    const text = buildText();

    if (navigator.share) {
      try {
        await navigator.share({ text, title });
        return;
      } catch {
        // User cancelled the share sheet — fall through to clipboard.
      }
    }

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleClick}
      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {copied ? "Copied!" : "Copy for Viber"}
    </button>
  );
}
