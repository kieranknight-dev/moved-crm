# MOVED. CRM — project context for Claude Code

## What this is
A companion webapp to the MOVED iOS app. Georgia (Kieran's wife) uses it to
build, schedule, and publish workouts through a UI that mirrors the app's own
Manual Workout Builder. It writes into the same Supabase project the iOS app
reads from (`kdyxeqynlreydzhqffhm.supabase.co`).

This is intentionally scoped as a CMS/CRM for workouts first. Community and
other CRM features are explicitly deferred — same "real core loop before
extra surface area" sequencing that was used for the iOS app.

## Stack
Next.js (App Router) + TypeScript + Tailwind + Supabase JS (`@supabase/ssr`).
Deploy target: Vercel.

## Current state (step 1 of the build order done — 2026-07-16)
- Schema confirmed against the live database. Real facts, which differ from
  the original scaffold guesses:
  - Tables: `profiles`, `workouts`, `workout_history`, `gigi_usage`,
    `exercises`. There is **no** `workout_exercises` junction — a workout's
    exercises are a JSONB array on `workouts.exercises` (shape mirrors the
    Swift `Exercise` struct; see `WorkoutExercise` in `lib/types.ts`).
  - Format values (case-sensitive, must match Swift raw values):
    'Rounds' | 'AMRAP' | 'EMOM' | 'For Time' | 'Tabata' | 'Circuit'.
  - Source values: 'coach' | 'aiGenerated' | 'saved' | 'userCreated'.
    The CRM writes 'coach' rows only.
  - No `status` / `publish_at` columns yet — those land in step 5.
- `exercises` table created and seeded (874 rows from the iOS bundle's
  `exercises.json`; name UNIQUE, 6-category CHECK, authenticated-read RLS,
  service-role-only writes). Migrations live in `../supabase/migrations/`
  and were applied with `supabase db push`. The iOS repo's previously
  unapplied `workouts_persistence_migration.sql` was applied at the same
  time (adds `rest_between_rounds_seconds` / `for_time_cap_seconds`, makes
  `workout_history.workout_id` nullable). The iOS app still reads its
  bundled JSON — switching it to the table is a separate iOS-side task.
- `lib/database.types.ts` — generated from the live schema
  (`supabase gen types typescript --linked`, run from `../`). Regenerate
  after every migration. `lib/types.ts` — hand-written domain types
  layered on top; both Supabase clients are typed with `Database`.
- `.env.local` — URL + anon key filled in (same public key the iOS app
  ships). `SUPABASE_SERVICE_ROLE_KEY` is still a placeholder — paste it
  from Supabase dashboard → Project Settings → API before building
  publish/admin writes.
- **Design tokens applied** (step 2). `tailwind.config.js` now carries the
  real "Blush on White" v2 palette from `design-reference/design-tokens.md`
  (blush-500 `#E58AA1`, blush-600 `#C9587E`, warm-ink neutrals, card/cta
  shadows). Archivo (variable) + Space Grotesk are wired via
  `next/font/local` in `app/layout.tsx`, exposed as `font-display` /
  `font-body`; the TTFs live in `app/fonts/`.
  - **Design-doc version conflict to know about**: `design-tokens.md`
    (Jul 12, flat-white v2) is authoritative and is what's applied. The
    older `design-tokens1.md` (Jun 18) and the dashboard mockups
    (`MOVED Dashboard.dc.html`, `figma_import/02 Dashboard.html`) are the
    superseded v1 gradient scheme. The dashboard here reuses the mockups'
    *layout patterns* (stat grid, rings, breakdowns) re-skinned to v2.
    `MOVED Home - Blush (standalone).html` (Jul 12) is a good v2 reference.
- **Auth is live** (step 3). Email/password via Supabase Auth, restricted to
  a fixed two-person allowlist (`lib/auth.ts` → `ADMIN_EMAILS`): Kieran +
  Georgia. Enforced in three places that must stay in sync: the login server
  action (`app/login/actions.ts`), the middleware (`middleware.ts` →
  `lib/supabase/middleware.ts` — redirects anon → `/login`, signs out
  non-allowlisted sessions), and Postgres RLS (`public.is_crm_admin()` in
  `supabase/migrations/20260717090000_admin_coach_writes.sql`, which grants
  INSERT/UPDATE/DELETE on `source='coach'` workouts to those two emails).
  - Route group: authenticated pages live under `app/(app)/` with the sidebar
    shell + sign-out in `app/(app)/layout.tsx`; `app/login/` sits outside it
    (no sidebar). Root `app/layout.tsx` is just html/body/fonts. The route
    group doesn't change URLs.
  - `lib/supabase/server.ts` uses the modern `getAll/setAll` cookie API.
  - Both admin accounts ALREADY EXIST in Supabase (they're the same accounts
    Kieran + Georgia use to log into the iOS app — confirmed present with the
    exact allowlist emails). They sign in with their existing app passwords;
    no account creation was needed. Recommended: turn OFF "Allow new users to
    sign up" in Auth settings (there's no signup UI, and middleware+RLS
    already gate access, but this is belt-and-braces).
