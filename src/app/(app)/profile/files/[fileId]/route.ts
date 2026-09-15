import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { decryptBuffer } from "@/lib/encryption";

// Same shape as tasks/[id]/attachments/[attachmentId]/route.ts: file bytes
// are encrypted at rest, so a plain Storage signed URL would just hand the
// browser ciphertext. This route checks ownership against the
// personal_files row (RLS-scoped to owner_id = auth.uid()), fetches with
// the service role client, decrypts, and streams the real file back.
export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: file } = await supabase
    .from("personal_files")
    .select("storage_path, file_name, mime_type")
    .eq("id", fileId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const serviceRole = createServiceRoleClient();
  const { data: blob, error } = await serviceRole.storage.from("personal-files").download(file.storage_path);
  if (error || !blob) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let plainBytes: Buffer;
  try {
    plainBytes = decryptBuffer(Buffer.from(await blob.arrayBuffer()));
  } catch {
    return NextResponse.json({ error: "This file could not be read." }, { status: 410 });
  }

  const asciiName = file.file_name.replace(/[^\x20-\x7E]/g, "_");
  return new NextResponse(new Uint8Array(plainBytes), {
    headers: {
      "Content-Type": file.mime_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
