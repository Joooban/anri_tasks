// Supabase's generated types (src/lib/database.types.ts, regenerated via
// `supabase gen types typescript`) can't express which scalar RPC
// parameters accept null — Postgres has no "not null" concept for plain
// function parameters the way it does for table columns, so the generator
// always types them as required. Several of this app's RPCs (see
// migrations 0013-0018) genuinely accept null for optional fields (e.g.
// an announcement's expires_at). This makes that intentional at each call
// site instead of an unexplained `as string`.
export function nullableRpcArg<T>(value: T | null): T {
  return value as T;
}
