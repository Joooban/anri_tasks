"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveAdminRoleRequest, rejectAdminRoleRequest } from "@/app/(app)/accounts/approval-actions";
import { Card, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format-datetime";
import type { PendingApprovalItem } from "@/lib/admin-queries";

export function PendingApprovals({ items }: { items: PendingApprovalItem[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const router = useRouter();

  function approve(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await approveAdminRoleRequest(id);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function reject(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await rejectAdminRoleRequest(id, reason);
      if (result.error) setError(result.error);
      else {
        setRejectingId(null);
        setReason("");
        router.refresh();
      }
    });
  }

  if (items.length === 0) return null;

  return (
    <Card>
      <CardTitle className="mb-3">Pending approvals</CardTitle>
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        A second admin needs to review these before the role grant takes effect.
      </p>
      {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-sm text-zinc-800 dark:text-zinc-200">
              Grant <span className="font-medium">{item.requestedRole?.name ?? "Unknown role"}</span> to{" "}
              <span className="font-medium">{item.target?.full_name ?? item.target?.email ?? "Unknown"}</span>
            </p>
            <p className="text-xs text-zinc-400">
              Requested by {item.requestedBy?.full_name ?? item.requestedBy?.email ?? "Unknown"} ·{" "}
              {formatDateTime(item.created_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>

            {rejectingId === item.id ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="min-w-[10rem] flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
                <button
                  disabled={pending}
                  onClick={() => reject(item.id)}
                  className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  Confirm reject
                </button>
                <button
                  onClick={() => setRejectingId(null)}
                  className="rounded-lg px-3 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <button
                  disabled={pending}
                  onClick={() => approve(item.id)}
                  className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  disabled={pending}
                  onClick={() => setRejectingId(item.id)}
                  className="rounded-lg bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-60 dark:bg-red-950 dark:text-red-400"
                >
                  Reject
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
