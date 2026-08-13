import { clearPreview } from "@/app/(app)/preview-actions";
import { ROLE_LABELS, type Role } from "@/lib/types";

export function PreviewBanner({
  role,
  departmentName,
}: {
  role: Role;
  departmentName: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-amber-400 px-4 py-1.5 text-xs font-medium text-amber-950 dark:bg-amber-500 dark:text-amber-950">
      <span>
        Previewing as: {ROLE_LABELS[role]} · {departmentName}. This is read-only — no actions taken
        here affect real data.
      </span>
      <form action={clearPreview}>
        <button type="submit" className="rounded bg-amber-950/10 px-2 py-0.5 hover:bg-amber-950/20">
          Exit preview
        </button>
      </form>
    </div>
  );
}
