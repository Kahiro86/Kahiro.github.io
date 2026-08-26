// The app on a phone. Every other browser audit runs at 1280-1400px wide,
// and this is a PWA people install on a Home Screen — so the width nothing
// had ever been checked at is the one it is actually used at.
//
// Horizontal overflow is the specific defect being hunted. It is invisible
// on desktop, obvious and miserable on a phone, and usually caused by one
// unwrapped row or a fixed pixel width somewhere in a flex chain. The page
// body must never scroll sideways; a wide table or chart may, inside its
// own container.
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
// iPhone 14 / Pixel-class portrait, the common install size.
const VW = 390;
const page = await b.newPage({ viewport: { width: VW, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

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

console.log(`\nWalking every facet at ${VW}px\n`);
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
  ok(`${route.padEnd(10)} no console errors${found.length ? ` — ${found.slice(0, 2).map((f) => f.text.slice(0, 90)).join(" | ")}` : ""}`, found.length === 0);

  // The page itself must not scroll sideways. Anything genuinely wide is
  // allowed to, inside its own overflow container — so measure the document,
  // then name the widest element when it fails, because "something is too
  // wide" is not a bug report.
  const over = await page.evaluate((vw) => {
    const doc = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    if (doc <= vw + 1) return null;
    let worst = null;
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      const right = r.right;
      if (right > vw + 1 && (!worst || right > worst.right)) {
        worst = { right: Math.round(right), tag: el.tagName.toLowerCase(),
          cls: (typeof el.className === "string" ? el.className : "").slice(0, 40),
          text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 45) };
      }
    }
    return { doc: Math.round(doc), worst };
  }, VW);
  ok(`${route.padEnd(10)} no sideways scroll${over ? ` — ${over.doc}px wide; worst: <${over.worst?.tag} class="${over.worst?.cls}"> reaching ${over.worst?.right}px "${over.worst?.text}"` : ""}`, over === null);

  // A control taller than the viewport or pushed off-screen cannot be tapped.
  const offscreen = await page.evaluate((vw) => {
    const bad = [];
    for (const el of document.querySelectorAll("button, [role=button], a, input, select, textarea")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.left < -1 || r.right > vw + 1) {
        bad.push(`<${el.tagName.toLowerCase()}> "${(el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 34)}"`);
      }
    }
    return bad.slice(0, 3);
  }, VW);
  ok(`${route.padEnd(10)} every control is on screen${offscreen.length ? ` — ${offscreen.join(", ")}` : ""}`, offscreen.length === 0);
}

console.log("");
if (seen.length) {
  console.log("ALL MESSAGES:");
  const uniq = [...new Map(seen.map((s) => [s.text.slice(0, 160), s])).values()];
  for (const s of uniq.slice(0, 20)) console.log(`  [${s.kind}] ${s.text.slice(0, 220)}`);
  console.log("");
}
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Mobile layout: ${pass}/${pass + fail} checks across ${ROUTES.length} routes at ${VW}px`);
await b.close(); server.close();
process.exit(fail ? 1 : 0);
