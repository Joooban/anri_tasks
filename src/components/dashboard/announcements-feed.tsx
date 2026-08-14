"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { LocalDateTimeField } from "@/components/ui/local-datetime-field";
import { updateAnnouncement, deleteAnnouncement } from "@/app/(app)/announcements/actions";
import type { AnnouncementItem } from "@/lib/dashboard-queries";

function EditAnnouncementForm({ item, onDone }: { item: AnnouncementItem; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateAnnouncement({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={item.id} />
      <input
        name="title"
        defaultValue={item.title}
        required
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <textarea
        name="body"
        defaultValue={item.body}
        required
        rows={3}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
        <input type="checkbox" name="pinned" defaultChecked={item.pinned} />
        Pin to top
      </label>
      <div className="flex flex-wrap gap-4">
        <LocalDateTimeField
          id={`publish_at-${item.id}`}
          name="publish_at"
          label="Publish at"
          defaultValueIso={item.publish_at}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
        <LocalDateTimeField
          id={`expires_at-${item.id}`}
          name="expires_at"
          label="Expires at (leave blank to never expire)"
          defaultValueIso={item.expires_at}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function AnnouncementsFeed({
  items,
  currentUserId,
  canModerate,
}: {
  items: AnnouncementItem[];
  currentUserId?: string | null;
  canModerate?: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, startDelete] = useTransition();
  const router = useRouter();

  function handleDelete(id: string) {
    if (!window.confirm("Delete this announcement? This can't be undone.")) return;
    startDelete(async () => {
      const result = await deleteAnnouncement(id);
      if (result.error) {
        window.alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardTitle className="mb-3">Announcements</CardTitle>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No announcements yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const canEdit = currentUserId != null && item.author_id === currentUserId;
            const canDelete = canEdit || canModerate;

            if (editingId === item.id) {
              return (
                <li key={item.id} className="border-b border-zinc-100 pb-3 last:border-0 last:pb-0 dark:border-zinc-800">
                  <EditAnnouncementForm item={item} onDone={() => setEditingId(null)} />
                </li>
              );
            }

            return (
              <li key={item.id} className="border-b border-zinc-100 pb-3 last:border-0 last:pb-0 dark:border-zinc-800">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {item.pinned && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                        Pinned
                      </span>
                    )}
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{item.title}</p>
                  </div>
                  {(canEdit || canDelete) && (
                    <div className="flex shrink-0 items-center gap-2 text-xs">
                      {canEdit && (
                        <button
                          onClick={() => setEditingId(item.id)}
                          className="font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                        >
                          Edit
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId}
                          className="font-medium text-red-500 hover:text-red-700 disabled:opacity-60 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{item.body}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {item.department?.name ?? "Company-wide"} · {item.author?.full_name ?? item.author?.email} ·{" "}
                  {new Date(item.publish_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {item.expires_at &&
                    ` · Expires ${new Date(item.expires_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
