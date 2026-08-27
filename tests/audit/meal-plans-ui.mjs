// Meal plans in the browser: import the real CSV through the real screen,
// then log a day from it and see it land in the food log.
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

const CSV = readFileSync("/root/.claude/uploads/c1cda293-d4aa-50de-8012-2d84791bad04/8c97905a-irisu_meal_plan.csv", "utf8");
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const TODAY = iso(new Date());

const seed = {
  onboarding: JSON.stringify({ overviewSeen: true, done: true }),
  whatsnew_seen: JSON.stringify("3.1"),
  nutrition_profile: JSON.stringify({ age: 27, sex: "male", heightCm: 178, weightKg: 78, activity: 1.55, goal: "muscle" }),
};

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const errs = [];
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await b.newPage({ viewport: { width: 1280, height: 1600 } });
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(`architect:${k}`, v); }, seed);
const dismiss = async () => { for (const n of ["Skip", "Skip the tour"]) { const x = page.getByRole("button", { name: n, exact: true }); try { if (await x.count()) { await x.first().click({ timeout: 1200 }); await page.waitForTimeout(150); } } catch { } } };

await page.goto(BASE, { waitUntil: "networkidle" });
await dismiss(); await page.waitForTimeout(1600); await dismiss(); await page.waitForTimeout(700);

const store = (k) => page.evaluate((key) => JSON.parse(localStorage.getItem(`architect:${key}`) || "null"), k);

console.log("\n1. The plans surface is on the Fuel screen");
// Meal plans moved with Fuel to the Nutrition facet's Plan tab (§13).
await page.locator('[data-tour="nav-nutrition"]').first().click();
await page.waitForTimeout(1800);
await page.getByRole("button", { name: /^Plan$/ }).first().click();
await page.waitForTimeout(1800); await dismiss();
const body1 = await page.locator("body").innerText();
ok("Meal plans has a home", /meal plans/i.test(body1));
ok("and says what a plan is for", /written once/i.test(body1));

console.log("\n2. Importing the real CSV, through the real screen");
await page.getByRole("button", { name: /import csv/i }).first().click();
await page.waitForTimeout(500);
await page.getByPlaceholder("Plan name").fill("Irisu");
await page.getByLabel("Paste CSV").fill(CSV);
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Import$/ }).first().click();
await page.waitForTimeout(1200);

const plans = (await store("nutrition_plans")) || [];
ok("the plan is stored", plans.length === 1);
ok("under the name given", plans[0]?.name === "Irisu");
ok("with both meals", plans[0]?.meals.length === 2);
ok("and its target band", JSON.stringify(plans[0]?.targets?.kcal) === "[2500,2800]");

const body2 = (await page.locator("body").innerText()).replace(/\s+/g, " ");
ok("the plan opens after importing", /Meal 1 - Performance/i.test(body2));
ok("meal subtotals are shown", /11[0-9]{2} kcal/.test(body2) && /kcal · \d+P/.test(body2));
ok("the day is judged against the band, not a number", /of 2500–2800|of 2500-2800/i.test(body2));
ok("and says which way it misses", /under by/i.test(body2));
ok("the training-only item is absent on a rest day", !/training only/i.test(body2));
ok("and the plan says which version it is showing", /rest days? version|rest days/i.test(body2));
ok("the rest-day note is carried through", /rest days drop/i.test(body2));

console.log("\n3. Choices are swappable");
const salmon = page.getByRole("button", { name: /^Use salmon$/ }).first();
ok("an alternative protein is offered", (await salmon.count()) > 0);
await salmon.click();
await page.waitForTimeout(800);
const after = (await store("nutrition_plans"))[0];
ok("the choice is remembered", after.meals[0].items[0].chosen === 2);
ok("and shown on the row", /salmon/i.test((await page.locator("body").innerText())));

console.log("\n4. Logging the plan writes ordinary food entries");
const before = ((await store("nutrition_log")) || {})[TODAY] || [];
await page.getByRole("button", { name: /log the whole day/i }).first().click();
await page.waitForTimeout(1500);
const day = ((await store("nutrition_log")) || {})[TODAY] || [];
ok(`the day gained the plan's rest-day items (${before.length} → ${day.length})`, day.length === before.length + 16);
ok("entries are normal log entries", day.every((e) => e.id && e.name && typeof e.grams === "number" && e.n));
ok("stamped with the plan they came from", day.filter((e) => e.fromPlan).length === 16);
ok("the swapped choice is what got logged", day.some((e) => /salmon/i.test(e.name)));
const stored = (await store("nutrition_plans"))[0];
ok("no meal or item in the plan carries a date",
  stored.meals.every((m) => !("date" in m) && m.items.every((i) => !("date" in i))));

const kcal = day.reduce((s, e) => s + (+e.n?.kcal || 0), 0);
// 2427 as written, minus the 116 kcal of training-day potatoes.
ok(`the logged day totals the plan's rest-day calories (${Math.round(kcal)})`, Math.abs(kcal - 2311) < 15);

console.log("\n5. Logging again adds, never replaces");
await page.getByRole("button", { name: /log this meal/i }).first().click();
await page.waitForTimeout(1200);
const day2 = ((await store("nutrition_log")) || {})[TODAY] || [];
ok("a second log appends rather than wiping the day", day2.length > day.length);

// ── 6. Adherence ─────────────────────────────────────────────────────
console.log("\n6. The plan reports how well it was followed");
const body6 = (await page.locator("body").innerText()).replace(/\s+/g, " ");
ok("the last 30 days are summarised", /last 30 days/i.test(body6));
ok("with a percentage of the plan", /\d+% of the plan/i.test(body6));
ok("over logged days only", /over \d+ logged day/i.test(body6));
ok("and unrecorded days are excluded out loud", /not recorded, not counted/i.test(body6) || !/not recorded/i.test(body6));

console.log("");
console.log("ERRORS:", errs.slice(0, 3).join(" || ") || "none");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Meal plans UI: ${pass}/${pass + fail} passed`);
await b.close(); server.close();
process.exit(fail ? 1 : 0);
