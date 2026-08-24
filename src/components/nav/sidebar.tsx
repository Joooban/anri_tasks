"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { PreviewSwitcher } from "@/components/preview/preview-switcher";
import type { Department, Role } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/departments", label: "Company Overview", adminOnly: true },
  { href: "/tasks", label: "Tasks" },
  { href: "/calendar", label: "Calendar" },
  { href: "/history", label: "Activity Log" },
  { href: "/messages", label: "Messages" },
  { href: "/announcements", label: "Announcements" },
  { href: "/accounts", label: "Accounts", adminOnly: true },
];

export function Sidebar({
  role,
  departmentName,
  canPreview,
  isPreviewing,
  departments,
  canAccessAdmin,
  unreadMessageCount,
}: {
  role: Role;
  departmentName: string | null;
  canPreview: boolean;
  isPreviewing: boolean;
  departments: Department[];
  canAccessAdmin: boolean;
  unreadMessageCount: number;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-52 shrink-0 flex-col border-r border-zinc-200 bg-white px-3 py-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-6 px-3">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">ANRI Tasks</p>
        {departmentName && (
          <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{departmentName}</p>
        )}
      </div>

      <ul className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.filter((item) => !item.adminOnly || canAccessAdmin).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={clsx(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                )}
              >
                {item.label}
                {item.href === "/messages" && unreadMessageCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[0.65rem] font-semibold text-white">
                    {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {role !== "employee" && !isPreviewing && (
        <Link
          href="/tasks/new"
          className="mt-4 rounded-lg bg-zinc-900 px-3 py-2 text-center text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          + New Task
        </Link>
      )}

      {canPreview && !isPreviewing && <PreviewSwitcher departments={departments} />}
    </nav>
  );
}
