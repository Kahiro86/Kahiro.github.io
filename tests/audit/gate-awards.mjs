// Clearing the gate pays. It did not before: gate.monthCleared (100) and
// campaign.quarterCleared (400) — the two largest awards in the value table,
// both exempt from the daily cap because they are meant to be rare — were
// priced from finance.gatesCleared and finance.quartersCleared, arrays that
// nothing in the app has ever written. `grep -rn` found two readers and zero
// writers, while scalingGate sat next door computing the gate correctly.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const p = (rel) => join(root, rel).replace(/\\/g, "/");
writeFileSync(join(here, "_ga.js"), `
export * as collect from "${p("src/shared/xp/collect.js")}";
export * as firm from "${p("src/shared/firm.js")}";
`);
const r = await build({ entryPoints: [join(here, "_ga.js")], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
const out = join(mkdtempSync(join(tmpdir(), "ga-")), "b.mjs");
writeFileSync(out, r.outputFiles[0].text);
const { collect, firm } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const MONTHS = ["2026-05", "2026-06", "2026-07"];
const nextMonthFirst = (ym) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; };
const world = (months, { withdrawIn = months, adherence = 100 } = {}) => ({
  reviews: months.map((ym, i) => ({ id: `r${i}`, kind: "monthly", period: ym, date: nextMonthFirst(ym) })),
  trades: months.map((ym, i) => ({ id: `t${i}`, date: `${ym}-10`, status: "CLOSED", outcome: "WIN", checklistTotal: 5, checklistScore: adherence === 100 ? 5 : 3 })),
  firmWithdrawals: withdrawIn.map((ym, i) => ({ id: `w${i}`, date: `${ym}-28`, amount: 20000, split: { fleet: 8000, vault: 6000, book: 4000, life: 2000 } })),
});
const events = (deps, kind) => {
  const byDay = collect.collectEvents(deps, "2026-12-31");
  return Object.entries(byDay).flatMap(([d, evs]) => evs.filter((e) => e.kind === kind).map((e) => ({ date: d, label: e.label })));
};

console.log("\n1. A cleared month pays, on the day it was proven");
{
  const w = world(MONTHS);
  const got = events(w, "gate.monthCleared");
  ok(`three clean months produce three awards (${got.length})`, got.length === 3);
  ok("dated to the monthly review that proved them, not to a synthetic day",
    got.every((e) => /-01$/.test(e.date)) && got.some((e) => e.date === "2026-06-01"));
  ok("and named for the month they cleared", got.some((e) => /2026-05/.test(e.label)));
}

console.log("\n2. All three conditions are load-bearing");
{
  ok("no monthly review, no award", events({ ...world(MONTHS), reviews: [] }, "gate.monthCleared").length === 0);
  ok("no withdrawal taken, no award", events(world(MONTHS, { withdrawIn: [] }), "gate.monthCleared").length === 0);
  ok("checklist not held, no award", events(world(MONTHS, { adherence: 60 }), "gate.monthCleared").length === 0);
  ok("a month withdrawn but not reviewed does not count",
    events(world(["2026-05"], { withdrawIn: ["2026-05", "2026-06"] }), "gate.monthCleared").length === 1);
}

console.log("\n3. A quarter is three CONSECUTIVE clean months");
{
  ok("three in a row clears one quarter", events(world(MONTHS), "campaign.quarterCleared").length === 1);
  ok("three scattered months clear none",
    events(world(["2026-01", "2026-05", "2026-09"]), "campaign.quarterCleared").length === 0);
  ok("two in a row clear none", events(world(["2026-05", "2026-06"]), "campaign.quarterCleared").length === 0);
  // Four consecutive months are one quarter, not two — the fourth extends the
  // record; it does not re-pay 400 for the same three.
  ok("four in a row still clear exactly one",
    events(world(["2026-05", "2026-06", "2026-07", "2026-08"]), "campaign.quarterCleared").length === 1);
  ok("six in a row clear two",
    events(world(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]), "campaign.quarterCleared").length === 2);
}

console.log("\n4. One definition of a clean month, shared with the Firm's gate");
{
  const w = world(MONTHS);
  const clean = firm.cleanMonths({ trades: w.trades, reviews: w.reviews, withdrawals: w.firmWithdrawals });
  const gate = firm.scalingGate(w.trades, w.reviews, w.firmWithdrawals, 3, "2026-08-15");
  ok(`cleanMonths says ${clean.length}, the gate screen says ${gate.have} of ${gate.need}`, clean.length === gate.have);
  ok("and the gate reads met", gate.met === true);
}

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Gate awards: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
