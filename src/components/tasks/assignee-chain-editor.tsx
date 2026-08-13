"use client";

import type { Department, Profile } from "@/lib/types";

export interface ChainStep {
  key: string;
  assignee_type: "department" | "individual";
  department_id: string | null;
  profile_id: string | null;
  requires_confirmation: boolean;
}

function newStep(): ChainStep {
  return {
    key: crypto.randomUUID(),
    assignee_type: "department",
    department_id: null,
    profile_id: null,
    requires_confirmation: false,
  };
}

export function AssigneeChainEditor({
  departments,
  profiles,
  value,
  onChange,
}: {
  departments: Department[];
  profiles: Profile[];
  value: ChainStep[];
  onChange: (steps: ChainStep[]) => void;
}) {
  function update(index: number, patch: Partial<ChainStep>) {
    onChange(value.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  // The last step in the chain can never require confirmation — there's no
  // next assignee who could ever give it. Cleared automatically whenever
  // reordering/removing changes which step is last, so stale state from
  // before a reorder can't linger.
  function clearLastStepConfirmation(steps: ChainStep[]): ChainStep[] {
    if (steps.length === 0) return steps;
    const lastIndex = steps.length - 1;
    if (!steps[lastIndex].requires_confirmation) return steps;
    return steps.map((s, i) => (i === lastIndex ? { ...s, requires_confirmation: false } : s));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(clearLastStepConfirmation(next));
  }

  function remove(index: number) {
    onChange(clearLastStepConfirmation(value.filter((_, i) => i !== index)));
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((step, index) => (
        <div
          key={step.key}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/50"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
            {index + 1}
          </span>

          <select
            value={step.assignee_type}
            onChange={(e) =>
              update(index, {
                assignee_type: e.target.value as "department" | "individual",
                department_id: null,
                profile_id: null,
              })
            }
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="department">Department</option>
            <option value="individual">Individual</option>
          </select>

          {step.assignee_type === "department" ? (
            <select
              value={step.department_id ?? ""}
              onChange={(e) => update(index, { department_id: e.target.value || null })}
              className="min-w-[10rem] flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Select department…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={step.profile_id ?? ""}
              onChange={(e) => update(index, { profile_id: e.target.value || null })}
              className="min-w-[10rem] flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Select person…</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.email}
                </option>
              ))}
            </select>
          )}

          {index < value.length - 1 && (
            <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={step.requires_confirmation}
                onChange={(e) => update(index, { requires_confirmation: e.target.checked })}
              />
              Needs next step&apos;s confirmation
            </label>
          )}

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-200 disabled:opacity-30 dark:hover:bg-zinc-800"
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === value.length - 1}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-200 disabled:opacity-30 dark:hover:bg-zinc-800"
              aria-label="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => remove(index)}
              className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
              aria-label="Remove step"
            >
              ✕
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...value, newStep()])}
        className="self-start rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
      >
        + Add assignee to chain
      </button>
    </div>
  );
}

export { newStep };
