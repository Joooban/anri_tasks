"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createConversation } from "@/app/(app)/messages/actions";
import { personDisplayName } from "@/components/ui/person-label";
import type { Profile } from "@/lib/types";

export function NewConversationButton({ people }: { people: Profile[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function start() {
    if (selected.size === 0) {
      setError("Pick at least one person.");
      return;
    }
    setError(null);
    const isGroup = selected.size > 1;
    startTransition(async () => {
      const result = await createConversation(Array.from(selected), isGroup, isGroup ? groupName : null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setSelected(new Set());
      setGroupName("");
      router.push(`/messages/${result.conversationId}`);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover dark:bg-brand dark:text-white dark:hover:bg-brand-hover"
      >
        + New message
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-sm flex-col gap-3 rounded-xl bg-white p-4 dark:bg-zinc-900">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">New message</p>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          {people.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2 text-sm last:border-0 dark:border-zinc-800"
            >
              <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
              <span className="text-zinc-800 dark:text-zinc-200">{personDisplayName(p)}</span>
            </label>
          ))}
        </div>

        {selected.size > 1 && (
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name (optional)"
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-2">
          <button
            disabled={pending}
            onClick={start}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-60 dark:bg-brand dark:text-white"
          >
            {pending ? "Starting…" : "Start"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setSelected(new Set());
              setError(null);
            }}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
