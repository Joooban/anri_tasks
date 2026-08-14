"use client";

import { useRef, useState, useTransition } from "react";
import { addAllowedEmail, removeAllowedEmail } from "@/app/(app)/accounts/allowlist-actions";
import { Card, CardTitle } from "@/components/ui/card";

export interface AllowedEmailItem {
  email: string;
  created_at: string;
}

export function AllowedEmails({ items }: { items: AllowedEmailItem[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addAllowedEmail(String(formData.get("email") ?? ""));
      if (result.error) setError(result.error);
      else formRef.current?.reset();
    });
  }

  function handleRemove(email: string) {
    if (!window.confirm(`Remove ${email} from the allowlist? They won't be able to sign in anymore.`)) return;
    startTransition(async () => {
      await removeAllowedEmail(email);
    });
  }

  return (
    <Card>
      <CardTitle className="mb-1">Allowed emails</CardTitle>
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        Only these email addresses can sign in with Google. Add someone here before they try to sign
        in for the first time.
      </p>

      <form ref={formRef} action={handleAdd} className="mb-3 flex flex-wrap gap-2">
        <input
          type="email"
          name="email"
          required
          placeholder="name@example.com"
          className="min-w-[14rem] flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
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
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No emails allowlisted yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li
              key={item.email}
              className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-800"
            >
              <span className="text-zinc-800 dark:text-zinc-200">{item.email}</span>
              <button
                onClick={() => handleRemove(item.email)}
                disabled={pending}
                className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-60 dark:text-red-400 dark:hover:text-red-300"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
