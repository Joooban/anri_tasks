import Link from "next/link";

const REASONS: Record<string, string> = {
  wrong_domain:
    "That Google account isn't part of the company Workspace domain. Please sign in with your company email.",
  not_allowlisted:
    "This email hasn't been approved for access yet. Ask the Resident Manager to add it, then try again.",
  inactive:
    "This account no longer has access. If you think this is a mistake, contact the Resident Manager.",
  exchange_failed:"We couldn't complete sign-in. Please try again.",
  missing_code: "Sign-in was interrupted. Please try again.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = (reason && REASONS[reason]) || "Something went wrong signing you in.";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-center dark:bg-zinc-950">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Sign-in failed</h1>
      <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
      <Link
        href="/login"
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover dark:bg-brand dark:text-white dark:hover:bg-brand-hover"
      >
        Back to sign in
      </Link>
    </div>
  );
}
