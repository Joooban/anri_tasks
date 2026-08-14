"use client";

import { useState } from "react";

// `datetime-local` inputs submit a timezone-less string (e.g. "2026-08-14T18:22").
// Parsing that server-side would apply the SERVER's timezone, not the user's —
// wrong the moment client and server run in different zones (e.g. once this
// deploys to Vercel while users are in the Philippines). Converting to a full
// ISO timestamp here, in the browser, captures the correct offset before the
// value ever leaves the client.

// Converts a stored UTC ISO string back to the "YYYY-MM-DDTHH:mm" shape a
// datetime-local input expects, using the browser's local time — the
// inverse of the onChange conversion below, so editing a value round-trips
// without drifting.
function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LocalDateTimeField({
  id,
  name,
  label,
  required,
  className,
  defaultValueIso,
}: {
  id: string;
  name: string;
  label?: string;
  required?: boolean;
  className?: string;
  defaultValueIso?: string | null;
}) {
  const [iso, setIso] = useState(defaultValueIso ?? "");

  const field = (
    <>
      <input
        id={id}
        type="datetime-local"
        required={required}
        defaultValue={defaultValueIso ? toLocalInputValue(defaultValueIso) : undefined}
        onChange={(e) => setIso(e.target.value ? new Date(e.target.value).toISOString() : "")}
        className={
          className ??
          "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        }
      />
      <input type="hidden" name={name} value={iso} />
    </>
  );

  if (!label) return field;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      {field}
    </div>
  );
}
