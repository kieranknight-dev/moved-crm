# Handoff: MOVED CRM design refresh

## Overview

A visual and UX refresh of the MOVED. admin CRM (`kieranknight-dev/moved-crm`, branch `main`). Six screens: Login, Dashboard, Workouts, New Workout, Recipes, New Recipe.

**No functionality changes.** Every filter, action, field and route that exists today still exists. The work is presentation only: colour weight, density, hierarchy, mobile layout, and — on the dashboard — surfacing data that already exists in Supabase but wasn't being displayed.

## About the design files

`MOVED CRM.dc.html` in this bundle is a **design reference written in HTML**. It is a prototype showing intended look and layout — it is not production code to copy.

The task is to **recreate these designs inside the existing Next.js + Tailwind app**, using its established patterns: server components where they already are, the `blush`/`ink` Tailwind scales, `rounded-card`/`rounded-pill`, `shadow-card`/`shadow-cta`, and the existing `next/font/local` setup for Archivo and Space Grotesk. Do not introduce a component library, do not restructure routes, do not change any server action.

Open the HTML file in a browser. Screens are laid out on a canvas and numbered 01–06, each with its mobile counterpart beside it where one was designed.

## Fidelity

**High fidelity.** Colours, type, spacing, radii and shadows are final and are taken from the project's own token file. Recreate closely. Two deliberate exceptions:

- Recipe thumbnails and the workout/recipe image fields render as neutral grey placeholders. In production these come from Supabase storage via `image_url` / `image_ref` and should keep the existing behaviour.
- Row data in the tables is real sample data pulled from the live database. It is illustrative; the tables stay data-driven.

## The core colour change

The current build uses `blush-50` / `blush-100` as the default surface and border for nearly every element — table headers, chips, cards, inputs, form panels. That is the source of the "too much pink" problem.

The rule in this redesign: **blush is for interactive intent only.** Everything structural moves to warm neutrals. In practice, per screen, blush now appears on roughly four elements: the logo dot, the active nav item, the primary CTA, and one chart series.

| Where it's used now | Change to |
| --- | --- |
| `border-blush-100` on cards | `#F1ECE6` (`border.card` in the token file) |
| `border-blush-100` on inputs | `#F0E8E2` (`border.input`) |
| `bg-blush-50` table header | `#FCFAF8` |
| `bg-blush-50` filter chips | `#fff` with `#F0E8E2` border, or `#F4F1ED` segmented track |
| `bg-blush-50` form field blocks | `#FAF8F6` (`surface.input`) with `#F0E8E2` border |
| Page background `bg-white` | `#FAF8F6` — this is what lets the white cards read as raised |
| `bg-blush-500/10 text-blush-700` status badge | semantic colours, see below |

Retained as-is: `blush-500 #E58AA1` primary buttons with `shadow-cta`, `blush-600 #C9587E` for links and active nav text, `blush-50 #FBECF0` as the active nav background.

### Status colour is now semantic

Every status currently renders in a blush tint, so status carries no information at a glance.

| Status | Text | Background |
| --- | --- | --- |
| Published | `#5F8D72` (`semantic.rest`) | `#EEF4F0` (`semantic.rest-tint`) |
| Scheduled | `#B98A4A` (`state.warning`) | `#F6EFE4` |
| Draft | `#6F665E` | `#F4F1ED` |
| Archived | `#A89E96` | `#F4F1ED` |

The same scale drives the dashboard's content-health indicators: green healthy, amber needs attention, `#D9462F` broken.

## Design tokens

All values below already exist in the iOS `Color` token file and in `tailwind.config.js`. Nothing new is invented.

**Brand**
```
blush          #E58AA1   primary CTA, accent fills
blush-deep     #C9587E   links, active nav text, small text on white
blush-tint     #FBECF0   active nav background, publish-panel selected state
blush-chip     #F4D6DF   borders on blush surfaces only
```

**Neutrals**
```
ink            #1A1714   headlines, body primary, selected pill background
icon-secondary #6F665E   secondary text, nav idle, icon strokes
text-secondary #8A827A   labels, meta, muted values
text-muted     #A89E96   hints, placeholders, archived text
text-ghost     #C6BDB2   zero values, disabled, drag handles
```

**Surfaces**
```
page           #FAF8F6   app background behind cards
card           #FFFFFF
input          #FAF8F6   form field fill
warm           #F4F1ED   chart tracks, icon badges, segmented control track
row-alt        #FDFCFB   alternating table row
table-header   #FCFAF8
border-card    #F1ECE6
border-input   #F0E8E2
divider        #F5F1ED   inside-card hairlines
```

