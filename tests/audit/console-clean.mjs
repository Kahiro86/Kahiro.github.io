// Every route, watched for what the browser complains about. The QA sweep
// catches a blank page; this catches the tier below — a React key warning,
// an unhandled rejection, a PropType violation, a thrown error a boundary
// swallowed. Those are bugs that have not surfaced yet rather than bugs
// that are not there.
//
// This one keeps its own console listener rather than the harness's, because
// it watches warnings as well as errors and filters known noise. Its data is
// richWorld() — the same world mobile-layout uses, which is how the two of
// them stop drifting apart, and how the gym-session bug in the copy they
// each carried came to light.
import { chromium } from "playwright";
import { serve, CHROMIUM, tally } from "../fixtures/harness.mjs";
import { richWorld } from "../fixtures/scenarios.mjs";

const { base: BASE, close: closeServer } = await serve();

const seed = richWorld();

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

const t = tally("Console clean");
const ok = t.ok;

const b = await chromium.launch({ executablePath: CHROMIUM });
const page = await b.newPage({ viewport: { width: 1400, height: 1600 } });

const seen = [];
page.on("pageerror", (e) => seen.push({ kind: "pageerror", text: String(e) }));
page.on("console", (m) => {
  const txt = m.text();
  if ((m.type() === "error" || m.type() === "warning") && !noisy(txt)) seen.push({ kind: m.type(), text: txt });
});

await page.addInitScript((s) => {
  for (const [k, v] of Object.entries(s)) localStorage.setItem(`architect:${k}`, JSON.stringify(v));
}, seed);
const dismiss = async () => { for (const n of ["Skip", "Skip the tour"]) { const x = page.getByRole("button", { name: n, exact: true }); try { if (await x.count()) { await x.first().click({ timeout: 1200 }); await page.waitForTimeout(150); } } catch { } } };

await page.goto(BASE, { waitUntil: "networkidle" });
await dismiss(); await page.waitForTimeout(1800); await dismiss(); await page.waitForTimeout(600);

console.log("\nWalking every facet with real data in every store\n");
for (const route of ROUTES) {
  const before = seen.length;
  try {
    await page.locator(`[data-tour="nav-${route}"]`).first().click({ timeout: 5000 });
    await page.waitForTimeout(2200);
    await dismiss();
    // Open whatever sub-tabs the facet offers — a chart that only renders on
    // the third tab is exactly where a stale prop hides.
    const tabs = await page.locator('[role="tab"], .tab, button').all();
    for (const tab of tabs.slice(0, 14)) {
      try {
        const label = (await tab.innerText()).trim();
        if (!label || label.length > 22 || /delete|remove|reset|clear|log out|import/i.test(label)) continue;
        await tab.click({ timeout: 1200 });
        await page.waitForTimeout(500);
      } catch { /* not clickable; fine */ }
    }
  } catch { /* route may not exist on this layout */ }
  const found = seen.slice(before);
  ok(`${route.padEnd(10)} clean${found.length ? ` — ${found.length}: ${found.slice(0, 2).map((f) => f.text.slice(0, 110)).join(" | ")}` : ""}`, found.length === 0);
}

if (seen.length) {
  console.log("\nALL MESSAGES:");
  const uniq = [...new Map(seen.map((s) => [s.text.slice(0, 160), s])).values()];
  for (const s of uniq.slice(0, 20)) console.log(`  [${s.kind}] ${s.text.slice(0, 220)}`);
}

await b.close(); closeServer();
t.done();
