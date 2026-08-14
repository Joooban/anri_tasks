import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// SECURITY: bypasses RLS entirely. Only ever call this from trusted
// server-side code (Server Actions) that has already verified the caller
// is authorized to perform the write — never expose this client or its key
// to the browser.
//
// Used for the attachment upload path (storage.objects + task_attachments
// inserts), which relies on RLS WITH CHECK policies referencing
// can_view_task() — the same pattern that silently rejected valid writes
// for non-boss_boss accounts elsewhere in this project (tasks_insert,
// task_assignees_update; see PROJECT_CONTEXT.md and migrations 0013-0015).
// Rather than risk the same failure mode going undetected here too, the
// upload does its own authorization check in application code, then writes
// with a client that ignores RLS altogether — matching the SECURITY
// DEFINER RPC pattern used for every other write in this app, adapted for
// Storage (which isn't reachable through a plain Postgres function since
// the actual file bytes go through Supabase's Storage API, not PostgREST).
export function createServiceRoleClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
