// `toLocaleString(undefined, ...)` lets the runtime's own timezone/locale
// leak into the formatted string — harmless for a Server Component (no
// re-render to diverge from), but a real bug in any Client Component: it
// renders once on the server (Vercel's runtime, not necessarily this
// Philippines-based company's timezone) and again during client hydration
// (the visitor's browser), and if those disagree, React throws a hydration
// mismatch (error #418) since the text content doesn't match. Fixing both
// the locale and the timeZone explicitly makes every environment compute
// the same string for a given instant, which fixes the hydration risk *and*
// makes server-rendered dates correct for this company's actual timezone
// regardless of which region Vercel happens to run the request in.
export const APP_TIME_ZONE = "Asia/Manila";

export function formatDateTime(value: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Date(value).toLocaleString("en-US", { timeZone: APP_TIME_ZONE, ...opts });
}

export function formatDate(value: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Date(value).toLocaleDateString("en-US", { timeZone: APP_TIME_ZONE, ...opts });
}
