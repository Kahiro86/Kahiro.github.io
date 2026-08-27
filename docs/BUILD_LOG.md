# Master Build Run — Running Log
_Autonomous run while owner is offline. Assumptions, deferrals, and decisions logged here._

## State at run start (already built earlier this session — verified, not rebuilt)
- **Phase 1 (Personalization):** DONE previously — `identity.jsx` (`app_identity` store), `NameYourSystem.jsx` first-run card, Settings identity fields + reset. Will verify against spec.
- **Phase 3 (Nutrition items):** DONE — the 4 items (tea, fizz, yoghurt+variants, samosa), fluid-ml total, sodium field, portion multipliers, duplicate-to-custom. (Wave 19 Part 1)
- **Phase 4 (Nutrition strict mode):** DONE — shipped as **God Mode** (owner renamed it from "Hard Mode"). Floors/ceiling enforcement, 20-min late flag, closed-day lock, mandatory post-shift meal + low-appetite path, sugared-bev cap, prohibited-escape blocks, 4-screen tutorial, neutral framing. (Wave 19 Part 2)
- **Phase 8 (Performance — code-splitting):** DONE — dropped vite-plugin-singlefile, React.lazy per module + vendor chunks; initial bundle 452→~132KB gz; FMP 3.8→2.0s, TTI 5.0→2.6s. (Wave 20a)
- **Phase 5 (Audit):** Produced earlier this session; will refresh numbers.

## In-flight at run start
- Definitive harness (bx1f0au3c) running on the merge artifact (Wave19 P1+P2/GodMode + Wave20a). Standing instruction "merge once green" → will merge to main when ALL PASS, then continue.

