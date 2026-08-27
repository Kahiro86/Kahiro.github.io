# Bundle & load audit — current build

Re-measured after the cross-module integration pass. Route-level code
splitting and the deferred-boot work are both in; the numbers below are the
optimized baseline, not the old 452 KB single file.

## 1. Bundle — total and per-route

**Initial path (first paint):** `index.dev` 114 KB gz + `vendor-react`
45 KB gz ≈ **160 KB gz** — under the 200 KB budget. `index.html` module-
preloads `vendor-react` and nothing else.

Per-route lazy chunks (fetched only when the screen opens):

| Chunk | gz | Loads when |
|---|---|---|
| vendor-charts (recharts + d3) | **115 KB** | Body, Nutrition, Habits, Record or Firm opens |
| FirmOS | 77 KB | The Firm opens |
| vendor-supabase | 57 KB | cloud sync/auth init |
| BodyOS | 27 KB | Body opens |
| AnalyticsOS | 26 KB | The Record opens |
| HabitTracker | 24 KB (+4 KB css) | Habits opens |
| NutritionOS | 19 KB | Nutrition opens |
| Dashboard | 11 KB | Home — **does not pull vendor-charts** |
| FaithOS / Calendar / HabitIntel | 2–4.5 KB each | on open |

**Home no longer drags recharts.** The previous audit named that as the
single highest-leverage fix left; the Dashboard chunk now contains no
reference to `vendor-charts` at all, so the landing screen costs react plus
the app chunk and nothing more.

**5 heaviest deps:** ① recharts+d3 (115 KB gz) — every charted route;
② the app's own code (~200 KB gz spread across chunks) — the real whale;
③ supabase-js (57 KB) — sync + auth; ④ react-dom+react (45 KB) — framework;
⑤ lucide-react (~10 KB, tree-shaken, one chunk per icon) — icons.

## 2. Load performance

`launch-perf` holds a boot budget in CI and asserts the structure the number
depends on, so this does not drift silently. Four boot passes — the
discipline migration, the dead-store purge, the XP carry-forward and the
metric-link reconcile — were moved behind first paint, which took the boot
from ~1620 ms to ~280 ms on the test machine.

The remaining lever is recharts on the five charted routes. It is a real
win, and it is still a **proposal, not a decision** — see below.

## 3. Re-renders on a single log action

`useStorageState` is **key-scoped** — a write broadcasts only to hooks on that
key, so logging does NOT globally re-render. Genuine costs: (a) **`useXp`**
recomputes whole-day aggregates on any watched store change → `Header`
re-renders (the "single log recomputes the day" smell); (b) **`App`** holds
~8 stores and passes derived props, so a habit tap re-renders its subtree;
(c) `useCountUp` runs animation loops on dashboard numbers (also violates the
Phase 6 "never animate a number" rule).

## 4. Modules — function, frequency, overlap

| Module | Frequency | Overlap |
|---|---|---|
| Command Center | **daily (landing)** | composes others — good |
| Life OS (habits/nutrition/etc.) | **many ×/day** | — |
| The Firm (Trading/Wealth/HQ) | event-driven | HQ's 5 tabs overlap heavily |
| Faith & Mind | daily-light | — |
| Calendar | < weekly | **overlaps Command agenda + Analytics** |
| Journey (Hall/Wants/Goals) | < weekly | Goals↔Command, Hall↔Analytics |
| Analytics | < weekly | overlaps Calendar + Journey |

Only **Command Center + Life OS** are daily. Calendar/Journey/Analytics are
three < weekly windows onto the same history.

## 5. Network calls & offline

Core logging is **localStorage-first → offline-safe**. Nothing in the log path
needs the network. Supabase sync = background reconcile (queues offline).
Anthropic AI (meal/coach/analyst) = enhancement, fails to an error state.
GoogleCalendar/push = optional. **No core action breaks offline.** Remaining
gap vs the Phase 8 bar: writes don't yet show an explicit "persisted locally
✓" distinct from "synced".

---

## Cut list (aggressive)

1. **`vite-plugin-singlefile`** — already removed (code-split landed).
2. **recharts → ~4 KB inline SVG** — heaviest dep; every chart is a line/area/
   ring over ≤365 pts, none need d3. Returns 112 KB to every charted route.
3. **Split `charts.jsx`** so `Ring`/`ActivityHeatmap` (pure SVG) don't import
   recharts — unblocks the FMP budget immediately.
4. **Demote Calendar + Journey + Analytics** to a single secondary "Insight"
   entry — primary nav = Command Center + Life OS only.
5. **Consolidate HQ's 5 tabs** (Campaign/Contingency/Covenant/Gate/Vault → 2).
6. **Kill `useCountUp`** everywhere (Phase 6 already bans count-up).

**Keep untouched:** every lock/gate/cap/cooldown (app PIN, trading gates,
God Mode floors, firm scaling gate). Friction is the product.

## Things you'd probably resist — and my argument
- **Calendar** (recently built): it's a 3rd lens on data Command + Analytics
  already show, opened < weekly. Earns its slot only as the *primary* history
  surface; else it's weight + a nav slot.
- **recharts**: charts look polished, but none need d3; a 4 KB SVG renderer is
  visually identical and returns 112 KB per charted route.
- **Analytics/Journey as daily-reachable nav**: payoff surfaces are weekly
  rituals; behind secondary nav they cost nothing but first-viewport space —
  which your own Phase 6 rule reserves for "what can I do / what's blocking".
