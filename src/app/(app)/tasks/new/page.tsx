import { redirect } from "next/navigation";
import { getDepartments, getProfiles, getTaskTypes } from "@/lib/queries";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { TaskForm } from "@/components/tasks/task-form";

export default async function NewTaskPage() {
  const current = await getCurrentProfile();
  if (!current) redirect("/login");
  if (current.profile.role === "employee") redirect("/tasks");

  const [departments, profiles, taskTypes] = await Promise.all([
    getDepartments(),
    getProfiles(),
    getTaskTypes(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">New Task</h1>
      <TaskForm departments={departments} profiles={profiles} taskTypes={taskTypes} />
    </div>
  );
}
