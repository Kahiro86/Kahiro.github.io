// Gate 2 §2.2 — the training/rest target linkage. This is the load-bearing
// part of the Body merge, so it is tested as arithmetic, not by eyeballing UI.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const entry = join(here, "_bt.js");
writeFileSync(entry, `export * from "${join(root, "src/modules/athlete/bodyTargets.js").replace(/\\/g, "/")}";
export { calcTargets } from "${join(root, "src/modules/athlete/nutrition.js").replace(/\\/g, "/")}";`);
const out = join(mkdtempSync(join(tmpdir(), "bt-")), "b.mjs");
const r = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
writeFileSync(out, r.outputFiles[0].text);
const B = await import(pathToFileURL(out).href);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };
const eq = (n, g, w) => ok(`${n} (got ${JSON.stringify(g)}, want ${JSON.stringify(w)})`, JSON.stringify(g) === JSON.stringify(w));

const TODAY = "2026-08-22";
const iso = (d) => d;
const back = (n) => { const x = new Date(`${TODAY}T12:00:00`); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
const profile = { age: 27, sex: "male", heightCm: 178, weightKg: 78, activity: 1.55, goal: "muscle" };
// A 60-minute session at 78 kg.
const sess = (date, mins = 60) => ({ id: `s${date}`, date, bodyweightKg: 78, startedAt: 0, finishedAt: mins * 60000, entries: [] });
// 4 sessions/week for 4 weeks, plus one today.
const history = [];
for (let w = 0; w < 4; w++) for (const off of [1, 2, 4, 6]) history.push(sess(back(w * 7 + off)));

console.log("\n── the allowance is the session's real cost ──");
eq("60 min at 78 kg", B.sessionKcalAllowance(sess("x", 60), 78), 425);
eq("30 min at 78 kg", B.sessionKcalAllowance(sess("x", 30), 78), 225);
ok("a 5-minute session still clears the floor", B.sessionKcalAllowance(sess("x", 5), 78) >= 150);
ok("a 4-hour session is capped", B.sessionKcalAllowance(sess("x", 240), 78) <= 600);
eq("no timestamps falls back to 45 min", B.sessionKcalAllowance({ date: "x", bodyweightKg: 78 }, 78), 325);

console.log("\n── training frequency is measured, not declared ──");
eq("16 sessions over 4 weeks reads as 4/wk", B.trainingDaysPerWeek(history, TODAY), 4);
eq("no history reads as 0", B.trainingDaysPerWeek([], TODAY), 0);

console.log("\n── the rule: training up, rest down, protein flat ──");
const trainDay = B.dayTargets({ profile, sessions: [...history, sess(TODAY)], ds: TODAY, today: TODAY });
// back(3) is deliberately a day the fixture logs no session on.
const restDay = B.dayTargets({ profile, sessions: history, ds: back(3), today: TODAY });
const base = B.calcTargets(profile);
ok("a training day raises calories above base", trainDay.targets.kcal > base.kcal);
ok("a rest day lowers calories below base", restDay.targets.kcal < base.kcal);
eq("protein is identical on both days", [trainDay.targets.p, restDay.targets.p], [base.p, base.p]);
eq("fat is identical on both days", [trainDay.targets.f, restDay.targets.f], [base.f, base.f]);
ok("carbs carry the whole training-day delta",
   (trainDay.targets.c - base.c) * 4 === trainDay.targets.kcal - base.kcal);
ok("carbs carry the whole rest-day delta",
   (restDay.targets.c - base.c) * 4 === restDay.targets.kcal - base.kcal);

console.log("\n── the week stays honest (no intake inflation) ──");
// 4 training days + 3 rest days should land within rounding of base × 7.
const t = 4;
const weekly = trainDay.targets.kcal * t + restDay.targets.kcal * (7 - t);
const drift = Math.abs(weekly - base.kcal * 7);
ok(`4 training + 3 rest ≈ base × 7 (drift ${drift} kcal of ${base.kcal * 7})`, drift <= 40);

console.log("\n── retroactive rest-day resolution (never rewrites food) ──");
eq("today with no session yet is provisional", B.dayTargets({ profile, sessions: history, ds: TODAY, today: TODAY }).resolved, "provisional");
eq("a past day with no session is a final rest day", B.dayTargets({ profile, sessions: history, ds: back(3), today: TODAY }).resolved, "rest");
eq("a day with a session is a training day", B.dayTargets({ profile, sessions: [...history, sess(TODAY)], ds: TODAY, today: TODAY }).resolved, "training");
ok("a provisional day is already scored against the rest-day target",
   B.dayTargets({ profile, sessions: history, ds: TODAY, today: TODAY }).targets.kcal === restDay.targets.kcal);
ok("both days' targets are offered so the user sees the trade before training",
   trainDay.trainingTargets.kcal > trainDay.restTargets.kcal);

console.log("\n── a user with no gym history is left alone ──");
const virgin = B.dayTargets({ profile, sessions: [], ds: TODAY, today: TODAY });
eq("no sessions → base target, unmodified", virgin.targets.kcal, base.kcal);
eq("no sessions → linkage reports itself off", virgin.linked, false);

console.log("\n── the rest-day floor ──");
// A heavy trainer on a cut: 6 days/week would otherwise gut the rest day.
const cutter = { ...profile, goal: "cut" };
const heavy = [];
for (let w = 0; w < 4; w++) for (const off of [1, 2, 3, 4, 5, 6]) heavy.push(sess(back(w * 7 + off)));
const heavyRest = B.dayTargets({ profile: cutter, sessions: heavy, ds: back(7), today: TODAY });
const bmr = Math.round(10 * 78 + 6.25 * 178 - 5 * 27 + 5);
ok(`a rest day never drops below BMR (${heavyRest.targets.kcal} ≥ ${bmr})`, heavyRest.targets.kcal >= bmr);

console.log("\n── the rule is written down, not hidden ──");
ok("TRAINING_RULE is exported as readable text", Array.isArray(B.TRAINING_RULE) && B.TRAINING_RULE.length >= 3);
ok("every day carries its rule for display", Array.isArray(trainDay.rule) && trainDay.rule.length >= 3);

console.log("\n── the week the app thinks you train ──");
// WEEK_PLAN is not decoration. directive.js reads type === "Rest" to decide
// whether a day with no session is a miss, and the Notification Center
// announces today's and tomorrow's session from it. A generic split that
// disagrees with the real week is wrong data driving daily judgements.
const plan = readFileSync(join(root, "src/modules/athlete/constants.js"), "utf8");
const rows = [...plan.matchAll(/\{\s*day:\s*"([A-Z]{3})",\s*type:\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]);
ok("all seven days are planned", rows.length === 7);
ok("the order is MON→SUN", rows.map((r) => r[0]).join(",") === "MON,TUE,WED,THU,FRI,SAT,SUN");
const typeOf = Object.fromEntries(rows);
ok("Monday is lower body", /lower/i.test(typeOf.MON));
ok("Tuesday is upper body", /upper/i.test(typeOf.TUE));
ok("Wednesday is endurance", /endurance/i.test(typeOf.WED));
ok("Thursday is the SECOND lower day, not rest", /lower/i.test(typeOf.THU) && !/rest/i.test(typeOf.THU));
ok("Friday is upper body", /upper/i.test(typeOf.FRI));
ok("Saturday is active recovery, which still expects something logged",
  /recovery/i.test(typeOf.SAT) && typeOf.SAT !== "Rest");
ok("Sunday is the only full rest day",
  typeOf.SUN === "Rest" && rows.filter(([, t]) => t === "Rest").length === 1);

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Body target linkage: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
