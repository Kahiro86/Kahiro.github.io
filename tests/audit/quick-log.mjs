// Phase 5 — the day's habits and meals log from anywhere, against the real
// habit store. QuickLog was built, then orphaned: 214 lines nothing imported,
// still reading the legacy store the tracker replaced.
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { extname, join, normalize } from "node:path";
const DIST = process.env.QA_DIST || fileURLToPath(new URL("../../dist", import.meta.url));
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const server = createServer((q, r) => { let p = decodeURIComponent((q.url || "/").split("?")[0]); if (p === "/") p = "/index.html"; const fp = normalize(join(DIST, p)); if (!fp.startsWith(DIST) || !existsSync(fp)) { r.statusCode = 404; return r.end("nf"); } r.setHeader("Content-Type", MIME[extname(fp)] || "application/octet-stream"); r.end(readFileSync(fp)); });
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/index.html`;
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const TODAY = iso(new Date());

const H = (id, name) => ({ id, name, subtype: "standard", type: "boolean", frequencyType: "daily",
  frequencyDays: null, frequencyCount: null, target: null, targetDirection: "at_least", unit: null,
  routineId: null, archivedAt: null, createdAt: `${ago(30)}T12:00:00.000Z`, updatedAt: `${ago(30)}T12:00:00.000Z`, sortOrder: 0 });
const seed = {
  ht_habits: JSON.stringify([H("h1", "Deep work 90m"), H("h2", "Read 20 pages")]),
  ht_entries: JSON.stringify([]),
  // A returning user: no onboarding overlay, no What's New. This test is about
  // the quick log, not about first-run chrome.
  onboarding: JSON.stringify({ overviewSeen: true, done: true }),
  whatsnew_seen: JSON.stringify("3.1"),
};

const errs = [];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await b.newPage({ viewport: { width: 1280, height: 1000 } });
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(`architect:${k}`, v); }, seed);
await page.goto(BASE, { waitUntil: "networkidle" });
const dismiss = async () => { for (const n of ["Skip", "Skip the tour"]) { const x = page.getByRole("button", { name: n, exact: true }); try { if (await x.count()) { await x.first().click({ timeout: 1200 }); await page.waitForTimeout(150); } } catch { } } };
await dismiss();
await page.waitForTimeout(1200);
await dismiss();   // onboarding and the tour can arrive after first paint
await page.waitForTimeout(600);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

console.log("\n── it exists, and it sees the real habits ──");
const fab = page.getByRole("button", { name: "Quick log", exact: true });
ok("the quick-log control is on screen", await fab.count() > 0);

await fab.first().click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(600);
const panel = page.locator('[data-quicklog="sheet"]');
ok("the sheet opened", await panel.count() > 0);
const sheet = await panel.innerText();
ok("it lists the tracker's habits, not the retired store", /Deep work 90m/.test(sheet) && /Read 20 pages/.test(sheet));

console.log("\n── a tap writes to the tracker ──");
const before = await page.evaluate(() => JSON.parse(localStorage.getItem("architect:ht_entries") || "[]").length);
// Scoped to the sheet — the same habit name also appears behind it.
await panel.getByText("Deep work 90m").first().click({ timeout: 6000 }).catch((e) => console.log("     click:", String(e).split("\n")[0]));
await page.waitForTimeout(900);
const after = await page.evaluate(() => JSON.parse(localStorage.getItem("architect:ht_entries") || "[]"));
console.log(`     ht_entries ${before} → ${after.length}`);
ok("the tap landed in ht_entries", after.length === before + 1);
ok("on the right habit and today's date", after.some((e) => e.habitId === "h1" && String(e.date).slice(0, 10) === TODAY));
ok("as a completion", after.some((e) => e.habitId === "h1" && Number(e.value) > 0));

console.log("\n── it is reachable from every facet, not just Home ──");
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
ok("Escape closes the sheet", await page.locator('[data-quicklog="sheet"]').count() === 0);
for (const nav of ["nav-gym", "nav-analytics"]) {
  await page.locator(`[data-tour="${nav}"]`).first().click(); await page.waitForTimeout(900); await dismiss();
  ok(`still mounted on ${nav.replace("nav-", "")}`, await page.getByRole("button", { name: "Quick log", exact: true }).count() > 0);
}

console.log("");
console.log("ERRORS:", errs.slice(0, 3).join(" || ") || "none");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Quick log: ${pass}/${pass + fail} passed`);
await b.close(); server.close();
process.exit(fail || errs.length ? 1 : 0);
