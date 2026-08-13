"use client";

import { useActionState, useState } from "react";
import { createMeeting, type CreateMeetingState } from "@/app/(app)/calendar/actions";

const initialState: CreateMeetingState = { error: null };

export function CreateMeetingForm({ canPostCompanyWide }: { canPostCompanyWide: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createMeeting, initialState);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
      >
        + Add meeting
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          name="title"
          placeholder="Meeting title"
          required
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          name="meeting_link"
          placeholder="Meeting link (optional)"
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          name="start_at"
          type="datetime-local"
          required
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          name="end_at"
          type="datetime-local"
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <textarea
        name="description"
        placeholder="Notes (optional)"
        rows={2}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      {canPostCompanyWide && (
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <input type="checkbox" name="company_wide" />
          Company-wide (not tied to my department)
        </label>
      )}
      {state.error && <p className="text-xs text-red-500">{state.error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
