import { revalidatePath } from "next/cache";

// Every place that shows a completion rate, a done-count, or department
// health depends on tasks.status. The task detail page was the only path
// getting revalidated after a status change, so dashboards, the company
// overview, history, and the calendar kept showing pre-change data until a
// hard refresh (or enough time passed) — this is what a task mutation
// should actually invalidate.
export function revalidateTaskRelatedPaths(taskId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/departments");
  revalidatePath("/departments/[slug]", "page");
  revalidatePath("/history");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  if (taskId) revalidatePath(`/tasks/${taskId}`);
}
