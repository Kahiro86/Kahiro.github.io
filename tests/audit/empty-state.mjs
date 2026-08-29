// The first five minutes: every route with NOTHING in any store.
//
// This is the opposite risk to console-clean.mjs, and the more common one
// in practice — an average over an empty array, a [0] on nothing, a chart
// handed no rows, a "best day" with no days. A screen that works with three
// years of history can still be the first thing a new person sees fail.
import { chromium } from "playwright";
import { serve, CHROMIUM } from "../fixtures/harness.mjs";

const { base: BASE, close: closeServer } = await serve();

// Only the flags that suppress first-run overlays. Every DATA store is left
// exactly as a new install finds it: absent.
const seed = {
  onboarding: JSON.stringify({ overviewSeen: true, done: true }),
  whatsnew_seen: JSON.stringify("3.1"),
  dash_show_more: JSON.stringify(true),
  dash_show_money: JSON.stringify(true),
};

// Noise that is not a defect: a dev-only React notice, a favicon 404 from
// the throwaway static server, a deliberate offline no-op.
const IGNORE = [
  /Download the React DevTools/i,
  /favicon/i,
  /Failed to load resource.*404.*(icon|manifest|apple-touch)/i,
  /ServiceWorker|serviceWorker registration/i,
];
const noisy = (t) => IGNORE.some((re) => re.test(t));

const ROUTES = ["dashboard", "habits", "gym", "faith", "calendar", "analytics", "firm"];

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const b = await chromium.launch({ executablePath: CHROMIUM });
const page = await b.newPage({ viewport: { width: 1400, height: 1600 } });

const seen = [];
page.on("pageerror", (e) => seen.push({ kind: "pageerror", text: String(e) }));
page.on("console", (m) => {
  const t = m.text();
  if ((m.type() === "error" || m.type() === "warning") && !noisy(t)) seen.push({ kind: m.type(), text: t });
});

await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(`architect:${k}`, v); }, seed);
const dismiss = async () => { for (const n of ["Skip", "Skip the tour"]) { const x = page.getByRole("button", { name: n, exact: true }); try { if (await x.count()) { await x.first().click({ timeout: 1200 }); await page.waitForTimeout(150); } } catch { } } };

await page.goto(BASE, { waitUntil: "networkidle" });
await dismiss(); await page.waitForTimeout(1800); await dismiss(); await page.waitForTimeout(600);

console.log("\nWalking every facet with nothing stored anywhere\n");
for (const route of ROUTES) {
  const before = seen.length;
  try {
    await page.locator(`[data-tour="nav-${route}"]`).first().click({ timeout: 5000 });
    await page.waitForTimeout(2200);
    await dismiss();
    // Open whatever sub-tabs the facet offers — a chart that only renders on
    // the third tab is exactly where a stale prop hides.
    const tabs = await page.locator('[role="tab"], .tab, button').all();
    for (const t of tabs.slice(0, 14)) {
      try {
        const label = (await t.innerText()).trim();
        if (!label || label.length > 22 || /delete|remove|reset|clear|log out|import/i.test(label)) continue;
        await t.click({ timeout: 1200 });
        await page.waitForTimeout(500);
      } catch { /* not clickable; fine */ }
    }
  } catch { /* route may not exist on this layout */ }
  const found = seen.slice(before);
  ok(`${route.padEnd(10)} clean${found.length ? ` — ${found.length}: ${found.slice(0, 2).map((f) => f.text.slice(0, 110)).join(" | ")}` : ""}`, found.length === 0);
}

// A blank panel and a panel that says "nothing here yet" look the same to a
// console watcher and completely different to a person.
const text = (await page.locator("body").innerText()).replace(/\\s+/g, " ");
ok("the app still says something on an empty install", text.length > 200);

console.log("");
if (seen.length) {
  console.log("ALL MESSAGES:");
  const uniq = [...new Map(seen.map((s) => [s.text.slice(0, 160), s])).values()];
  for (const s of uniq.slice(0, 20)) console.log(`  [${s.kind}] ${s.text.slice(0, 220)}`);
  console.log("");
}
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Empty state: ${pass}/${pass + fail} routes`);
await b.close(); closeServer();
process.exit(fail ? 1 : 0);
