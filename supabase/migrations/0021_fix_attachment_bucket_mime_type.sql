-- 0020 restricted the task-attachments bucket to a document/image MIME
-- allowlist, but that was written before attachment encryption (this
-- session, later) — every file is now encrypted before upload, so Storage
-- only ever receives application/octet-stream regardless of the real file
-- type, and every single upload was failing with "mime type
-- application/octet-stream is not supported".
--
-- The original per-type restriction still has real value, it just has to
-- move to application code (see the allowlist check in tasks/actions.ts),
-- since Storage can no longer see the real file type to enforce it. The
-- bucket itself just needs to accept the one type it will ever actually
-- receive now.
update storage.buckets
set allowed_mime_types = array['application/octet-stream']
where id = 'task-attachments';
