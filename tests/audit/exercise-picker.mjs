// The exercise picker, in the browser: the catalog's nine disciplines are
// browsable, not just typeable — you cannot search for eleven stretches by
// name when you don't know their names yet.
import { chromium } from "playwright";
import { CHROMIUM, dismisser, serve } from "../fixtures/harness.mjs";

const { base: BASE, close: closeServer } = await serve();

const seed = {
  onboarding: JSON.stringify({ overviewSeen: true, done: true }),
  whatsnew_seen: JSON.stringify("3.1"),
};

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const errs = [];
const b = await chromium.launch({ executablePath: CHROMIUM });
const page = await b.newPage({ viewport: { width: 1280, height: 1400 } });
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(`architect:${k}`, v); }, seed);
const dismiss = dismisser(page);

await page.goto(BASE, { waitUntil: "networkidle" });
await dismiss(); await page.waitForTimeout(1600); await dismiss(); await page.waitForTimeout(700);

console.log("\n1. Opening the picker mid-session");
await page.locator('[data-tour="nav-gym"]').first().click();
await page.waitForTimeout(1800); await dismiss();
const start = page.getByRole("button", { name: /start|new session|begin/i }).first();
if (await start.count()) { await start.click(); await page.waitForTimeout(1200); }
const add = page.getByRole("button", { name: /add exercise/i }).first();
ok("the session offers Add exercise", (await add.count()) > 0);
await add.click();
await page.waitForTimeout(900);
// The search box is a placeholder, not page text — assert the field itself.
ok("the picker opens", (await page.getByPlaceholder("Search exercises…").count()) > 0);

console.log("\n2. Every discipline is a chip");
for (const label of ["All", "Strength", "Calisthenics", "Plyometrics", "HIIT", "LIIT", "Hybrid athleticism", "Mobility", "Stretching", "Recovery"]) {
  ok(`"${label}" is offered`, (await page.getByRole("button", { name: label, exact: true }).count()) > 0);
}

console.log("\n3. A chip narrows the list to that discipline");
await page.getByRole("button", { name: "Stretching", exact: true }).click();
await page.waitForTimeout(600);
const stretching = (await page.locator("body").innerText()).replace(/\s+/g, " ");
ok("stretches are listed", /Couch Stretch/i.test(stretching) && /Child's Pose/i.test(stretching));
ok("lifts are not", !/Barbell Bench Press/i.test(stretching));

await page.getByRole("button", { name: "Plyometrics", exact: true }).click();
await page.waitForTimeout(600);
const plyo = (await page.locator("body").innerText()).replace(/\s+/g, " ");
ok("jumps are listed", /Box Jump/i.test(plyo));
ok("stretches are gone", !/Couch Stretch/i.test(plyo));

console.log("\n4. Each row says what kind of movement it is");
ok("the discipline is on the row", /Box Jump Plyometrics/i.test(plyo));

console.log("\n5. Chip and query compose");
await page.getByRole("button", { name: "Mobility", exact: true }).click();
await page.waitForTimeout(400);
await page.getByPlaceholder("Search exercises…").fill("hip");
await page.waitForTimeout(600);
const composed = (await page.locator("body").innerText()).replace(/\s+/g, " ");
ok("the query narrows within the chip", /Hip Circle/i.test(composed));
ok("and the chip still excludes other disciplines", !/Barbell Hip Thrust/i.test(composed));

console.log("\n6. All returns everything");
await page.getByPlaceholder("Search exercises…").fill("");
await page.getByRole("button", { name: "All", exact: true }).click();
await page.waitForTimeout(600);
const all = (await page.locator("body").innerText()).replace(/\s+/g, " ");
ok("lifts are back", /Barbell Bench Press/i.test(all));

console.log("");
console.log("ERRORS:", errs.slice(0, 3).join(" || ") || "none");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Exercise picker: ${pass}/${pass + fail} passed`);
await b.close(); closeServer();
process.exit(fail ? 1 : 0);
