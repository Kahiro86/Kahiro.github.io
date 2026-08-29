// Three findings with one shape: an event recorded without the date it
// happened on, or without a way to have more than one of it.
//
//   · a verse reviewed twenty times over twenty days kept one date
//   · a bill paid every month for a year kept one month, on a made-up day
//   · a journal written twice in a day became two entries for one day
//
// Dates are not decoration here. The calendar, the consistency engine and the
// XP ledger all key on them, so an event on the wrong day is a wrong number
// somewhere the user can see.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const p = (rel) => join(root, rel).replace(/\\/g, "/");
writeFileSync(join(here, "_de.js"), `
export * as collect from "${p("src/shared/xp/collect.js")}";
export * as bills from "${p("src/modules/finance/bills.js")}";
`);
const r = await build({ entryPoints: [join(here, "_de.js")], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
const out = join(mkdtempSync(join(tmpdir(), "de-")), "b.mjs");
writeFileSync(out, r.outputFiles[0].text);
const { collect, bills } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const TODAY = "2026-08-28";
const datesOf = (deps, kind) => {
  const byDay = collect.collectEvents(deps, TODAY);
  return Object.entries(byDay).flatMap(([d, evs]) => evs.filter((e) => e.kind === kind).map(() => d)).sort();
};

console.log("\n1. Scripture review — one event per date it happened");
{
  const dated = { id: "v1", ref: "Ps 23:1", addedAt: "2026-08-01", reviews: 3, lastReviewed: "2026-08-20",
    reviewDates: ["2026-08-05", "2026-08-12", "2026-08-20"] };
  ok("three reviews on three days are three dated events",
    JSON.stringify(datesOf({ verses: [dated] }, "faith.verseReviewed")) === JSON.stringify(["2026-08-05", "2026-08-12", "2026-08-20"]));
  ok("two reviews on one day count once — one act of review",
    datesOf({ verses: [{ ...dated, reviewDates: ["2026-08-05", "2026-08-05"] }] }, "faith.verseReviewed").length === 1);

  // The field the collector used to read was `reviewCount`, which the app has
  // never written — FaithCore writes `reviews`. So this award fired zero times
  // for any real verse, and the register's own fixture matched the code rather
  // than the app, which is how it looked merely mis-dated.
  const legacy = { id: "v2", ref: "Ps 23:1", addedAt: "2026-08-01", reviews: 5, lastReviewed: "2026-08-20" };
  ok("a verse from before the dated log still pays, once, on its last review",
    JSON.stringify(datesOf({ verses: [legacy] }, "faith.verseReviewed")) === JSON.stringify(["2026-08-20"]));
  ok("and the earlier dates are not invented", datesOf({ verses: [legacy] }, "faith.verseReviewed").length === 1);
  ok("a verse never reviewed pays nothing",
    datesOf({ verses: [{ id: "v3", ref: "x", addedAt: "2026-08-01", reviews: 0, lastReviewed: null }] }, "faith.verseReviewed").length === 0);

  const src = readFileSync(join(root, "src/modules/faith/FaithCore.jsx"), "utf8");
  ok("and the review button writes the date", /reviewDates:/.test(src));
}

console.log("\n2. Bills — every payment, on the day it was made");
{
  let b = bills.newBill({ id: "b1", name: "Rent", amount: 30000, dueDay: 1 });
  b = bills.payBill(b, "2026-06-03");
  b = bills.payBill(b, "2026-07-02");
  b = bills.payBill(b, "2026-08-04");
  ok("three months paid are three dated events",
    JSON.stringify(datesOf({ finance: { bills: [b] } }, "bill.paid")) === JSON.stringify(["2026-06-03", "2026-07-02", "2026-08-04"]));
  ok("not one event on a day nobody paid", !datesOf({ finance: { bills: [b] } }, "bill.paid").some((d) => d.endsWith("-15")));
  ok("paying the same day twice records once", bills.payBill(bills.payBill(b, "2026-08-04"), "2026-08-04").payments.length === 3);
  ok("the cycle still reads settled", bills.isPaidThisCycle(b, "2026-08-20"));

  const undone = bills.unpayBill(b, "2026-08-20");
  ok("un-paying drops that cycle's payment", undone.payments.length === 2);
  ok("and leaves the earlier months alone", datesOf({ finance: { bills: [undone] } }, "bill.paid").length === 2);

  const legacy = { id: "b2", name: "Rent", amount: 30000, lastPaidMonth: "2026-07" };
  ok("a bill settled before the log still pays for that month",
    JSON.stringify(datesOf({ finance: { bills: [legacy] } }, "bill.paid")) === JSON.stringify(["2026-07-15"]));
}

console.log("\n3. Journal — one day, one entry");
{
  const w = readFileSync(join(root, "src/modules/habits/disciplineWriters.js"), "utf8");
  // The key used to require `fromDiscipline`, which QuickJournal does not set,
  // so the Discipline composer created a second entry for a day that already
  // had one — and opened onto text it would then not edit.
  ok("the day's existing entry is matched whoever wrote it", /const sameDay = list\.filter/.test(w));
  ok("preferring this writer's own, when there is one", /sameDay\.find\(\(e\) => e\.fromDiscipline\) \|\| sameDay\[0\]/.test(w));
}

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Dated events: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
