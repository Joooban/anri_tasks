"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/friendly-error";

const chainStepSchema = z.object({
  assignee_type: z.enum(["department", "individual"]),
  department_id: z.string().uuid().nullable(),
  profile_id: z.string().uuid().nullable(),
  requires_confirmation: z.boolean(),
});

const visibilitySchema = z.object({
  department_id: z.string().uuid().nullable(),
  profile_id: z.string().uuid().nullable(),
});

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(10_000).optional(),
  task_type_id: z.string().uuid().nullable(),
  deadline: z.string().optional(),
  is_personal: z.boolean(),
  chain: z.array(chainStepSchema).min(1, "At least one assignee is required"),
  visibility: z.array(visibilitySchema),
});

export interface CreateTaskState {
  error: string | null;
}

export async function createTask(
  _prevState: CreateTaskState,
  formData: FormData
): Promise<CreateTaskState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, department_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "No profile found for this account." };

  const raw = {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    task_type_id: (formData.get("task_type_id") as string) || null,
    deadline: (formData.get("deadline") as string) || undefined,
    is_personal: formData.get("is_personal") === "on",
    chain: JSON.parse(String(formData.get("chain") ?? "[]")),
    visibility: JSON.parse(String(formData.get("visibility") ?? "[]")),
  };

  const parsed = createTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid form data." };
  }
  const input = parsed.data;

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      title: input.title,
      description: input.description || null,
      task_type_id: input.task_type_id,
      created_by: profile.id,
      creator_department_id: profile.department_id,
      deadline: input.deadline ? new Date(input.deadline).toISOString() : null,
      is_personal: input.is_personal,
    })
    .select("id")
    .single();

  if (taskError || !task) {
    return { error: friendlyError(taskError, "We couldn't create the task") };
  }

  const assigneeRows = input.chain.map((step, index) => ({
    task_id: task.id,
    step_order: index + 1,
    assignee_type: step.assignee_type,
    department_id: step.department_id,
    profile_id: step.profile_id,
    requires_confirmation: step.requires_confirmation,
    status: index === 0 ? "active" : "pending",
    started_at: index === 0 ? new Date().toISOString() : null,
  }));

  const { error: assigneeError } = await supabase.from("task_assignees").insert(assigneeRows);
  if (assigneeError) return { error: friendlyError(assigneeError, "We couldn't set up the assignee chain") };

  if (input.visibility.length > 0) {
    const { error: visibilityError } = await supabase.from("task_visibility").insert(
      input.visibility.map((v) => ({
        task_id: task.id,
        department_id: v.department_id,
        profile_id: v.profile_id,
      }))
    );
    if (visibilityError) return { error: friendlyError(visibilityError, "We couldn't save the visibility settings") };
  }

  // First step starts 'active' via direct insert above rather than an
  // update, so the auto-advance trigger (which only fires on UPDATE) never
  // runs for it — log its activation explicitly here to keep the audit
  // trail complete.
  await supabase.from("audit_log").insert({
    task_id: task.id,
    actor_id: profile.id,
    action: "step_activated",
    details: { step_order: 1 },
  });

  const files = formData.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of files) {
    const path = `${task.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("task-attachments")
      .upload(path, file);
    if (!uploadError) {
      await supabase.from("task_attachments").insert({
        task_id: task.id,
        storage_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: profile.id,
      });
    }
  }

  redirect(`/tasks/${task.id}`);
}
