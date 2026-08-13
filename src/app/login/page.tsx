"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GOOGLE_WORKSPACE_DOMAIN } from "@/lib/constants";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${siteUrl}/auth/callback`,
        // Hints Google's account chooser to the Workspace domain. This is a
        // UX nicety only — the real enforcement happens server-side in
        // /auth/callback, since the hd param can be bypassed client-side.
        queryParams: GOOGLE_WORKSPACE_DOMAIN ? { hd: GOOGLE_WORKSPACE_DOMAIN } : undefined,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          ANRI Task Management
        </h1>
        <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          Sign in with your company Google account
          {GOOGLE_WORKSPACE_DOMAIN ? ` (@${GOOGLE_WORKSPACE_DOMAIN})` : ""} to continue.
        </p>
      </div>

      <button
        onClick={signIn}
        disabled={loading}
        className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-6 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <GoogleLogo />
        {loading ? "Redirecting…" : "Sign in with Google"}
      </button>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.5 0-14 4.2-17.7 10.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.5-2.1 14.2-5.6l-6.6-5.6C29.6 34.6 26.9 35.5 24 35.5c-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9.9 39.7 16.4 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C41.4 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}
