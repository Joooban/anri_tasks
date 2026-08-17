import { redirect } from "next/navigation";
import { getDepartments, getProfiles, getTaskTypes } from "@/lib/queries";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { getPreview } from "@/lib/get-preview";
import { TaskForm } from "@/components/tasks/task-form";

export default async function NewTaskPage() {
  const current = await getCurrentProfile();
  if (!current) redirect("/login");
  if (current.profile.role === "employee") redirect("/tasks");

  const isPreviewing =
    (current.profile.role === "boss_boss" || current.profile.role === "supervisor") &&
    (await getPreview()) !== null;
  if (isPreviewing) redirect("/tasks");

  const [departments, allProfiles, taskTypes] = await Promise.all([
    getDepartments(),
    getProfiles(),
    getTaskTypes(),
  ]);
  // Removed accounts (see 0028_user_deactivation.sql) shouldn't be pickable
  // for new work going forward — they stay in the app's history untouched.
  const profiles = allProfiles.filter((p) => !p.deactivated_at);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">New Task</h1>
      <TaskForm departments={departments} profiles={profiles} taskTypes={taskTypes} />
    </div>
  );
}
