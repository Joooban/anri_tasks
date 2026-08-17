"use client";

import { useState, useTransition } from "react";
import { createAdminRole, updateAdminRole, deleteAdminRole } from "@/app/(app)/accounts/admin-roles-actions";
import { Card, CardTitle } from "@/components/ui/card";
import { ADMIN_PERMISSIONS, ADMIN_PERMISSION_LABELS, type AdminPermission } from "@/lib/permissions";
import type { AdminRoleWithPermissions } from "@/lib/admin-queries";

function RoleForm({ initial, onDone }: { initial?: AdminRoleWithPermissions; onDone: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [permissions, setPermissions] = useState<Set<AdminPermission>>(new Set(initial?.permissions ?? []));
  const [requiresApproval, setRequiresApproval] = useState(initial?.requires_approval ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // manage_roles and approve_admin_requests control the permission system
  // itself — the server always forces requires_approval on for these
  // regardless of what's submitted (see create_admin_role_rpc/
  // update_admin_role_rpc, 0027), so the checkbox reflects that here too
  // rather than silently being overridden after save.
  const forcesApproval = permissions.has("manage_roles") || permissions.has("approve_admin_requests");

  function toggle(perm: AdminPermission) {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = initial
        ? await updateAdminRole(initial.id, name, description, Array.from(permissions), requiresApproval)
        : await createAdminRole(name, description, Array.from(permissions), requiresApproval);
      if (result.error) setError(result.error);
      else onDone();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Role name, e.g. HR Admin"
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {ADMIN_PERMISSIONS.map((perm) => (
          <label key={perm} className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={permissions.has(perm)} onChange={() => toggle(perm)} />
            {ADMIN_PERMISSION_LABELS[perm]}
          </label>
        ))}
      </div>
      <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
        <input
          type="checkbox"
          checked={requiresApproval || forcesApproval}
          disabled={forcesApproval}
          onChange={(e) => setRequiresApproval(e.target.checked)}
        />
        Require a second admin&apos;s approval before granting this role
        {forcesApproval && " (required — this role can manage roles/approvals)"}
      </label>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending || !name.trim()}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "Saving…" : initial ? "Save" : "Create role"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function AdminRolesManager({ roles }: { roles: AdminRoleWithPermissions[] }) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleDelete(role: AdminRoleWithPermissions) {
    if (!window.confirm(`Delete the "${role.name}" role? Accounts using it must be reassigned first.`)) return;
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteAdminRole(role.id);
      if (result.error) setDeleteError(result.error);
    });
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <CardTitle>Admin roles</CardTitle>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            + New role
          </button>
        )}
      </div>

      {creating && (
        <div className="mb-3">
          <RoleForm onDone={() => setCreating(false)} />
        </div>
      )}
      {deleteError && <p className="mb-2 text-xs text-red-500">{deleteError}</p>}

      {roles.length === 0 && !creating ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No Admin roles yet — create one to grant account-management access without making someone
          President or Supervisor.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {roles.map((role) =>
            editingId === role.id ? (
              <li key={role.id}>
                <RoleForm initial={role} onDone={() => setEditingId(null)} />
              </li>
            ) : (
              <li
                key={role.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {role.name}
                    {role.requires_approval && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                        Needs approval
                      </span>
                    )}
                  </p>
                  {role.description && <p className="text-xs text-zinc-500 dark:text-zinc-400">{role.description}</p>}
                  <p className="mt-1 text-xs text-zinc-400">
                    {role.permissions.length === 0
                      ? "No permissions"
                      : role.permissions.map((p) => ADMIN_PERMISSION_LABELS[p]).join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  <button
                    onClick={() => setEditingId(role.id)}
                    className="font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(role)}
                    disabled={deletingId}
                    className="font-medium text-red-500 hover:text-red-700 disabled:opacity-60 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </Card>
  );
}
