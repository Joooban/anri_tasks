"use client";

import { useActionState, useState } from "react";
import { postAnnouncement, type PostAnnouncementState } from "@/app/(app)/announcements/actions";
import { LocalDateTimeField } from "@/components/ui/local-datetime-field";

const initialState: PostAnnouncementState = { error: null };

export function PostAnnouncementForm({ canPostCompanyWide }: { canPostCompanyWide: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(postAnnouncement, initialState);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
      >
        + New announcement
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <input
        name="title"
        placeholder="Title"
        required
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <textarea
        name="body"
        placeholder="Announcement text"
        required
        rows={3}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-4 text-xs text-zinc-600 dark:text-zinc-400">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="pinned" />
            Pin to top
          </label>
          {canPostCompanyWide && (
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="company_wide" />
              Company-wide
            </label>
          )}
        </div>
        <LocalDateTimeField
          id="publish_at"
          name="publish_at"
          label="Publish at (optional — leave blank to post now)"
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      {state.error && <p className="text-xs text-red-500">{state.error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Post
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
