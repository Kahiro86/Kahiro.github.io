// Gate 2 criterion 3 — a logged session has to be visible to every view that
// reports on training, not just to the XP engine. Nothing writes the legacy
// `athlete_workouts` store any more, so a view that reads it alone reports
// zero training while the user trains daily.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|tsx?)$/.test(e)) files.push(p);
  }
})(join(root, "src"));

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

// Allowed to touch the legacy store directly: the shared selector that merges
// it, the XP hook that does the same merge inline, and the backup/export path.
const ALLOWED = ["shared/useWorkouts.js", "shared/useXp.js", "shared/backup.js", "shared/storage.js"];

const offenders = [];
for (const f of files) {
  const rel = f.slice(root.length + 1).replace(/\\/g, "/");
  if (ALLOWED.some((a) => rel.endsWith(a))) continue;
  const src = readFileSync(f, "utf8");
  if (!/athlete_workouts/.test(src)) continue;
  // Reading it is only safe alongside the gym-session merge.
  if (!/gymSessionsToWorkouts|useWorkouts/.test(src)) offenders.push(rel);
}
ok(`no view reads athlete_workouts without merging gym sessions${offenders.length ? ` (${offenders.join(", ")})` : ""}`, offenders.length === 0);

const sel = readFileSync(join(root, "src/shared/useWorkouts.js"), "utf8");
ok("the shared selector reads both stores", /athlete_workouts/.test(sel) && /gym_sessions/.test(sel));
ok("the shared selector drops neither", /gymSessionsToWorkouts/.test(sel) && /legacy/.test(sel));

const consumers = ["modules/dashboard/Dashboard.jsx", "modules/calendar/CalendarModule.jsx",
  "modules/analytics/AnalyticsOS.jsx", "shared/NotificationCenter.jsx", "shared/EveningReview.jsx",
  "shared/Correlations.jsx", "shared/WeeklyReview.jsx"];
for (const c of consumers) {
  const src = readFileSync(join(root, "src", c), "utf8");
  ok(`${c.split("/").pop()} goes through useWorkouts`, /useWorkouts\(\)/.test(src));
}

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Workout readers: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
