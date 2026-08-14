"use client";

import { useActionState, useState } from "react";
import { createTask, type CreateTaskState } from "@/app/(app)/tasks/actions";
import { AssigneeChainEditor, newStep, type ChainStep } from "@/components/tasks/assignee-chain-editor";
import { VisibilityPicker, type VisibilityEntry } from "@/components/tasks/visibility-picker";
import { LocalDateTimeField } from "@/components/ui/local-datetime-field";
import type { Department, Profile, TaskType } from "@/lib/types";

const initialState: CreateTaskState = { error: null };

export function TaskForm({
  departments,
  profiles,
  taskTypes,
}: {
  departments: Department[];
  profiles: Profile[];
  taskTypes: TaskType[];
}) {
  const [state, formAction, pending] = useActionState(createTask, initialState);
  const [chain, setChain] = useState<ChainStep[]>([newStep()]);
  const [visibility, setVisibility] = useState<VisibilityEntry[]>([]);

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          maxLength={300}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="task_type_id" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Task type
          </label>
          <select
            id="task_type_id"
            name="task_type_id"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">None</option>
            {taskTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <LocalDateTimeField id="deadline" name="deadline" label="Deadline" />
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" name="is_personal" />
        Personal task (visible only to me and the assignee chain)
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Assignee chain (relay order)
        </span>
        <AssigneeChainEditor
          departments={departments}
          profiles={profiles}
          value={chain}
          onChange={setChain}
        />
        <input type="hidden" name="chain" value={JSON.stringify(
          chain.map(({ assignee_type, department_id, profile_id, requires_confirmation }) => ({
            assignee_type,
            department_id,
            profile_id,
            requires_confirmation,
          }))
        )} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Also visible to (optional, beyond the chain)
        </span>
        <VisibilityPicker
          departments={departments}
          profiles={profiles}
          value={visibility}
          onChange={setVisibility}
        />
        <input
          type="hidden"
          name="visibility"
          value={JSON.stringify(
            visibility.map(({ department_id, profile_id }) => ({ department_id, profile_id }))
          )}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="attachments" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Attachments
        </label>
        <input
          id="attachments"
          name="attachments"
          type="file"
          multiple
          className="text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:hover:file:bg-zinc-700"
        />
      </div>

      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Creating…" : "Create Task"}
      </button>
    </form>
  );
}
