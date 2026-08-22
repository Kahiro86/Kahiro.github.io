// Gate 2 §2.3 — the Coach reflects, it does not prescribe. The prohibitions
// in the spec are the test: every string the Coach can emit is swept for
// prescription, shame framing, appearance comment, and under-eating praise.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const entry = join(here, "_bc.js");
writeFileSync(entry, `export * from "${join(root, "src/modules/athlete/bodyCoach.js").replace(/\\/g, "/")}";`);
const out = join(mkdtempSync(join(tmpdir(), "bc-")), "b.mjs");
const r = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
writeFileSync(out, r.outputFiles[0].text);
const C = await import(pathToFileURL(out).href);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const TODAY = "2026-08-22";
const back = (n) => { const d = new Date(`${TODAY}T12:00:00`); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const profile = { age: 27, sex: "male", heightCm: 178, weightKg: 78, activity: 1.55, goal: "muscle" };
const meal = (kcal, p) => ({ name: "meal", grams: 300, slot: "pre_shift", n: { kcal, p, c: 40, f: 20 } });
const sess = (date) => ({ id: `s${date}`, date, bodyweightKg: 78, startedAt: 0, finishedAt: 3600000, entries: [] });

// A well-logged month: 28 of 30 days, protein hit on most, 4 sessions/week.
const fullLog = {}, sessions = [];
for (let i = 1; i <= 30; i++) {
  if (i === 9 || i === 17) continue;
  fullLog[back(i)] = [meal(1600, 90), meal(1500, 80)];
  if (i % 7 === 1 || i % 7 === 3 || i % 7 === 5 || i % 7 === 0) sessions.push(sess(back(i)));
}
const full = C.bodyCoach({ log: fullLog, profile, sessions, measurements: [], today: TODAY });

// Every sentence the Coach produced, in one bag.
const allText = (res) => [...res.notes, ...res.gaps].map((x) => x.text).concat(res.question ? [res.question] : []).join(" \n ");

console.log("\n── it reflects what happened ──");
ok("reports protein hits as a count, not a verdict", /Protein target hit \d+ of the \d+ logged days/.test(allText(full)));
ok("reports sessions logged", /\d+ sessions logged/.test(allText(full)));
ok("28 of 30 days logged reads as reliable", full.reliable === true && full.coverage >= 90);

console.log("\n── it does not prescribe (spec §2.3) ──");
const PRESCRIBE = /\b(you should|you need to|try to|aim for|increase your|reduce your|cut your|add \d+ ?g|eat \d|drop to|bump to|set your target|switch to|start doing|do \d+ sets|per day to)\b/i;
ok("no prescription in a well-logged month", !PRESCRIBE.test(allText(full)));
ok("the Coach declares itself non-prescriptive", full.prescribes === false);

console.log("\n── no shame framing, ever ──");
const SHAME = /\b(failed|failure|you blew|lazy|excuse|no excuses|disappointing|pathetic|shame|guilty|bad day|you missed again|should have)\b/i;
ok("no shame language in a well-logged month", !SHAME.test(allText(full)));

console.log("\n── no comment on body image, appearance or worth ──");
const APPEARANCE = /\b(look|looks|looking|appearance|attractive|ugly|fat(?!\b ?target)|skinny|flabby|shredded|physique|beach|worth it|deserve)\b/i;
ok("no appearance language in a well-logged month", !APPEARANCE.test(allText(full)));

console.log("\n── thin data is flagged, not averaged over ──");
const thinLog = {};
for (const i of [1, 3, 5, 9, 14, 20]) thinLog[back(i)] = [meal(1600, 90)];
const thin = C.bodyCoach({ log: thinLog, profile, sessions: [], measurements: [], today: TODAY });
ok("6 of 30 days reads as unreliable", thin.reliable === false);
ok("it says so out loud", /not enough to average|sketch, not a measurement/i.test(allText(thin)));
ok("no shame in the thin-data case", !SHAME.test(allText(thin)));
ok("no prescription in the thin-data case", !PRESCRIBE.test(allText(thin)));

console.log("\n── sustained under-target is a question, never a win ──");
const lowLog = {};
for (let i = 1; i <= 20; i++) lowLog[back(i)] = [meal(700, 45)];
const low = C.bodyCoach({ log: lowLog, profile, sessions: [], measurements: [], today: TODAY });
const lowText = allText(low);
ok("under-eating is surfaced at all", /running well under target/i.test(lowText));
ok("it names both readings", /meals are going unlogged/i.test(lowText) && /intake really is short/i.test(lowText));
ok("it says the two need opposite fixes", /opposite fixes/i.test(lowText));
const PRAISE = /\b(great|well done|nice work|excellent|on track|crushing|perfect|keep it up|impressive)\b/i;
ok("under-eating is never praised", !PRAISE.test(lowText));
ok("under-eating never comes with a push to eat less", !/\b(reduce|cut|lower|drop)\b/i.test(lowText));

console.log("\n── correlations are named, not diagnosed ──");
const meas = [
  { date: back(24), weightKg: 78.0, waistCm: 84.0 },
  { date: back(1), weightKg: 78.2, waistCm: 82.4 },
];
const recomp = C.bodyCoach({ log: fullLog, profile, sessions, measurements: meas, today: TODAY });
ok("flat weight + falling waist is called recomposition", /recomposition, not a stall/i.test(allText(recomp)));
ok("still no prescription alongside the correlation", !PRESCRIBE.test(allText(recomp)));

console.log("\n── at most one question, and it is a question ──");
for (const res of [full, thin, low, recomp]) {
  if (res.question) ok(`question is a single question: "${res.question.slice(0, 42)}…"`, res.question.trim().endsWith("?") && (res.question.match(/\?/g) || []).length === 1);
}
ok("a stable week gives a stable question", C.bodyCoach({ log: fullLog, profile, sessions, measurements: [], today: TODAY }).question === full.question);

console.log("\n── the source itself carries no banned vocabulary ──");
const src = readFileSync(join(root, "src/modules/athlete/bodyCoach.js"), "utf8");
// Strip comments first — the module quotes the spec's banned words in its own
// header to say it does not use them, which is the opposite of a violation.
const code = src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const strings = [...code.matchAll(/`([^`]*)`|"([^"]*)"/g)].map((m) => m[1] || m[2] || "").join(" \n ");
ok("no shame word in any literal in the module", !SHAME.test(strings));
ok("no prescription in any literal in the module", !PRESCRIBE.test(strings));
ok("no appearance word in any literal in the module", !APPEARANCE.test(strings));

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Body Coach: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
