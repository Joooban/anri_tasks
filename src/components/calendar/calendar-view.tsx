"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventContentArg } from "@fullcalendar/core";
import clsx from "clsx";
import type { TaskStatus } from "@/lib/types";

export interface CalendarEventInput {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  color: string;
  extendedProps: {
    type: "task" | "meeting";
    taskId?: string;
    taskStatus?: TaskStatus;
    meetingLink?: string | null;
    departmentName?: string | null;
  };
}

export interface DepartmentLegendEntry {
  id: string | null;
  name: string;
  color: string;
}

function renderEventContent(arg: EventContentArg) {
  const props = arg.event.extendedProps as CalendarEventInput["extendedProps"];
  const isDone = props.taskStatus === "done";

  return (
    <div className={clsx("flex min-w-0 items-center gap-1 px-0.5", isDone && "opacity-60")}>
      {/* Drawn ourselves rather than relying on FullCalendar's own dot/
          background coloring, which is what differs between its two
          inconsistent display modes — see the CSS override in
          globals.css for why. Color alone (via taskCalendarColor) already
          distinguishes overdue/blocked/done, so no separate icon is needed. */}
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: arg.event.backgroundColor || arg.event.borderColor }}
      />
      <span className={clsx("truncate", isDone && "line-through")}>{arg.event.title}</span>
    </div>
  );
}

export function CalendarView({
  events,
  departmentLegend,
}: {
  events: CalendarEventInput[];
  departmentLegend: DepartmentLegendEntry[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<CalendarEventInput | null>(null);
  const calendarRef = useRef<FullCalendar>(null);

  // A full 7-column month grid has no room left for readable content once
  // day cells shrink to phone width — titles truncate to a character or
  // two. Defaulting to the list/agenda view below the sm breakpoint keeps
  // it usable there; initialView itself can't be responsive (FullCalendar
  // only reads it once, on mount), so this switches it imperatively via
  // the calendar's own API right after mount instead. Deliberately only
  // runs once on mount rather than on every resize, so it doesn't fight a
  // view someone picks manually from the toolbar mid-session.
  useEffect(() => {
    if (window.innerWidth < 640) {
      calendarRef.current?.getApi().changeView("listWeek");
    }
  }, []);

  function handleEventClick(arg: EventClickArg) {
    const props = arg.event.extendedProps as CalendarEventInput["extendedProps"];
    if (props.type === "task" && props.taskId) {
      router.push(`/tasks/${props.taskId}`);
      return;
    }
    setSelected({
      id: arg.event.id,
      title: arg.event.title,
      start: arg.event.startStr,
      end: arg.event.endStr,
      color: arg.event.backgroundColor,
      extendedProps: props,
    });
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,listMonth",
        }}
        height="auto"
        dayMaxEvents={4}
        // Forces every event to use the compact dot+title style. Without
        // this, FullCalendar's default "auto" display mode renders some
        // events (its all-day-vs-timed inference isn't always consistent
        // with how these deadlines get parsed) as full-width block bars
        // instead — visually inconsistent with everything else on the
        // same day, and misleading since nothing here actually spans
        // multiple days.
        eventDisplay="list-item"
        events={events}
        eventContent={renderEventContent}
        eventClick={handleEventClick}
      />

      {selected && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-800/50">
          <div>
            <p className="font-medium text-zinc-900 dark:text-zinc-50">{selected.title}</p>
            {selected.extendedProps.departmentName && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {selected.extendedProps.departmentName}
              </p>
            )}
          </div>
          {selected.extendedProps.meetingLink && (
            <a
              href={selected.extendedProps.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              Join
            </a>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: "hsl(25 85% 50%)" }} />
          Overdue
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: "hsl(0 70% 50%)" }} />
          Blocked
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: "hsl(220 10% 75%)" }} />
          Done
        </span>
        {departmentLegend.map((d) => (
          <span key={d.id ?? "none"} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
            {d.name}
          </span>
        ))}
      </div>
    </div>
  );
}
