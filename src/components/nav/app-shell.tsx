"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import clsx from "clsx";
import { Sidebar } from "@/components/nav/sidebar";
import { TopBar } from "@/components/nav/top-bar";
import { PreviewBanner } from "@/components/preview/preview-banner";
import type { Department, Role } from "@/lib/types";

// Below the lg breakpoint the sidebar is an off-canvas drawer (opened via
// the TopBar's menu button) instead of a permanently docked column — a
// fixed 240px sidebar left no usable width for content on a phone screen.
export function AppShell({
  role,
  departmentName,
  canPreview,
  isPreviewing,
  departments,
  fullName,
  email,
  topBarRole,
  previewInfo,
  canAccessAdmin,
  unreadMessageCount,
  pendingApprovalCount,
  children,
}: {
  role: Role;
  departmentName: string | null;
  canPreview: boolean;
  isPreviewing: boolean;
  departments: Department[];
  fullName: string | null;
  email: string;
  topBarRole: Role;
  previewInfo: { role: Role; departmentName: string } | null;
  canAccessAdmin: boolean;
  unreadMessageCount: number;
  pendingApprovalCount: number;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer on navigation rather than leaving it open over the new
  // page. Adjusting state directly during render (rather than in a
  // useEffect) when a value like pathname changes is React's documented
  // pattern for this — it re-renders once more before anything commits to
  // the screen, so there's no flash of the drawer still open.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <div
        className={clsx(
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar
          role={role}
          departmentName={departmentName}
          canPreview={canPreview}
          isPreviewing={isPreviewing}
          departments={departments}
          canAccessAdmin={canAccessAdmin}
          unreadMessageCount={unreadMessageCount}
          pendingApprovalCount={pendingApprovalCount}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {previewInfo && (
          <PreviewBanner role={previewInfo.role} departmentName={previewInfo.departmentName} />
        )}
        <TopBar fullName={fullName} email={email} role={topBarRole} onMenuClick={() => setMobileOpen(true)} />
        {/* overflow-x-hidden is a safety net, not the fix for any specific
            bug — a flex/grid child that forgets min-w-0 on truncated text
            (the actual bug class, see task-mini-list.tsx and messages/
            page.tsx) would otherwise force the whole page to scroll
            horizontally instead of just that one element clipping. */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
