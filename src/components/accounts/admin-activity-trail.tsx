"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/format-datetime";
import type { AdminAuditEntry } from "@/lib/admin-queries";

function formatAction(action: string): string {
  return action.replace(/_/g, " ");
}

const DEFAULT_VISIBLE = 10;

// Deliberately a bare list, not its own Card — used both as the standalone
// "Admin activity trail" section on the Accounts page (wrapped in a Card
// there) and inline per row in AccountsTable for a single account's Role
// Assignment History, where a nested Card would look wrong.
export function AdminActivityTrail({
  items,
  emptyLabel = "No admin activity yet.",
}: {
  items: AdminAuditEntry[];
  emptyLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">{emptyLabel}</p>;
  }

  const visible = expanded ? items : items.slice(0, DEFAULT_VISIBLE);

  return (
    <div>
      <ul className="flex flex-col gap-2">
        {visible.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-baseline gap-x-2 text-xs">
            <span className="shrink-0 text-zinc-400">
              {formatDateTime(entry.created_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
            <span className="text-zinc-700 dark:text-zinc-300">
              {entry.actor?.full_name ?? entry.actor?.email ?? "System"} — {formatAction(entry.action)}
            </span>
          </li>
        ))}
      </ul>
      {items.length > DEFAULT_VISIBLE && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          {expanded ? "Show less" : `Show ${items.length - DEFAULT_VISIBLE} more`}
        </button>
      )}
    </div>
  );
}
