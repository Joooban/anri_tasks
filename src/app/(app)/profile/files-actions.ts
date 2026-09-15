"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { encryptBuffer } from "@/lib/encryption";
import { friendlyError } from "@/lib/friendly-error";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MiB, matches the bucket limit (0035)

async function requireSelf() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, error: "Not signed in." } as const;
  return { userId: user.id, error: null } as const;
}

export async function uploadPersonalFile(_prevState: { error: string | null }, formData: FormData) {
  const { userId, error: authError } = await requireSelf();
  if (authError || !userId) return { error: authError ?? "Not signed in." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_FILE_BYTES) return { error: "That file is too large (25MB max)." };

  // Service role rather than the user's own session — same reasoning as
  // task-attachment/document-template uploads (see those actions):
  // authorization is checked above instead of depending on a storage
  // policy involving a lookup, which has a documented history in this
  // project of silently rejecting valid writes.
  const serviceRole = createServiceRoleClient();
  const path = `${userId}/${crypto.randomUUID()}-${file.name}`;
  const plainBytes = Buffer.from(await file.arrayBuffer());
  const encryptedBytes = encryptBuffer(plainBytes);

  const { error: uploadError } = await serviceRole.storage
    .from("personal-files")
    .upload(path, encryptedBytes, { contentType: "application/octet-stream" });
  if (uploadError) return { error: friendlyError(uploadError, "We couldn't upload that file") };

  const { error: insertError } = await serviceRole.from("personal_files").insert({
    owner_id: userId,
    storage_path: path,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type || null,
  });
  if (insertError) {
    await serviceRole.storage.from("personal-files").remove([path]);
    return { error: friendlyError(insertError, "We couldn't save that file") };
  }

  revalidatePath("/profile");
  return { error: null };
}

export async function deletePersonalFile(id: string) {
  const { userId, error: authError } = await requireSelf();
  if (authError || !userId) return { error: authError ?? "Not signed in." };

  // Service role bypasses RLS entirely, so ownership has to be checked
  // here in application code rather than relied on from a policy — look
  // the row up scoped to the caller's own id before touching anything.
  const serviceRole = createServiceRoleClient();
  const { data: row } = await serviceRole
    .from("personal_files")
    .select("storage_path")
    .eq("id", id)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!row) return { error: "File not found." };

  const { error } = await serviceRole.from("personal_files").delete().eq("id", id).eq("owner_id", userId);
  if (error) return { error: friendlyError(error, "We couldn't delete that file") };

  await serviceRole.storage.from("personal-files").remove([row.storage_path]);
  revalidatePath("/profile");
  return { error: null };
}
