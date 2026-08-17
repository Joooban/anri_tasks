"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { friendlyError } from "@/lib/friendly-error";

const ALLOWED_TEMPLATE_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const MAX_TEMPLATE_BYTES = 25 * 1024 * 1024; // 25 MiB, matches the bucket limit (0026)

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, error: "Not signed in." } as const;

  const { data: caller } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!caller || (caller.role !== "boss_boss" && caller.role !== "supervisor")) {
    return { userId: null, error: "Only the President or Supervisors can manage document templates." } as const;
  }
  return { userId: user.id, error: null } as const;
}

export async function uploadDocumentTemplate(_prevState: { error: string | null }, formData: FormData) {
  const { userId, error: authError } = await requireAdmin();
  if (authError || !userId) return { error: authError ?? "Not signed in." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_TEMPLATE_BYTES) return { error: "That file is too large (25MB max)." };
  if (!ALLOWED_TEMPLATE_MIME_TYPES.has(file.type)) {
    return { error: "That file type isn't supported. Use PDF, Word, Excel, or PowerPoint." };
  }

  // Same reasoning as the task-attachment upload path (tasks/actions.ts):
  // service role rather than the user's own session, with authorization
  // already checked above instead of depending on a storage.objects policy.
  const serviceRole = createServiceRoleClient();
  const path = `${crypto.randomUUID()}-${file.name}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await serviceRole.storage
    .from("document-templates")
    .upload(path, bytes, { contentType: file.type });
  if (uploadError) return { error: friendlyError(uploadError, "We couldn't upload that file") };

  const { error: insertError } = await serviceRole
    .from("document_templates")
    .insert({ file_name: file.name, storage_path: path, uploaded_by: userId });
  if (insertError) {
    await serviceRole.storage.from("document-templates").remove([path]);
    return { error: friendlyError(insertError, "We couldn't save that template") };
  }

  revalidatePath("/departments");
  return { error: null };
}

export async function deleteDocumentTemplate(id: string, storagePath: string) {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const serviceRole = createServiceRoleClient();
  const { error } = await serviceRole.from("document_templates").delete().eq("id", id);
  if (error) return { error: friendlyError(error, "We couldn't delete that template") };

  await serviceRole.storage.from("document-templates").remove([storagePath]);
  revalidatePath("/departments");
  return { error: null };
}
