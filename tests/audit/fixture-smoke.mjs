// Every scenario must boot the real app.
//
// contract.mjs proves a fixture is a shape the sanitizers accept. That is
// necessary and not sufficient: a seed can satisfy every sanitizer and still
// render a blank screen, because the sanitizers guard shape and the screens
// guard nothing. This boots each world against the built app and checks that
// something rendered, with a clean console.
//
// corrupt() is included on purpose. It is the one fixture the sanitizers
// reject, and the whole claim of the corruption harness is that the app
// survives it — so it has to be held to the same "did anything render" bar
// as the valid worlds, not exempted from it.
import { harness, tally } from "../fixtures/harness.mjs";
import { SCENARIOS, ADVERSARIAL } from "../fixtures/scenarios.mjs";

const t = tally("Fixture smoke");
const ok = t.ok;
const worlds = { ...SCENARIOS, ...ADVERSARIAL };

for (const [name, build] of Object.entries(worlds)) {
  console.log(`\n── ${name}() ──`);
  const h = await harness({ seed: build() });
  const body = await h.text();

  ok(`${name}: the app rendered`, body.length > 200);
  ok(`${name}: the nav is present`, (await h.page.locator('[data-tour^="nav-"]').count()) >= 6);
  ok(`${name}: no console errors${h.errors.length ? ` — ${h.errors[0].slice(0, 110)}` : ""}`, h.errors.length === 0);

  await h.close();
}

console.log("\n── the worlds are actually different ──");
// A scenario that seeds nothing distinguishable is a scenario nobody needs.
{
  // Checked on Nutrition, not Home — Home carries a calorie chip, not a food
  // list, so asserting a food name there would fail for the right reason and
  // teach the wrong lesson.
  const h1 = await harness({ seed: SCENARIOS.freshInstall() });
  const empty = await h1.go("nutrition", 1800);
  await h1.close();
  const h2 = await harness({ seed: SCENARIOS.oneDay() });
  const full = await h2.go("nutrition", 1800);
  await h2.close();
  ok("freshInstall() lists no food", !/oats/i.test(empty));
  ok("oneDay() lists the day's food", /oats/i.test(full));
  ok("and the two screens differ", empty !== full);
}

t.done();
