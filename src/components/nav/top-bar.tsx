import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/app/actions/auth";
import { ROLE_LABELS, type Role } from "@/lib/types";

export function TopBar({
  fullName,
  email,
  role,
}: {
  fullName: string | null;
  email: string;
  role: Role;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div />
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <div className="flex items-center gap-2 border-l border-zinc-200 pl-3 dark:border-zinc-800">
          <div className="text-right">
            <p className="text-sm font-medium leading-tight text-zinc-900 dark:text-zinc-50">
              {fullName || email}
            </p>
            <p className="text-xs leading-tight text-zinc-500 dark:text-zinc-400">
              {ROLE_LABELS[role]}
            </p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
