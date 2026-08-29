// The Command Centre, trimmed. Everything below was removed at the user's
// request; net worth in particular now lives only inside Finance.
import { chromium } from "playwright";
import { serve, CHROMIUM, iso } from "../fixtures/harness.mjs";

const { base: BASE, close: closeServer } = await serve();

// Real finance and trading data, so a card that still renders them shows up.
const seed = {
  onboarding: JSON.stringify({ overviewSeen: true, done: true }),
  whatsnew_seen: JSON.stringify("3.1"),
  dash_show_more: JSON.stringify(true),          // expand it — nothing may hide
  finance_state: JSON.stringify({ accounts: [{ id: "a1", name: "Main", balance: 250000, kind: "cash" }],
    income: [{ id: "i1", date: iso(new Date()), amount: 40000, source: "Salary" }], bills: [{ id: "b1", name: "Rent", amount: 30000 }] }),
  ict_trades: JSON.stringify([{ id: "t1", date: iso(new Date()), status: "CLOSED", outcome: "WIN", checklistTotal: 5, checklistScore: 5 }]),
  // No checklist seed: the store was never called `checklist_items` (the real
  // key was `daily_checklist`), so this line was inert even before the
  // checklist was retired. The assertion below stays — it guards against the
  // block coming back — but it no longer pretends to be seeded against.
  monthly_overhead: JSON.stringify({ targetKsh: 40000 }),  // OverheadToday self-hides without a ceiling
  weekly_focus: JSON.stringify({ text: "Ship the merge", week: iso(new Date()) }),
};

const errs = [];
const b = await chromium.launch({ executablePath: CHROMIUM });
const page = await b.newPage({ viewport: { width: 1280, height: 1400 } });
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(`architect:${k}`, v); }, seed);
await page.goto(BASE, { waitUntil: "networkidle" });
const dismiss = async () => { for (const n of ["Skip", "Skip the tour"]) { const x = page.getByRole("button", { name: n, exact: true }); try { if (await x.count()) { await x.first().click({ timeout: 1200 }); await page.waitForTimeout(150); } } catch { } } };
await dismiss(); await page.waitForTimeout(1500); await dismiss(); await page.waitForTimeout(500);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const home = await page.locator("body").innerText();

console.log("\n── removed from the Command Centre ──");
for (const [label, re] of [
  ["Progression card", /\bPROGRESSION\b/i],
  ["Level / XP bar", /\d+\s*\/\s*[\d,]+\s*XP/i],
  ["Current Streaks", /current streaks/i],
  ["Trading · Killzone card", /trades? logged today/i],
  ["Monthly Overhead bar", /monthly overhead\b/i],
  ["Today's Checklist", /today'?s checklist/i],
  ["This Week's Focus box", /one focus statement/i],
  ["Monthly Overhead Ceiling", /overhead ceiling/i],
  ["The Mission · Freedom", /the mission · freedom|years to freedom/i],
]) ok(`${label} is gone`, !re.test(home));

console.log("\n── money is folded away, not deleted ──");
// The fold's own label names what is inside it; that is not the figure.
const homeSansFold = home.replace(/money & markets[^\n]*/i, "");
ok("no net-worth figure on the home screen by default", !/net worth/i.test(homeSansFold));
ok("no KES amount on the home screen by default", !/KES\s?[\d,]/.test(home));
ok("the Money & markets fold is offered", /money & markets/i.test(home));
await page.getByRole("button", { name: /show money and markets/i }).first().click();
await page.waitForTimeout(700);
const money = await page.locator("body").innerText();
// Net worth is not in the fold either — it lives only inside The Firm.
ok("net worth is absent even inside the fold", !/net worth/i.test(money));
ok("opening the fold reveals the trading card", /trades? logged today/i.test(money));
ok("opening the fold reveals monthly overhead", /monthly overhead/i.test(money));
await page.getByRole("button", { name: /hide money and markets/i }).first().click();
await page.waitForTimeout(500);
await page.locator('[data-tour="nav-firm"]').first().click(); await page.waitForTimeout(1100); await dismiss();
await page.getByRole("button", { name: /^Wealth$/ }).first().click().catch(() => {});
await page.waitForTimeout(900);
const firm = await page.locator("body").innerText();
ok("the Firm still offers Net Worth", /net worth/i.test(firm));

console.log("\n── what the user kept is still there ──");
await page.locator('[data-tour="nav-dashboard"]').first().click(); await page.waitForTimeout(1100); await dismiss();
const back = await page.locator("body").innerText();
ok("the level card is gone from the Command Centre", !/\bPROGRESSION\b/i.test(back) && !/\d+\s*\/\s*[\d,]+\s*XP/i.test(back));
ok("the day score survives", /discipline|day score|%/i.test(back));
ok("the domain grid survives", /purity|fuel|training|habits/i.test(back));
ok("the More toggle survives", /more —|hide details/i.test(back));
// The user asked for this block up top: it was buried inside "More", where
// the only real numbers about the 365-day cycle were never seen.
ok("Year of Consistency is above the fold", /year of consistency/i.test(back));
ok("the two pillars are above the fold with it", /the man . batman/i.test(back) && /the machine . stark/i.test(back));
ok("and its numbers come with it", /current streak/i.test(back) && /consistency rate/i.test(back));

console.log("");
console.log("ERRORS:", errs.slice(0, 3).join(" || ") || "none");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Dashboard trim: ${pass}/${pass + fail} passed`);
await b.close(); closeServer();
process.exit(fail || errs.length ? 1 : 0);
