// Criterion 29 — the XP & effort ledger renders, and each habit's difficulty
// weight and driving completion rate are inspectable by the user.
import { chromium } from "playwright";
import { CHROMIUM, ago, dismisser, serve } from "../fixtures/harness.mjs";

const { base: BASE, close: closeServer } = await serve();

// One habit mastered, one fought — so the two ends of the scale must render.
const H = (id, name, age) => ({ id, name, subtype: "standard", type: "boolean", frequencyType: "daily",
  frequencyDays: null, frequencyCount: null, target: null, targetDirection: "at_least", unit: null,
  routineId: null, archivedAt: null, createdAt: `${ago(age)}T12:00:00.000Z`, updatedAt: `${ago(age)}T12:00:00.000Z`, sortOrder: 0 });
const habits = [H("Deep work 90m", "Deep work 90m", 70), H("Cold shower", "Cold shower", 70)];
const entries = [];
for (let i = 0; i < 60; i++) {
  entries.push({ id: `a${i}`, habitId: "Deep work 90m", date: ago(i), value: 1, note: null, createdAt: "", updatedAt: "" });
  if (i % 3 === 0) entries.push({ id: `b${i}`, habitId: "Cold shower", date: ago(i), value: 1, note: null, createdAt: "", updatedAt: "" });
}

const errs = [];
const b = await chromium.launch({ executablePath: CHROMIUM });
const page = await b.newPage({ viewport: { width: 1280, height: 1100 } });
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await page.addInitScript((seed) => { for (const [k, v] of Object.entries(seed)) localStorage.setItem(`architect:${k}`, v); },
  { ht_habits: JSON.stringify(habits), ht_entries: JSON.stringify(entries) });
await page.goto(BASE, { waitUntil: "networkidle" });
const dismiss = dismisser(page);
await dismiss();

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

await page.locator('[data-tour="nav-analytics"]').first().click();
await page.waitForTimeout(900); await dismiss();
await page.getByRole("button", { name: /^Effort$/ }).first().click();
await page.locator("text=Effort weighting").first().waitFor({ timeout: 15000 }).catch(() => {});
await page.waitForTimeout(400);
const txt = await page.locator("body").innerText();

console.log("\n── 29: the ledger renders and explains itself ──");
ok("an Effort tab exists in Analytics", /Effort weighting/i.test(txt));
ok("both habits appear", /Deep work 90m/.test(txt) && /Cold shower/.test(txt));
ok("each habit shows its weight", /×0\.6/.test(txt) && /×1\.[48]/.test(txt));
ok("the mastered habit is named as such", /Mastered/i.test(txt));
ok("the hard one is named too", /Hard|Frontier/i.test(txt));
ok("the driving completion rate is shown as a percentage", /100%/.test(txt) && /3[0-9]%/.test(txt));
ok("the counts behind the rate are shown", /landed \d+ of \d+ scheduled/.test(txt));
ok("the measuring window is stated", /last 60 days/i.test(txt));
ok("the whole band scale is shown, not just this habit's", /<50%/.test(txt) && /90%\+/.test(txt));

console.log("\n── the banked ledger is inspectable ──");
ok("the ledger section renders", /The ledger/i.test(txt));
ok("it states that sealed days cannot be taken back", /cannot take back what it already paid/i.test(txt));
const dayRow = page.locator("button").filter({ hasText: /^\d{2}-\d{2}/ }).first();
ok("earning days are listed", await dayRow.count() > 0);
if (await dayRow.count()) {
  await dayRow.click(); await page.waitForTimeout(300);
  const open = await page.locator("body").innerText();
  ok("opening a day shows the individual lines that paid", open.length > txt.length);
  ok("each line shows its base and multipliers", /\d+ ×[\d.]+/.test(open));
}

console.log("");
console.log("ERRORS:", errs.slice(0, 3).join(" || ") || "none");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Effort ledger: ${pass}/${pass + fail} passed`);
await b.close(); closeServer();
process.exit(fail || errs.length ? 1 : 0);
