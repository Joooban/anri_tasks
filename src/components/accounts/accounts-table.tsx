"use client";

import { useState, useTransition } from "react";
import { updateAccount } from "@/app/(app)/accounts/actions";
import { ROLE_LABELS, type Profile, type Department, type Role } from "@/lib/types";

const ROLES: Role[] = ["boss_boss", "supervisor", "department", "employee"];

interface Row {
  role: Role;
  departmentId: string | null;
}

export function AccountsTable({
  profiles,
  departments,
  myProfileId,
}: {
  profiles: Profile[];
  departments: Department[];
  myProfileId: string;
}) {
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(profiles.map((p) => [p.id, { role: p.role, departmentId: p.department_id }]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<{ id: string; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function update(id: string, patch: Partial<Row>) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    setSavedId(null);
  }

  function save(id: string) {
    const row = rows[id];
    setSavingId(id);
    setErrorId(null);
    startTransition(async () => {
      const res = await updateAccount(id, row.role, row.departmentId);
      setSavingId(null);
      if (res.error) {
        setErrorId({ id, message: res.error });
      } else {
        setSavedId(id);
      }
    });
  }

  return (
    <>
      {/* Table: readable at desktop widths. Below md, four columns (name,
          role, department, save) don't fit without truncating the role/
          department selects down to a couple of characters, so this is
          swapped for a stacked card per person instead (below). */}
      <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
              <th className="px-4 py-2 font-medium">Name / email</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Department</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const row = rows[p.id];
              const dirty = row.role !== p.role || row.departmentId !== p.department_id;
              return (
                <tr key={p.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                  <td className="px-4 py-2">
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{p.full_name || "—"}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {p.email}
                      {p.id === myProfileId && " (you)"}
                    </p>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={row.role}
                      onChange={(e) => update(p.id, { role: e.target.value as Role })}
                      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={row.departmentId ?? ""}
                      onChange={(e) => update(p.id, { departmentId: e.target.value || null })}
                      className="min-w-[10rem] rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="">None</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      disabled={!dirty || pending}
                      onClick={() => save(p.id)}
                      className="rounded-lg bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      {savingId === p.id ? "Saving…" : "Save"}
                    </button>
                    {savedId === p.id && <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">Saved</span>}
                    {errorId?.id === p.id && <p className="mt-1 text-xs text-red-500">{errorId.message}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Card list: one person per card, fields stacked full-width. */}
      <div className="flex flex-col gap-3 md:hidden">
        {profiles.map((p) => {
          const row = rows[p.id];
          const dirty = row.role !== p.role || row.departmentId !== p.department_id;
          return (
            <div
              key={p.id}
              className="flex flex-col gap-2.5 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{p.full_name || "—"}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {p.email}
                  {p.id === myProfileId && " (you)"}
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor={`role-${p.id}`} className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Role
                </label>
                <select
                  id={`role-${p.id}`}
                  value={row.role}
                  onChange={(e) => update(p.id, { role: e.target.value as Role })}
                  className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor={`dept-${p.id}`} className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Department
                </label>
                <select
                  id={`dept-${p.id}`}
                  value={row.departmentId ?? ""}
                  onChange={(e) => update(p.id, { departmentId: e.target.value || null })}
                  className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="">None</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={!dirty || pending}
                  onClick={() => save(p.id)}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {savingId === p.id ? "Saving…" : "Save"}
                </button>
                {savedId === p.id && <span className="text-xs text-emerald-600 dark:text-emerald-400">Saved</span>}
              </div>
              {errorId?.id === p.id && <p className="text-xs text-red-500">{errorId.message}</p>}
            </div>
          );
        })}
      </div>
    </>
  );
}
