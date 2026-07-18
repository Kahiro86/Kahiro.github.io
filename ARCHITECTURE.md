# Kahiro — Kaizen OS · Architecture

Single-page React app (Vite, single-file build) deployed to GitHub Pages.
Every byte ships in one `index.html`; there is no server — cloud sync is
Supabase (per-user rows, RLS) driven entirely from the client.

## Modules (`src/modules/`)

| Module | Folder | Accent | Purpose |
|---|---|---|---|
| Command Center | `dashboard/` | graphite | Today screen: welcome-back, time-aware greeting, weekly-focus review, ring, needs-attention, done-today, this-week strip, missions, agenda; trends folded |
| Life OS | `life/` | green | Habits v2, routines, wellness, non-negotiables, journal, projects, purity |
| Trading OS | `trading/` | cyan/red | Journal, checklist gate, analytics, risk, playbook, reviews |
| Athlete OS | `athlete/` | blue | Workouts, templates, PRs, measurements, running progression |
| Finance OS | `finance/` | green/gold | Net worth, budgets, income, debts, goals, bills, reports |
| Mind OS | `mind/` | indigo | Library, notes, decision journal |
| Faith OS | `faith/` | amber | Spiritual habits, scripture memory, church, devotionals |
| Journey | `journey/` | gold | Universal goals (12 life areas) + Hall of Fame (tiered lifelong milestones, titles, lifetime record) |
| Analytics | `analytics/` | purple | Cross-OS reports, correlations, XP progression |

Modules are self-contained (own engines + tabs) and consume shared services;
they never import from each other except through `src/shared/`.

## Core services (`src/shared/`)

- **Storage**: `storage.js` (adapter) + `useStorageState.js` — write-through
  synced store; all keys `architect:`-prefixed; shape-guarded reads.
- **Sync**: `supabase.js` (auth) + `sync.js` — dirty queue, batched upserts,
  realtime, last-write-wins per key, offline-safe. LWW is decided by real edit
  time: `flush` reads remote timestamps for its dirty keys first and takes the
  newer remote instead of overwriting it, and reconnect pulls before it pushes
  — so a device edited offline with stale data can't clobber newer changes made
  elsewhere.
- **XP / progression**: `xpEngine.js` (+ `useXp.js`, `XPCelebration.jsx`) —
  XP derived from records, never stored; Hall of Fame journeys (tiered
  milestones over derived stats) auto-stamp unlock dates; legacy flat
  achievement ids remap losslessly.
- **Engines**: `habitEngine.js`, `discipline.js`, `momentum.js`,
  `missions.js`, `goals.js` (universal goals; checkpoint/completion dates
  auto-stamp for idempotent XP; goals may bind to a live `stats.*` source via
  `GOAL_SOURCES`/`syncAutoGoals`, write-through by the always-mounted
  `AutoGoalSync.jsx`), `analytics.js`, `insights.js` (nudges — incl. a
  sync-off backup reminder), `directive.js` (the Command Center coach line:
  ranks concerns across every domain into one order + a reason, incl. the
  cross-domain trade-checklist-discipline and workout-pace signals; also owns
  the corrected `isRestDay`, indexed against `WEEK_PLAN` MON→SUN, and returns
  `suppress` ids so the directive never echoes a Priority Alert),
  `kaizen.js` (incl. `dayGreetingLine`),
  `review.js` (weekly focus: `isoWeekKey`, `weakestArea`, `weekly_focus`
  store), `weekReview.js` (`buildWeekReview` — the Sunday "did I win?" recap:
  week score vs last week, habits held/slipped, honest wins, weakest area →
  next focus; surfaced by `WeeklyReview.jsx`'s `WeeklyReviewGate`, which
  auto-opens on Sundays until the coming week has a focus, and by a manual
  button on the cockpit), module engines (`trading/reviews.js`,
  `finance/bills.js`, `life/purity.js`).
- **Dates**: `dates.js` — `localDateStr`, `daysAgoStr`, `daysBetween`
  (local-timezone; noon-anchored). All date math goes through here.
- **UI primitives**: `ui.jsx` (Card, SH, Chip, Meter, Empty, inputs,
  Hydrating), `ModuleTabs.jsx` (module sub-nav shell), `charts.jsx`
  (Ring, DonutChart, ActivityHeatmap), `Collapse.jsx`, `ChartTooltip.jsx`,
  `toast.jsx` (notifications + undo), `ErrorBoundary.jsx`.
- **Chrome**: `Sidebar`, `Header` (killzone clock, XP bar, nudge bell),
  `AIPanel`, `SettingsPanel` (sync, calendar, backup), `QuickLog`,
  `AmbientBackground` (+`ambient.js` per-module themes).

## Data model

One Supabase table `kv (user_id, key, value jsonb, updated_at)` with RLS
"own rows only" — every store is a key; no joins, no duplicate tables.
Local mirror is `localStorage` under the same keys, so offline == online
data model. Device-local config (`architect_sync`, `kahiro_gcal`, API key)
deliberately lives outside the synced prefix.

## Rules that keep it clean

- New feature data = new `useStorageState` key → sync/offline/XP for free.
- Engines are pure functions over store data; components stay thin.
- Derive, don't store: streaks, XP, discipline, reports all recompute.
- Storage keys keep the legacy `architect:` prefix — renaming would orphan
  every user's data.
- Single-file deploy: no code-splitting/lazy chunks; keep dependencies lean
  (react, recharts, lucide-react, supabase-js only).

## CI & tests

`tests/qa.mjs` is the corruption harness (see `tests/README.md`): it boots the
built app under Chromium across ~38 seeded data scenarios × desktop+mobile ×
every module and asserts no screen renders blank or throws. `.github/workflows/
ci.yml` runs `npm run build` + the harness on every push and PR; `deploy.yml`
builds and publishes to Pages on `main`. Run locally with `npm run test:ci`.
