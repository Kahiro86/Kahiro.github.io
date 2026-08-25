// Feature → Store → Views → XP → Analytics → Command Centre.
//
// A module can look finished and still be "hanging in the wind": a store
// nothing reads, a screen that writes somewhere nothing consumes, a metric
// that never reaches XP. This walks every tracked feature and reports where
// the chain actually breaks — by grep over the real source, not by assertion.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const files = [];
(function walk(d) { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else if (/\.(jsx?|tsx?)$/.test(e)) files.push(p); } })(join(root, "src"));
const src = new Map(files.map((f) => [f.slice(root.length + 1).replace(/\\/g, "/"), readFileSync(f, "utf8")]));
const strip = (s) => s.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l.trim())).join("\n");
const code = new Map([...src].map(([k, v]) => [k, strip(v)]));

const anyFile = (re, filter = () => true) => [...code].filter(([k]) => filter(k)).some(([, v]) => re.test(v));
const whichFiles = (re, filter = () => true) => [...code].filter(([k, v]) => filter(k) && re.test(v)).map(([k]) => k);

// feature → the store it owns, and the four places it must reach
// feature → the store it owns, where it must reach, and where it lives by
// design. `home` is the surface that owns the feature's own reporting: a
// metric reported inside its own facet is connected, not missing from the
// Command Centre.
const FEATURES = [
  { name: "Habits (Discipline)", store: "ht_habits", also: ["ht_entries"], xp: /habit\.completed/, analytics: /habitFeed|disciplineView|completionRate/, cc: /habitSummary|hsum/ },
  { name: "Purity", store: "purity_log", xp: /purity\.dayClaimed/, analytics: /sys_purity|habitFeed/, cc: /purityStreak/, note: "reports as a habit since Gate 1" },
  { name: "Journal", store: "journal_entries", xp: /journal\.entry/, analytics: /sys_journal|habitFeed/, cc: /journal/, note: "reports as a habit since Gate 1" },
  { name: "Nutrition (Fuel)", store: "nutrition_log", xp: /meals\.dayComplete|protein\.hit/, analytics: /nutritionReport|bodyTimeline/, cc: /nutrition/ },
  { name: "Hydration", store: "nutrition_log", also: ["hydration_log"], xp: /water\.hit/, analytics: /hydrationSeries/, cc: /hydrationSeries/, note: "two log paths, one definition — beverages + the linked habit" },
  { name: "Sleep", store: "trade_sleep", xp: /sleep\.floorHeld/, analytics: /sleepSeries|sleepView/, cc: /sleepSeries/ },
  { name: "Exercise (Gym)", store: "gym_sessions", xp: /workout\.logged/, analytics: /bodyTimeline|gymSessionsToWorkouts/, cc: /useWorkouts|workouts/ },
  { name: "Prayer / Faith", store: "faith_church", also: ["faith_scripture", "faith_notes"], xp: /faith\.church|faith\.verseAdded/, analytics: /spiritualPct/, cc: /faith|church/i },
  { name: "Goals", store: "goals", xp: /goal\.checkpoint|goal\.completed/, analytics: /sanitizeGoals/, cc: null, home: "The Record → Goals" },
  { name: "Want list", store: "wants", xp: /want\.purchased/, analytics: /sanitizeWants|WantListModule/, cc: null, home: "The Record → Goals → Want List" },
  { name: "Finance", store: "finance_state", xp: /income\.logged|vault\.contribution/, analytics: /financeSummary|snapshots/, cc: null, home: "The Firm → Wealth (kept off the Command Centre at the user's request)" },
  { name: "Trading", store: "ti_trades", xp: /trading\.dayReview/, analytics: /tiTradeStats|IntelAnalytics/, cc: /tiTrades|tradeCountToday/, home: "The Firm → Trading → Analytics" },
  { name: "Reviews", store: "ict_reviews", xp: /review\.weekly|review\.monthly/, analytics: /sanitizeReviews/, cc: null, home: "Weekly Review gate + The Record → Reports" },
  { name: "Mind / Library", store: "mind_library", also: ["mind_decisions", "mind_notes"], xp: /mind\.bookFinished|mind\.decisionLogged/, analytics: /library|decisions/, cc: null, home: "The Record → Library" },
  { name: "Measurements", store: "athlete_measurements", xp: null, analytics: /bodyTimeline|measurements/, cc: null, home: "Body → Trends" },
  { name: "Non-negotiables", store: "habits", xp: /habit\.completed/, analytics: /completionRate|rangeStats/, cc: null, home: "Habits (Discipline)" },
  // Named in the audit brief and never mapped. A notification store that
  // nothing reports on is exactly the failure this tool exists to catch.
  // xp: null means "pays nothing, by design" — see each note for why.
  { name: "Notifications", store: "notif_reminders", also: ["notif_log", "notif_prefs"], xp: null, analytics: /notifAnalytics\(/, cc: null, home: "The bell — unpaid on purpose: the reminder's task pays when logged, so paying the reminder too would count one action twice" },
  { name: "XP ledger", store: "xp_ledger", also: ["xp_achievements"], xp: null, analytics: /journeys|RANKS|nextRankFor/, cc: /xpToday|xp\?\./, home: "The Record → Progress — this IS the XP path, not a feed into it" },
  { name: "Meal plans", store: "nutrition_plans", xp: null, analytics: null, cc: null, todo: "adherence is not reported — \"did I follow the plan?\" has no answer yet", home: "Body → Fuel → Meal plans (a template, never intake)" },
  { name: "Metric links", store: "hab_link_writes", xp: null, analytics: null, cc: /useLinkedMetrics/, home: "internal provenance for the habit ⇄ counterpart mirror — nothing to report on" },
  { name: "Day marks", store: "athlete_day_marks", xp: null, analytics: /hasCheat|dayMarks/, cc: /useDayMarks/, home: "cheat/season days — excluded from streak grading" },
];

const collect = "src/shared/xp/collect.js";
const isView = (k) => /^src\/(modules|shared)\// .test(k) && !/tests?\//.test(k);

let issues = 0;
let planned = 0;
const rows = [];
for (const f of FEATURES) {
  const stores = [f.store, ...(f.also || [])];
  const written = stores.some((s) => anyFile(new RegExp(`useStorageState\\(\\s*["']${s}["']`), isView) || false);
  const readers = stores.flatMap((s) => whichFiles(new RegExp(`["']${s}["']`), isView));
  const inXp = f.xp ? f.xp.test(code.get(collect) || "") : null;
  // "Reported" means the metric is rendered somewhere a person can read it
  // back — the Record, a facet's own report screen, or a shared analytic.
  // A number reported inside its own facet is connected; only a number with
  // nowhere at all to be read is not.
  // NotificationCenter carries its own 30-day analysis (completion rate, most
  // ignored, best and toughest day) — a facet reporting on itself, which is
  // the rule this matcher already applies to Body Trends and the Firm's
  // Analyst tab.
  const ANALYTIC = (k) => /modules\/(analytics|journey)\/|shared\/(analytics|views|crossModule|wellbeing|consistency)\.js|bodyTrends|NotificationCenter|Report|Review|Trends|Overview|Analyst|IntelAnalytics/i.test(k);
  const inAnalytics = f.analytics ? anyFile(f.analytics, ANALYTIC) : null;
  const inCC = f.cc ? f.cc.test(code.get("src/modules/dashboard/Dashboard.jsx") || "") : null;

  const state = !readers.length ? "❌ orphaned"
    : inXp === false ? "⚠️ no XP path"
    : inAnalytics === false ? "⚠️ not in analytics"
    : inCC === false ? "⚠️ not on Command Centre"
    : f.todo ? "📋 planned"
    : "✅";
  if (state === "✅" && f.home) rows.homes = true;
  if (state !== "✅" && state !== "📋 planned") issues++;
  if (state === "📋 planned") planned++;
  rows.push({
    name: f.name, store: stores.join(" + "), readers: readers.length,
    xp: inXp, an: inAnalytics, cc: inCC, state,
    note: f.todo ? f.todo : (f.note || f.home || ""),
  });
}

const mark = (v) => (v === null ? " —" : v ? " ✓" : " ✗");
console.log("\nFeature                  Store                       readers  XP  Analytics  CC   State");
console.log("─".repeat(96));
for (const r of rows) {
  console.log(
    r.name.padEnd(24) + r.store.slice(0, 26).padEnd(28) +
    String(r.readers).padStart(5) + "  " + mark(r.xp).padStart(4) + mark(r.an).padStart(10) + mark(r.cc).padStart(5) + "   " + r.state
  );
  if (r.note) console.log(" ".repeat(24) + "└ " + r.note);
}
console.log("─".repeat(96));
console.log(
  `${rows.length - issues - planned} of ${rows.length} fully connected · ` +
  `${issues} need attention · ${planned} planned but not built\n`
);
// A broken chain fails; a gap that is known and recorded does not. Reporting
// both the same way is how a warning column stops being read.
process.exit(issues ? 1 : 0);