**Semantic**
```
success        #5F8D72  tint #EEF4F0
warning        #B98A4A  tint #F6EFE4   panel bg #FDF9F2, border #F2E7D5
error          #D9462F  tint #FDEEEC   border #F6D9D4, text #A33A28
```

**Chart accents** — unchanged from `components/dashboard.tsx`:
```
Circuit #7E9770 · AMRAP #C4704F · Rounds #8D7BA6 · EMOM #7A92A5
Tabata #6FA39B · For Time #B76578 · Mobility #8E97C7 · Strength #B98A4A
```

**Radius** — `card 18px`, `cardLg 24px`, `pill 9999px`, plus `12px` for inputs/nav items and `14px` for inline field blocks.

**Shadow** — unchanged from `tailwind.config.js`:
```
card      0 5px 18px rgba(20,15,10,.07)
cardLg    0 14px 38px rgba(20,15,10,.10)
cta       0 8px 20px rgba(229,138,161,.35)
subtle    0 2px 8px rgba(20,15,10,.05)   toolbar buttons and inputs
```

**Type** — Archivo (`font-display`) for numbers, headings and the logo; Space Grotesk (`font-body`) for everything else. Sizes: page title 30/700, card title 15–17/700, KPI figure 34/700, body 13.5–14, label 12/600 uppercase `.05em`, meta 12–12.5.

**Spacing** — page padding 36px top / 40px sides; card padding 20–28px; grid gap 18px between cards, 28px between form column and publish panel.

---

## Screens

### 01 Login — `app/login/page.tsx`

Two-panel split. Left: centred form column, max-width 380px, on `#FAF8F6`. Right: fixed 520px panel on `#FBECF0`, holding a headline and four live stat tiles at 72% white. Below 900px the right panel is hidden and the form centres.

The form itself is unchanged — same two fields, same `login` server action, same admin-gate error. Changes:

- Fields move into a white card with `shadow-cardLg`, fill `#FAF8F6`, border `#F0E8E2`, radius 12px, min-height 50px.
- Password field gains a show/hide toggle (client-side only, no auth change).
- The error message moves from a blush box to the semantic error treatment: `#FDEEEC` background, `#F6D9D4` border, `#A33A28` text, with a small round error icon. This covers both `state.error` and the `?error=unauthorized` case.
- The right panel's four numbers should be fetched with the same admin client already used by `lib/dashboard.ts`, or hardcoded if you'd rather not query on an unauthenticated route. **Recommend hardcoding or omitting** — the login page is public and shouldn't leak content counts. If in doubt, drop the right panel's numbers and keep the headline.

### 02 Dashboard — `app/(app)/dashboard/page.tsx`, `components/dashboard.tsx`, `lib/dashboard.ts`

The biggest change. Current dashboard reports on workouts only; 126 recipes and 263 exercises are invisible.

**Row 1 — four KPI cards.** Reframed from raw counts to questions:

1. *Items live in the app* — `160`, being published workouts + published recipes. Footer splits it: 34 workouts, 126 recipes. Delta chip "+5 this week".
2. *Registered users* — `3`, with a progress bar showing Pro share (2 of 3, 67%). This is the one place blush is used in the KPI row.
3. *Sessions completed* — `15`, footer shows finish rate and average duration.
4. *Gigi spend, all time* — `$0.90`, footer shows run count and cost per run. Model name `sonnet-4-6` sits top-right in mono.

Card anatomy: white, `border-card`, radius 18, `shadow-card`, 20px padding. 36px round icon badge top-left; delta chip top-right; figure at 34/700 Archivo with `tabular-nums`; footer stats above a `#F5F1ED` hairline.

**Row 2 — Content health panel.** New. Radius 24, `shadow-cardLg`. Two progress rows (workout images 1/35 in `#D9462F`; recipe images 126/126 in `#5F8D72`) and an amber callout strip for the empty publish pipeline. The "2 gaps to close" badge counts red/amber items. All of this is derivable from existing tables — no schema change:

```sql
-- workouts missing an image
select count(*) from workouts where image_ref is null or image_ref = '';
-- recipes missing an image
select count(*) from recipes where image_url is null or image_url = '';
-- anything scheduled
select count(*) from workouts where status = 'scheduled';
select count(*) from recipes  where status = 'scheduled';
```

