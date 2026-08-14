import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { getPreview } from "@/lib/get-preview";
import { decrypt } from "@/lib/encryption";
import { departmentColor, taskCalendarColor } from "@/lib/constants";
import { CalendarView, type CalendarEventInput } from "@/components/calendar/calendar-view";
import { CreateMeetingForm } from "@/components/calendar/create-meeting-form";
import type { TaskStatus } from "@/lib/types";

export default async function CalendarPage() {
  const current = await getCurrentProfile();
  const supabase = await createClient();

  const [{ data: tasks }, { data: meetings }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title,deadline,status,creator_department_id,creator_department:departments(name)")
      .not("deadline", "is", null)
      .not("status", "in", "(cancelled)"),
    supabase
      .from("calendar_events")
      .select("*, department:departments(name)"),
  ]);

  const events: CalendarEventInput[] = [
    ...(tasks ?? []).map((t) => ({
      id: `task-${t.id}`,
      title: decrypt(t.title),
      start: t.deadline as string,
      // FullCalendar applies a default 1-hour duration to timed
      // (allDay: false) events with no explicit `end`. A deadline late in
      // the day (e.g. 11:30 PM) then ends past midnight, which FullCalendar
      // renders as spanning into the next day's cell. allDay events default
      // to exactly a 1-day duration instead, so they can never bleed into
      // the next cell — and the calendar never displays a time anyway.
      allDay: true,
      color: taskCalendarColor(t.status as TaskStatus, t.deadline, t.creator_department_id),
      extendedProps: {
        type: "task" as const,
        taskId: t.id,
        taskStatus: t.status as TaskStatus,
        departmentName: (t.creator_department as unknown as { name: string } | null)?.name ?? null,
      },
    })),
    ...(meetings ?? []).map((m) => ({
      id: `meeting-${m.id}`,
      title: m.title,
      start: m.start_at,
      end: m.end_at ?? undefined,
      allDay: m.all_day,
      color: departmentColor(m.department_id),
      extendedProps: {
        type: "meeting" as const,
        meetingLink: m.meeting_link,
        departmentName: (m.department as unknown as { name: string } | null)?.name ?? null,
      },
    })),
  ];

  const departmentLegend = Array.from(
    new Map(
      (tasks ?? [])
        .filter((t) => t.status !== "done" && t.status !== "blocked")
        .map((t) => [
          t.creator_department_id,
          {
            id: t.creator_department_id,
            name: (t.creator_department as unknown as { name: string } | null)?.name ?? "Unassigned",
            color: departmentColor(t.creator_department_id),
          },
        ])
    ).values()
  );

  const preview =
    current?.profile.role === "boss_boss" || current?.profile.role === "supervisor"
      ? await getPreview()
      : null;
  const canPostCompanyWide = current?.profile.role === "boss_boss" || current?.profile.role === "supervisor";
  const canCreateMeeting = current?.profile.role !== "employee" && !preview;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Calendar</h1>
        {canCreateMeeting && <CreateMeetingForm canPostCompanyWide={canPostCompanyWide} />}
      </div>
      <CalendarView events={events} departmentLegend={departmentLegend} />
    </div>
  );
}
