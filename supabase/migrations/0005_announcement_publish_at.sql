-- Adds a scheduled publish time to announcements, so a department/Boss/
-- Supervisor can write an announcement now but have it become visible at a
-- specific future date and time (e.g. "posted" right as a meeting starts).
-- Defaults to now() so existing rows and the common "post immediately" case
-- both keep working unchanged.

alter table announcements
  add column publish_at timestamptz not null default now();

create index announcements_publish_at_idx on announcements(publish_at);
