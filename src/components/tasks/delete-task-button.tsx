"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTask } from "@/app/(app)/tasks/[id]/actions";

export function DeleteTaskButton({ taskId, redirectTo }: { taskId: string; redirectTo?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm("Permanently delete this cancelled task? This can't be undone.")) return;
    startTransition(async () => {
      const result = await deleteTask(taskId);
      if (result.error) {
        window.alert(result.error);
        return;
      }
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
    >
      {pending ? "Deleting…" : "Delete permanently"}
    </button>
  );
}
