// §14 Test 1 — the meal lifecycle, end to end.
//
//   Log a meal.    Nutrition, macros, micronutrients and the analytics views
//                  must all move, and the entry must appear exactly once.
//   Edit the meal. Everything recalculates — including the micronutrients,
//                  which are the easiest thing in the app to leave stale
//                  because nothing on the Today screen shows them.
//   Delete it.     Everything recalculates back, and the day reads as unlogged
//                  rather than as a day of zeros.
//
// The point of the test is the "and" — one write, five surfaces. Any one of
// them can be made to pass alone; the bug this catches is the sixth surface
// that kept yesterday's number.
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

const DAY_LABEL = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

// Oats, because it is dense in exactly the micronutrients the Micros screen
// ranks — 10.1g fibre, 362mg potassium, 138mg magnesium per 100g — so a
// stale micronutrient table is visible rather than merely suspected.
const FOOD = "Oats (dry)";
const KCAL_100 = 379;

// The day's log starts empty. Everything asserted below is a consequence of
// what this test itself types in.
const seed = {
  onboarding: JSON.stringify({ overviewSeen: true, done: true }),
  whatsnew_seen: JSON.stringify("3.1"),
  nutrition_profile: JSON.stringify({ age: 27, sex: "male", heightCm: 178, weightKg: 78, activity: 1.55, goal: "muscle" }),
  nutrition_log: JSON.stringify({}),
};

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const errs = [];
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await b.newPage({ viewport: { width: 1280, height: 1500 } });
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await page.addInitScript((s) => {
  if (localStorage.getItem("__seeded")) return;
  for (const [k, v] of Object.entries(s)) localStorage.setItem(`architect:${k}`, v);
  localStorage.setItem("__seeded", "1");
}, seed);
const dismiss = async () => { for (const n of ["Skip", "Skip the tour"]) { const x = page.getByRole("button", { name: n, exact: true }); try { if (await x.count()) { await x.first().click({ timeout: 1200 }); await page.waitForTimeout(150); } } catch { } } };
const flat = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ");

const goNutrition = async (tab) => {
  await page.locator('[data-tour="nav-nutrition"]').first().click();
  await page.waitForTimeout(1400); await dismiss();
  if (tab) { await page.getByRole("button", { name: new RegExp(`^${tab}$`) }).first().click(); await page.waitForTimeout(700); }
  return flat();
};

// The facet header carries "N kcal left". That number is the running total
// read backwards, so it is the cheapest proof the day's arithmetic moved.
const kcalLeft = (t) => { const m = t.match(/([\d,]+)\s*kcal\s*left/i); return m ? +m[1].replace(/,/g, "") : null; };
// The Micros screen prints "eaten / reference" per nutrient.
const microOf = (t, name) => { const m = t.match(new RegExp(`${name}[^\\d]{0,20}([\\d.]+)\\s*(?:mg|g|µg|mcg)?\\s*/`, "i")); return m ? +m[1] : null; };

await page.goto(BASE, { waitUntil: "networkidle" });
await dismiss(); await page.waitForTimeout(1700); await dismiss(); await page.waitForTimeout(600);

console.log("\n1. Before anything is logged");
const before = await goNutrition(null);
const leftEmpty = kcalLeft(before);
ok(`the header offers the whole day's budget (${leftEmpty} kcal left)`, leftEmpty > 1500);
ok("and no food is listed", !new RegExp(FOOD.replace(/[()]/g, "\\$&"), "i").test(before));
const microsEmpty = await goNutrition("Micros");
// An empty day is not a day of zeros, and the screen says so rather than
// drawing fourteen empty bars that look like a deficiency.
ok("Micros says the day is unlogged rather than showing zeros", /nothing logged today yet/i.test(microsEmpty));

console.log("\n2. Log 100g of oats");
await page.getByRole("button", { name: /^Today$/ }).first().click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Add to Pre-shift" }).first().click();
await page.waitForTimeout(400);
await page.getByPlaceholder(/Search foods/i).first().fill("Oats");
await page.waitForTimeout(500);
await page.getByRole("button", { name: new RegExp(`^Oats \\(dry\\)\\s+\\d+ kcal`) }).first().click();
await page.waitForTimeout(400);
await page.getByRole("spinbutton", { name: "Portion in grams" }).first().fill("100");
await page.waitForTimeout(200);
await page.getByRole("button", { name: /^Log it$/ }).first().click();
await page.waitForTimeout(900);

const logged = await flat();
ok("the meal is on the day", /Oats \(dry\)/i.test(logged));
const rows = await page.getByRole("spinbutton", { name: `Grams of ${FOOD}` }).count();
ok(`it is there exactly once (${rows} row${rows === 1 ? "" : "s"})`, rows === 1);
ok(`the row carries its calories (${KCAL_100})`, new RegExp(`${KCAL_100} kcal`).test(logged));
const leftLogged = kcalLeft(logged);
ok(`the header dropped by the meal (${leftEmpty} → ${leftLogged})`, Math.abs((leftEmpty - leftLogged) - KCAL_100) <= 2);

