# ANRI Task Management System — Prototype

Task relay/handoff management, department dashboards, and a company-wide
executive dashboard for ANRI / RCMC BNLMP Management. See the project brief
shared with this repo for full requirements; this file covers local setup.

**Status:** Month-1 prototype. Built under the developer's personal
Vercel/Supabase/GitHub accounts — see "Moving to production" below.

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind CSS 4)
- Supabase (Postgres + Auth + Storage), access controlled entirely via
  Postgres Row Level Security — see `supabase/migrations/`
- FullCalendar for the calendar view
- A hand-rolled service worker for installable PWA + offline viewing of
  already-visited pages (no next-pwa/Workbox dependency)

## 1. Create a Supabase project

1. Create a free project at [supabase.com](https://supabase.com) (closest
   region to the Philippines is Singapore).
2. In the SQL Editor, run the migrations in `supabase/migrations/` **in
   order**: `0001_schema.sql`, `0002_functions_triggers.sql`,
   `0003_rls.sql`, `0004_seed.sql`.
3. Under Authentication → Providers, enable Google and add your OAuth
   Client ID/Secret (Google Cloud Console → OAuth consent screen restricted
   to internal/Workspace users, plus a Web OAuth client with the Supabase
   callback URL as an authorized redirect URI).
4. Under Authentication → URL Configuration, add
   `http://localhost:3000/auth/callback` (and your production URL once
   deployed) as a redirect URL.

## 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project
  Settings → API in the Supabase dashboard.
- `NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN` — the company's Google Workspace
  domain (e.g. `arcnickel.com`). Sign-in is restricted to this domain both
  as a UX hint on the login button and, more importantly, enforced
  server-side in `src/app/auth/callback/route.ts`.
- `NEXT_PUBLIC_SITE_URL` — `http://localhost:3000` locally.

## 3. Provision the first account

New Google sign-ins auto-create a `profiles` row (via the
`handle_new_auth_user` trigger) with `role = 'employee'` and no
department — they'll see a "pending setup" screen until assigned. To
bootstrap the very first admin account, sign in once, then in the
Supabase SQL Editor run:

```sql
update profiles set role = 'boss_boss' where email = 'you@yourdomain.com';
-- or role = 'supervisor', plus department_id for department/employee accounts
```

After that, Supervisors/Boss can manage other accounts' role and
department directly in the `profiles` table (a dedicated admin UI for this
is a good next increment — see below).

## 4. Run locally

```bash
npm install
npm run dev
```

## What's implemented (Month 1 scope)

- Google Sign-In restricted to the Workspace domain
- Role-based accounts (President / Supervisor / Department / Employee)
  with Postgres RLS enforcing visibility, not just the frontend
- Task creation with an ordered, reorderable relay/handoff assignee chain
  (departments and/or individuals), optional "next step confirms" gating,
  visibility beyond the chain, file attachments, deadlines, task types
- Automatic chain advancement + status roll-up + append-only audit log,
  implemented as Postgres triggers (`supabase/migrations/0002_...sql`) so
  it's correct even under concurrent updates
- Department dashboards (completion rate, meetings, overdue/blocked,
  upcoming deadlines, announcements)
- Boss Boss dashboard: completion rate, red/yellow/green department
  health, overdue/blocked, upcoming deadlines, announcements,
  clickable department drill-down tiles, plus a toggle/reorder widget
  catalog (`Customize` button)
- Calendar (FullCalendar) combining task deadlines and meetings,
  color-coded per department, with a "Join" button for meeting links
- History tab: completed/cancelled tasks with a per-task expandable full
  audit trail
- "Copy for Viber" button (clipboard) + Web Share API (native share sheet
  on mobile, where Viber appears directly)
- Installable, mobile-responsive PWA with light/dark mode and offline
  viewing of previously visited pages

## Known gaps / next steps

- **Department org chart is incomplete.** `supabase/migrations/0004_seed.sql`
  seeds the 12 full-account departments and the two General Contractor
  filter tags exactly as specified in the brief, but deliberately does
  *not* guess the parent department for the "various deeper sub-boxes"
  (Safety/Health Sections, Planning & Cost Control, Tenement & Survey,
  etc.) — that mapping needs to come from the client.
- **No admin UI yet** for account provisioning (role/department
  assignment) or editing task types — both are plain tables editable via
  the Supabase dashboard for now. Worth building before real rollout since
  account provisioning is supposed to be the Resident Manager's job, not a
  SQL Editor task.
- **No TypeScript types generated from the database.** Once the Supabase
  project exists, run `npx supabase gen types typescript --project-id
  <id> > src/lib/database.types.ts` and wire it into
  `createClient<Database>()` in `src/lib/supabase/{client,server}.ts` for
  full query type-safety.
- **Google Meet auto-generation** isn't wired up — meeting links are a
  manual optional field for now. Auto-creating a Meet link needs the
  Calendar API and an additional OAuth scope/consent step beyond basic
  sign-in.
- **Highlight-and-comment annotation, AI daily summary, offline editing**
  — all explicitly phase 2 per the brief.
- Task type categories (`task_types` table) are seeded with placeholders
  (General/Maintenance/Compliance/Safety/Administrative/Operations)
  pending client confirmation.


