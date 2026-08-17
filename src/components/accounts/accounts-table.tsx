"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAccount, assignAdminRole, removeUser, reactivateUser } from "@/app/(app)/accounts/actions";
import { AdminActivityTrail } from "@/components/accounts/admin-activity-trail";
import { ROLE_LABELS, type Profile, type Department, type Role } from "@/lib/types";
import type { AdminRoleWithPermissions, AdminAuditEntry } from "@/lib/admin-queries";

const ROLES: Role[] = ["boss_boss", "supervisor", "department", "employee"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface Row {
  role: Role;
  departmentId: string | null;
  birthdayMonth: number | null;
  birthdayDay: number | null;
}

function ManagePanel({
  profile,
  adminRoles,
  isPending,
  auditLog,
}: {
  profile: Profile;
  adminRoles: AdminRoleWithPermissions[];
  isPending: boolean;
  auditLog: AdminAuditEntry[];
}) {
  const router = useRouter();
  const [adminRoleId, setAdminRoleId] = useState(profile.admin_role_id ?? "");
  const [assigning, startAssign] = useTransition();
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignStatus, setAssignStatus] = useState<"applied" | "pending" | null>(null);
  const [removing, startRemove] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const isDeactivated = profile.deactivated_at !== null;

  function assign() {
    setAssignError(null);
    setAssignStatus(null);
    startAssign(async () => {
      const result = await assignAdminRole(profile.id, adminRoleId || null);
      if (result.error) setAssignError(result.error);
      else {
        setAssignStatus(result.status);
        router.refresh();
      }
    });
  }

  function remove() {
    if (!window.confirm(`Remove ${profile.full_name || profile.email}? They'll lose sign-in access immediately.`)) return;
    setRemoveError(null);
    startRemove(async () => {
      const result = await removeUser(profile.id);
      if (result.error) setRemoveError(result.error);
      else router.refresh();
    });
  }

  function reactivate() {
    setRemoveError(null);
    startRemove(async () => {
      const result = await reactivateUser(profile.id);
      if (result.error) setRemoveError(result.error);
      else router.refresh();
    });
  }

  const history = auditLog.filter((e) => (e.details as { target_profile_id?: string } | null)?.target_profile_id === profile.id);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Admin role</label>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={adminRoleId}
            onChange={(e) => setAdminRoleId(e.target.value)}
            className="min-w-[10rem] rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">None</option>
            {adminRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.requires_approval ? " (needs approval)" : ""}
              </option>
            ))}
          </select>
          <button
            disabled={assigning || adminRoleId === (profile.admin_role_id ?? "")}
            onClick={assign}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {assigning ? "Saving…" : "Assign"}
          </button>
          {isPending && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              Pending approval
            </span>
          )}
          {assignStatus === "applied" && <span className="text-xs text-emerald-600 dark:text-emerald-400">Applied</span>}
          {assignStatus === "pending" && <span className="text-xs text-amber-600 dark:text-amber-400">Sent for approval</span>}
        </div>
        {assignError && <p className="text-xs text-red-500">{assignError}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isDeactivated ? (
          <>
            <span className="text-xs font-medium text-red-600 dark:text-red-400">Removed</span>
            <button
              disabled={removing}
              onClick={reactivate}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Reactivate
            </button>
          </>
        ) : (
          <button
            disabled={removing}
            onClick={remove}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            Remove account
          </button>
        )}
        {removeError && <p className="text-xs text-red-500">{removeError}</p>}
      </div>

      <div>
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          {showHistory ? "Hide" : "Show"} role assignment history
        </button>
        {showHistory && (
          <div className="mt-2">
            <AdminActivityTrail items={history} emptyLabel="No role changes on record." />
          </div>
        )}
      </div>
    </div>
  );
}

