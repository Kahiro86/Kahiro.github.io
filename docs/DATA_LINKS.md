# Linked metrics — habits and their counterparts

Some facts get recorded twice. A habit called "Sleep well" and the hours
typed into the trading module are the same night. A "Hydration" habit and a
glass of water logged as food are the same litre. Before this, neither knew
about the other: ticking the habit moved the habit's streak and nothing else,
while System Health, the Record's trends and the XP engine all read the other
store and reported the day unlogged.

## The rule

**One definition per metric, many writers.** The habit tracker is a writer
into the metric's store, and the store writes back into the habit.

| Metric | Canonical store(s) | habit → store | store → habit |
|---|---|---|---|
| `sleep` | `trade_sleep` `{date: hours}` | numeric habits only | yes |
| `hydration` | `hydration_log` `{date: ml}` **+** `nutrition_log` beverages | numeric habits only, into `hydration_log` | yes |
| `training` | `athlete_workouts`, `gym_sessions` | never | yes |
| `meals` | `nutrition_log` | never | yes |

Hydration is the one metric with two inputs, and they are **added, not chosen
between** — drinking a coffee and drinking a glass of water are different
events, and `hydrationSeries` is still the single place that defines what a
day's fluid means.

## What does not flow, and why

- **A boolean tick never becomes a number.** Ticking "Sleep well" does not
  write 6.5 hours. Inventing the measurement would poison every average
  downstream of it. It records a **claim** instead: the bar was met, nothing
  was measured. Claims count toward coverage and consistency; they are
  excluded from averages.
- **A rich record is never written backwards.** A workout is exercises and
  sets; a day's meals are a list of foods. No habit tick could honestly
  produce one, so `training` and `meals` are read-only links.
- **Someone else's number is never overwritten.** Every mirrored write is
  recorded in `hab_link_writes` with the value written. Retracting a habit
  entry removes the canonical value only if the mirror put it there and
  nothing has changed it since.
- **A hand-ticked day is not overwritten with a measured miss.** You were
  there and the log wasn't.
- **Silence is never filled in.** A day with no canonical value produces no
  habit entry — an unrecorded day is not a missed day.

## Which habit stands for which metric

`resolveLinks(habits, meta)` decides, in this order:

1. An explicit choice in `ht_meta` under `link_<metric>` — a habit id, or
   `"none"` to link nothing.
2. Otherwise the **oldest** non-archived habit whose name matches the
   metric's pattern, so adding a second "water" habit never silently steals
   the link from the one already carrying history.

Units come from the habit's own unit field (`L`, `ml`, `glasses`, `h`,
`mins`, …). With the field empty, the target is read only inside a band with
one sensible answer — a sleep target of 8 is hours, a water target of 3 is
litres, a water target of 60 is ambiguous and is declined. A habit whose
unit cannot be read makes claims instead of measurements.

## Where it runs

- `src/modules/habits/linkedMetrics.js` — pure: the registry, resolution,
  conversion, and what each direction is allowed to write.
- `src/modules/habits/linkSync.js` — storage: registers the Db entry hook,
  mirrors forward, runs the reverse pass.
- `src/modules/habits/localDb.js` — `setEntryHook`, the single choke point
  every entry write passes through, from any screen.
- `src/main.jsx` — installs the hook, then reconciles the last 60 days.
- `src/shared/useLinkedMetrics.js` — the reader hook, so no surface has to
  remember to pass claims (and quietly disagree with the ones that do).

Covered by `tests/audit/linked-metrics.mjs` (unit) and
`tests/audit/linked-sync.mjs` (browser, end to end).
