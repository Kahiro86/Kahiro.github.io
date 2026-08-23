// ── Cross-module insights (spec §5.2) ────────────────────────────────
// The payoff the merges were for. None of these is computable from a single
// module, which is the whole test of whether putting the data together was
// worth doing.
//
// Two rules hold throughout:
//   · Every insight cites the Law or gate it touches. A finding that names
//     the rule it is about carries weight; a floating statistic does not.
//   · Every insight states its own evidence — how many days it looked at and
//     how many carried data. A correlation over four days is a coincidence
//     with good presentation, and it says so rather than being suppressed.
//
// All reads go through src/shared/views.js. Nothing here touches a store.
import { localDateStr } from "./dates.js";
import { sleepView, disciplineView, bodyView, windowDays, SLEEP_FLOOR_HOURS } from "./views.js";

export const LAWS = {
  sleep: { n: 7, title: "Sleep is infrastructure.", body: "The 6.5-hour floor outranks every opportunity." },
  audit: { n: 9, title: "Audit like a firm.", body: "Daily card, weekly audit, monthly review, quarterly gate — numbers before feelings." },
  oneLoss: { n: 3, title: "One loss = done.", body: "Per account, per day. The re-entry urge is the exit signal." },
  proveOne: { n: 1, title: "Prove one, then multiply.", body: "No account #2 until #1 has paid three clean months of withdrawals." },
};

const pct = (n) => Math.round(n * 100);
const MIN_EACH_SIDE = 3;   // below this a split is not a comparison

/**
 * Sleep × discipline. Law 7 is the app's own claim that sleep is upstream of
 * everything; this is the only place that claim can actually be checked.
 */
function sleepVsDiscipline({ sleep, discipline, days }) {
  const short = [], held = [];
  for (const d of days) {
    const ok = sleep.heldFloorOn(d);
    if (ok === null) continue;                       // unlogged night: no claim
    const sched = discipline.scheduledOn(d);
    if (!sched) continue;
    (ok ? held : short).push(discipline.heldOn(d) / sched);
  }
  if (short.length < MIN_EACH_SIDE || held.length < MIN_EACH_SIDE) {
    return { id: "sleep-discipline", law: LAWS.sleep, status: "insufficient",
      evidence: `${held.length} nights at or above the floor, ${short.length} below — needs ${MIN_EACH_SIDE} of each to compare.`,
      text: "Not enough logged nights on both sides of the floor to say anything yet." };
  }
  const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const hi = pct(avg(held)), lo = pct(avg(short));
  const gap = hi - lo;
  return {
    id: "sleep-discipline", law: LAWS.sleep, status: "computed", gap,
    evidence: `${held.length} nights at or above ${SLEEP_FLOOR_HOURS}h, ${short.length} below.`,
    text: gap >= 5
      ? `Habits hold at ${hi}% after a night at or above the floor, ${lo}% after a short one — a ${gap}-point gap.`
      : gap <= -5
      ? `Habits hold at ${lo}% after a short night and ${hi}% after a full one — the gap runs the other way, which is worth a second look at how sleep is logged.`
      : `Habits hold at ${hi}% after a full night and ${lo}% after a short one. No meaningful gap in this window.`,
  };
}

/**
 * Body adherence × schedule. Which days protein actually lands, and what those
 * days have in common. Cites the training-day rule the Body merge introduced.
 */
function proteinVsTraining({ body, days }) {
  const trained = [], rest = [];
  for (const d of days) {
    const a = body.adherenceOn(d);
    if (!a) continue;                                 // unlogged day: no claim
    (a.trained ? trained : rest).push(a.hitProtein ? 1 : 0);
  }
  const total = trained.length + rest.length;
  if (trained.length < MIN_EACH_SIDE || rest.length < MIN_EACH_SIDE) {
    return { id: "protein-training", law: null, rule: "Body · training-day targets (§2.2)", status: "insufficient",
      evidence: `${total} logged days — ${trained.length} training, ${rest.length} rest.`,
      text: "Not enough logged days of each kind to compare yet." };
  }
  const hit = (a) => pct(a.reduce((s, v) => s + v, 0) / a.length);
  const t = hit(trained), r = hit(rest);
  return {
    id: "protein-training", law: null, rule: "Body · training-day targets (§2.2)", status: "computed", gap: t - r,
    evidence: `${total} logged days — ${trained.length} training, ${rest.length} rest.`,
    text: Math.abs(t - r) < 8
      ? `Protein lands on ${t}% of training days and ${r}% of rest days — effectively the same either way.`
      : t > r
      ? `Protein lands on ${t}% of training days but only ${r}% of rest days. The target does not drop on a rest day; only calories and carbs do.`
      : `Protein lands on ${r}% of rest days but only ${t}% of training days — the harder days are the ones going short.`,
  };
}

/**
 * Gate status × habits. Law 9 makes the gate depend on things Discipline owns,
 * so the dependency should be visible from both sides rather than implied.
 */
function gateVsHabits({ sleep, discipline, days }) {
  const logged = days.filter((d) => sleep.heldFloorOn(d) !== null);
  const breaches = logged.filter((d) => sleep.heldFloorOn(d) === false);
  const rate = discipline.rateBetween(days[0], days[days.length - 1]);
  if (!logged.length) {
    return { id: "gate-habits", law: LAWS.audit, status: "insufficient",
      evidence: "No sleep logged in this window.",
      text: "The gate leans on the sleep floor, and no nights are logged — so the gate cannot be judged from here." };
  }
  return {
    id: "gate-habits", law: LAWS.audit, status: "computed",
    evidence: `${logged.length} of ${days.length} nights logged${rate.pct === null ? "" : `, habit rate from ${rate.scheduled} scheduled days`}.`,
    text: breaches.length === 0
      ? `The sleep floor held on all ${logged.length} logged nights this window${rate.pct === null ? "" : `, alongside a ${rate.pct}% habit rate`}. The gate's dependency is being met.`
      : `${breaches.length} of ${logged.length} logged nights fell under the floor${rate.pct === null ? "" : `, against a ${rate.pct}% habit rate`}. The gate reads the same floor this does.`,
  };
}

/**
 * Every insight for a window. `days` defaults to 30.
 * Returns them ordered: computed findings first, biggest gap first, with
 * insufficient ones kept rather than hidden — an honest "not yet" is more
 * useful than a silent gap where an insight should be.
 */
export function crossModuleInsights({
  htHabits, htEntries, legacyHabits, sleep: rawSleep,
  nutrition, nutritionProfile, workouts, gymSessions,
  today = localDateStr(), days = 30,
} = {}) {
  const window = windowDays(today, days);
  const sleep = sleepView(rawSleep);
  const discipline = disciplineView({ htHabits, htEntries, legacyHabits, today });
  const body = bodyView({ nutrition, nutritionProfile, workouts, gymSessions, today });

  const all = [
    sleepVsDiscipline({ sleep, discipline, days: window }),
    proteinVsTraining({ body, days: window }),
    gateVsHabits({ sleep, discipline, days: window }),
  ];

  const computed = all.filter((i) => i.status === "computed")
    .sort((a, b) => Math.abs(b.gap ?? 0) - Math.abs(a.gap ?? 0));
  const pending = all.filter((i) => i.status !== "computed");
  return { insights: [...computed, ...pending], window: days, computed: computed.length };
}