**Row 3 — three breakdown cards.** Workouts by format (existing donut, stroke width 15, track `#F4F1ED`), Exercise library by equipment category (new), Recipes by category with dietary-tag chips (new). Each card ends with a one-line takeaway above a hairline.

**Gigi card.** You asked to keep this. It stays as its own section below the breakdowns, with the same content it has now — cost all-time, cost 30-day, runs split by generate/swap, input and output tokens, and the pricing footnote. Restyle only: `MiniStat` blocks move from `bg-blush-50` to `#FBECF0` for the primary figure and `#F4F1ED` for the rest. Worth adding: *runs that became workouts* (`9 of 42`), which shows Gigi conversion.

**Mobile.** Stats go 2-up, the gaps panel becomes a single amber card, charts go full width with the legend in two columns. Sidebar becomes a four-item bottom bar.

### Two data bugs to fix while you're in `lib/dashboard.ts`

These are pre-existing and cause visible defects today.

1. `WORKOUT_CATEGORIES` omits `'Upper Body'` and `'Lower Body'`. `CATEGORY_ACCENTS` in `components/dashboard.tsx` includes all seven, so the page maps over seven categories but `workouts.byCategory` only has five keys. The two missing ones resolve to `undefined`, `Math.max` returns `NaN`, and those bars render full-width with no number. Add both to the array.

2. `WORKOUT_FORMATS` omits `'Mobility'`. There is one Mobility workout in the database, so the donut centre reads 35 while the segments sum to 34. Add it, and add a `Mobility` entry to `FORMAT_ACCENTS` — `#8E97C7`, already defined as `FormatAccent.mobility` in the iOS tokens.

3. Minor: `workouts.total` counts archived rows. The KPI should count `status = 'published'` and report archived separately.

### 03 Workouts — `app/(app)/library/LibraryTable.tsx`

Same three filters, same three server actions.

**Toolbar.** Three stacked rows of chips become one row: search input (268px, pill, magnifier icon), a segmented control for status (track `#F4F1ED`, active pill white with `shadow-subtle`), and two dropdown buttons for format and category. Result count sits right-aligned. This is what buys the extra visible rows — the header block drops from ~150px to ~44px.

Search is new on this screen; it filters `title` client-side, exactly as `RecipeLibraryTable` already does with `search`.

**Table.** Header `#FCFAF8`, uppercase 12/600 labels in `text-secondary`. Title and Name headers are sortable — add a `sortKey`/`sortDir` state and a chevron on the active column. Rows: 11px vertical padding, alternating `#FDFCFB`, `#F5F1ED` borders. Title at weight 500 in `ink`; every other cell in `icon-secondary` so the title anchors the row. Format cell gains a 7px colour dot from `FORMAT_ACCENTS`.

**Actions.** The three text links become 32px icon buttons with `title` tooltips — pencil (blush-deep), duplicate, archive/restore. Add a hover background of `#F4F1ED`. Keep the existing `confirm()` on archive.

Footer row shows "Showing 12 of 35" with a load-more link.

**Mobile.** Table becomes cards: title, a meta line of format · category · difficulty, a status pill, and a 44px overflow button opening a sheet with Edit / Duplicate / Archive. A blush FAB sits above the bottom bar.

### 04 New Workout — `app/(app)/builder/BuilderClient.tsx`

**Layout.** Single column becomes `grid-cols-[1fr_320px]` with a 28px gap. The publish bar that currently floats over the bottom of the form moves into a sticky right panel (`sticky top-9`). Below 1100px the panel drops beneath the form.

**Publish panel** — replaces `components/PublishPanel.tsx`'s current presentation, same three options. Radio rows with title and helper text; selected row gets `#FBECF0` fill, `#E58AA1` 1.5px border and a filled check. Primary button below. A Summary card underneath shows format, exercise count, total sets, estimated duration and equipment, plus an amber "No image set" warning when `image_ref` is empty.

**Form cards.** Three white cards: basics (name, format, estimated time), exercises, coach details.

- Workout name becomes a labelled field on `#FAF8F6` at 22/600 Archivo, replacing the underlined input.
- The estimated-time block loses its heavy blush fill for `#FAF8F6` with a bordered stepper.
- Format and category pills: idle is now white with a `#F0E8E2` border rather than a blush fill; selected stays `ink` with white text.
- **Exercise rows are the main UX change.** Currently the section is an empty dashed target. Each added exercise now renders as a row with a drag handle, thumbnail, name, equipment/body-part meta, and inline sets / reps / rest inputs. Reordering should use whatever the builder already does for exercise order; if it has none, this is presentational only and the inputs bind to the same `exercises` jsonb shape.
- Image field carries a red hint: "34 of your 35 workouts are missing one". Drive it from the same count as the dashboard, and hide it once the count is low.

