// Server actions must never hand a raw Postgres/PostgREST error string back
// to the browser (things like `new row violates row-level security policy
// for table "tasks"` mean nothing to a non-technical user, and can leak
// schema details). Log the real error server-side for debugging, return a
// short human sentence for the UI.
export function friendlyError(raw: unknown, message: string): string {
  console.error(`[${message}]`, raw);
  return `${message}. Please try again — if it keeps happening, let support know.`;
}