- `/dashboard` — **new** admin analytics page (server-rendered,
  `dynamic = 'force-dynamic'`). Live app-wide stats via
  `lib/dashboard.ts::getDashboardStats()` using the service-role admin
  client (`lib/supabase/admin.ts`) so it bypasses RLS: user/pro counts,
  workout breakdowns by format/category/source (format donut uses the
  per-format accent colors), session completion ring, 7d/30d activity, and
  Gigi usage. Presentational pieces in `components/dashboard.tsx` are pure
  server components with hand-built SVG charts (no chart lib). Needs
  `SUPABASE_SERVICE_ROLE_KEY` set or it shows a friendly error.
- `/` — simple landing; primary CTA points at `/dashboard`.
- **Publishing lifecycle** (step 5). `workouts` now has `status`
  ('draft'|'scheduled'|'published'|'archived', default 'published') and
  `publish_at` (timestamptz). Migration
  `supabase/migrations/20260717150000_workout_status_publishing.sql`
  backfilled every existing row to published + due, so the live app saw no
  change. **App visibility is enforced by RLS**: the coach SELECT policy now
  only exposes `status='published' AND publish_at <= now()` coach rows —
  drafts and future-scheduled workouts are hidden from the app (incl. from
  admins in the app) with no iOS change and no cron. Verified end-to-end via
  rolled-back role simulation: admin insert allowed, non-admin blocked,
  drafts/scheduled invisible to a normal authenticated user.
- `/library` — admin-only view of ALL coach content via the **service-role
  admin client** (`createAdminClient`, bypasses RLS) so it sees drafts +
  scheduled that the app can't. Scoped to `source='coach'`. Table
  (`LibraryTable.tsx`) has client-side filter chips for status (All / Published
  / Scheduled / Draft / Archived) and format; per-row actions are Edit
  (→ `/builder?id=<uuid>`), Duplicate (copies as fresh draft), and Archive
  (soft delete, status='archived'; becomes Restore for archived rows).
  **Service-role write pattern** (`requireAdminClient()` in
  `lib/supabase/require-admin.ts`): all CRM coach mutations (create, update,
  archive, restore, duplicate) verify the admin email allowlist in-action, then
  run as service role. **Why**: the coach SELECT policy hides non-published rows
  from everyone (including admins), but Postgres rejects an UPDATE whose result
  would fail the SELECT policy — so drafting a row via the admin's own session
  would hit RLS 42501. Rather than leak drafts into the admins' app, writes run
  as service role, gated by the admin check (middleware + RLS policies back it
  up).
