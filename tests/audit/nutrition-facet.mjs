// §13 / §2: Nutrition is its own facet, ordered after Today, with one
// question per tab rather than a wall of cards — and the links that used to
// point into Body still land somewhere sensible.
import { harness, tally, TODAY } from "../fixtures/harness.mjs";

const seed = {
  onboarding: { overviewSeen: true, done: true },
  whatsnew_seen: "3.1",
  nutrition_profile: { age: 27, sex: "male", heightCm: 178, weightKg: 78, activity: 1.55, goal: "muscle" },
  nutrition_log: {
    [TODAY]: [
      { id: "n1", name: "Chicken breast", slot: "pre_shift", grams: 200, proc: 1, n: { kcal: 330, p: 60, c: 0, f: 10, fib: 0, k: 500, mg: 60, fe: 1.2, ca: 20, zn: 2, vc: 0 } },
      { id: "n2", name: "Avocado", slot: "mid_shift", grams: 100, proc: 1, n: { kcal: 160, p: 2, c: 9, f: 15, fib: 6.7, k: 485, mg: 29, fe: 0.6, ca: 12, zn: 0.6, vc: 10 } },
    ],
  },
};

const t = tally("Nutrition facet");
const h = await harness({ seed });
const { page, ok } = { page: h.page, ok: t.ok };

console.log("\n1. It is a facet, and it is in the right place");
const nav = await page.locator('[data-tour^="nav-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-tour")));
const order = nav.map((n) => n.replace("nav-", ""));
ok(`Nutrition is a top-level facet (${order.join(" → ")})`, order.includes("nutrition"));
ok("it comes directly after Home", order.indexOf("nutrition") === order.indexOf("dashboard") + 1);
ok("and before Body", order.indexOf("nutrition") < order.indexOf("gym"));

console.log("\n2. One question per tab");
const today = await h.go("nutrition", 1800);
ok("the four tabs are offered", /Today/.test(today) && /Plan/.test(today) && /Micros/.test(today) && /Trends/.test(today));
ok("the header says what is LEFT, not what was eaten", /kcal (left|over)/i.test(today));
ok("Today shows the day's food", /chicken breast/i.test(today));
ok("but not the meal-plan section", !/meal plans/i.test(today));
ok("and not the micronutrient table", !/of the reference daily intake|lowest today/i.test(today));

console.log("\n3. Micros are their own screen, worst first");
await page.getByRole("button", { name: /^Micros$/ }).first().click();
await page.waitForTimeout(900);
const micros = await h.text();
ok("micronutrients are listed", /fib(er|re)|potassium|magnesium/i.test(micros));
ok("with what was eaten against the reference intake", /\d+\s*(mg|g|µg|mcg)\s*\/\s*\d+/i.test(micros));
ok("the lowest are called out first", /lowest today/i.test(micros));
ok("the day's meals are not repeated here", !/chicken breast/i.test(micros));

console.log("\n4. Plan is its own screen too");
await page.getByRole("button", { name: /^Plan$/ }).first().click();
await page.waitForTimeout(900);
const plan = await h.text();
ok("the meal-plan surface is here", /meal plans/i.test(plan));
ok("and the day's logger is not", !/chicken breast/i.test(plan));
ok("nor the weekly and monthly reports", !/weekly report|monthly report/i.test(plan));

console.log("\n5. Body no longer carries Fuel");
const body = await h.go("gym", 1800);
ok("Body does not duplicate the nutrition screen", !/meal plans/i.test(body));
ok("nor the day's food log", !/chicken breast/i.test(body));

await h.close();
t.done(h.errors);
