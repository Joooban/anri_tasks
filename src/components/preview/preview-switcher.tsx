"use client";

import { useState } from "react";
import { setPreview } from "@/app/(app)/preview-actions";
import type { Department } from "@/lib/types";

export function PreviewSwitcher({ departments }: { departments: Department[] }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
      >
        Preview as…
      </button>
    );
  }

  return (
    <form
      action={setPreview}
      className="mt-2 flex flex-col gap-1.5 rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800"
    >
      <p className="px-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">Preview as</p>
      <select
        name="preview_role"
        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="department">Department Head</option>
        <option value="employee">Employee</option>
      </select>
      <select
        name="preview_department_id"
        required
        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="">Select department…</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <div className="flex gap-1.5">
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Go
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