- `/builder` — **real Manual Builder** (step 4). Client UI in
  `app/(app)/builder/BuilderClient.tsx` faithfully ports the iOS
  ManualWorkoutBuilder: all six formats (the `Rounds` format is labelled
  "Strength" in the chips, a MOVED convention), same-every-round vs
  custom-rounds toggle (with per-round grouping + duplicate-round), per-format
  settings (rounds/rest chips, AMRAP & For-Time caps, EMOM minutes), and
  per-exercise Reps|Time + Sets/Rest editing. Exercise picker
  (`ExercisePicker.tsx`) searches the 874-row table (prefix-then-contains
  ranking, category filter, custom-name fallback). Plus CRM-only "coach
  details" (category, difficulty, equipment, description, is_new, posted_ago).
  - All builder logic (estimate, summary, detail strings, insert payload) is a
    pure port in `lib/builder.ts` — the single source of truth used by both
    the live UI and the server action. Covered by a logic test
    (scratchpad/builder-test.ts, 30 assertions across all formats).
  - **Publish choice** (step 5): a Draft / Schedule / Publish now selector.
    Schedule reveals a datetime-local input; the client converts it to an
    absolute ISO timestamp (the server must not re-interpret local time).
    `resolvePublish()` in `lib/builder.ts` maps the choice → status +
    publish_at and rejects past/blank schedule times.
  - **Edit mode** (step 6): with `?id=<uuid>`, the page loads the workout via
    admin client and reconstructs builder state via `builderStateFromWorkout()`
    (best-effort reverse of `buildInsert` — CRM-created workouts round-trip
    cleanly; legacy free-form details like "10 reps each side" parse to their
    leading number). `publishInitFromStatus()` sets the Draft/Schedule/Publish
    selector from the workout's status. `BuilderClient` takes optional `init`
    prop; when editing it calls `updateCoachWorkout` instead of
    `createCoachWorkout` and the heading reads "Edit workout".
  - Save: `app/(app)/builder/actions.ts::createCoachWorkout` (create) and
    `updateCoachWorkout` (edit) rebuild the payload server-side via `buildInsert`
    (forces source='coach', user_id=null, applies the resolved status/publish_at),
    so the client can't inject columns; both run through `requireAdminClient()` for
    the service-role write (see `/library` note above). They do NOT `.select()` the
    inserted/updated row — a draft/scheduled row isn't visible under the coach
    SELECT policy, so RETURNING it would trip RLS (the iOS insert skips the
    round-trip for the same reason). On success routes to `/library`. The
    Save button is disabled while an exercise card is expanded (mirrors iOS)
    and while saving.
  - Verified end-to-end (auth temporarily bypassed with owner permission):
    the builder renders, format switching, the 874-row picker + search, add/
    edit/collapse, publish-mode + datetime, library filters, edit pre-fill, and
    the admin guard rejecting mutations when unsigned all work. Logic test
    (scratchpad/builder-test.ts) covers all formats + publish modes + a
    round-trip (buildInsert → builderStateFromWorkout → buildInsert stable).
    Fixed a real bug found in testing: `addExercise` called `setExpandedId`
    inside the setState updater, which desynced under StrictMode's
    double-invocation — now built outside the (pure) updater.
- Gotcha for whoever runs the dev server: after moving routes or switching
  git branches, a stale `.next` cache causes `Cannot find module './N.js'`
  or `__webpack_require__.n` errors. Fix: stop the server, `rm -rf .next`,
  restart. Never run `next build` while the dev server is live (they share
  `.next`).
- **Security hardening** (2026-07-18). Upgraded Next to **14.2.35** (patches
  the Dec-2025 advisory). Applied `supabase/migrations/2026071809000{0,1}_*`:
  pinned `is_crm_admin` search_path, revoked public RPC EXECUTE on the
  `handle_new_user`/`protect_is_pro` trigger functions, and narrowed the
  `avatars` storage bucket read policy (was "list all files" → own-folder
  only; public avatar display unaffected — public-bucket URLs bypass storage
  RLS). Supabase security advisor is clean except one **manual** item:
  **Leaked Password Protection is OFF** — enable it in the dashboard
  (Auth → Providers/Password). Other owner-only follow-ups: enable MFA for
  both admin accounts, and (on Vercel) set `SUPABASE_SERVICE_ROLE_KEY` as a
  server-only env var.
  - **Correction**: earlier notes said to disable public sign-ups — DON'T. The
    Supabase auth setting is project-wide; the iOS app needs open signup for
    real users. The CRM stays secure regardless (middleware allowlist +
    in-action admin check + RLS). Leaked-password protection is a **Pro-plan**
    feature and isn't available on the current **Free** plan (org `byKnight`) —
    set a strong minimum password length in Auth settings instead. MFA (TOTP)
    is a build, not a toggle — deferred.
- **Gigi AI usage & cost tracking** (2026-07-18). The `generate-workout` edge
  function runs on **Anthropic `claude-sonnet-4-6`** (a current model — $3/M
  input, $15/M output). It now logs `mode`/`model`/`input_tokens`/
  `output_tokens` to `gigi_usage` for both generate and swap (migration
  `20260718100000_gigi_usage_tokens.sql` added the columns + backfilled old
  rows to `mode='generate'`; the free-tier rate limit now counts
  `mode='generate'` only, so swaps no longer eat the 5/mo quota). The dashboard
  has a **Gigi AI usage & cost** card (`getDashboardStats().gigiUsage` +
  `GIGI_PRICING` in `lib/dashboard.ts`): run counts (gen/swap split), token
  totals, and estimated USD cost (all-time + 30-day). Redeploy the function
  with `supabase functions deploy generate-workout` (no Docker needed) after
  edits.
