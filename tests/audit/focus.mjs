// §7 / §8. The rules matter less than the restraint: this must never invent
// a problem the data does not support, and must stay quiet when it has not
// seen enough to speak.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const p = (rel) => join(root, rel).replace(/\\/g, "/");
writeFileSync(join(here, "_fc.js"), `export * from "${p("src/shared/focus.js")}";
export * as A from "${p("src/shared/activity.js")}";`);
const r = await build({ entryPoints: [join(here, "_fc.js")], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
const out = join(mkdtempSync(join(tmpdir(), "fc-")), "b.mjs");
writeFileSync(out, r.outputFiles[0].text);
const F = await import(pathToFileURL(out).href);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const TODAY = "2026-08-25";
const back = (n) => { const d = new Date(`${TODAY}T12:00:00`); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const habits = [{ id: "hs", name: "Stretch", type: "numeric", unit: "min", target: 15, targetDirection: "at_least", archivedAt: null }];
const feedOf = (deps) => F.A.buildActivityFeed(deps);

// ── 1. Silence when there is nothing to go on ────────────────────────
console.log("\n1. It says nothing on thin data");
const empty = F.focusFindings([], { today: TODAY });
ok("no findings at all", empty.more.length === 0 && empty.avoid.length === 0);
ok("and it says why rather than pretending", empty.evidence.enough === false);
ok("with the evidence it did have", empty.evidence.loggedDays === 0);

const oneDay = feedOf({ htHabits: habits, htEntries: [{ habitId: "hs", date: TODAY, value: 2 }] });
const thin = F.focusFindings(oneDay, { today: TODAY });
ok("one bad day is not a pattern", thin.more.length === 0 && thin.avoid.length === 0);
ok("and is still marked as not enough", thin.evidence.enough === false);

// ── 2. The finding partial completion made possible ──────────────────
console.log("\n2. Started but not finished");
const partialEntries = Array.from({ length: 8 }, (_, i) => ({ habitId: "hs", date: back(i), value: 5 }));
const partialFeed = feedOf({ htHabits: habits, htEntries: partialEntries });
const partial = F.focusFindings(partialFeed, { today: TODAY });
const pf = partial.more.find((f) => f.id.startsWith("partial:"));
ok("it notices a habit half-done again and again", !!pf);
ok("and says which one", /stretch/i.test(pf.text));
ok("with the real average, not a vague nudge", /33%/.test(pf.text));
ok("the evidence is attached to the claim", pf.why.logged === 8 && pf.why.partial === 8);

console.log("\n2b. Doing it properly produces no such finding");
const doneFeed = feedOf({ htHabits: habits, htEntries: Array.from({ length: 8 }, (_, i) => ({ habitId: "hs", date: back(i), value: 15 })) });
const okDays = F.focusFindings(doneFeed, { today: TODAY });
ok("no 'not finishing' finding when it is finished", !okDays.more.some((f) => f.id.startsWith("partial:")));
ok("and no consistency complaint either", !okDays.more.some((f) => f.id === "habit:consistency"));

// ── 3. A trend needs both halves ─────────────────────────────────────
console.log("\n3. Trending down, not just quiet lately");
const dropped = feedOf({
  htHabits: habits,
  htEntries: Array.from({ length: 8 }, (_, i) => ({ habitId: "hs", date: back(i + 15), value: 15 })),
  verses: Array.from({ length: 8 }, (_, i) => ({ id: `v${i}`, date: back(i + 15) })),
});
const dropFind = F.focusFindings(dropped, { days: 30, today: TODAY }).more.find((f) => f.id === "dropped:scripture");
ok("a real drop is reported", !!dropFind);
ok("with both halves quoted", dropFind && dropFind.why.older >= 4 && dropFind.why.newer === 0);

const sparse = feedOf({ htHabits: habits, htEntries: [], verses: [{ id: "v1", date: back(20) }, { id: "v2", date: back(19) }] });
ok("two rows ever is not a trend",
  !F.focusFindings(sparse, { days: 30, today: TODAY }).more.some((f) => f.id === "dropped:scripture"));

// ── 4. Improvement is reported too ───────────────────────────────────
console.log("\n4. It is not only a list of failures");
const improving = feedOf({
  workouts: [
    ...Array.from({ length: 4 }, (_, i) => ({ id: `o${i}`, date: back(i + 16), type: "Push" })),
    ...Array.from({ length: 9 }, (_, i) => ({ id: `n${i}`, date: back(i), type: "Push" })),
  ],
});
const up = F.focusFindings(improving, { days: 30, today: TODAY }).more.find((f) => f.id === "up:workout");
ok("an improving trend is surfaced", !!up);
ok("and phrased as improvement", up && /improving/i.test(up.text));

// ── 5. Ranking and restraint ─────────────────────────────────────────
console.log("\n5. Three at most, most useful first");
const busy = feedOf({
  htHabits: habits,
  htEntries: Array.from({ length: 10 }, (_, i) => ({ habitId: "hs", date: back(i), value: 4 })),
  sleep: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [back(i), 5])),
  workouts: Array.from({ length: 5 }, (_, i) => ({ id: `w${i}`, date: back(i * 2), type: "Push" })),
});
const many = F.focusFindings(busy, { days: 30, today: TODAY });
ok("no more than three to do", many.more.length <= 3);
ok("no more than three to avoid", many.avoid.length <= 3);
ok("ranked, heaviest first", many.more.every((f, i, xs) => i === 0 || xs[i - 1].weight >= f.weight));
ok("something is actually said", many.more.length > 0);
ok("the sleep floor is called out", many.avoid.some((f) => f.id === "avoid:sleep"));
ok("every finding is one short sentence", [...many.more, ...many.avoid].every((f) => f.text.length < 110 && (f.text.match(/\./g) || []).length <= 2));
ok("every 'avoid' actually says avoid", many.avoid.every((f) => /^avoid/i.test(f.text)));
ok("every finding carries its evidence", [...many.more, ...many.avoid].every((f) => f.why && Object.keys(f.why).length > 0));

console.log("\n5b. The single most useful thing");
const top = F.topFocus(busy, { days: 30, today: TODAY });
ok("there is one", !!top);
ok("and it is the heaviest of them all",
  top.weight === Math.max(...[...many.more, ...many.avoid].map((f) => f.weight)));
ok("topFocus is null when there is nothing to say", F.topFocus([], { today: TODAY }) === null);

// ── 6. Unlogged is never a miss ──────────────────────────────────────
console.log("\n6. An unrecorded day is an unknown, not a failure");
const gappy = feedOf({
  htHabits: habits,
  htEntries: [0, 1, 2, 3, 20, 21].map((i) => ({ habitId: "hs", date: back(i), value: 15 })),
});
const g = F.focusFindings(gappy, { days: 30, today: TODAY });
ok("perfect days are not called inconsistent", !g.more.some((f) => f.id === "habit:consistency"));
ok("the gaps are named as gaps instead", g.avoid.some((f) => f.id === "avoid:gaps"));
const gapFind = g.avoid.find((f) => f.id === "avoid:gaps");
ok("counting the days honestly", gapFind && gapFind.why.loggedDays === 6);

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Focus: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
