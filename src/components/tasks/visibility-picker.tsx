"use client";

import type { Department, Profile } from "@/lib/types";

export interface VisibilityEntry {
  key: string;
  department_id: string | null;
  profile_id: string | null;
  label: string;
}

export function VisibilityPicker({
  departments,
  profiles,
  value,
  onChange,
}: {
  departments: Department[];
  profiles: Profile[];
  value: VisibilityEntry[];
  onChange: (entries: VisibilityEntry[]) => void;
}) {
  function addDepartment(id: string) {
    if (!id || value.some((v) => v.department_id === id)) return;
    const dept = departments.find((d) => d.id === id);
    if (!dept) return;
    onChange([...value, { key: crypto.randomUUID(), department_id: id, profile_id: null, label: dept.name }]);
  }

  function addProfile(id: string) {
    if (!id || value.some((v) => v.profile_id === id)) return;
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return;
    onChange([
      ...value,
      { key: crypto.randomUUID(), department_id: null, profile_id: id, label: profile.full_name || profile.email },
    ]);
  }

  function remove(key: string) {
    onChange(value.filter((v) => v.key !== key));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <select
          defaultValue=""
          onChange={(e) => {
            addDepartment(e.target.value);
            e.target.value = "";
          }}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">+ Add department…</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          defaultValue=""
          onChange={(e) => {
            addProfile(e.target.value);
            e.target.value = "";
          }}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">+ Add individual…</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name || p.email}
            </option>
          ))}
        </select>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span
              key={v.key}
              className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {v.label}
              <button
                type="button"
                onClick={() => remove(v.key)}
                className="text-zinc-400 hover:text-red-500"
                aria-label={`Remove ${v.label}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
