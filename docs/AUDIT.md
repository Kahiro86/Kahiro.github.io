# Phase 5 Audit — current state (post code-split + enforcement)

Measured on the CURRENT build (route-level code-splitting already landed in a
prior wave, so numbers reflect the optimized baseline, not the old 452 KB
single-file). Throttle: Chromium CDP, 4× CPU + Regular 3G, served gzipped.

## 1. Bundle — total and per-route

**Initial path (first paint):** `index.dev` 87.5 KB gz + `vendor-react`
44.4 KB gz ≈ **132 KB gz** — under the 200 KB budget.

Per-route lazy chunks (load only when the screen opens):

| Chunk | gz | Loads when |
|---|---|---|
| vendor-charts (recharts+d3) | **112 KB** | any charted module (incl. Dashboard via `Ring`) |
| vendor-supabase | 54 KB | cloud sync/auth init |
| FirmOS | 70 KB | The Firm opens |
| LifeOSModule | 36 KB | Life OS opens |
| SettingsPanel | 12 KB | Settings opens |
| Dashboard / Faith / Analytics / Journey / Calendar | 6–14 KB each | on open |

**5 heaviest deps:** ① recharts+d3 (~112 KB) — every chart; ② the app's own
code (~250 KB spread across chunks) — the real whale; ③ supabase-js (54 KB) —
sync+auth; ④ react-dom+react (44 KB) — framework; ⑤ lucide-react (~10 KB,
tree-shaken) — icons.

## 2. Load performance (mid-range Android / 3G)

| Budget | Target | Actual |
|---|---|---|
| First meaningful paint | < 1.5 s | **~2.0 s** ❌ (was 3.8) |
| Time to interactive | < 2.5 s | **~2.6 s** ≈ (was 5.0) |
| Initial JS | < 200 KB gz | **132 KB** ✅ |

FMP misses by ~0.5 s. Cause: the landing Dashboard pulls `charts.jsx`, which
statically imports recharts (112 KB) even though the Dashboard only uses the
pure-SVG `Ring`. **Splitting `charts.jsx` so `Ring` doesn't drag recharts is
the single highest-leverage FMP fix left.**

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