**Mobile.** Header bar with back button and draft chip. Coach details collapse from inline pills into tappable rows showing their current value and a chevron, each opening a sheet. Sets/reps/rest go 3-up at 44px. Publish actions live in a fixed footer: a Draft button and a full-width Publish now.

### 05 Recipes — `app/(app)/recipe-library/RecipeLibraryTable.tsx`

Same treatment as Workouts. Search already exists — keep it, restyle it into the toolbar. Thumbnails go to 38px at radius 11, with a `#F4F1ED` placeholder when `image_url` is null.

Because there are 126 rows, this screen gets **pagination** rather than load-more: 10 per page, "Showing 1–10 of 126" with prev/next. Client-side slicing of the already-fetched array is fine; the page currently fetches all rows.

Actions are Edit / Archive / Delete as today, with the same two `confirm()` dialogs.

### 06 New Recipe — `app/(app)/recipes/RecipeBuilder.tsx`

Same two-column shell and publish panel as New Workout.

- Prep time and servings steppers sit side by side in a 2-column grid on `#FAF8F6`, replacing the pink blocks.
- Dietary tags: selected state is now the success treatment (`#EEF4F0` fill, `#D7E6D3` border, `#5F8D72` text with a check) rather than blush, so multi-select reads differently from the single-select pills above it.
- Ingredients and steps gain drag handles; steps get a numbered circle.
- **The Pro toggle defaults on.** All 126 recipes currently have `is_premium = false` despite the column defaulting to `true`, so Pro gates nothing today. Since everything is Pro at launch, the toggle should be on for new recipes, and existing rows want a one-off backfill:
  ```sql
  update recipes set is_premium = true;
  ```
  The toggle moves into the publish panel, beneath the three publish options.

---

## Interactions & behaviour

Nothing here changes existing logic; these are the states the design assumes.

- **Hover** — table rows lighten to `#FCFAF8`; icon buttons take a `#F4F1ED` background; cards used as links lift from `shadow-card` to `shadow-cardHover`. 150ms ease.
- **Focus** — inputs move their border to `#E58AA1`, matching current behaviour. Add a 3px `rgba(229,138,161,.15)` ring for keyboard users.
- **Disabled/pending** — existing `disabled:opacity-50` and the `busyId` row fade are retained.
- **Empty states** — keep the existing copy. Style them as centred `text-secondary` at 13.5px with 32px vertical padding.
- **Zero values** — render in `text-ghost` `#C6BDB2` rather than full-strength ink, so an empty pipeline reads as empty at a glance.

## Responsive

The app currently hides the sidebar below `md` and leaves no navigation. Breakpoints assumed by the design:

| Width | Behaviour |
| --- | --- |
| ≥1280px | Full layout: sidebar, 4-up KPIs, `1fr 320px` form grid |
| 1024–1279px | KPIs 2-up; form publish panel drops below the form |
| 768–1023px | Sidebar collapses to a hamburger sheet; tables scroll horizontally |
| <768px | Bottom tab bar replaces the sidebar; tables become cards; forms single-column with a fixed action footer |

Bottom bar has four items — Dashboard, Workouts, Recipes, Create — with the two "New" routes merged behind Create. Minimum touch target 44px throughout; the mobile form controls are 44–52px.

## Assets

None to hand over. Icons are inline 2px round-cap strokes at 24×24 viewBox, consistent with the existing `iconProps` in `components/dashboard.tsx` — reuse that helper and add the handful of new glyphs (search, chevron, pencil, duplicate, archive, restore, trash, drag handle, eye, calendar, warning). Fonts are already installed in `app/fonts/`.

## Files in this bundle

- `MOVED CRM.dc.html` — all six screens plus mobile
- `Dashboard directions.dc.html` — the three dashboard directions explored; 1a was chosen and is what's built out. Useful only as context.

## Suggested order

1. Tokens and the two `lib/dashboard.ts` bugs.
2. `app/(app)/layout.tsx` — sidebar and the new mobile bottom bar. Everything else inherits the shell.
3. Login.
4. Both tables — they share a toolbar, header, row and action pattern; build it once.
5. Both builders — they share the shell and publish panel.
6. Dashboard last, since it needs the new queries.
