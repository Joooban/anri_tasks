"use client";

import { useState, useTransition } from "react";
import { addComment } from "@/app/(app)/tasks/[id]/actions";

export interface CommentItem {
  id: string;
  body: string;
  created_at: string;
  author: { full_name: string | null; email: string } | null;
}

export function CommentsSection({ taskId, comments }: { taskId: string; comments: CommentItem[] }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await addComment(taskId, value);
      if (res.error) {
        setError(res.error);
      } else {
        setValue("");
        setError(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900/50">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {c.author?.full_name ?? c.author?.email ?? "Unknown"}
                </span>
                <span className="text-xs text-zinc-400">
                  {new Date(c.created_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={2}
          placeholder="Add a comment…"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          disabled={pending || !value.trim()}
          onClick={submit}
          className="self-end rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Post
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
