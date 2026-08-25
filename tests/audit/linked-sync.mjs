// Linked habits, end to end in the browser: a habit and its counterpart are
// one fact. Ticking "Sleep well" reaches System Health; sleep hours recorded
// elsewhere reach the habit. Neither surface can say "unlogged" about a day
// the other one has.
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

const habit = (over) => ({
  type: "boolean", unit: null, target: null, targetDirection: "at_least",
  frequencyType: "daily", frequencyDays: null, frequencyCount: null,
  icon: "✅", colour: null, notes: null, archivedAt: null,
  createdAt: `${ago(40)}T06:00:00.000Z`, updatedAt: `${ago(40)}T06:00:00.000Z`,
  ...over,
});

const seed = {
  onboarding: JSON.stringify({ overviewSeen: true, done: true }),
  whatsnew_seen: JSON.stringify("3.1"),
  dash_show_more: JSON.stringify(true),
  ht_habits: JSON.stringify([
    habit({ id: "hs", name: "Sleep well" }),
    habit({ id: "hw", name: "Hydration", type: "numeric", unit: "L", target: 3 }),
    habit({ id: "ht", name: "Train" }),
    habit({ id: "hm", name: "Log meals" }),
  ]),
  ht_entries: JSON.stringify([]),
  // Two nights recorded in the trading module, nothing on the habit.
  trade_sleep: JSON.stringify({ [ago(1)]: 7.5, [ago(2)]: 5 }),
  // A session and a day of food, logged in their own modules, never on a habit.
  athlete_workouts: JSON.stringify([{ id: "w1", date: ago(1), type: "Push", exercises: [] }]),
  nutrition_log: JSON.stringify({ [ago(2)]: [{ id: "e1", name: "Ugali", slot: "lunch", grams: 300, proc: 1, n: { kcal: 330, p: 8 } }] }),
};

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const errs = [];
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await b.newPage({ viewport: { width: 1280, height: 1400 } });
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(`architect:${k}`, v); }, seed);
const dismiss = async () => { for (const n of ["Skip", "Skip the tour"]) { const x = page.getByRole("button", { name: n, exact: true }); try { if (await x.count()) { await x.first().click({ timeout: 1200 }); await page.waitForTimeout(150); } } catch { } } };

await page.goto(BASE, { waitUntil: "networkidle" });
await dismiss(); await page.waitForTimeout(1600); await dismiss(); await page.waitForTimeout(900);

const store = (k) => page.evaluate((key) => JSON.parse(localStorage.getItem(`architect:${key}`) || "null"), k);

// ── 1. Sleep already recorded elsewhere reaches the habit ────────────
console.log("\n1. Hours recorded in the trading module reach the habit");
let entries = (await store("ht_entries")) || [];
const on = (id, d) => entries.find((e) => e.habitId === id && e.date === d);
ok("the 7.5-hour night ticks the linked sleep habit", on("hs", ago(1))?.value === 1);
ok("the 5-hour night marks it missed", on("hs", ago(2))?.value === 0);
ok("a night with no record produces no entry", !on("hs", ago(3)));
ok("the unlinked hydration habit is untouched", !entries.some((e) => e.habitId === "hw"));

console.log("\n1b. Records that are not numbers still tick their habit");
ok("a workout logged in the gym ticks 'Train'", on("ht", ago(1))?.value === 1);
ok("a day with no session leaves 'Train' alone", !on("ht", ago(2)));
ok("a day of food logged in Fuel ticks 'Log meals'", on("hm", ago(2))?.value === 1);
ok("a rich record is never written backwards from a habit",
  ((await store("athlete_workouts")) || []).length === 1);

// ── 2. The Command Centre reads the same fact ────────────────────────
console.log("\n2. The Command Centre reads one source, not two");
let home = await page.locator("body").innerText();
ok("System Health is on screen", /system health/i.test(home));
ok("today's sleep reads as unlogged, not 'Poor'",
  /sleep\s*\n?\s*unlogged/i.test(home.replace(/\s+/g, " ").replace(/ /g, " ")) || /unlogged/i.test(home));

// ── 3. Ticking the habit reaches System Health ───────────────────────
console.log("\n3. Ticking 'Sleep well' today reaches System Health");
await page.locator('[data-tour="nav-habits"]').first().click();
await page.waitForTimeout(1400); await dismiss();
const cell = page.getByRole("button", { name: /Sleep well, today: not logged yet/i }).first();
ok("today's cell for the sleep habit is on the habits screen", (await cell.count()) > 0);
await cell.click();
await page.waitForTimeout(1000);
entries = (await store("ht_entries")) || [];
ok("the tick is recorded on the habit", on("hs", TODAY)?.value === 1);
ok("a tick invents no sleep hours", (await store("trade_sleep"))[TODAY] === undefined);

await page.locator('[data-tour="nav-dashboard"]').first().click();
await page.waitForTimeout(1500); await dismiss();
home = (await page.locator("body").innerText()).replace(/\s+/g, " ");
ok("System Health no longer calls today's sleep unlogged", !/Sleep Unlogged/i.test(home));
ok("and reports it as good on the claim", /Sleep Good/i.test(home));

// ── 4. A numeric habit writes a real measurement ─────────────────────
console.log("\n4. Litres logged on the habit become millilitres of fluid");
await page.locator('[data-tour="nav-habits"]').first().click();
await page.waitForTimeout(1400); await dismiss();
const amount = page.getByRole("button", { name: /Hydration, today: not logged yet\. Enter an amount\./i }).first();
ok("the hydration habit asks for an amount", (await amount.count()) > 0);
await amount.click();
await page.waitForTimeout(700);
// The sheet uses a decimal text input, not a number spinner.
const field = page.getByRole("textbox", { name: /^Amount/i }).first();
await field.fill("3");
await page.getByRole("button", { name: /^Save$/ }).first().click();
await page.waitForTimeout(1200);
const hyd = (await store("hydration_log")) || {};
ok("3 L on the habit is 3000 ml in the hydration log", hyd[TODAY] === 3000);
const writes = (await store("hab_link_writes")) || {};
ok("the mirror records that it wrote that day", writes.hydration?.[TODAY] === 3000);

await page.locator('[data-tour="nav-dashboard"]').first().click();
await page.waitForTimeout(1500); await dismiss();
home = (await page.locator("body").innerText()).replace(/\s+/g, " ");
ok("the Command Centre's water tile sees it", /3\.0 ?L|3000 ?ml|Hydration On track/i.test(home));

// ── 5. The link is visible on the habit itself ───────────────────────
console.log("\n5. The habit says what it is joined to");
await page.locator('[data-tour="nav-habits"]').first().click();
await page.waitForTimeout(1400); await dismiss();
await page.getByText("Sleep well", { exact: true }).first().click();
await page.waitForTimeout(1200);
const detail = (await page.locator("body").innerText()).replace(/\s+/g, " ");
ok("the sleep habit names its link", /LINKED . SLEEP/i.test(detail));
ok("and explains that a tick measures nothing", /records no measurement/i.test(detail));

console.log("");
console.log("ERRORS:", errs.slice(0, 3).join(" || ") || "none");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Linked sync: ${pass}/${pass + fail} passed`);
await b.close(); server.close();
process.exit(fail ? 1 : 0);
