import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { getPreview } from "@/lib/get-preview";
import { decrypt } from "@/lib/encryption";
import { departmentColor, taskCalendarColor, PRESIDENT_TASK_COLOR } from "@/lib/constants";
import { CalendarView, type CalendarEventInput, type DepartmentLegendEntry } from "@/components/calendar/calendar-view";
import { CreateMeetingForm } from "@/components/calendar/create-meeting-form";
import type { TaskStatus } from "@/lib/types";

interface TaskHolder {
  departmentId: string | null;
  departmentName: string | null;
  isPresident: boolean;
}

export default async function CalendarPage() {
  const current = await getCurrentProfile();
  const supabase = await createClient();

  const [{ data: tasks }, { data: meetings }, { data: liveSteps }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title,deadline,status,creator_department_id,creator_department:departments(name)")
      .not("deadline", "is", null)
      .not("status", "in", "(cancelled)"),
    supabase
      .from("calendar_events")
      .select("*, department:departments(name)"),
    // Whoever is *currently* holding each task (the one non-terminal step in
    // its relay chain) — this is what a calendar dot's color should reflect,
    // not who created the task (see the "why is it Unassigned" confusion:
    // the President has no department of his own, so every task he creates
    // used to show as gray "Unassigned" regardless of who it was actually
    // assigned to).
    supabase
      .from("task_assignees")
      .select(
        "task_id,step_order,department_id,department:departments(name),profile:profiles(role,department_id,department:departments(name))"
      )
      .in("status", ["active", "pending_approval", "blocked"]),
  ]);

  // Only one step should ever be non-terminal at a time per the relay-chain
  // model, but sort by step_order first and keep the first-seen (earliest)
  // one per task defensively, rather than letting query/insertion order
  // decide silently if that's ever not true.
  const holderByTask = new Map<string, TaskHolder>();
  const sortedLiveSteps = [...(liveSteps ?? [])].sort((a, b) => a.step_order - b.step_order);
  for (const step of sortedLiveSteps) {
    if (holderByTask.has(step.task_id)) continue;

    const stepDept = step.department as unknown as { name: string } | null;
    const profile = step.profile as unknown as {
      role: string;
      department_id: string | null;
      department: { name: string } | null;
    } | null;

    const holder: TaskHolder = step.department_id
      ? { departmentId: step.department_id, departmentName: stepDept?.name ?? null, isPresident: false }
      : profile
        ? {
            departmentId: profile.department_id,
            departmentName: profile.department?.name ?? null,
            isPresident: profile.role === "boss_boss",
          }
        : { departmentId: null, departmentName: null, isPresident: false };

    holderByTask.set(step.task_id, holder);
  }

  const events: CalendarEventInput[] = [
    ...(tasks ?? []).map((t) => {
      // Tasks with no live step (fully done) fall back to who created it —
      // the dot's color is overridden to the neutral "done" gray anyway, so
      // this only affects the department name shown in the click-through
      // popup.
      const holder = holderByTask.get(t.id) ?? {
        departmentId: t.creator_department_id,
        departmentName: (t.creator_department as unknown as { name: string } | null)?.name ?? null,
        isPresident: false,
      };
      return {
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
        color: taskCalendarColor(t.status as TaskStatus, t.deadline, holder.departmentId, holder.isPresident),
        extendedProps: {
          type: "task" as const,
          taskId: t.id,
          taskStatus: t.status as TaskStatus,
          departmentName: holder.isPresident ? "President" : holder.departmentName,
        },
      };
    }),
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

  // A "president" legend id can never collide with a real department uuid,
  // so it's a safe dedup key alongside department ids and "unassigned".
  const legendMap = new Map<string, DepartmentLegendEntry>();
  for (const t of tasks ?? []) {
    if (t.status === "done" || t.status === "blocked") continue;
    const holder = holderByTask.get(t.id);
    if (holder?.isPresident) {
      legendMap.set("president", { id: "president", name: "President", color: PRESIDENT_TASK_COLOR });
    } else {
      const departmentId = holder ? holder.departmentId : t.creator_department_id;
      const departmentName = holder ? holder.departmentName : (t.creator_department as unknown as { name: string } | null)?.name;
      legendMap.set(departmentId ?? "unassigned", {
        id: departmentId,
        name: departmentName ?? "Unassigned",
        color: departmentColor(departmentId),
      });
    }
  }
  // President first (top of the hierarchy), then departments alphabetically,
  // "Unassigned" last — a stronger statement of hierarchy than the previous
  // arbitrary query-order listing.
  const departmentLegend = Array.from(legendMap.values()).sort((a, b) => {
    if (a.id === "president") return -1;
    if (b.id === "president") return 1;
    if (a.id === null) return 1;
    if (b.id === null) return -1;
    return a.name.localeCompare(b.name);
  });

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
