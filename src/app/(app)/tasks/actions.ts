"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/friendly-error";
import { revalidateTaskRelatedPaths } from "@/lib/revalidate-task-paths";

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
    .select("id, department_id, role")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "No profile found for this account." };
  if (profile.role === "employee") return { error: "Employees can't create tasks." };

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

  // Task + assignee chain + visibility + audit log all happen atomically
  // inside this one SECURITY DEFINER function rather than as separate
  // client-side inserts — see 0013_create_task_rpc.sql for why.
  const { data: taskId, error: rpcError } = await supabase.rpc("create_task_rpc", {
    p_title: input.title,
    p_description: input.description || null,
    p_task_type_id: input.task_type_id,
    p_deadline: input.deadline ? new Date(input.deadline).toISOString() : null,
    p_is_personal: input.is_personal,
    p_chain: input.chain,
    p_visibility: input.visibility,
  });

  if (rpcError || !taskId) {
    return { error: friendlyError(rpcError, "We couldn't create the task") };
  }

  const files = formData.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of files) {
    const path = `${taskId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("task-attachments")
      .upload(path, file);
    if (!uploadError) {
      await supabase.from("task_attachments").insert({
        task_id: taskId,
        storage_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: profile.id,
      });
    }
  }

  revalidateTaskRelatedPaths();
  redirect(`/tasks/${taskId}`);
}
