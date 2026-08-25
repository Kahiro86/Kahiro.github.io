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
const FEATURES = [
  { name: "Habits (Discipline)", store: "ht_habits", also: ["ht_entries"], xp: /habit\.completed/, analytics: /htHabits|habitFeed|disciplineView/, cc: /habitSummary|hsum/ },
  { name: "Purity", store: "purity_log", xp: /purity\.dayClaimed/, analytics: /sanitizePurity/, cc: /purityStreak/ },
  { name: "Journal", store: "journal_entries", xp: /journal\.entry/, analytics: /journalPatterns|writingStats/, cc: /journal/ },
  { name: "Nutrition (Fuel)", store: "nutrition_log", xp: /meals\.dayComplete|protein\.hit/, analytics: /nutritionReport|bodyTimeline/, cc: /nutrition/ },
  { name: "Hydration", store: "nutrition_log", xp: /water\.hit/, analytics: /fluidMl|waterMl/, cc: /water/i },
  { name: "Sleep", store: "trade_sleep", xp: /sleep\.floorHeld/, analytics: /sleepView|heldFloorOn/, cc: /sleep/i },
  { name: "Exercise (Gym)", store: "gym_sessions", xp: /workout\.logged/, analytics: /bodyTimeline|gymSessionsToWorkouts/, cc: /workouts|useWorkouts/ },
  { name: "Prayer / Faith", store: "faith_church", also: ["faith_scripture", "faith_notes"], xp: /faith\.church|faith\.verseAdded/, analytics: /spiritualPct|verses/, cc: /faith|church/i },
  { name: "Goals", store: "goals", xp: /goal\.checkpoint|goal\.completed/, analytics: /sanitizeGoals/, cc: /goals/ },
  { name: "Want list", store: "wants", xp: /want\.purchased/, analytics: /sanitizeWants/, cc: /wants/ },
  { name: "Finance", store: "finance_state", xp: /income\.logged|vault\.contribution/, analytics: /financeSummary/, cc: /financeSummary|freedom/ },
  { name: "Trading", store: "ti_trades", xp: /trading\.dayReview/, analytics: /tiTradeStats|sanitizeTiTrades/, cc: /tiTrades|tradesToday/ },
  { name: "Reviews", store: "ict_reviews", xp: /review\.weekly|review\.monthly/, analytics: /sanitizeReviews/, cc: /reviewSignal|WeeklyReview/ },
  { name: "Mind / Library", store: "mind_library", also: ["mind_decisions", "mind_notes"], xp: /mind\.bookFinished|mind\.decisionLogged/, analytics: /library|decisions/, cc: /decisions|library/ },
  { name: "Measurements", store: "athlete_measurements", xp: null, analytics: /bodyTimeline|measurements/, cc: /measurements/ },
  { name: "Non-negotiables", store: "habits", xp: /habit\.completed/, analytics: /completionRate|rangeStats/, cc: /openNonNegs|nonneg/ },
];

const collect = "src/shared/xp/collect.js";
const isView = (k) => /^src\/(modules|shared)\// .test(k) && !/tests?\//.test(k);

let issues = 0;
const rows = [];
for (const f of FEATURES) {
  const stores = [f.store, ...(f.also || [])];
  const written = stores.some((s) => anyFile(new RegExp(`useStorageState\\(\\s*["']${s}["']`), isView) || false);
  const readers = stores.flatMap((s) => whichFiles(new RegExp(`["']${s}["']`), isView));
  const inXp = f.xp ? f.xp.test(code.get(collect) || "") : null;
  const inAnalytics = f.analytics ? anyFile(f.analytics, (k) => /analytics|shared\/(analytics|views|crossModule)|bodyTrends|Report/i.test(k)) : null;
  const inCC = f.cc ? f.cc.test(code.get("src/modules/dashboard/Dashboard.jsx") || "") : null;

  const state = !readers.length ? "❌ orphaned"
    : inXp === false ? "⚠️ no XP path"
    : inAnalytics === false ? "⚠️ not in analytics"
    : inCC === false ? "⚠️ not on Command Centre"
    : "✅";
  if (state !== "✅") issues++;
  rows.push({ name: f.name, store: stores.join(" + "), readers: readers.length, xp: inXp, an: inAnalytics, cc: inCC, state });
}

const mark = (v) => (v === null ? " —" : v ? " ✓" : " ✗");
console.log("\nFeature                  Store                       readers  XP  Analytics  CC   State");
console.log("─".repeat(96));
for (const r of rows) {
  console.log(
    r.name.padEnd(24) + r.store.slice(0, 26).padEnd(28) +
    String(r.readers).padStart(5) + "  " + mark(r.xp).padStart(4) + mark(r.an).padStart(10) + mark(r.cc).padStart(5) + "   " + r.state
  );
}
console.log("─".repeat(96));
console.log(`${rows.length - issues} of ${rows.length} fully connected · ${issues} need attention\n`);
process.exit(0);
