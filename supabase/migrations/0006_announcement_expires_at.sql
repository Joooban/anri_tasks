-- Announcements shouldn't stay visible forever. expires_at is nullable —
-- leave it blank for an announcement with no expiry (e.g. a standing
-- policy notice), or set it to have the announcement drop out of the feed
-- automatically after that date/time.

alter table announcements
  add column expires_at timestamptz;

create index announcements_expires_at_idx on announcements(expires_at);
