"use client";

import { useRef, useState, useTransition } from "react";
import { addTaskType, deleteTaskType } from "@/app/(app)/accounts/task-type-actions";
import { Card, CardTitle } from "@/components/ui/card";
import type { TaskType } from "@/lib/types";

const COLOR_OPTIONS = ["zinc", "blue", "amber", "emerald", "red", "violet", "pink"];

export function TaskTypesManager({ items }: { items: TaskType[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addTaskType(String(formData.get("name") ?? ""), String(formData.get("color") ?? "zinc"));
      if (result.error) setError(result.error);
      else formRef.current?.reset();
    });
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete task type "${name}"? Tasks using it will just show no type, not be deleted.`)) return;
    startTransition(async () => {
      const result = await deleteTaskType(id);
      if (result.error) window.alert(result.error);
    });
  }

  return (
    <Card>
      <CardTitle className="mb-3">Task types</CardTitle>

      <form ref={formRef} action={handleAdd} className="mb-3 flex flex-wrap gap-2">
        <input
          type="text"
          name="name"
          required
          placeholder="e.g. Compliance"
          className="min-w-[10rem] flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          name="color"
          defaultValue="zinc"
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {COLOR_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </form>
      {error && <p className="mb-3 text-xs text-red-500">{error}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No task types yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {item.name}
              <button
                onClick={() => handleDelete(item.id, item.name)}
                disabled={pending}
                className="text-zinc-400 hover:text-red-500 disabled:opacity-60"
                aria-label={`Delete ${item.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
