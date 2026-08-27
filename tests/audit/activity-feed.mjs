// The activity feed: one canonical record, derived from the stores that
// already exist. The properties that matter are that it never invents a
// second copy of the same fact, and that it keeps the magnitude of what was
// actually done rather than collapsing it to done/not-done.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const p = (rel) => join(root, rel).replace(/\\/g, "/");
writeFileSync(join(here, "_af.js"), `export * from "${p("src/shared/activity.js")}";`);
const r = await build({ entryPoints: [join(here, "_af.js")], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
const out = join(mkdtempSync(join(tmpdir(), "af-")), "b.mjs");
writeFileSync(out, r.outputFiles[0].text);
const A = await import(pathToFileURL(out).href);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const TODAY = "2026-08-25";
const back = (n) => { const d = new Date(`${TODAY}T12:00:00`); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const profile = { age: 27, sex: "male", heightCm: 178, weightKg: 78, activity: 1.55, goal: "muscle" };

const habit = (over) => ({
  type: "boolean", unit: null, target: null, targetDirection: "at_least",
  frequencyType: "daily", frequencyDays: null, frequencyCount: null,
  icon: "✅", archivedAt: null, createdAt: `${back(60)}T06:00:00.000Z`, updatedAt: "", ...over,
});
const HABITS = [
  habit({ id: "hs", name: "Stretch", type: "numeric", unit: "min", target: 15 }),
  habit({ id: "hp", name: "Pray" }),
  habit({ id: "hc", name: "Scrolling", type: "numeric", unit: "min", target: 30, targetDirection: "at_most" }),
];

// ── 1. The headline case from the brief ──────────────────────────────
console.log("\n1. Five minutes of a fifteen-minute stretch");
const five = A.habitActivities({ htHabits: HABITS, htEntries: [{ habitId: "hs", date: TODAY, value: 5 }] })[0];
ok("the actual value survives", five.actual === 5);
ok("so does the target", five.target === 15);
ok("and the unit", five.unit === "min");
ok("it reads 33%, not zero", five.pct === 33);
ok("its status is partial, not 'none'", five.status === "partial");
ok("and it does not count as done", !A.isDone(five));

console.log("\n1b. The rest of the ladder");
const at = (v) => A.habitActivities({ htHabits: HABITS, htEntries: [{ habitId: "hs", date: TODAY, value: v }] })[0];
ok("0 of 15 is 'none' at 0%", at(0).status === "none" && at(0).pct === 0);
ok("15 of 15 is 'complete' at 100%", at(15).status === "complete" && at(15).pct === 100);
ok("20 of 15 is 'exceeded' at 133%", at(20).status === "exceeded" && at(20).pct === 133);
ok("exceeding is not flattened to 100", at(20).pct > 100);
ok("a day with no row produces no activity at all",
  A.habitActivities({ htHabits: HABITS, htEntries: [] }).length === 0);

console.log("\n1c. A boolean habit has no magnitude to lose");
const prayed = A.habitActivities({ htHabits: HABITS, htEntries: [{ habitId: "hp", date: TODAY, value: 1 }] })[0];
ok("ticking it is complete", prayed.status === "complete" && prayed.pct === 100);
ok("an explicit miss is 'none', not unlogged",
  A.habitActivities({ htHabits: HABITS, htEntries: [{ habitId: "hp", date: TODAY, value: 0 }] })[0].status === "none");

console.log("\n1d. 'No more than N' is not a percentage of an achievement");
const scroll = (v) => A.habitActivities({ htHabits: HABITS, htEntries: [{ habitId: "hc", date: TODAY, value: v }] })[0];
ok("10 of a 30-minute ceiling is complete", scroll(10).status === "complete");
ok("and reports no percentage", scroll(10).pct === null);
ok("40 over the ceiling is not complete", scroll(40).status === "none");
ok("the raw value is still kept", scroll(40).actual === 40);

// ── 2. Every record has the shape §9 asks for ────────────────────────
console.log("\n2. One shape for everything");
const deps = {
  htHabits: HABITS,
  htEntries: [{ habitId: "hs", date: TODAY, value: 5 }, { habitId: "hp", date: back(1), value: 1 }],
  workouts: [{ id: "w1", date: back(1), type: "Push", sets: [{}, {}] }],
  nutrition: { [TODAY]: [{ id: "n1", name: "Chicken", slot: "pre_shift", grams: 200, proc: 1, n: { kcal: 330, p: 60 } },
                          { id: "n2", name: "Water", slot: "mid_shift", grams: 800, proc: 1, bev: true, n: {} }] },
  nutritionProfile: profile,
  hydration: { [TODAY]: 1200 },
  sleep: { [TODAY]: 7.5, [back(1)]: 5 },
  church: [{ id: "c1", date: back(2), title: "Sunday" }],
  verses: [{ id: "v1", date: TODAY }, { id: "v2", date: TODAY }],
  faithNotes: [{ id: "fn1", date: TODAY }],
  entries: [{ id: "j1", date: TODAY }],
  purity: { [TODAY]: { s: "pure" }, [back(1)]: { s: "relapse" } },
};
const feed = A.buildActivityFeed(deps);
const REQUIRED = ["id", "date", "type", "category", "label", "source", "actual", "target", "unit", "pct", "status"];
const missing = feed.filter((a) => REQUIRED.some((k) => !(k in a)));
ok(`every record carries the full shape${missing.length ? ` (${missing.length} short)` : ""}`, missing.length === 0);
ok("every status is one of the five", feed.every((a) => A.STATUSES.includes(a.status)));
ok("every date is a real day", feed.every((a) => /^\d{4}-\d{2}-\d{2}$/.test(a.date)));
ok("every record names the module that owns the write", feed.every((a) => !!a.source));
ok("the feed spans every module", new Set(feed.map((a) => a.source)).size >= 5);

console.log("\n2b. Ids are derived from the fact, not from when it was read");
const again = A.buildActivityFeed(deps);
ok("rebuilding produces identical ids", JSON.stringify(feed.map((a) => a.id)) === JSON.stringify(again.map((a) => a.id)));
ok("no duplicate ids", new Set(feed.map((a) => a.id)).size === feed.length);
ok("so merging two builds cannot double-count",
  new Set([...feed, ...again].map((a) => a.id)).size === feed.length);

console.log("\n2c. Editing a store moves the feed with it");
const edited = A.buildActivityFeed({ ...deps, htEntries: [{ habitId: "hs", date: TODAY, value: 15 }] });
const s2 = edited.find((a) => a.id === `habit:hs:${TODAY}`);
ok("the same activity now reads complete", s2.status === "complete" && s2.pct === 100);
ok("and there is still only one of it", edited.filter((a) => a.id === `habit:hs:${TODAY}`).length === 1);
const deleted = A.buildActivityFeed({ ...deps, htEntries: [] });
ok("deleting the entry removes it from the feed", !deleted.some((a) => a.id === `habit:hs:${TODAY}`));

// ── 3. Nutrition is graded per question ──────────────────────────────
console.log("\n3. Nutrition asks more than 'did I eat'");
const kcal = feed.find((a) => a.type === "calories");
const prot = feed.find((a) => a.type === "protein");
const water = feed.find((a) => a.type === "hydration");
ok("calories are graded against the day's target", kcal && kcal.target > 0 && kcal.actual === 330);
ok("a 330 kcal day is not 'complete'", kcal.status === "partial");
ok("protein is its own question", prot && prot.actual === 60);
ok("hydration adds both log paths", water.actual === 2000);
ok("and is graded against the water target", water.target > 0);

// ── 4. Faith counts acts, not rows ───────────────────────────────────
console.log("\n4. Faith counts what happened, not how many rows it took");
const scripture = feed.filter((a) => a.type === "scripture");
ok("two verses on one day are ONE reading", scripture.length === 1);
ok("with the count preserved", scripture[0].actual === 2);
ok("church attendance is its own activity", feed.some((a) => a.type === "church"));
ok("faith rolls up to the faith category", feed.filter((a) => a.category === "faith").length >= 3);

// ── 5. Days and windows ──────────────────────────────────────────────
console.log("\n5. Grouping and summarising");
const byDay = A.activityByDay(feed);
ok("every day in the feed has a bucket", Object.keys(byDay).every((d) => byDay[d].length > 0));
ok("today's bucket holds today's work", A.activitiesOn(feed, TODAY).every((a) => a.date === TODAY));
ok("a window excludes what is outside it", A.windowOf(feed, 1, TODAY).every((a) => a.date === TODAY));

const sleepSum = A.summarise(feed, "sleep", 7, TODAY);
ok("summarise counts logged days", sleepSum.logged === 2);
ok("and how many met the bar", sleepSum.met === 1);
ok("unlogged days are counted apart, not as misses", sleepSum.unlogged === 5);
ok("consistency is over logged days only", sleepSum.consistency === 50);
ok("coverage says how much of the window was recorded", sleepSum.coverage === Math.round((2 / 7) * 100));

const stretchSum = A.summarise(feed, "habit", 7, TODAY);
ok("partial days are counted as partial", stretchSum.partial >= 1);
ok("the average percentage is over measured rows", stretchSum.avgPct != null);

console.log("\n5b. An empty feed says nothing rather than zero");
const none = A.summarise([], "habit", 7, TODAY);
ok("consistency is null, not 0%", none.consistency === null);
ok("and the average is null", none.avgPct === null);
ok("but coverage is honestly zero", none.coverage === 0);
ok("an empty build is an empty feed", A.buildActivityFeed({}).length === 0);

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Activity feed: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
