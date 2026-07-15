# Kahiro — Daily-Use UX Audit & Redesign

*July 2026 · the audit behind the "Simplify and Redesign for Daily Use" release.*

The test applied to every screen: **would this earn its place in the first 10
seconds of a daily open?** If not, it either became one tap cheaper, moved
behind a fold, or was deleted as a duplicate.

## 1 · The daily experience, before → after

| Screen / flow | Friction found | What shipped |
|---|---|---|
| **Command Center** | Opened on two analytics cards (Discipline, Momentum) before anything actionable; heatmap, progression chart and brief pushed "what should I do?" below the fold. | Rebuilt Today-first: progress ring · **Needs attention** (live nudges, tap-through) · **Done today** (habits / training / meals / journal at a glance). All analytics folded into a closed-by-default **Trends & Analytics** section. |
| **Goals** | Only existed inside Finance; the dashboard "Goals" card silently dumped you into Finance OS. | Universal goal engine (`shared/goals.js`) covering 12 life areas with auto-stamped checkpoints (25/50/75/100%), deadlines, XP rewards, and a dedicated **Journey → Goals** screen. Dashboard card now reads the universal store. |
| **Achievements** | A flat 17-badge grid buried in Analytics; once earned, nothing left to chase. | **Hall of Fame**: 13 lifelong tiered journeys (First Step → Immortal) where every milestone reveals the next, plus lifetime records and the unlockable title ladder. Old unlock dates migrate via legacy-id mapping — nothing earned is lost. |
| **Nutrition logging** | Repeat meals still cost open-panel → search → portion → log (~6 taps). | **One-tap row**: the (meal, portion) pairs eaten 2+ times in 30 days log themselves into the slot the current hour implies. "Copy yesterday" kept for empty mornings. |
| **Intelligent layer** | The nudge engine existed but lived behind the bell icon; the app felt like a form, not a companion. | Top nudges surface inline on the dashboard with one-tap navigation to where each is handled; celebrations and reminders unchanged underneath. |
| **Charts** | Weekly *trends* drawn as bars (Life OS consistency, Analytics XP/correlations, Purity patterns, Athlete volume/frequency, Nutrition kcal) — bars emphasise single periods, not direction. | Converted to clean line graphs; dual-axis pairs became two lines. Bars kept **only** where categorical (per-day wellness status, checklist-grade win rate, per-run distance) — there they genuinely read better. |

## 2 · Principles enforced app-wide

- **Minimal-first**: the default view of any screen shows today; history and
  analysis live behind `Collapse` sections that remember their state.
- **Never ask what can be derived**: XP, streaks, checkpoints, frequent meals,
  meal-slot choice, discipline/momentum — all computed, none entered.
- **Every alert is actionable**: a nudge always links to the screen that
  resolves it; silence means genuinely nothing is owed.
- **Progress is endless**: every Hall of Fame tier reached exposes the next
  threshold; every goal checkpoint reveals the one after it.
- **One store per fact**: hydration stays a Life OS habit surfaced in
  Nutrition; finance goals stayed in Finance while life goals live in Journey;
  the Analytics achievements grid was deleted rather than duplicated.

## 3 · Known deliberate trade-offs

- Discipline/Momentum stay computed on dashboard mount even while folded —
  they're cheap memos and the fold is a UX choice, not a perf one.
- The Hall of Fame's ~90 tiers pay more lifetime bonus XP than the old 17
  badges; levels inflate slightly for long-time data. XP remains fully
  derived, so the change is consistent across devices with no migration.
- Weekly-trend line charts need ≥2 points to read; single-week data shows a
  dot — acceptable for a system designed around long-term consistency.
