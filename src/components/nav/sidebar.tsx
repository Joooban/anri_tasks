"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import type { Role } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  roles?: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tasks", label: "Tasks" },
  { href: "/calendar", label: "Calendar" },
  { href: "/history", label: "History" },
  { href: "/announcements", label: "Announcements" },
  { href: "/departments", label: "Company Overview", roles: ["boss_boss", "supervisor"] },
];

export function Sidebar({ role, departmentName }: { role: Role; departmentName: string | null }) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-60 shrink-0 flex-col border-r border-zinc-200 bg-white px-3 py-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-6 px-3">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">ANRI Tasks</p>
        {departmentName && (
          <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{departmentName}</p>
        )}
      </div>

      <ul className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={clsx(
                  "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href="/tasks/new"
        className="mt-4 rounded-lg bg-zinc-900 px-3 py-2 text-center text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        + New Task
      </Link>
    </nav>
  );
}
