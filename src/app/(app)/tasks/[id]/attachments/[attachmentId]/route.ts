import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { decryptBuffer } from "@/lib/encryption";

// Attachment bytes are encrypted at rest (see encryptBuffer in
// tasks/actions.ts's upload path), so a plain Supabase Storage signed URL
// — the previous approach — would just hand the browser ciphertext. This
// route is now the only way to get a usable file back: it checks
// authorization against the task_attachments row (which respects RLS, via
// can_view_task), fetches the encrypted bytes with the service role client
// (same reasoning as the upload path — storage.objects' own RLS uses the
// same WITH CHECK-on-can_view_task shape documented as unreliable in
// PROJECT_CONTEXT.md, so authorization already happened above instead of
// depending on it), decrypts, and streams the real file back.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id: taskId, attachmentId } = await params;

  const supabase = await createClient();
  const { data: attachment } = await supabase
    .from("task_attachments")
    .select("storage_path, file_name, mime_type")
    .eq("id", attachmentId)
    .eq("task_id", taskId)
    .maybeSingle();

  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const serviceRole = createServiceRoleClient();
  const { data: blob, error } = await serviceRole.storage
    .from("task-attachments")
    .download(attachment.storage_path);

  if (error || !blob) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let plainBytes: Buffer;
  try {
    plainBytes = decryptBuffer(Buffer.from(await blob.arrayBuffer()));
  } catch {
    // Uploaded before encryption was added, or corrupted — see the
    // decryptBuffer doc comment for why there's no silent fallback here.
    return NextResponse.json(
      { error: "This file was uploaded before attachment encryption and can no longer be read." },
      { status: 410 }
    );
  }

  const asciiName = attachment.file_name.replace(/[^\x20-\x7E]/g, "_");
  return new NextResponse(new Uint8Array(plainBytes), {
    headers: {
      "Content-Type": attachment.mime_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.file_name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
