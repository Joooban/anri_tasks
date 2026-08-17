"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { uploadDocumentTemplate, deleteDocumentTemplate } from "@/app/(app)/departments/template-actions";
import type { DocumentTemplateItem } from "@/lib/dashboard-queries";

const initialState = { error: null as string | null };

export function DocumentTemplatesCard({
  items,
  canManage,
}: {
  items: DocumentTemplateItem[];
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(uploadDocumentTemplate, initialState);
  const [deletingId, startDelete] = useTransition();
  const router = useRouter();

  function handleDelete(id: string, storagePath: string) {
    if (!window.confirm("Delete this template? This can't be undone.")) return;
    startDelete(async () => {
      const result = await deleteDocumentTemplate(id, storagePath);
      if (result.error) {
        window.alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardTitle className="mb-3">Official document templates</CardTitle>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No templates uploaded yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
              {item.downloadUrl ? (
                <a
                  href={item.downloadUrl}
                  className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800 hover:underline dark:text-zinc-200"
                >
                  {item.fileName}
                </a>
              ) : (
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-400">{item.fileName} (unavailable)</span>
              )}
              {canManage && (
                <button
                  onClick={() => handleDelete(item.id, item.storagePath)}
                  disabled={deletingId}
                  className="shrink-0 text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-60 dark:text-red-400 dark:hover:text-red-300"
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <input
            type="file"
            name="file"
            required
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            className="min-w-0 flex-1 text-xs text-zinc-600 dark:text-zinc-400"
          />
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {pending ? "Uploading…" : "Upload"}
          </button>
          {state.error && <p className="w-full text-xs text-red-500">{state.error}</p>}
        </form>
      )}
    </Card>
  );
}
