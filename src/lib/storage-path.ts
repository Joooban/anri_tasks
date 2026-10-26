// Uploaded file names are client-controlled and were being used verbatim
// as part of the Storage object key — a name containing "/" or ".." could
// change which folder the object lands in, and the folder segment is what
// the storage policies key ownership off. Only the key is sanitized; the
// original name is still stored as plain metadata (file_name) and used for
// display and the download's Content-Disposition.
export function safeStorageName(fileName: string): string {
  const cleaned = fileName
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/\.{2,}/g, "_")
    .slice(0, 100);
  return cleaned || "file";
}
