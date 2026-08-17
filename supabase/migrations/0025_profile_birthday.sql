-- Client feedback: "Upcoming Birthdays" on Company Overview. Month/day only
-- — no birth year is stored, so this can only ever say "when," never
-- compute age. Admin-entered for now via the Accounts table (same place
-- role/department are managed), since Accounts is already the only place
-- these small-company prototype accounts get edited by someone other than
-- themselves.
alter table profiles
  add column birthday_month smallint check (birthday_month between 1 and 12),
  add column birthday_day smallint check (birthday_day between 1 and 31);
