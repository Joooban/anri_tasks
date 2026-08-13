import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { departmentColor } from "@/lib/constants";
import { CalendarView, type CalendarEventInput } from "@/components/calendar/calendar-view";
import { CreateMeetingForm } from "@/components/calendar/create-meeting-form";

export default async function CalendarPage() {
  const current = await getCurrentProfile();
  const supabase = await createClient();

  const [{ data: tasks }, { data: meetings }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title,deadline,creator_department_id,creator_department:departments(name)")
      .not("deadline", "is", null)
      .not("status", "in", "(cancelled)"),
    supabase
      .from("calendar_events")
      .select("*, department:departments(name)"),
  ]);

  const events: CalendarEventInput[] = [
    ...(tasks ?? []).map((t) => ({
      id: `task-${t.id}`,
      title: t.title,
      start: t.deadline as string,
      color: departmentColor(t.creator_department_id),
      extendedProps: {
        type: "task" as const,
        taskId: t.id,
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

  const canPostCompanyWide = current?.profile.role === "boss_boss" || current?.profile.role === "supervisor";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Calendar</h1>
        <CreateMeetingForm canPostCompanyWide={canPostCompanyWide} />
      </div>
      <CalendarView events={events} />
    </div>
  );
}
