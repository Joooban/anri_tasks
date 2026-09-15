import { createClient } from "@/lib/supabase/server";

export interface PersonalFileItem {
  id: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
}

// personal_files_select (0035_personal_files.sql) scopes this to the
// caller's own rows (owner_id = auth.uid()) — no explicit filter needed
// here, same as every other RLS-scoped list query in this app.
export async function getMyFiles(): Promise<PersonalFileItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("personal_files")
    .select("id,file_name,file_size,mime_type,created_at")
    .order("created_at", { ascending: false });

  return (data ?? []).map((f) => ({
    id: f.id,
    fileName: f.file_name,
    fileSize: f.file_size,
    mimeType: f.mime_type,
    createdAt: f.created_at,
  }));
}
