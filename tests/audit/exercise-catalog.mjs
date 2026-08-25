// The catalog beyond the weight room: the week in the schedule can now be
// logged movement by movement, and the disciplines that had nowhere to live
// have somewhere. Every invariant that made the old catalog trustworthy
// still holds across the new rows.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const r = await build({ entryPoints: [join(here, "_gc.js")], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
const out = join(mkdtempSync(join(tmpdir(), "gc-")), "b.mjs");
writeFileSync(out, r.outputFiles[0].text);
const G = await import(pathToFileURL(out).href);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const all = G.allExercises();
const byName = (n) => all.find((e) => e.name.toLowerCase() === n.toLowerCase());
const find = (q) => G.searchExercises(q)[0];

// ── 1. Every movement in the schedule can be logged ──────────────────
console.log("\n1. The weekly schedule, movement by movement");
const SCHEDULE = [
  // Monday
  "Jump Rope", "Ankle Rotation", "Deep Squat Hold", "Bodyweight Squat", "Box Jump",
  "Back Squat", "Romanian Deadlift", "Bulgarian Split Squat", "Walking Lunge",
  "Standing Calf Raise", "Couch Stretch", "Forward Fold",
  // Tuesday
  "Scissor Stretch", "Push-up Hold", "Handstand Hold", "Barbell Bench Press", "Pull-up",
  "Overhead Press", "Single-Arm Dumbbell Row", "Dumbbell Curl", "Push-up", "Lateral Raise",
  "Lying Leg Raise", "L-Sit", "Child's Pose", "Doorway Pec Stretch",
  // Wednesday
  "Easy Run", "Burpee",
  // Thursday
  "Broad Jump", "Crisscross Jump Squat", "World's Greatest Stretch", "Goblet Squat",
  "Hack Squat", "Nordic Curl", "Superman", "Side Plank", "Cobra Stretch", "Cat-Cow",
  // Friday
  "Dip", "Chin-up", "Inverted Row", "Pike Push-up", "Machine Chest Press", "Hammer Curl",
  "Skull Crusher", "Cross-Body Shoulder Stretch", "Overhead Triceps Stretch", "Thoracic Rotation",
  // Saturday
  "Scapular Pull-up", "Crawling",
  // Sunday
  "Brisk Walk",
];
const missing = SCHEDULE.filter((n) => !byName(n));
ok(`all ${SCHEDULE.length} scheduled movements are in the catalog${missing.length ? ` (missing: ${missing.join(", ")})` : ""}`, missing.length === 0);

console.log("\n1b. And they answer to the names the schedule uses");
for (const [typed, expected] of [
  ["skipping", "Jump Rope"],
  ["running", "Easy Run"],
  ["handstand practice", "Handstand Hold"],
  ["leg raises", "Lying Leg Raise"],
  ["cross-hack squat", "Hack Squat"],
  ["compound stretch", "World's Greatest Stretch"],
  ["scapular control", "Scapular Pull-up"],
  ["spine stretch", "Cat-Cow"],
  ["l-sit progression", "L-Sit"],
  ["walking", "Brisk Walk"],
]) ok(`"${typed}" finds ${expected}`, find(typed)?.name === expected);

// ── 2. The taxonomy ──────────────────────────────────────────────────
console.log("\n2. Every discipline is populated");
for (const d of G.DISCIPLINES) {
  const n = all.filter((e) => e.discipline === d.id).length;
  ok(`${d.label} has entries (${n})`, n > 0);
}
ok("every exercise carries a discipline", all.every((e) => typeof e.discipline === "string" && e.discipline));
ok("every exercise carries the effect its discipline implies",
  all.every((e) => e.trainingEffect === G.effectOf(e.discipline)));

console.log("\n2b. Disciplines are assigned, not guessed");
for (const [name, disc] of [
  ["Back Squat", "strength"], ["Pull-up", "calisthenics"], ["Jump Squat", "plyometric"],
  ["Box Jump", "plyometric"], ["Burpee", "hiit"], ["Jump Rope", "hiit"],
  ["Easy Run", "liit"], ["Farmer's Carry", "hybrid"], ["Turkish Get-Up", "hybrid"],
  ["Couch Stretch", "stretching"], ["Cat-Cow", "mobility"], ["Crawling", "recovery"],
]) ok(`${name} is ${disc}`, byName(name)?.discipline === disc);

