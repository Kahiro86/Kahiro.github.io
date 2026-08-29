// Launch performance, against the real build and a realistically heavy
// store: three years of purity days, 800 journal entries, 4,200 habit
// entries, 400 nights of sleep and 300 days of food.
//
// The budget exists because the boot chain is the easiest place in the app
// to quietly spend a second. Four idempotent passes — the discipline
// migration, the dead-store purge, the XP carry-forward and the 60-day
// link reconcile — used to run BEFORE the first render, so the person with
// the most history waited the longest to see anything. They now run after
// paint, and this test is what stops them creeping back in front of it.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serve, CHROMIUM, ROOT, ago } from "../fixtures/harness.mjs";

const { base: BASE, close: closeServer } = await serve();


const purity = {}; for (let i = 0; i < 1100; i++) purity[ago(i)] = { s: i % 9 === 0 ? "relapse" : "pure", triggers: [] };
const journal = []; for (let i = 0; i < 800; i++) journal.push({ id: `j${i}`, date: ago(i), title: "Day", text: "x".repeat(300), mood: 3, tags: [] });
const htHabits = Array.from({ length: 14 }, (_, i) => ({
  id: `h${i}`, name: `Habit ${i}`, type: "boolean", unit: null, target: null, targetDirection: "at_least",
  frequencyType: "daily", frequencyDays: null, frequencyCount: null, icon: "✅", colour: null, notes: null,
  archivedAt: null, createdAt: `${ago(400)}T06:00:00.000Z`, updatedAt: `${ago(400)}T06:00:00.000Z`,
}));
const htEntries = [];
for (const h of htHabits) for (let i = 0; i < 300; i++) htEntries.push({ id: `e${h.id}-${i}`, habitId: h.id, date: ago(i), value: i % 5 ? 1 : 0, note: null, createdAt: "", updatedAt: "" });
const sleep = {}; for (let i = 0; i < 400; i++) sleep[ago(i)] = 5 + (i % 5);
const nutrition = {};
for (let i = 0; i < 300; i++) nutrition[ago(i)] = Array.from({ length: 6 }, (_, k) => ({ id: `n${i}-${k}`, name: "Food", slot: "pre_shift", grams: 150, proc: 2, n: { kcal: 300, p: 20, c: 30, f: 10 } }));

const seed = {
  onboarding: JSON.stringify({ overviewSeen: true, done: true }),
  whatsnew_seen: JSON.stringify("3.1"),
  purity_log: JSON.stringify(purity),
  journal_entries: JSON.stringify(journal),
  ht_habits: JSON.stringify(htHabits),
  ht_entries: JSON.stringify(htEntries),
  trade_sleep: JSON.stringify(sleep),
  nutrition_log: JSON.stringify(nutrition),
};

const b = await chromium.launch({ executablePath: CHROMIUM });
const runs = [];
for (let i = 0; i < 3; i++) {
  const page = await b.newPage({ viewport: { width: 1280, height: 1200 } });
  await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(`architect:${k}`, v); }, seed);
  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: "commit" });
  // First real content: the app's own chrome, not the static splash.
  await page.waitForFunction(() => {
    const r = document.getElementById("root");
    return r && r.textContent && r.textContent.replace(/\s+/g, "").length > 40;
  }, { timeout: 30000 });
  const paint = Date.now() - t0;
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] || {};
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    return { fcp: fcp ? Math.round(fcp.startTime) : null, domInteractive: Math.round(nav.domInteractive || 0), scripts: performance.getEntriesByType("resource").filter((r) => r.name.endsWith(".js")).length };
  });
  runs.push({ paint, ...m });
  await page.close();
}
await b.close(); closeServer();
const med = (k) => runs.map((r) => r[k]).filter((v) => v != null).sort((a, b2) => a - b2)[Math.floor(runs.length / 2)];
const appContent = med("paint");
const domInteractive = med("domInteractive");

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  \u2713 ${n}`); } else { fail++; fails.push(n); console.log(`  \u2717 ${n}`); } };

console.log(`\n  runs (ms to app content): ${runs.map((r) => r.paint).join(", ")}`);
console.log(`  median ${appContent}ms \u00b7 domInteractive ${domInteractive}ms\n`);

// Measured at ~1620ms before the boot chain was deferred and ~300ms after.
// 800 leaves generous headroom for a slower machine while still failing
// loudly if a blocking pass returns to the front of the first paint.
ok(`app content within 800ms (${appContent}ms)`, appContent < 800);
ok(`the document is interactive fast (${domInteractive}ms)`, domInteractive < 400);
ok("no run is a catastrophic outlier", runs.every((r) => r.paint < 1600));

// The structural half of the same rule: assert the boot chain is arranged
// the way the number depends on, so a regression is caught by reading as
// well as by timing.
const main = readFileSync(join(ROOT, "src/main.jsx"), "utf8");
const renderAt = main.indexOf("createRoot(document.getElementById");
const deferAt = main.indexOf("afterPaint(() =>");
ok("the heavy boot passes are scheduled after the render call", deferAt > renderAt && renderAt > 0);
for (const call of ["runDisciplineMigration(", "purgeDeadStores(", "openLedgerWithHistory(", "reconcileLinks("]) {
  ok(`${call.replace("(", "")} runs after paint`, main.indexOf(call, deferAt) > deferAt);
}
ok("the link hook is still registered synchronously", main.indexOf("installLinkSync()") < renderAt);
ok("afterPaint waits for a real paint, not just idle", /requestAnimationFrame\(\(\) => requestAnimationFrame/.test(main));

// A deploy that never reaches the device is not a deploy. An installed PWA
// resumed from the Home Screen does no navigation, so the browser's own
// update check never fires — this app has to ask.
ok("the service worker is asked for updates on foreground", /reg\.update\(\)/.test(main));
ok("triggered by returning to the app", /visibilitychange/.test(main));
ok("and throttled so it is not a request per app-switch", /3600000/.test(main));
ok("registration still cannot break boot", /\.catch\(\(\) =>/.test(main.slice(main.indexOf("serviceWorker"))));

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Launch performance: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
