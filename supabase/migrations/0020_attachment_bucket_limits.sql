-- Security review finding: the task-attachments bucket (0004_seed.sql) was
-- created with no file_size_limit or allowed_mime_types, so uploads were
-- unbounded in size and type — a storage-cost/abuse risk even though
-- uploads are already restricted to non-employee accounts. 25MB comfortably
-- covers documents/photos for this use case; the MIME list covers the
-- common office document, PDF, and image types a task attachment would
-- realistically be.
update storage.buckets
set
  file_size_limit = 26214400, -- 25 MiB
  allowed_mime_types = array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif'
  ]
where id = 'task-attachments';
