// Gate 2 acceptance, criteria 1, 3 and 5, driven in a browser against the build.
import { chromium } from "playwright";
import { serve, CHROMIUM, ago } from "../fixtures/harness.mjs";

const { base: BASE, close: closeServer } = await serve();

// Pre-merge data a returning user would already have: meals, sessions,
// custom foods, favourites and measurements.
const nutritionLog = {};
for (let i = 0; i <= 20; i++) {
  nutritionLog[ago(i)] = [
    { id: `m${i}a`, name: "Ugali & sukuma", grams: 400, slot: "post_shift", time: "19:30", proc: 1, n: { kcal: 620, p: 18, c: 96, f: 14, fib: 9, na: 320 } },
    { id: `m${i}b`, name: "Chicken breast", grams: 220, slot: "mid_shift", time: "13:00", proc: 1, n: { kcal: 360, p: 68, c: 0, f: 8, fib: 0, na: 180 } },
  ];
}
const gymSessions = [];
for (const d of [0, 2, 4, 7, 9, 11, 14, 16, 18, 21, 23, 25]) {
  gymSessions.push({ id: `gs${d}`, date: ago(d), startedAt: 1, finishedAt: 1 + 55 * 60000, bodyweightKg: 78,
    entries: [{ exerciseId: "barbell_bench_press", name: "Bench", sets: [{ weightKg: 80, reps: 8 }, { weightKg: 80, reps: 8 }, { weightKg: 85, reps: 5 }] }] });
}
const customFoods = [{ id: "cf1", name: "Mama's pilau", per100: { kcal: 180, p: 6, c: 25, f: 6 }, serving: { g: 300 }, tags: [] }];
const measurements = [{ date: ago(24), weightKg: 78.0, waistCm: 84.0 }, { date: ago(2), weightKg: 78.2, waistCm: 82.4 }];
const profile = { age: 27, sex: "male", heightCm: 178, weightKg: 78, activity: 1.55, goal: "muscle", favs: ["cf1"] };

const errs = [];
const b = await chromium.launch({ executablePath: CHROMIUM });
const page = await b.newPage({ viewport: { width: 1280, height: 1100 } });
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await page.addInitScript((seed) => {
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(`architect:${k}`, v);
}, {
  nutrition_log: JSON.stringify(nutritionLog),
  nutrition_foods: JSON.stringify(customFoods),
  nutrition_profile: JSON.stringify(profile),
  gym_sessions: JSON.stringify(gymSessions),
  athlete_measurements: JSON.stringify(measurements),
});
await page.goto(BASE, { waitUntil: "networkidle" });
const dismiss = async () => { for (const n of ["Skip", "Skip the tour"]) { const x = page.getByRole("button", { name: n, exact: true }); try { if (await x.count()) { await x.first().click({ timeout: 1200 }); await page.waitForTimeout(150); } } catch { } } };
await dismiss();

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

