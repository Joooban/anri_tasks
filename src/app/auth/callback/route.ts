import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_DOMAIN = process.env.NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN;

// Exchanges the OAuth code for a session, then enforces access control
// server-side (the `hd` hint on the login page is only a UX nicety and can
// be bypassed). Two gates, both optional-if-unset so either can be used
// alone or together:
// - Workspace domain restriction, for a company that has one.
// - Email allowlist (0022_email_allowlist.sql), for one that doesn't —
//   this company's employees sign in with personal email addresses, so
//   there's no shared domain to check. Without either gate, any Google
//   account could sign in and read the full staff directory (profiles_select
//   is `to authenticated using (true)`).
// Any account that fails an active check is signed back out immediately.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/auth-error?reason=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/auth/auth-error?reason=exchange_failed`);
  }

  const email = data.user.email ?? "";
  const domain = email.split("@")[1]?.toLowerCase();

  if (ALLOWED_DOMAIN && domain !== ALLOWED_DOMAIN.toLowerCase()) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/auth/auth-error?reason=wrong_domain`);
  }

  const { data: allowed } = await supabase.rpc("is_email_allowed", { p_email: email });
  if (!allowed) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/auth/auth-error?reason=not_allowlisted`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