## Assumptions
- A1: "Hard Mode" in Phases 3–4 of this prompt = the already-shipped **God Mode** (owner's explicit rename). Not rebuilding under the old name.
- A2: Phase 5 approval gate "stands as written" → Phases 6, 7, 8(remaining), and 9 are GATED. Since owner is asleep and cannot approve, I will complete Phases 1–4 + the Phase 5 audit, then STOP at the gate. Phase 9 ("after Phases 1–8 complete and stable") is therefore deferred — logged, not built, per the prompt's own ordering.
- A3: New enforcement work (Phase 2) is feature-work (Phases 1–4 are pre-gate) so it proceeds without approval.

## Deferred / incomplete (with reasons) — updated through the run
- (pending)

## Progress this run
- **Merged** the green stack (nutrition items + God Mode + code-splitting) to main (8048c1c).
- **Phase 1** — verified complete (identity propagates to header/sidebar/lock/reports/document.title; first-run card; Settings + reset). No work needed.
- **Phase 2 (enforcement)** — BUILT:
  - New `tradeGates.js` rules engine + `PreTradeGate.jsx` checklist modal.
  - Pre-trade checklist gate (must clear to unlock logging; stored per-trade in `trade_checklists`).
  - Daily trade cap (default 3) — real disable of the log action.
  - Post-loss cooldown (default 30 min) — real disable + live countdown.
  - Sleep gate — morning hours input; < 6.5h → NO-TRADE (disable), 6.5–7.5h → HALF SIZE flag.
  - R-multiple as default unit in the trade list; currency opt-in via Settings toggle.
  - Gate tracker (#6), Fleet Formula (#7), Freedom bar (#8) — already existed in firm.js; verified present.
  - Settings "Trading · Enforcement" section (cap/cooldown/sleep thresholds stage for next day; editable checklist; currency toggle).
  - REMOVALS: dashboard live P&L ticker + its count-up removed (card now shows trades-vs-cap + killzone/checklist discipline).
- **Phase 5 (audit)** — produced (`docs/AUDIT.md`). **STOP at the approval gate.**

## Deferred / incomplete (with reasons)
- **Phases 6, 7, 8-remaining, 9 — DEFERRED at the Phase 5 gate** (per the prompt: audit "stands as written", owner asleep, cannot approve). Phase 9 ("Who I Am") additionally requires Phases 1–8 complete + stable, so it is not built against a mid-refactor tree — exactly as the prompt orders.
- **Phase 2, R-multiple "everywhere":** the primary trade LIST now defaults to R; the account **header NET stat** and **TradeDetail** P&L still render currency. Partial — deferred the detail/header unit-switch to keep this run's blast radius contained. (Logged, low-risk follow-up.)
- **Phase 8 remaining** (self-hosted subset fonts, memoize rules engine, virtualize >50-row lists) — gated behind Phase 5. `useXp` memoization + charts.jsx split are the flagged wins, queued for post-approval.

## Assumptions added
- A4: "Streak counters/badges tied to trade frequency" and "duplicate performance charts on the dashboard" (Phase 2 removals) — none exist in the current app (dashboard streaks are consistency streaks, not trade-frequency; equity/win-rate charts live only in the journal/analytics). Nothing to remove there; logged as already-satisfied.
- A5: Threshold edits for trading gates apply next day via a staged `pending` config; the editable checklist + currency toggle apply immediately (they don't soften a mid-session risk threshold).

## Addendum (A–I) — built this run, queued after the phase work
- **E — Clean bulk target:** nutrition bulk goal now the fixed 3000 kcal / 190P / 80F / ~355C, all editable in Settings. `calcTargets` honors `goal.fixed`.
- **H — Nutrition additions:** QUICK-ADD "Bump my calories" one-tap row (groundnut paste, honey, whole milk, avocado, boiled egg); electrolyte variants (watermelon-pineapple fizz, plain honey fizz, whey protein); creatine + magnesium as 0-kcal daily adherence checkmarks (`nutrition_supps`).
- **A — Daily checklist:** user-editable core/optional items, reorder, per-day completion history, no gamification. **No items invented** — ships empty for the owner to fill (`daily_checklist`).
- **B — Weekly goal:** single focus text, prompt on a new week (Monday-anchored `weekKey`), dated read-only archive.
- **C — Monthly overhead ceiling:** editable KSh target, actual-vs-target shown monthly (surfaces late-month), archive. **Actual uses the bills-sum proxy** (see D-note below).
- **I — Recurring life pings:** generic interval pattern; Laundry + Haircut every 14 days; dismissible today-surface notice; dismiss resets the counter; no gates/locks.
- **D — Season mode (Daniel Fast):** reusable pattern, start date + duration (default 21d), whole-foods framing, **auto-lowers the God Mode protein floor** (meat out) via `seasonFloorAdjust`, does not force samosa/whey; season-tagged entries excluded from normal healthy-streak history; Day X of N counter; auto-ends. Settings picker to start/end.
- **F — Workout split templates:** 7 named day-types (Upper+Core, Lower+Core, Rest, Full Body, Cardio, Mobility, Recovery) shipping as **placeholder structure only — no invented exercises**. Edit/add/remove/reorder/duplicate exercises (name/type/sets/reps-or-duration/note), giant-set blocks, weekly weekday→split plan (Rest defaults to Sunday), today's split surfaces as a runnable checklist (`workout_split_log`). New "Splits" tab in Athlete OS.
- **G — File-based journals:** the endless inline reflection feed is replaced by per-month **files**, collapsed by date; the current month opens by default, older months sit closed out of the active view until opened. Per-file Markdown export. Only reshapes presentation — stored `journal_entries` are unchanged.

## Assumptions added (addendum)
- A6: **Life-ping intervals** — Laundry/Haircut ship at the spec'd 14 days with dismiss-resets-counter working; a Settings editor to change intervals/add pings is **deferred** (defaults + dismiss cover the stated need). Logged.
- A7: **Monthly overhead "actual"** — no dedicated monthly-spend ledger exists, so actual-vs-target reuses the sum of tracked `finance` bills as the closest real proxy. Flagged in-UI as an approximation; a dedicated monthly-spend feed is a low-risk follow-up.
- A8: **Season protein-floor multiplier** (Daniel Fast = 0.6×) is a chosen default, editable via the God Mode floors; the spec asked only that the floor "auto-lower since meat is out" without a number.
- A9: **Daily-checklist / workout-split content** deliberately ships empty per the addendum's explicit "do not invent items / placeholder structure only." This is intended, not an omission.

## Phases 6–9 — built this run (post approval-gate)
Owner approved passing the Phase 5 gate ("Go"). Constraints held: subtraction/
refinement only in 6–8, no lock/gate/cap weakened, no user data touched.

- **Phase 8 — Performance.** Before/after against the budgets:
  - **Initial JS bundle: ~190KB → ~137KB gz** (budget <200KB). Supabase SDK
    (~55KB gz) moved behind a dynamic `import()` — it left the first-paint
    critical path and now downloads only once sync is configured. The entry
    HTML now module-preloads only `index.dev` + `vendor-react`.
    Auth wrappers `await` the lazy SDK; sync retries until it lands.
  - **Fonts self-hosted + latin-subset** (Inter 6 weights, JetBrains Mono 3,
    Spectral serif 4) — dropped the render-blocking Google-Fonts `@import`,
    preloaded the two first-paint faces. Offline-first; unused weight 300 cut.
    (True glyph subsetting beyond unicode-range needs fonttools, absent here —
    unicode-range latin split is the effective subset; logged.)
  - **Count-up removed** everywhere (spec bans animating a number) — figures
    render at their true value; a log/tap registers instantly.
  - **Rules engines already memoized** at call sites (evalGates, evalDay,
    scalingGate all in `useMemo`) — verified, no change needed.
  - FMP/TTI: not re-measured on a throttled Android profile in this sandbox;
    the ~28% initial-bundle cut + eliminated font round-trip move both toward
    the <1.5s / <2.5s targets. Logged as estimated, not lab-measured.
- **Phase 6 — Interface.** Refinement, not redesign:
  - **Serif section headings** — the shared `SH` primitive now renders in
    Spectral (16.5px/600), bringing the serif identity to every module's
    headings while dense data stays sans + tabular mono (the spec's
    heading-vs-label split).
  - **Numeric keypad** — `inputMode="decimal"` added to every remaining
    `type=number` input.
  - Locks-loudest / optimistic-log / 5-states already hold from prior waves;
    a full per-module 5-state re-audit is deferred (verification-only, no gap
    found in the modules exercised).
- **Phase 7 — Modules.** Verified, not re-architected: consolidation already
  happened in Waves A–D (Trading+Finance+Firm merged; Athlete→Life;
  Mind→Faith). Config-driven rules engines (`tradeGates`, `nutritionHard`,
  `firm`, `season`) share one pattern (config → eval → {locked, reason}); a
  single physically-unified engine is deferred as a high-risk refactor with no
  functional gain. The "today" surface (`TodayTrackers` + Dashboard) composes
  every module's current state. A forced further module merge would violate
  "subtraction/refinement only" without evidence it's needed.
- **Phase 9 — "Who I Am" identity panel.** Full-screen Spectral serif,
  dark-brown/gold. READ mode by default; WRITE is a deliberate second action
  with fading ember prompts, autosave, no save button, no char limit. Every
  edit kept as a dated revision (never overwritten). One-time present-tense
  nudge. Daily auto-show on first command-center open (only once a vision
  exists, skippable by tap, never gates anything) with one honest line from
  today's real state. Gold crest entry point, distinct from the gear.
  Plain-text, local-first, carried in the all-keys backup. Never
  auto-generates the words.

## Assumptions added (Phases 6–9)
- A10: **"Go" = approval to pass the Phase 5 gate** and build Phases 6–9. The
  gate was the only pause point; the owner cleared it.
- A11: **Serif applied to headings + the vision panel, not to numerals.**
  Stacked numbers stay in tabular JetBrains Mono (the spec also demands
  tabular-figure alignment) — serifing dense dashboard figures would fight
  that. The spec's own "test before deciding" hedge supports this split.
- A12: **Today-line for the vision daily surface** uses the real consistency
  streak (an honest signal). Richer rules-engine lines (active trading-gate %,
  God-Mode clean-day count) are supported by `todayVisionLine` but not yet fed
  from App to avoid coupling; streak is live today. Logged.
- A13: **FMP/TTI not lab-measured** on throttled mid-range Android in-sandbox;
  bundle + font wins reported instead as the honest, measurable proxy.

## Addendum — God / Normal / Hell mode (built this run)
Derived entirely from the existing rules engine (per the stated assumption),
never a manual toggle. Every gate already exposed a queryable status, so no
gate logic is duplicated.
- **Engine (`modes.js`) + `useModeState` hook** — the single read-out. God =
  every active gate clean, nothing pending; Hell = `hellThreshold`+ gates
  failing at once (default 2, configurable); Normal = the rest. An unevaluable
  gate is "incomplete": it keeps a day out of God but never counts toward Hell.
  Reads local data only (never a pending-sync state); recomputes live on a 60s
  tick; commits each closed day's final state to `mode_history` once (midnight
  rollover handled). Season lowers nutrition floors via the existing
  `seasonFloorAdjust`, so a fast never forces Hell.
- **Gate audit (E):** cap/cooldown/sleep from `tradeGates.evalGates`; nutrition
  floor/ceiling from `nutritionHard.evalDay`; daily-checklist core items past a
  configurable cutoff; overdue recurring pings. All already expose clean
  booleans/enums — no gate needed a status retrofit.
- **UI (A):** small crest+label on the today surface (`ModeIndicator`), tap for
  the plain gate-driver list; restrained global treatment via a `data-mode`
  attribute + pointer-through `body::after` veil (God faint gold, Hell quiet
  darkening, Normal none) — deliberately NOT a `filter` on an ancestor (that
  breaks `position:fixed` overlays). Live recalc, no manual refresh.
- **History (B):** `ModeHistoryStrip` — a monthly calendar of closed-day states,
  filed in the Journals section only, never on the dashboard (a pattern to
  review, not a daily-glanced metric).
- **Tutorials (C):** God + Hell walkthroughs (own screens), neutral and
  no-shame throughout, reachable from the detail view and Settings.
- **Contingencies (D):** partial day → incomplete gates excluded from both
  thresholds; season handled via floor-adjust; midnight rollover commits the
  prior day then evaluates fresh; offline = local-only compute; ambiguous
  boundary (exactly at threshold with pending gates) resolves to the plainer
  label and is flagged in history for review.

## Assumptions added (modes)
- A14: **"Checklist" gate = the daily checklist (addendum A) core items**, not
  the transient per-trade pre-trade checklist (which has no daily-completion or
  cutoff concept). Cutoff hour configurable (default 21:00).
- A15: **Trade cap is informational** (reaching it is the system working, not a
  violation) — it only reads "fail" if somehow exceeded, which enforcement
  prevents. Cooldown/sleep/nutrition/checklist/pings are the real violation
  signals.
- A16: **Nutrition floor is "incomplete" while the day is open** (still time),
  "fail" only once the day has closed; the ceiling is "fail" immediately when
  exceeded. Nutrition gates are excluded entirely unless God-Mode nutrition is
  active that day.
- A17: **Global mode treatment is a pointer-through veil, not an ancestor
  filter** — a CSS `filter` on `#root` would reparent every `position:fixed`
  overlay. The veil tints the main UI and leaves modals crisp.
- A18: **`useModeState` is only imported by lazy chunks** (today surface /
  Settings), never by the eager `App` entry, so the Supabase/Phase-8 initial
  bundle win is preserved.

---

# Session: data connections, catalog, plans, boot

## What this session was for
The app had grown into modules that each worked and did not talk to each
other. Most of the work below is joining things that were already there,
not adding new ones.

## Linked metrics (habits ⇄ their counterparts)
A habit called "Sleep well" and the hours typed into the trading module were
the same night recorded twice, with neither aware of the other. One
definition per metric, many writers — `src/modules/habits/linkedMetrics.js`
(pure) and `linkSync.js` (storage). Full contract in `docs/DATA_LINKS.md`.

Deliberate non-flows, all tested: a boolean tick never becomes a number (it
records a *claim* — counted for coverage and consistency, excluded from every
average); workouts and meals are rich records so those links are read-only;
nothing overwrites or retracts a value the mirror did not write.

**System Health was the duplicate source this hinged on.** It looked sleep and
water up against the legacy wellness habits while the tiles directly above it
read `trade_sleep` and `nutrition_log` — two readings of the same two facts in
one component.

## Exercise catalog: 107 → 164
Added a `discipline` axis (strength · calisthenics · plyometric · hiit · liit
· hybrid · mobility · stretching · recovery) and the 57 movements that had
nowhere to live. Mobility, stretching and recovery carry
`trainingEffect: "target"`: real muscle shares so they stay findable, but the
aggregators skip them, because holding a stretch is not training and heat on
the map becomes a claim the whole app then reasons from.

## Meal plans
A day's eating written once and applied to any day. Carries choices
("chicken / beef / salmon" is one swappable item), conditions ("on rest days
drop the potatoes" is a property of the item, so a rest day is genuinely a
different plan) and a band rather than a number. Importing reads the CSV shape
a spreadsheet exports; applying writes ordinary entries into `nutrition_log`,
which stays the single source of truth for what was eaten.

**Adherence** answers "did I actually follow it?" — coverage and macros
reported separately rather than blended into a score, because "the plan had 9
items, 7 are in the log" is answerable and a single number hides which half
went wrong. Swapping an option counts as following the plan (that is what the
options are for); a day with nothing logged is unknown rather than failed, and
is counted apart so a busy week cannot make the report lie.

Not built: an in-app editor for creating a plan from scratch. The building
blocks exist (`newPlan`/`newMeal`/`newItem`/`patchItem`/`planFromDay`) and are
unused.

## Notifications
Every notification now leads somewhere. A reminder could always carry a
"Link to" destination and the fired notification always discarded it —
Complete, Snooze and Dismiss are three ways to make a message go away and no
way to act on it. Entries now carry a destination, default one from their
category when none is set, and the row offers Open. The push path had the
same hole: `notificationclick` focused an open window and dropped the target.

## Launch performance
Four idempotent passes ran before `createRoot().render()` — discipline
migration, dead-store purge, XP carry-forward, 60-day link reconcile — all
scaling with how much history you have, so the person with the most data
waited longest for the first pixel. Moved after paint: **1621ms → ~280ms** to
app content, on a store with three years of purity days, 800 journal entries
and 4,200 habit entries. Guarded by `tests/audit/launch-perf.mjs`.

## The dependency map
`tests/audit/dataflow.mjs` said "16 of 16 fully connected" while five stores
were not in it at all — a map only reports on what it has been told about.
Now 21, including Notifications and the XP ledger, which the audit brief named
by hand. It distinguishes a broken chain (exits non-zero) from a known gap
that is recorded but not built, because reporting both with ⚠️ is how a
warning column stops being read.

## One source per measured fact
The same bug was fixed three times in three places: a screen looks sleep or
water up against the LEGACY wellness habits while another screen reads the
authoritative store, and the two disagree about the same day. Dashboard's
System Health, NutritionTab's water line, and the Record's weekly sleep
average. Guarded in `metric-definitions.mjs`: no file outside `habitEngine`
may call `isWellness()` except the three that need it to EXCLUDE a wellness
habit, each listed with why.

## Testing
`npm run test:audit` runs the ~22 pure audits in about 15 seconds;
`test:audit:browser` runs the Playwright ones against `dist/`; `test:all`
does everything including the 138 gym domain tests.

Two dead Gate 0 scripts were deleted — they drove a pre-revamp `xpEngine` and
had been crashing on every run since Gate 3 while "the audits pass" kept
being said. The runner treats a crash as a failure for exactly that reason.

## After the deploy
Test-only work, so production was not touched again:
- Every route swept for console errors and warnings with full data, and again
  with **nothing** stored anywhere. The second is the more common failure —
  an average over an empty array, a "best day" with no days — and every test
  before it seeded data first. Both clean on all seven facets.
- The CSV importer driven through thirteen malformed inputs. All already
  handled; two cases asserted beyond "did not crash", since a clean refusal
  also does not crash and is the wrong outcome for a BOM-prefixed export or a
  quoted comma inside a food name.
- The metric mirror pinned down across two devices, where sync converges per
  key and the mirror spans two of them.

One src change followed: the link override was documented and supported and
had no UI, so with two water habits the older one silently won. Same defect
class as the notification `nav` field — a capability with no way to reach it.

## Assumptions added
- A19: **A claimed day is logged, not measured.** Ticking a boolean wellbeing
  habit means the bar was met; it enters coverage and consistency and never
  an average. "Didn't do it" and "didn't record it" stay different claims.
- A20: **An imported meal plan's macros beat the food library's.** The
  spreadsheet said 328 kcal for that chicken; substituting the library's
  number would make the app disagree with the document in the user's hand for
  a food they never edited. Plans built in-app bind by id and follow the
  library instead.
- A21: **An unrecorded night is not a bad night.** System Health indicators
  with no data are grey and say "Unlogged" rather than red and "Poor".
- A22: **A notification without a destination should not exist.** Where one
  is not set, it is derived from the category rather than left empty.

---

# State at handoff

## Deployed
`main` carries the build; GitHub Pages serves the repo root. Everything
below is live except the last batch noted as pending.

## The pattern that dominated this session
Four separate bugs turned out to be the same shape — **a capability the code
already had that nothing could reach**:

| Capability | Existed | Reachable |
|---|---|---|
| A reminder's destination (`nav`) | always | discarded when the notification fired; every queued push had `url: "./"` |
| The habit↔metric link override | documented in `DATA_LINKS.md` | nothing could set it |
| `removeContribution` in `wants.js` | always | no caller — a mistyped amount was permanent |
| The daily focus check-in | Settings and Weekly Review both built on it | its only writer was removed with the Command Centre block |

None of these threw an error. They are invisible to a test that checks for
crashes and obvious to a test that asks "can a person actually do this?".
**Worth repeating the sweep after any surface is removed**: `grep` for exports
with no consumer in `src/`, then check each against whether it is a helper or
a feature.

A fifth was plain wrong data: `WEEK_PLAN` is hardcoded and uneditable, drove
System Health's Recovery and the daily training nudges, and disagreed with
the real training week — it called Thursday a rest day.

## Open, and deliberately not decided
- **recharts (115 KB gzip per charted route).** `AUDIT.md` argues for
  replacing it with a small SVG renderer. Left alone: it is framed there as a
  proposal awaiting a decision, and the initial load pulls only react + the
  app chunk, so it costs nothing at launch. It is a real win on the Fuel and
  Record routes if you want it.
- **No in-app meal-plan editor.** Plans import from CSV and apply. The
  building blocks exist and are unused: `newPlan`, `newMeal`, `newItem`,
  `patchItem`, `patchMeal`, `duplicatePlan`, `planFromDay` — the last turns a
  day you already logged into a plan, which is probably how most plans would
  really be made. Explicitly out of scope at the owner's instruction.

## Decided since
- **The daily checklist, weekly goal and life pings are retired.** The owner
  asked for the Command Centre block that held them to be removed, and
  `TodayTrackers.jsx` was their only surface, so the component went with it
  rather than sitting unmounted pretending to be a feature. **The data was
  not deleted**: those five stores joined `ORPHANED_CONTENT_KEYS`, and the
  sanitizers in `shared/today.js` were kept on purpose as the recovery path.
  The dependency map now reads 21 of 21 connected because that is true, not
  because the exceptions were widened.

## Cross-module integration pass
The brief's own summary of itself was "build connections, not more screens",
and the work divided cleanly along that line.

- **One activity record.** `shared/activity.js` derives a single shape —
  `{date, type, category, actual, target, unit, pct, status}` — from the
  stores that already exist. It is not a second database: ids are derived
  from what the activity *is* (`habit:hs:2026-08-25`), so rebuilding the feed
  can never duplicate a row. Calendar, Faith and the focus layer all read it.
- **Partial completion is preserved end to end.** A habit logged at 12 of 20
  used to collapse to "not done". `completionOf` keeps the ratio, un-clamped
  (20 of 15 is 133%, not 100%), and returns `null` rather than dividing by a
  zero target. `at_most` habits get no ratio at all — a percentage of a
  ceiling measures how close to failing you came, which is not a completion.
- **"Unlogged" is not "missed".** Every summary distinguishes them. A day
  nobody recorded is silence, and grading silence as failure is how an
  honest tracker turns into a guilt machine.
- **Recommendations, with a floor.** `shared/focus.js` and
  `gym/trainingBalance.js` both refuse to speak below a minimum evidence bar
  (four days; twenty sets). Saying nothing is a supported answer.
- **Training balance counts sets, not sessions.** A session labelled
  "mobility" that is nineteen sets of squats and one hip opener is a strength
  session, and the discipline comes from the exercise registry rather than
  the label. `BalanceCard` names the disciplines with *nothing* logged, since
  an absent bar is invisible and absence is the whole finding.
- **Nutrition is its own facet, second in the nav.** Four tabs, one question
  each; the header says what is *left*, not what was eaten; micros are
  ordered worst-first. Moving it left a trail of links pointing at
  `gym:today` — Home's Fuel and Water chips, the calendar's Fuel line, the
  search destination and food results, three nutrition insights — all of
  which opened a Body screen with no food on it. `metric-definitions` now
  fails if a food-flavoured line hands out a Body destination.

## What the five §14 flows actually test
`meal-lifecycle` is the shape to copy. It is not "does logging work"; it is
**one write, five surfaces**: log 100g of oats and the facet header, the slot
row, the micronutrient table, Home's Fuel chip and the calendar day must all
move together; edit to 200g and all five double; delete and all five go back,
with the day reading as *unlogged* rather than as a day of zeros. Any single
surface can be made to pass alone. The bug this catches is the sixth surface
that kept yesterday's number — which is exactly the bug that was found three
separate times before the test existed.

## Running the tests
```
npm run test:audit           # ~22 pure audits, ~15s — run constantly
npm run test:audit:browser   # 10 Playwright audits against dist/, ~3 min
npm run test:gym             # 138 vendored domain tests
npm run test                 # the blank-page QA sweep, 25-60 min
npm run test:all             # build + everything above except the QA sweep
```
A crashing audit counts as a **failure**, not a skip. Two dead scripts sat in
`tests/audit/` for weeks crashing on every run while "the audits pass" kept
being said out loud, because nobody read the exit codes.

## What the browser audits cover that the QA sweep does not
QA catches a blank page. Below it: `console-clean` (every route, full data,
zero warnings), `empty-state` (every route with **nothing** stored — the more
common real failure), `mobile-layout` (390px, horizontal overflow and
off-screen controls), `launch-perf` (a boot budget plus the structural
assertions the number depends on).
