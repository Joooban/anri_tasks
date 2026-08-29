import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security review finding: no HTTP security headers were set at all.
  // These four are safe, well-understood defaults. Content-Security-Policy
  // is handled separately, per-request, in src/lib/supabase/middleware.ts
  // (needs a fresh nonce every request, which a static header here can't
  // provide) — see that file for the actual policy.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Prevents this app from being embedded in an iframe on another
          // site — without this, a malicious page could frame it and trick
          // a logged-in user into clicking real actions (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          // Stops the browser from guessing a file's type from its
          // content and executing it as something else (e.g. treating an
          // uploaded attachment as HTML/JS).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Don't leak the full URL (which can contain task/announcement
          // IDs) to third-party sites via the Referer header on outbound
          // links (e.g. an attachment's external link, if any).
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Explicitly denies access to sensitive device APIs this app
          // never uses.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
