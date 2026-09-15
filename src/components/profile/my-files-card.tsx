"use client";

import { useActionState, useTransition } from "react";
import { uploadPersonalFile, deletePersonalFile } from "@/app/(app)/profile/files-actions";
import { Card, CardTitle } from "@/components/ui/card";
import type { PersonalFileItem } from "@/lib/personal-files-queries";

const initialState = { error: null as string | null };

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MyFilesCard({ items }: { items: PersonalFileItem[] }) {
  const [state, formAction, pending] = useActionState(uploadPersonalFile, initialState);
  const [deletingId, startDelete] = useTransition();

  function handleDelete(id: string, fileName: string) {
    if (!window.confirm(`Delete "${fileName}"? This can't be undone.`)) return;
    startDelete(async () => {
      const result = await deletePersonalFile(id);
      if (result.error) window.alert(result.error);
    });
  }

  return (
    <Card>
      <CardTitle className="mb-1">My files</CardTitle>
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        A private space for your own files — nobody else, not even an admin, can see or download these.
      </p>

      {items.length === 0 ? (
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">No files yet.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            >
              <a
                href={`/profile/files/${item.id}`}
                className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800 hover:underline dark:text-zinc-200"
              >
                {item.fileName}
              </a>
              <span className="shrink-0 text-xs text-zinc-400">{formatBytes(item.fileSize)}</span>
              <button
                onClick={() => handleDelete(item.id, item.fileName)}
                disabled={deletingId}
                className="shrink-0 text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-60 dark:text-red-400 dark:hover:text-red-300"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        action={formAction}
        className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800"
      >
        <input
          type="file"
          name="file"
          required
          className="min-w-0 flex-1 text-xs text-zinc-600 dark:text-zinc-400"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-60 dark:bg-brand dark:text-white"
        >
          {pending ? "Uploading…" : "Upload"}
        </button>
        {state.error && <p className="w-full text-xs text-red-500">{state.error}</p>}
      </form>
    </Card>
  );
}