// ── 3. The honesty guard ─────────────────────────────────────────────
console.log("\n3. A stretch is not training");
const stretch = byName("Couch Stretch");
ok("a stretch still names the muscle it addresses", stretch.muscles.some((m) => m.muscle === "quads" && m.share > 0));
ok("but it is not load", stretch.trainingEffect === "target");
ok("it is findable by that muscle", G.searchExercises("", { muscle: "quads", discipline: "stretching" }).length > 0);

const set = (id, extra = {}) => ({ exerciseId: id, reps: 1, weightKg: 0, durationSec: 60, ...extra });
const stretchVol = G.aggregateMuscleVolume([set("couch-stretch")]);
ok("holding it adds no volume to the heatmap", (stretchVol.quads || 0) === 0);
const stretchXp = G.aggregateMuscleXp([set("couch-stretch")]);
ok("and pays no muscle XP", (stretchXp.quads || 0) === 0);

const realVol = G.aggregateMuscleVolume([set("jump-rope")]);
ok("but real interval work does add volume", (realVol.calves || 0) > 0);
ok("mixing the two only counts the training",
  (G.aggregateMuscleVolume([set("jump-rope"), set("couch-stretch")]).calves || 0) === (realVol.calves || 0));

// ── 4. Invariants that made the old catalog trustworthy ──────────────
console.log("\n4. The old invariants still hold on the new rows");
const bad = [];
for (const e of all) {
  if (e.components) continue;
  const sum = e.muscles.reduce((s, m) => s + m.share, 0);
  if (Math.abs(sum - 1) > 0.001) bad.push(`${e.name} shares sum to ${sum.toFixed(3)}`);
  if (e.muscles.some((m) => m.share < 0)) bad.push(`${e.name} has a negative share`);
  if ((e.loadType === "time") && e.intensityFactor === undefined) bad.push(`${e.name} is time-based with no intensityFactor`);
  if (["bodyweight", "weighted_bodyweight", "assisted", "distance"].includes(e.loadType) && e.leverageFactor === undefined) {
    bad.push(`${e.name} needs a leverageFactor`);
  }
  if (!e.muscles.some((m) => m.primaryMover)) bad.push(`${e.name} has no primary mover`);
  if (e.referenceVolume <= 0) bad.push(`${e.name} has no reference volume`);
}
ok(`every exercise is well-formed${bad.length ? ` — ${bad.slice(0, 4).join("; ")}` : ""}`, bad.length === 0);

const ids = all.map((e) => e.id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
ok(`no duplicate ids${dupes.length ? ` (${[...new Set(dupes)].join(", ")})` : ""}`, dupes.length === 0);

const names = all.map((e) => e.name.toLowerCase());
const dupeNames = names.filter((n, i) => names.indexOf(n) !== i);
ok(`no duplicate names${dupeNames.length ? ` (${[...new Set(dupeNames)].join(", ")})` : ""}`, dupeNames.length === 0);

ok("every id resolves through the registry", ids.every((id) => G.getExercise(id)?.id === id));

// ── 5. Search by discipline ──────────────────────────────────────────
console.log("\n5. You can look for a kind of training, not just a lift");
ok("typing 'stretching' returns stretches", G.searchExercises("stretching").every((e) => e.discipline === "stretching"));
ok("typing 'plyometrics' returns jumps", G.searchExercises("plyometrics").every((e) => e.discipline === "plyometric"));
ok("typing 'hiit' returns intervals", G.searchExercises("hiit").every((e) => e.discipline === "hiit"));
ok("filtering by discipline narrows to it",
  G.searchExercises("", { discipline: "mobility" }).every((e) => e.discipline === "mobility"));
ok("a lift search is not polluted by the new rows", find("bench press")?.name === "Barbell Bench Press");

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Exercise catalog: ${pass}/${pass + fail} passed  ·  ${all.length} exercises`);
process.exit(fail ? 1 : 0);