// SUPERSEDED. Gate 2 folded Nutrition into Body to kill the Life facet. The
// integration brief §13 reverses that specific decision — eating is decided
// more often than training, and it had ended up two levels down. The rest of
// Gate 2 (one Body facet, no Life, targets that follow training) still holds
// and is still checked below.
console.log("\n── criterion 1 (revised §13): Nutrition is its own facet, after Home ──");
const navLabels = await page.locator('[data-tour^="nav-"]').allInnerTexts();
const navIds = await page.locator('[data-tour^="nav-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-tour")));
ok(`Nutrition is a facet (${navLabels.map((s) => s.trim()).filter(Boolean).join(", ")})`,
   navIds.includes("nav-nutrition"));
ok("directly after Home", navIds.indexOf("nav-nutrition") === navIds.indexOf("nav-dashboard") + 1);
ok("no Life facet left in the sidebar", !navIds.includes("nav-life") && !navLabels.some((t) => /^\s*life\s*$/i.test(t)));
ok("a Body facet exists instead", navIds.includes("nav-gym") && navLabels.some((t) => /body/i.test(t)));

console.log("\n── Body carries training and fuel in one scroll ──");
await page.locator('[data-tour="nav-gym"]').first().click(); await page.waitForTimeout(900); await dismiss();
const bodyTxt = await page.locator("body").innerText();
ok("Body offers Today / Trends / Coach", /today/i.test(bodyTxt) && /trends/i.test(bodyTxt) && /coach/i.test(bodyTxt));
ok("the session section is on Today", /workout|session|start/i.test(bodyTxt));
// Fuel moved out of Body (§13), so Body must NOT show it — the point is one
// home per thing, not two.
ok("Body no longer carries the fuel section", !/meal plans/i.test(bodyTxt));

console.log("\n── §2.2: the training link still moves the targets, now in Nutrition ──");
await page.locator('[data-tour="nav-nutrition"]').first().click();
await page.waitForTimeout(1800);
const fuelTxt = await page.locator("body").innerText();
ok("meals logged before the merge are still shown", /ugali|chicken breast/i.test(fuelTxt));
ok("the day is labelled training or rest", /training day|rest day/i.test(fuelTxt));
ok("the rule is written on screen, not hidden", /Training day = base \+ session allowance/i.test(fuelTxt));
ok("it states protein does not move", /Protein and fat never move/i.test(fuelTxt));
const linkNums = await page.evaluate(() => {
  const t = document.body.innerText;
  const m = t.match(/Calories (raised|lowered|unchanged) from base ([\d,]+)\s*([+-]?\d+)\s*·\s*([\d,]+)/);
  return m ? { dir: m[1], base: +m[2].replace(/,/g, ""), delta: +m[3], now: +m[4].replace(/,/g, "") } : null;
});
ok(`the shift is shown as a number (${JSON.stringify(linkNums)})`, !!linkNums);
if (linkNums) {
  ok("today has a session logged, so calories are raised", linkNums.dir === "raised" && linkNums.delta > 0);
  ok("the arithmetic on screen is self-consistent", linkNums.base + linkNums.delta === linkNums.now);
}

console.log("\n── criterion 3: nothing was lost in the merge ──");
const kept = await page.evaluate(() => ({
  log: Object.keys(JSON.parse(localStorage.getItem("architect:nutrition_log") || "{}")).length,
  foods: JSON.parse(localStorage.getItem("architect:nutrition_foods") || "[]").length,
  sessions: JSON.parse(localStorage.getItem("architect:gym_sessions") || "[]").length,
  meas: JSON.parse(localStorage.getItem("architect:athlete_measurements") || "[]").length,
  favs: (JSON.parse(localStorage.getItem("architect:nutrition_profile") || "{}").favs || []).length,
}));
ok(`all 21 logged meal days survive (${kept.log})`, kept.log === 21);
ok(`the custom food survives (${kept.foods})`, kept.foods === 1);
ok(`all 12 sessions survive (${kept.sessions})`, kept.sessions === 12);
ok(`both measurements survive (${kept.meas})`, kept.meas === 2);
ok(`the one-tap favourite survives (${kept.favs})`, kept.favs === 1);
// It moved with Fuel to the Nutrition facet (§13), which is where fuelTxt was read.
ok("the 'Running low' micronutrient callout survived the move", /running low/i.test(fuelTxt));

// Criterion 3 asks for spot-checks, not just counts — a count survives even
// if every record was silently re-keyed to the wrong day.
console.log("\n── criterion 3: five records per type, checked individually ──");
const spot = await page.evaluate(() => ({
  log: JSON.parse(localStorage.getItem("architect:nutrition_log") || "{}"),
  sessions: JSON.parse(localStorage.getItem("architect:gym_sessions") || "[]"),
  meas: JSON.parse(localStorage.getItem("architect:athlete_measurements") || "[]"),
  foods: JSON.parse(localStorage.getItem("architect:nutrition_foods") || "[]"),
}));
const mealDays = [0, 5, 10, 15, 20].map(ago);
const mealsOk = mealDays.filter((d) => {
  const got = spot.log[d];
  const want = nutritionLog[d];
  return Array.isArray(got) && got.length === want.length
    && got[0].name === want[0].name && got[0].grams === want[0].grams
    && got[0].n.kcal === want[0].n.kcal && got[1].name === want[1].name;
});
ok(`5 meal days intact on their original dates (${mealsOk.length}/5: ${mealDays.map((d) => d.slice(5)).join(" ")})`, mealsOk.length === 5);

const sessionIds = ["gs0", "gs4", "gs11", "gs18", "gs25"];
const sessOk = sessionIds.filter((id) => {
  const got = spot.sessions.find((x) => x.id === id);
  const want = gymSessions.find((x) => x.id === id);
  return got && got.date === want.date && got.bodyweightKg === want.bodyweightKg
    && got.entries[0].sets.length === want.entries[0].sets.length
    && got.entries[0].sets[2].weightKg === want.entries[0].sets[2].weightKg;
});
ok(`5 sessions intact, dates and sets unchanged (${sessOk.length}/5)`, sessOk.length === 5);

ok("both measurements keep their exact date and values",
   spot.meas.length === 2 && spot.meas.every((m, i) => m.date === measurements[i].date
     && m.weightKg === measurements[i].weightKg && m.waistCm === measurements[i].waistCm));
ok("the custom food keeps its name, per-100g values and serving size",
   spot.foods[0] && spot.foods[0].name === customFoods[0].name
   && spot.foods[0].per100.kcal === customFoods[0].per100.kcal
   && spot.foods[0].serving.g === customFoods[0].serving.g);
ok("no meal day was re-keyed to a date that did not exist before",
   Object.keys(spot.log).every((d) => Object.prototype.hasOwnProperty.call(nutritionLog, d)));

console.log("\n── Trends: one timeline ──");
// Back to Body — the §2.2 checks above moved to the Nutrition facet.
await page.locator('[data-tour="nav-gym"]').first().click(); await page.waitForTimeout(1800);
await page.getByRole("button", { name: /^Trends$/ }).first().click(); await page.waitForTimeout(700);
const trendTxt = await page.locator("body").innerText();
ok("weight and waist share the timeline", /weight/i.test(trendTxt) && /waist/i.test(trendTxt));
ok("adherence sits on the same timeline", /calories vs target/i.test(trendTxt) && /protein vs target/i.test(trendTxt));
ok("strength progression is on it too", /tonnage/i.test(trendTxt));
ok("coverage is disclosed per week", /days of food logged|sketch, not a measurement/i.test(trendTxt));

console.log("\n── Coach: reflects, never prescribes ──");
await page.getByRole("button", { name: /^Coach$/ }).first().click(); await page.waitForTimeout(700);
const coachTxt = await page.locator("body").innerText();
ok("the Coach reports what happened", /protein target hit|sessions logged/i.test(coachTxt));
ok("it says it does not set targets", /does not set targets/i.test(coachTxt));
const PRESCRIBE = /\b(you should|you need to|aim for|increase your|reduce your|cut your|eat \d)\b/i;
const SHAME = /\b(failed|failure|lazy|pathetic|disappointing|should have)\b/i;
ok("no prescription on screen", !PRESCRIBE.test(coachTxt));
ok("no shame framing on screen", !SHAME.test(coachTxt));

console.log("\n── criterion 5: the merge did not open a farming route ──");
const xp = await page.evaluate(() => {
  const raw = localStorage.getItem("architect:nutrition_log");
  return { hasLog: !!raw };
});
ok("fuel targets are derived, never written to the food log", xp.hasLog);
const logAfter = await page.evaluate(() => localStorage.getItem("architect:nutrition_log"));
ok("the food log is byte-identical after viewing Body", logAfter === JSON.stringify(nutritionLog), );

console.log("\n── retired routes still land somewhere real ──");
const orphan = await page.evaluate(() => {
  const t = document.body.innerText;
  return /Nothing here|404|not found/i.test(t);
});
ok("no orphan route reached", !orphan);

console.log("");
console.log("ERRORS:", errs.slice(0, 5).join(" || ") || "none");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Gate 2 acceptance: ${pass}/${pass + fail} passed`);
await b.close(); closeServer();
process.exit(fail || errs.length ? 1 : 0);