export function AccountsTable({
  profiles,
  departments,
  myProfileId,
  adminRoles,
  pendingProfileIds,
  auditLog,
}: {
  profiles: Profile[];
  departments: Department[];
  myProfileId: string;
  adminRoles: AdminRoleWithPermissions[];
  pendingProfileIds: Set<string>;
  auditLog: AdminAuditEntry[];
}) {
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      profiles.map((p) => [
        p.id,
        { role: p.role, departmentId: p.department_id, birthdayMonth: p.birthday_month, birthdayDay: p.birthday_day },
      ])
    )
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<{ id: string; message: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update(id: string, patch: Partial<Row>) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    setSavedId(null);
  }

  function isDirty(p: Profile, row: Row) {
    return (
      row.role !== p.role ||
      row.departmentId !== p.department_id ||
      row.birthdayMonth !== p.birthday_month ||
      row.birthdayDay !== p.birthday_day
    );
  }

  function save(id: string) {
    const row = rows[id];
    setSavingId(id);
    setErrorId(null);
    startTransition(async () => {
      const res = await updateAccount(id, row.role, row.departmentId, row.birthdayMonth, row.birthdayDay);
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
          swapped for a stacked card per person instead (below). Admin
          role/remove/history live in a collapsible panel per row rather
          than more table columns, to keep the primary table from getting
          unreasonably wide. */}
      <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
              <th className="px-3 py-2 font-medium">Name / email</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Department</th>
              <th className="px-3 py-2 font-medium">Birthday</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const row = rows[p.id];
              const dirty = isDirty(p, row);
              return (
                <Fragment key={p.id}>
                  <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                    <td className="px-3 py-2">
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {p.full_name || "—"}
                        {p.deactivated_at && (
                          <span className="ml-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-red-500">
                            Removed
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {p.email}
                        {p.id === myProfileId && " (you)"}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.role}
                        onChange={(e) => update(p.id, { role: e.target.value as Role })}
                        className="w-28 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.departmentId ?? ""}
                        onChange={(e) => update(p.id, { departmentId: e.target.value || null })}
                        className="w-36 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <option value="">None</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <select
                          aria-label="Birthday month"
                          value={row.birthdayMonth ?? ""}
                          onChange={(e) =>
                            update(p.id, { birthdayMonth: e.target.value ? Number(e.target.value) : null })
                          }
                          className="w-16 rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <option value="">—</option>
                          {MONTHS.map((m, i) => (
                            <option key={m} value={i + 1}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <input
                          aria-label="Birthday day"
                          type="number"
                          min={1}
                          max={31}
                          value={row.birthdayDay ?? ""}
                          onChange={(e) => update(p.id, { birthdayDay: e.target.value ? Number(e.target.value) : null })}
                          className="w-14 rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        disabled={!dirty || pending}
                        onClick={() => save(p.id)}
                        className="rounded-lg bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
                      >
                        {savingId === p.id ? "Saving…" : "Save"}
                      </button>
                      {savedId === p.id && <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">Saved</span>}
                      {errorId?.id === p.id && <p className="mt-1 text-xs text-red-500">{errorId.message}</p>}
                      <div>
                        <button
                          onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                          className="mt-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                        >
                          {expandedId === p.id ? "Close" : "Manage"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === p.id && (
                    <tr className="border-b border-zinc-100 dark:border-zinc-800">
                      <td colSpan={5} className="px-4 py-3">
                        <ManagePanel
                          key={p.admin_role_id ?? "none"}
                          profile={p}
                          adminRoles={adminRoles}
                          isPending={pendingProfileIds.has(p.id)}
                          auditLog={auditLog}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Card list: one person per card, fields stacked full-width. */}
      <div className="flex flex-col gap-3 md:hidden">
        {profiles.map((p) => {
          const row = rows[p.id];
          const dirty = isDirty(p, row);
          return (
            <div
              key={p.id}
              className="flex flex-col gap-2.5 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  {p.full_name || "—"}
                  {p.deactivated_at && (
                    <span className="ml-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-red-500">
                      Removed
                    </span>
                  )}
                </p>
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

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Birthday</label>
                <div className="flex items-center gap-1.5">
                  <select
                    aria-label="Birthday month"
                    value={row.birthdayMonth ?? ""}
                    onChange={(e) => update(p.id, { birthdayMonth: e.target.value ? Number(e.target.value) : null })}
                    className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="">—</option>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Birthday day"
                    type="number"
                    min={1}
                    max={31}
                    value={row.birthdayDay ?? ""}
                    onChange={(e) => update(p.id, { birthdayDay: e.target.value ? Number(e.target.value) : null })}
                    className="w-16 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
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
                <button
                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  {expandedId === p.id ? "Close" : "Manage"}
                </button>
              </div>
              {errorId?.id === p.id && <p className="text-xs text-red-500">{errorId.message}</p>}

              {expandedId === p.id && (
                <ManagePanel
                  key={p.admin_role_id ?? "none"}
                  profile={p}
                  adminRoles={adminRoles}
                  isPending={pendingProfileIds.has(p.id)}
                  auditLog={auditLog}
                />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
