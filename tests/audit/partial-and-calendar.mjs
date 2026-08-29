// §14 Test 2 and Test 4. The headline case — 5 of 15 minutes stretching —
// followed through the tracker, the calendar and back, and the calendar
// checked as a mirror of the underlying records rather than a dataset of
// its own.
import { chromium } from "playwright";
import { CHROMIUM, TODAY, ago, dayLabel, serve } from "../fixtures/harness.mjs";

const { base: BASE, close: closeServer } = await serve();

// The grid repeats day numbers in its padding rows, so days are addressed by
// their full accessible name rather than by the digits on the tile.
const openToday = async (page, dismiss) => {
  await page.locator('[data-tour="nav-calendar"]').first().click();
  await page.waitForTimeout(1700); await dismiss();
  await page.getByRole("button", { name: new RegExp(`^${dayLabel()}`) }).first().click();
  await page.waitForTimeout(800);
  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
};

const habit = (over) => ({
  type: "boolean", unit: null, target: null, targetDirection: "at_least",
  frequencyType: "daily", frequencyDays: null, frequencyCount: null,
  icon: "✅", colour: null, notes: null, archivedAt: null,
  createdAt: `${ago(40)}T06:00:00.000Z`, updatedAt: `${ago(40)}T06:00:00.000Z`, ...over,
});

const seed = {
  onboarding: JSON.stringify({ overviewSeen: true, done: true }),
  whatsnew_seen: JSON.stringify("3.1"),
  ht_habits: JSON.stringify([
    habit({ id: "hstr", name: "Stretch", type: "numeric", unit: "min", target: 15 }),
    habit({ id: "hpray", name: "Pray", icon: "🙏" }),
  ]),
  ht_entries: JSON.stringify([]),
};

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const errs = [];
const b = await chromium.launch({ executablePath: CHROMIUM });
const page = await b.newPage({ viewport: { width: 1280, height: 1500 } });
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await page.addInitScript((s) => {
  if (localStorage.getItem("__seeded")) return;
  for (const [k, v] of Object.entries(s)) localStorage.setItem(`architect:${k}`, v);
  localStorage.setItem("__seeded", "1");
}, seed);
const dismiss = async () => { for (const n of ["Skip", "Skip the tour"]) { const x = page.getByRole("button", { name: n, exact: true }); try { if (await x.count()) { await x.first().click({ timeout: 1200 }); await page.waitForTimeout(150); } } catch { } } };
const store = (k) => page.evaluate((key) => JSON.parse(localStorage.getItem(`architect:${key}`) || "null"), k);

const logAmount = async (label, value) => {
  await page.locator('[data-tour="nav-habits"]').first().click();
  await page.waitForTimeout(1400); await dismiss();
  // An unlogged cell reads "<habit>, today: not logged yet"; once it holds a
  // value it reads "<habit>, <ISO date>: 5 min". Match either.
  await page.getByRole("button", { name: new RegExp(`^${label}, (today|${TODAY})`, "i") }).first().click();
  await page.waitForTimeout(700);
  const field = page.getByRole("textbox", { name: /^Amount/i }).first();
  await field.fill(String(value));
  await page.getByRole("button", { name: /^Save$/ }).first().click();
  await page.waitForTimeout(1100);
};

await page.goto(BASE, { waitUntil: "networkidle" });
await dismiss(); await page.waitForTimeout(1600); await dismiss(); await page.waitForTimeout(700);

// ── Test 2 ───────────────────────────────────────────────────────────
console.log("\n1. Five minutes of a fifteen-minute stretch");
await logAmount("Stretch", 5);
const e1 = ((await store("ht_entries")) || []).find((e) => e.habitId === "hstr" && e.date === TODAY);
ok("the actual value is stored, not a boolean", e1 && e1.value === 5);

let cal = await openToday(page, dismiss);
ok("the calendar shows the day as having habit activity", /habits/i.test(cal));
ok("and names the partial habit", /stretch/i.test(cal));
ok("with the real numbers, not 'not done'", /5 min of 15 min/i.test(cal));
ok("and the percentage", /\b33%/.test(cal));
ok("it is counted as partial, not as a completion", /partial/i.test(cal));

// ── Test 2, second half ──────────────────────────────────────────────
console.log("\n2. Then the remaining ten minutes");
await logAmount("Stretch", 15);
const e2 = ((await store("ht_entries")) || []).filter((e) => e.habitId === "hstr" && e.date === TODAY);
ok("editing updates the same row rather than adding one", e2.length === 1);
ok("and the value is now 15", e2[0].value === 15);

cal = await openToday(page, dismiss);
ok("the calendar now reads 1/1 done", /1\/1 done/.test(cal));
ok("and no longer calls it partial", !/· 1 partial/.test(cal));

// ── Test 4 ───────────────────────────────────────────────────────────
console.log("\n3. The calendar mirrors other modules too");
await page.locator('[data-tour="nav-habits"]').first().click();
await page.waitForTimeout(1400); await dismiss();
await page.getByRole("button", { name: /Pray, today: not logged yet/i }).first().click();
await page.waitForTimeout(900);
cal = await openToday(page, dismiss);
ok("a habit ticked elsewhere appears on the day", /2\/2 done/.test(cal));

console.log("\n4. A deletion propagates with nothing left behind");
await page.locator('[data-tour="nav-habits"]').first().click();
await page.waitForTimeout(1400); await dismiss();
await page.getByRole("button", { name: new RegExp(`^Stretch, (today|${TODAY})`, "i") }).first().click();
await page.waitForTimeout(700);
await page.getByRole("button", { name: /^Clear$/ }).first().click();
await page.waitForTimeout(1100);
const remaining = ((await store("ht_entries")) || []).filter((e) => e.date === TODAY);
ok("clearing removes only that habit's row", remaining.length === 1 && remaining[0].habitId === "hpray");
cal = await openToday(page, dismiss);
ok("the deleted habit is gone from the day", !/stretch/i.test(cal));
ok("and the remaining one is still there", /1\/1 done/.test(cal));

// ── Test 5 ───────────────────────────────────────────────────────────
console.log("\n5. It survives a restart");
await page.reload({ waitUntil: "networkidle" });
await dismiss(); await page.waitForTimeout(1800); await dismiss();
const after = ((await store("ht_entries")) || []).filter((e) => e.date === TODAY);
ok("the entries are still there after a reload", after.length === 1 && after[0].habitId === "hpray");

console.log("");
console.log("ERRORS:", errs.slice(0, 3).join(" || ") || "none");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Partial completion + calendar: ${pass}/${pass + fail} passed`);
await b.close(); closeServer();
process.exit(fail ? 1 : 0);