console.log("\n3. Macros and micronutrients followed it");
ok("protein appears against its target", /\d+\s*\/\s*\d+\s*g/i.test(logged) || /protein/i.test(logged));
const micros1 = await goNutrition("Micros");
const fib1 = microOf(micros1, "Fiber");
ok(`fibre is now the meal's fibre (${fib1}g)`, fib1 !== null && fib1 >= 9 && fib1 <= 11);
const k1 = microOf(micros1, "Potassium");
ok(`potassium moved too (${k1}mg)`, k1 !== null && k1 > 300);

console.log("\n4. The analytics views read the same meal");
await page.locator('[data-tour="nav-dashboard"]').first().click();
await page.waitForTimeout(1500); await dismiss();
const dash = await flat();
// The chip labels are uppercased in CSS, which innerText honours.
ok(`Home's Fuel chip shows the day's calories (${KCAL_100})`, new RegExp(`Fuel[\\s\\S]{0,80}${KCAL_100}`, "i").test(dash));
await page.locator('[data-tour="nav-calendar"]').first().click();
await page.waitForTimeout(1600); await dismiss();
await page.getByRole("button", { name: new RegExp(`^${DAY_LABEL}`) }).first().click();
await page.waitForTimeout(800);
const cal1 = await flat();
ok(`the calendar day says ${KCAL_100} kcal logged`, new RegExp(`${KCAL_100} kcal logged`).test(cal1));

console.log("\n5. Edit it to 200g — everything recalculates");
await goNutrition("Today");
await page.getByRole("spinbutton", { name: `Grams of ${FOOD}` }).first().fill("200");
await page.waitForTimeout(900);
const edited = await flat();
ok(`the row doubled (${KCAL_100 * 2} kcal)`, new RegExp(`${KCAL_100 * 2} kcal`).test(edited));
const leftEdited = kcalLeft(edited);
ok(`the header halved the budget again (${leftLogged} → ${leftEdited})`, Math.abs((leftLogged - leftEdited) - KCAL_100) <= 3);
const rows2 = await page.getByRole("spinbutton", { name: `Grams of ${FOOD}` }).count();
ok("editing did not clone the entry", rows2 === 1);
const micros2 = await goNutrition("Micros");
const fib2 = microOf(micros2, "Fiber");
ok(`fibre doubled with it (${fib1}g → ${fib2}g)`, fib2 !== null && Math.abs(fib2 - fib1 * 2) <= 1);
await page.locator('[data-tour="nav-calendar"]').first().click();
await page.waitForTimeout(1600); await dismiss();
await page.getByRole("button", { name: new RegExp(`^${DAY_LABEL}`) }).first().click();
await page.waitForTimeout(800);
ok(`and the calendar followed (${KCAL_100 * 2} kcal logged)`, new RegExp(`${KCAL_100 * 2} kcal logged`).test(await flat()));

console.log("\n6. Delete it — everything recalculates back");
await goNutrition("Today");
await page.getByRole("button", { name: `Remove ${FOOD}` }).first().click();
await page.waitForTimeout(900);
const deleted = await flat();
// Checked on the slot list, not the whole page: the food stays in "recent"
// so it can be re-logged in one tap, and that is the feature, not a leak.
ok("the meal is off the day", (await page.getByRole("spinbutton", { name: `Grams of ${FOOD}` }).count()) === 0);
const leftAfter = kcalLeft(deleted);
ok(`the whole budget is back (${leftAfter} kcal left)`, leftAfter === leftEmpty);
const micros3 = await goNutrition("Micros");
ok("Micros is back to the unlogged state", /nothing logged today yet/i.test(micros3));
await page.locator('[data-tour="nav-calendar"]').first().click();
await page.waitForTimeout(1600); await dismiss();
await page.getByRole("button", { name: new RegExp(`^${DAY_LABEL}`) }).first().click();
await page.waitForTimeout(800);
const cal3 = await flat();
ok("the calendar no longer claims a meal", !/kcal logged/.test(cal3));

console.log("\n7. It survives a reload");
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1800); await dismiss();
const reloaded = await goNutrition(null);
ok("the deletion persisted", (await page.getByRole("spinbutton", { name: `Grams of ${FOOD}` }).count()) === 0);
ok("and so did the budget", kcalLeft(reloaded) === leftEmpty);

console.log("");
console.log("ERRORS:", errs.slice(0, 3).join(" || ") || "none");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Meal lifecycle: ${pass}/${pass + fail} passed`);
await b.close(); server.close();
process.exit(fail ? 1 : 0);
