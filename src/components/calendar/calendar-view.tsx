"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg } from "@fullcalendar/core";

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
    meetingLink?: string | null;
    departmentName?: string | null;
  };
}

export function CalendarView({ events }: { events: CalendarEventInput[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<CalendarEventInput | null>(null);

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
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,listMonth",
        }}
        height="auto"
        events={events}
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
    </div>
  );
}
