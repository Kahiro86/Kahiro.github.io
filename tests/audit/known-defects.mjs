// ── The defect register ──────────────────────────────────────────────
// Findings from the 2026-08-28 audit, written as code instead of prose.
//
// Each one DEMONSTRATES the defect and asserts it is still present. That is
// deliberate and it is not a green rubber stamp: a report goes stale the day
// after it is written, and nobody re-reads it. This runs on every `npm run
// test:audit`, so a claim that stops being true fails loudly and says so —
// "appears fixed, verify and remove this entry" — instead of quietly
// misinforming the next person to open the file.
//
// The inversion matters. Writing these as ordinary failing tests would leave
// the suite permanently red, and a permanently red suite is one nobody reads,
// which is most of how the fixture drift this work started from happened.
//
// When you fix one: this audit fails, you delete the entry, and the real
// assertion belongs wherever the behaviour lives.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const p = (rel) => join(root, rel).replace(/\\/g, "/");

writeFileSync(join(here, "_kd.js"), `
export * as collect from "${p("src/shared/xp/collect.js")}";
export * as migrate from "${p("src/modules/habits/migrateDiscipline.js")}";
`);
const r = await build({ entryPoints: [join(here, "_kd.js")], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
const out = join(mkdtempSync(join(tmpdir(), "kd-")), "b.mjs");
writeFileSync(out, r.outputFiles[0].text);
const { collect, migrate } = await import(pathToFileURL(out).href);

const D = "2026-08-20";
const TODAY = "2026-08-28";
const PROFILE = { age: 27, sex: "male", heightCm: 178, weightKg: 78, activity: 1.55, goal: "muscle" };

// ─────────────────────────────────────────────────────────────────────
const DEFECTS = [
  {
    n: 4,
    title: "A purity day corrected in the Purity screen never reaches XP",
    where: "migrateDiscipline.js:82 · PurityTab.jsx:141",
    should: "the mirror is keyed on the value, not just the date, so an edit propagates",
    demonstrate() {
      // The user marked D clean, then went back and corrected it to a relapse.
      // purity_log has the correction; ht_entries still holds the claim.
      const plan = migrate.planDisciplineMigration({
        purity: { [D]: { s: "relapse", triggers: [] } },
        journal: [],
        htHabits: [{ id: "sys_purity", name: "Purity" }],
        htEntries: [{ id: "old", habitId: "sys_purity", date: D, value: 1 }],
        everPinned: ["sys_purity", "sys_journal"],
      });
      // The boot migration is idempotent on the DATE, so it sees the day as
      // already handled and writes nothing. XP keeps paying for the claim.
      return {
        present: plan.addEntries.length === 0,
        detail: `purity_log says relapse, ht_entries says value 1, and the boot migration adds ${plan.addEntries.length} corrections (alreadyPresent: ${plan.report.alreadyPresent})`,
      };
    },
  },

  {
    n: 7,
    title: "Overlap resolution ranks on base price, so multipliers cannot decide the winner",
    where: "collect.js:220",
    should: "rank on the priced value, as the comment above it promises",
    demonstrate() {
      const habit = {
        id: "h9", name: "Log meals", type: "boolean", target: null, targetDirection: "at_least",
        frequencyType: "daily", archivedAt: null, sortOrder: 0,
        createdAt: "2026-01-01T12:00:00.000Z", updatedAt: "2026-01-01T12:00:00.000Z",
      };
      const byDay = collect.collectEvents({
        htHabits: [habit],
        htEntries: [{ id: "e1", habitId: "h9", date: D, value: 1, note: null, createdAt: "", updatedAt: "" }],
        nutrition: { [D]: [{ id: "m1", name: "X", slot: "pre_shift", grams: 100, proc: 1, n: { kcal: 400, p: 30 } }] },
        nutritionProfile: PROFILE,
      }, TODAY);
      const meals = (byDay[D] || []).filter((e) => e.group === "meals");
      const habitEvent = meals.find((e) => e.kind === "habit.completed");
      // base 10 loses to base 12 — but at Frontier difficulty the habit is
      // worth 10 × 1.8 = 18, which would beat meals.dayComplete outright.
      return {
        present: !!habitEvent?.supersededBy,
        detail: `habit.completed (base 10, up to 18 weighted) is superseded by ${habitEvent?.supersededBy} (base 12, never weighted)`,
      };
    },
  },

  {
    n: 10,
    title: "Verse reviews all collapse onto the last-reviewed date",
    where: "collect.js:168-169",
    should: "one event per review date, or a review log instead of a counter",
    demonstrate() {
      const byDay = collect.collectEvents({
        verses: [{ id: "v1", ref: "Ps 23:1", addedAt: "2026-08-01", reviewCount: 5, lastReviewed: "2026-08-20" }],
      }, TODAY);
      const spread = Object.entries(byDay)
        .map(([d, evs]) => [d, evs.filter((e) => e.kind === "faith.verseReviewed").length])
        .filter(([, n]) => n > 0);
      return {
        present: spread.length === 1 && spread[0][1] === 5,
        detail: `five reviews land as ${spread.map(([d, n]) => `${n} on ${d}`).join(", ")} — the other four dates are lost`,
      };
    },
  },

  {
    n: 11,
    title: "A paid bill is dated to the 15th, and only the last month counts",
    where: "collect.js:151",
    should: "the date the bill was actually paid, and a payment log rather than one scalar",
    demonstrate() {
      const byDay = collect.collectEvents({
        finance: { bills: [{ id: "b1", name: "Rent", lastPaidMonth: "2026-07", lastPaidDate: "2026-07-03" }] },
      }, TODAY);
      const dates = Object.entries(byDay)
        .filter(([, evs]) => evs.some((e) => e.kind === "bill.paid"))
        .map(([d]) => d);
      return {
        present: dates.length === 1 && dates[0].endsWith("-15"),
        detail: `paid on 2026-07-03, recorded on ${dates.join(", ")}; a year of payments would still be ${dates.length} event`,
      };
    },
  },
];

// ─────────────────────────────────────────────────────────────────────
let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

console.log(`\n${DEFECTS.length} findings from the 2026-08-28 audit, still open.\n`);
for (const d of DEFECTS) {
  let res;
  try { res = d.demonstrate(); }
  catch (e) { res = { present: false, detail: `the demonstration itself threw: ${e.message}` }; }
  console.log(`── Finding ${d.n} · ${d.title}`);
  console.log(`   ${d.where}`);
  console.log(`   ${res.detail}`);
  console.log(`   should be: ${d.should}`);
  ok(`finding ${d.n} is still present${res.present ? "" : " — APPEARS FIXED: verify, then delete this entry and assert the fix where the behaviour lives"}`,
    res.present);
  console.log("");
}

if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Known defects: ${pass}/${pass + fail} still present, as recorded`);
process.exit(fail ? 1 : 0);
