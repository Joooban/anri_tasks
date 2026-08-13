import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Safe to use in Client Components — relies on
// the anon key and Postgres Row Level Security to enforce access control.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
