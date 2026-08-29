"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { PreviewSwitcher } from "@/components/preview/preview-switcher";
import {
  DashboardIcon,
  CompanyIcon,
  TasksIcon,
  CalendarIcon,
  ActivityLogIcon,
  MessagesIcon,
  AnnouncementsIcon,
  AccountsIcon,
} from "@/components/nav/nav-icons";
import type { Department, Role } from "@/lib/types";
import type { ComponentType } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/departments", label: "Company Overview", icon: CompanyIcon, adminOnly: true },
  { href: "/tasks", label: "Tasks", icon: TasksIcon },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/history", label: "Activity Log", icon: ActivityLogIcon },
  { href: "/messages", label: "Messages", icon: MessagesIcon },
  { href: "/announcements", label: "Announcements", icon: AnnouncementsIcon },
  { href: "/accounts", label: "Accounts", icon: AccountsIcon, adminOnly: true },
];

export function Sidebar({
  role,
  departmentName,
  canPreview,
  isPreviewing,
  departments,
  canAccessAdmin,
  unreadMessageCount,
  pendingApprovalCount,
}: {
  role: Role;
  departmentName: string | null;
  canPreview: boolean;
  isPreviewing: boolean;
  departments: Department[];
  canAccessAdmin: boolean;
  unreadMessageCount: number;
  pendingApprovalCount: number;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-52 shrink-0 flex-col border-r border-zinc-200 bg-white px-3 py-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-6 px-3">
        {/* logo.jpg has a white, non-transparent background — a plain white
            card here keeps it looking intentional in dark mode instead of
            a stray white box floating on the dark sidebar. */}
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element -- static
              brand asset, no responsive/remote-loader needs that would
              justify next/image here */}
          <img src="/anri-logo.jpg" alt="Arc Nickel Resources Inc." className="block w-full" />
        </div>
        {departmentName && (
          <p className="mt-2 truncate text-xs text-zinc-500 dark:text-zinc-400">{departmentName}</p>
        )}
      </div>

      <ul className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.filter((item) => !item.adminOnly || canAccessAdmin).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={clsx(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand text-white dark:bg-brand dark:text-white"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                )}
              >
                <span className="flex items-center gap-2.5">
                  <Icon />
                  {item.label}
                </span>
                {item.href === "/messages" && unreadMessageCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[0.65rem] font-semibold text-white">
                    {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                  </span>
                )}
                {/* Amber rather than the Messages badge's blue — this one
                    means "needs your action" (a pending admin-role grant
                    awaiting a second approver), not just "unread." */}
                {item.href === "/accounts" && pendingApprovalCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[0.65rem] font-semibold text-white">
                    {pendingApprovalCount > 9 ? "9+" : pendingApprovalCount}
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
          className="mt-4 rounded-lg bg-brand px-3 py-2 text-center text-sm font-medium text-white hover:bg-brand-hover dark:bg-brand dark:text-white dark:hover:bg-brand-hover"
        >
          + New Task
        </Link>
      )}

      {canPreview && !isPreviewing && <PreviewSwitcher departments={departments} />}
    </nav>
  );
}
