import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_DOMAIN = process.env.NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN;

// Exchanges the OAuth code for a session, then enforces the Workspace
// domain restriction server-side (the `hd` hint on the login page is only a
// UX nicety and can be bypassed). Any account outside the domain is signed
// back out immediately.
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

  return NextResponse.redirect(`${origin}${next}`);
}
