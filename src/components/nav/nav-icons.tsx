// Minimal stroke-based icon set for the sidebar nav — hand-drawn rather than
// pulled from an icon library, since the app has no icon dependency yet and
// eight glyphs doesn't justify adding one. Kept intentionally plain
// (1.75 stroke, no fill) to match the sidebar's understated look.
import type { ReactNode } from "react";

function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function DashboardIcon() {
  return (
    <IconBase>
      <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.2" />
      <rect x="11" y="2.5" width="6.5" height="6.5" rx="1.2" />
      <rect x="2.5" y="11" width="6.5" height="6.5" rx="1.2" />
      <rect x="11" y="11" width="6.5" height="6.5" rx="1.2" />
    </IconBase>
  );
}

export function CompanyIcon() {
  return (
    <IconBase>
      <rect x="3" y="3.5" width="9" height="13" rx="1" />
      <path d="M12 8.5h4.5v8H12" />
      <path d="M5.5 6.5h1M8.5 6.5h1M5.5 9.5h1M8.5 9.5h1M5.5 12.5h1M8.5 12.5h1" />
      <path d="M14 11.5h1M14 14h1" />
    </IconBase>
  );
}

export function TasksIcon() {
  return (
    <IconBase>
      <path d="M4 5.5l1.3 1.3L7.5 4.5" />
      <path d="M4 11l1.3 1.3L7.5 10" />
      <path d="M4 16.5l1.3 1.3L7.5 15.5" />
      <path d="M10.5 5.5h6M10.5 11h6M10.5 16.5h6" />
    </IconBase>
  );
}

export function CalendarIcon() {
  return (
    <IconBase>
      <rect x="2.5" y="4" width="15" height="13.5" rx="1.5" />
      <path d="M2.5 8h15" />
      <path d="M6 2.5v3M14 2.5v3" />
    </IconBase>
  );
}

export function ActivityLogIcon() {
  return (
    <IconBase>
      <circle cx="10" cy="10.5" r="7" />
      <path d="M10 6.5v4l2.8 1.8" />
    </IconBase>
  );
}

export function MessagesIcon() {
  return (
    <IconBase>
      <path d="M3 4.5h14v9.5H8.2L4.5 17V14H3z" />
    </IconBase>
  );
}

export function AnnouncementsIcon() {
  return (
    <IconBase>
      <path d="M3 8.5v3l3 .6v3.4a1.3 1.3 0 0 0 2.6 0v-2.9" />
      <path d="M6 8.5l9.5-4v12l-9.5-4z" />
      <path d="M15.5 8v5" />
    </IconBase>
  );
}

export function AccountsIcon() {
  return (
    <IconBase>
      <circle cx="7.3" cy="7" r="2.6" />
      <path d="M2.5 16c.5-3 2.3-4.5 4.8-4.5s4.3 1.5 4.8 4.5" />
      <circle cx="14.2" cy="7.5" r="2" />
      <path d="M12.8 11.7c1.9.2 3.3 1.6 3.7 4.3" />
    </IconBase>
  );
}
