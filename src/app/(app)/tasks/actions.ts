"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { encrypt, encryptNullable, encryptBuffer } from "@/lib/encryption";
import { friendlyError } from "@/lib/friendly-error";
import { nullableRpcArg } from "@/lib/rpc-utils";
import { revalidateTaskRelatedPaths } from "@/lib/revalidate-task-paths";

// Attachments are encrypted before upload (see the upload loop below), so
// Storage itself can no longer see the real file type/size to enforce
// anything — the bucket accepts only application/octet-stream now
// (0021_fix_attachment_bucket_mime_type.sql). This is where that
// validation actually happens instead. Keep this list in sync with the
// original allowlist from 0020_attachment_bucket_limits.sql.
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MiB, matches the old bucket-level limit

const chainStepSchema = z
  .object({
    assignee_type: z.enum(["department", "individual"]),
    department_id: z.string().uuid().nullable(),
    profile_id: z.string().uuid().nullable(),
    requires_confirmation: z.boolean(),
  })
  // The DB's task_assignees_target_check constraint already enforces this,
  // but catching it here first turns a raw constraint-violation 500 (with
  // an unhelpful "we couldn't create the task") into an error that
  // actually says what to fix — this happens when a step's type is left
  // as "Department"/"Individual" but no actual department/person was
  // picked from the still-blank "Select…" option.
  .refine((step) => (step.assignee_type === "department" ? step.department_id !== null : step.profile_id !== null), {
    message: "Every chain step needs a department or person selected.",
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
    p_title: encrypt(input.title),
    p_description: nullableRpcArg(encryptNullable(input.description)),
    p_task_type_id: nullableRpcArg(input.task_type_id),
    p_deadline: nullableRpcArg(input.deadline ? new Date(input.deadline).toISOString() : null),
    p_is_personal: input.is_personal,
    p_chain: input.chain,
    p_visibility: input.visibility,
  });

  if (rpcError || !taskId) {
    return { error: friendlyError(rpcError, "We couldn't create the task") };
  }

  const files = formData.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0);
  const failedFiles: string[] = [];

  if (files.length > 0) {
    // Uses the service role client rather than the user's own session: the
    // storage.objects and task_attachments RLS policies gate writes with
    // WITH CHECK (... and can_view_task(...)) — the same shape of policy
    // that silently rejected valid writes elsewhere in this project (see
    // PROJECT_CONTEXT.md). The user was already authorized above (passed
    // the employee check and successfully created this exact task via
    // create_task_rpc), so no further per-file check is needed here.
    const serviceRole = createServiceRoleClient();
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_BYTES || !ALLOWED_ATTACHMENT_MIME_TYPES.has(file.type)) {
        failedFiles.push(file.name);
        continue;
      }
      const path = `${taskId}/${Date.now()}-${file.name}`;
      // File content is encrypted before it ever reaches Storage — what's
      // stored there is ciphertext, not the real file, so it's served with
      // a generic content type rather than the original one. Only the
      // decrypt route (src/app/(app)/tasks/[id]/attachments/[attachmentId]/
      // route.ts) can turn it back into the real file; the original name/
      // size/type are kept as plain metadata to render/serve it correctly.
      const plainBytes = Buffer.from(await file.arrayBuffer());
      const encryptedBytes = encryptBuffer(plainBytes);
      const { error: uploadError } = await serviceRole.storage
        .from("task-attachments")
        .upload(path, encryptedBytes, { contentType: "application/octet-stream" });
      if (uploadError) {
        failedFiles.push(file.name);
        continue;
      }
      const { error: insertError } = await serviceRole.from("task_attachments").insert({
        task_id: taskId,
        storage_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: profile.id,
      });
      if (insertError) failedFiles.push(file.name);
    }
  }

  revalidateTaskRelatedPaths();
  // The task itself was already created successfully by this point, so a
  // failed attachment shouldn't block redirect or discard the form (which
  // would also risk a duplicate task on resubmit) — surface it as a banner
  // on the task page instead of a hard error here.
  redirect(
    failedFiles.length > 0
      ? `/tasks/${taskId}?attachmentError=${encodeURIComponent(failedFiles.join(", "))}`
      : `/tasks/${taskId}`
  );
}
