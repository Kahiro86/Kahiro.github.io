// Every route, watched for what the browser complains about. The QA sweep
// catches a blank page; this catches the tier below — a React key warning,
// an unhandled rejection, a PropType violation, a thrown error a boundary
// swallowed. Those are bugs that have not surfaced yet rather than bugs
// that are not there.
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { extname, join, normalize, resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIST = process.env.QA_DIST || join(root, "dist");
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const server = createServer((q, r) => { let p = decodeURIComponent((q.url || "/").split("?")[0]); if (p === "/") p = "/index.html"; const fp = normalize(join(DIST, p)); if (!fp.startsWith(DIST) || !existsSync(fp)) { r.statusCode = 404; return r.end("nf"); } r.setHeader("Content-Type", MIME[extname(fp)] || "application/octet-stream"); r.end(readFileSync(fp)); });
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/index.html`;

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

// Real-shaped data everywhere, so screens render their full path rather
// than their empty state — an empty screen cannot warn about a bad key.
const htHabits = Array.from({ length: 6 }, (_, i) => ({
  id: `h${i}`, name: ["Sleep well", "Hydration", "Train", "Read", "Pray", "Journal"][i],
  type: i === 1 ? "numeric" : "boolean", unit: i === 1 ? "L" : null, target: i === 1 ? 3 : null,
  targetDirection: "at_least", frequencyType: "daily", frequencyDays: null, frequencyCount: null,
  icon: "✅", colour: null, notes: null, archivedAt: null,
  createdAt: `${ago(120)}T06:00:00.000Z`, updatedAt: `${ago(120)}T06:00:00.000Z`,
}));
const htEntries = [];
for (const h of htHabits) for (let i = 0; i < 60; i++) htEntries.push({ id: `e${h.id}-${i}`, habitId: h.id, date: ago(i), value: i % 4 ? 1 : 0, note: null, createdAt: "", updatedAt: "" });
const nutrition = {};
for (let i = 0; i < 40; i++) nutrition[ago(i)] = [
  { id: `n${i}a`, name: "Chicken breast", slot: "pre_shift", grams: 200, proc: 1, n: { kcal: 330, p: 60, c: 0, f: 10 } },
  { id: `n${i}b`, name: "Water", slot: "mid_shift", grams: 500, proc: 1, bev: true, n: {} },
];
const sleep = {}; for (let i = 0; i < 60; i++) sleep[ago(i)] = 6 + (i % 4);
const trades = Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, date: ago(i), status: "CLOSED", outcome: i % 3 ? "WIN" : "LOSS", pnl: i % 3 ? 1200 : -600, checklistTotal: 5, checklistScore: 5, accountId: "a1" }));

const seed = {
  onboarding: JSON.stringify({ overviewSeen: true, done: true }),
  whatsnew_seen: JSON.stringify("3.1"),
  dash_show_more: JSON.stringify(true),
  dash_show_money: JSON.stringify(true),
  ht_habits: JSON.stringify(htHabits),
  ht_entries: JSON.stringify(htEntries),
  nutrition_log: JSON.stringify(nutrition),
  nutrition_profile: JSON.stringify({ age: 27, sex: "male", heightCm: 178, weightKg: 78, activity: 1.55, goal: "muscle" }),
  trade_sleep: JSON.stringify(sleep),
  ti_trades: JSON.stringify(trades),
  ti_accounts: JSON.stringify([{ id: "a1", name: "Main", startingBalance: 10000 }]),
  ti_settings: JSON.stringify({ activeAccountId: "a1" }),
  finance_state: JSON.stringify({ accounts: [{ id: "f1", name: "Main", balance: 250000, kind: "cash" }], income: [{ id: "i1", date: ago(2), amount: 40000, source: "Salary" }], bills: [{ id: "b1", name: "Rent", amount: 30000 }] }),
  journal_entries: JSON.stringify(Array.from({ length: 20 }, (_, i) => ({ id: `j${i}`, date: ago(i), title: "Day", text: "Some reflection.", mood: 3, tags: [] }))),
  purity_log: JSON.stringify(Object.fromEntries(Array.from({ length: 40 }, (_, i) => [ago(i), { s: i % 7 ? "pure" : "relapse", triggers: [] }]))),
  goals: JSON.stringify([{ id: "g1", name: "Ship it", target: 10, current: 4, unit: "steps", createdAt: ago(30) }]),
  athlete_measurements: JSON.stringify(Array.from({ length: 8 }, (_, i) => ({ id: `m${i}`, date: ago(i * 7), weightKg: 78 - i * 0.2 }))),
  gym_sessions: JSON.stringify(Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, date: ago(i * 2), bodyweightKg: 78, sets: [{ exerciseId: "back-squat", reps: 5, weightKg: 100, bodyweightKg: 78, timestamp: Date.now() }] }))),
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

const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
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

console.log("");
if (seen.length) {
  console.log("ALL MESSAGES:");
  const uniq = [...new Map(seen.map((s) => [s.text.slice(0, 160), s])).values()];
  for (const s of uniq.slice(0, 20)) console.log(`  [${s.kind}] ${s.text.slice(0, 220)}`);
  console.log("");
}
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Console clean: ${pass}/${pass + fail} routes`);
await b.close(); server.close();
process.exit(fail ? 1 : 0);