- **Gigi free-tier limits** (2026-07-18). Free users: **10 generations/mo**
  (was 5) and **50 swaps/mo** (was uncapped); Pro users bypass both. Limits
  are constants (`FREE_GENERATE_LIMIT` / `FREE_SWAP_LIMIT`) at the top of the
  edge function; each mode counts its own `gigi_usage` rows for the calendar
  month. Both return `429 {"error":"RATE_LIMIT_EXCEEDED"}` when exceeded.
  **iOS TODO**: confirm the app handles a 429 on *swap* (it already handles it
  for generate — swap may need the same paywall/toast handling added).
- **Recipe Builder** (2026-07-18) — sibling feature to the Workout Builder,
  same app/auth/conventions. `/recipes` (`app/(app)/recipes/`) = a single page
  with the add-form on top and an existing-recipes list below (add + view only;
  no edit/delete). Mirrors the builder exactly: server page reads via
  `createAdminClient`, client `RecipeBuilder.tsx` (local Chip/Stepper helpers
  copied from the builder's styling), `createRecipe` server action via
  `requireAdminClient`. Nav entry "Recipes" in `app/(app)/layout.tsx`.
  - Tables/policies: `recipes` (RLS: authenticated read, `is_crm_admin()`
    write) + `recipe-images` public bucket (admin-only write via
    `is_crm_admin()`). Migrations `20260719010000_recipes.sql` /
    `20260719010001_recipe_images_bucket.sql`. `is_premium` is app-side only
    (not RLS-enforced — "could harden later").
  - **Image upload is the one new pattern**: client-side via the browser client
    (`lib/supabase/client.ts`, previously unused) to `recipe-images`, then the
    public URL is stored on the row. Needs a real admin session (RLS) — verified
    via SQL simulation, not the auth-bypassed local run.
  - **Migration-history note**: pushing hit a mismatch — the `gigi_usage`
    backfill existed locally as `20260620000000_create_gigi_usage.sql` but the
    remote had recorded it at `20260719004817`. Reconciled with
    `supabase migration repair` (reverted the mis-versioned remote entry, marked
    the repo's version applied) — metadata only, the table was untouched. If
    another workflow re-introduces a stray version, that's the fix.
  - iOS note: recipes RLS is authenticated-read (no anon) — the app already has
    a session for every feature, so a Recipes tab is a non-issue there.

## Priority build order
1. ~~Confirm real Supabase schema and migrate the bundled exercise dataset
   into an `exercises` table~~ — **done** (see Current state).
2. ~~Port exact design tokens into `tailwind.config.js` and set up the
   Archivo variable font~~ — **done** (see Current state). Also built the
   `/dashboard` analytics page on top of these tokens.
3. ~~Set up Supabase Auth scoped to two allowlisted admin accounts, with RLS
   restricting coach-workout writes to admins~~ — **done** (accounts already
   existed; no manual step needed).
4. ~~Build the real Manual Builder UI in `app/(app)/builder`~~ — **done**
   (see Current state). Mirrors the iOS builder; saves coach workouts.
5. ~~Wire Save as Draft / Schedule / Publish Now to `status` and `publish_at`
   columns on `workouts`~~ — **done** (see Current state). App visibility
   enforced by RLS; CRM library reads all via service role.
6. ~~Wire `/library` to the real schema: filters (status, format), edit (reopen
   Builder pre-filled), duplicate, archive (soft delete only — never
   hard-delete a workout that might be referenced in `workout_history`)~~ —
   **done** (see Current state). Also refactored all coach mutations to run as
   service role via requireAdminClient() to work around RLS SELECT-visibility
   gotcha on UPDATE.
7. Later: thumbnail/Rive preview support, then Community/broader CRM.

## Notes on scheduling
Default to query-side filtering (app only fetches
`status = 'published' AND publish_at <= now()`) rather than a cron job,
unless a real need for a hard status transition (e.g. push notifications on
publish) comes up. Keep it simple until that's a real requirement.
