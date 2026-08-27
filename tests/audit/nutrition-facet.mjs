// §13 / §2: Nutrition is its own facet, ordered after Today, with one
// question per tab rather than a wall of cards — and the links that used to
// point into Body still land somewhere sensible.
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
const TODAY = iso(new Date());

const seed = {
  onboarding: JSON.stringify({ overviewSeen: true, done: true }),
  whatsnew_seen: JSON.stringify("3.1"),
  nutrition_profile: JSON.stringify({ age: 27, sex: "male", heightCm: 178, weightKg: 78, activity: 1.55, goal: "muscle" }),
  nutrition_log: JSON.stringify({
    [TODAY]: [
      { id: "n1", name: "Chicken breast", slot: "pre_shift", grams: 200, proc: 1, n: { kcal: 330, p: 60, c: 0, f: 10, fib: 0, k: 500, mg: 60, fe: 1.2, ca: 20, zn: 2, vc: 0 } },
      { id: "n2", name: "Avocado", slot: "mid_shift", grams: 100, proc: 1, n: { kcal: 160, p: 2, c: 9, f: 15, fib: 6.7, k: 485, mg: 29, fe: 0.6, ca: 12, zn: 0.6, vc: 10 } },
    ],
  }),
};

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const errs = [];
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await b.newPage({ viewport: { width: 1280, height: 1400 } });
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await page.addInitScript((s) => {
  if (localStorage.getItem("__seeded")) return;
  for (const [k, v] of Object.entries(s)) localStorage.setItem(`architect:${k}`, v);
  localStorage.setItem("__seeded", "1");
}, seed);
const dismiss = async () => { for (const n of ["Skip", "Skip the tour"]) { const x = page.getByRole("button", { name: n, exact: true }); try { if (await x.count()) { await x.first().click({ timeout: 1200 }); await page.waitForTimeout(150); } } catch { } } };

await page.goto(BASE, { waitUntil: "networkidle" });
await dismiss(); await page.waitForTimeout(1700); await dismiss(); await page.waitForTimeout(600);

console.log("\n1. It is a facet, and it is in the right place");
const nav = await page.locator('[data-tour^="nav-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-tour")));
const order = nav.map((n) => n.replace("nav-", ""));
ok(`Nutrition is a top-level facet (${order.join(" → ")})`, order.includes("nutrition"));
ok("it comes directly after Home", order.indexOf("nutrition") === order.indexOf("dashboard") + 1);
ok("and before Body", order.indexOf("nutrition") < order.indexOf("gym"));

console.log("\n2. One question per tab");
await page.locator('[data-tour="nav-nutrition"]').first().click();
await page.waitForTimeout(1800); await dismiss();
const today = (await page.locator("body").innerText()).replace(/\s+/g, " ");
ok("the four tabs are offered", /Today/.test(today) && /Plan/.test(today) && /Micros/.test(today) && /Trends/.test(today));
ok("the header says what is LEFT, not what was eaten", /kcal (left|over)/i.test(today));
ok("Today shows the day's food", /chicken breast/i.test(today));
ok("but not the meal-plan section", !/meal plans/i.test(today));
ok("and not the micronutrient table", !/of the reference daily intake|lowest today/i.test(today));

console.log("\n3. Micros are their own screen, worst first");
await page.getByRole("button", { name: /^Micros$/ }).first().click();
await page.waitForTimeout(900);
const micros = (await page.locator("body").innerText()).replace(/\s+/g, " ");
ok("micronutrients are listed", /fib(er|re)|potassium|magnesium/i.test(micros));
ok("with what was eaten against the reference intake", /\d+\s*(mg|g|µg|mcg)\s*\/\s*\d+/i.test(micros));
ok("the lowest are called out first", /lowest today/i.test(micros));
ok("the day's meals are not repeated here", !/chicken breast/i.test(micros));

console.log("\n4. Plan is its own screen too");
await page.getByRole("button", { name: /^Plan$/ }).first().click();
await page.waitForTimeout(900);
const plan = (await page.locator("body").innerText()).replace(/\s+/g, " ");
ok("the meal-plan surface is here", /meal plans/i.test(plan));
ok("and the day's logger is not", !/chicken breast/i.test(plan));
ok("nor the weekly and monthly reports", !/weekly report|monthly report/i.test(plan));

console.log("\n5. Body no longer carries Fuel");
await page.locator('[data-tour="nav-gym"]').first().click();
await page.waitForTimeout(1800); await dismiss();
const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
ok("Body does not duplicate the nutrition screen", !/meal plans/i.test(body));
ok("nor the day's food log", !/chicken breast/i.test(body));

console.log("");
console.log("ERRORS:", errs.slice(0, 3).join(" || ") || "none");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Nutrition facet: ${pass}/${pass + fail} passed`);
await b.close(); server.close();
process.exit(fail ? 1 : 0);
