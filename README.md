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


