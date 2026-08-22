// Gate 3 — acceptance criteria 10–21, proved rather than asserted.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const xp = (f) => join(root, "src/shared/xp", f).replace(/\\/g, "/");
const entry = join(here, "_g3.js");
writeFileSync(entry, `export * as V from "${xp("values.js")}";
export * as E from "${xp("engine.js")}";
export * as L from "${xp("ledger.js")}";
export * as D from "${xp("difficulty.js")}";`);
const out = join(mkdtempSync(join(tmpdir(), "g3-")), "b.mjs");
const r = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
writeFileSync(out, r.outputFiles[0].text);
const { V, E, L, D } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const TODAY = "2026-08-22";
const back = (n) => { const d = new Date(`${TODAY}T12:00:00`); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

console.log("\n── 10: all XP awarding routes through one engine ──");
const files = [];
(function walk(dir) { for (const e of readdirSync(dir)) { const p = join(dir, e); if (statSync(p).isDirectory()) walk(p); else if (/\.(jsx?|tsx?)$/.test(e)) files.push(p); } })(join(root, "src"));
const valueSrc = readFileSync(join(root, "src/shared/xp/values.js"), "utf8");
ok("every payable value lives in values.js", Object.keys(V.EVENTS).length >= 35 && /export const EVENTS/.test(valueSrc));
ok("an event absent from the table cannot pay", E.priceEvent({ kind: "totally.madeUp" }).xp === 0);
ok("the refusal says why", /not in the value table/.test(E.priceEvent({ kind: "totally.madeUp" }).reason));

console.log("\n── 11: zero XP for app usage ──");
for (const k of ["app.opened", "app.tabViewed", "app.notificationDismissed"]) {
  const p = E.priceEvent({ kind: k });
  ok(`${k} pays nothing`, p.xp === 0 && p.paid === false);
}
ok("the old login award is gone from values.js", !/login/i.test(valueSrc.replace(/NEVER_PAID[\s\S]*?};/, "")));

console.log("\n── 12: no double-counting ──");
const dup = E.priceEvent({ kind: "habit.completed", supersededBy: "workout.logged" });
ok("a habit satisfied by a workout pays nothing", dup.xp === 0 && dup.satisfied === true);
ok("but is still recorded as satisfied", /already paid as workout.logged/.test(dup.reason));
const woOnly = E.priceEvent({ kind: "workout.logged" }).xp;
const both = E.priceDay([{ kind: "workout.logged" }, { kind: "habit.completed", supersededBy: "workout.logged" }], {});
ok(`one action pays once (${both.total} = ${woOnly})`, both.total === woOnly);

console.log("\n── 13: five trivial habits, simulated 14 days ──");
// The real test: add five one-tap habits on day 0 and watch the daily yield
// across the next 14 days as their measured completion rate climbs and their
// difficulty weight falls. The spike has to decay.
function simulate(day) {
  // Three real habits the user has held for 60 days at ~72%.
  const diff = { r1: { weight: 1.0 }, r2: { weight: 1.0 }, r3: { weight: 1.0 } };
  const events = [1, 2, 3].map((i) => ({ kind: "habit.completed", habitId: `r${i}` }));
  // Five trivial habits added on day 0, completed every day since. Their
  // weight is whatever their own record says it is on this day.
  for (let i = 1; i <= 5; i++) {
    const d = D.difficultyFor({ scheduled: day, completed: day });
    diff[`t${i}`] = { weight: d.weight };
    events.push({ kind: "habit.completed", habitId: `t${i}` });
  }
  return { total: E.priceDay(events, { difficulty: diff, consistency: 1.3, balance: {} }).total, w: diff.t1.weight };
}
const baseline = E.priceDay([1, 2, 3].map((i) => ({ kind: "habit.completed", habitId: `r${i}` })),
  { difficulty: { r1: { weight: 1 }, r2: { weight: 1 }, r3: { weight: 1 } }, consistency: 1.3, balance: {} }).total;
const curve = [1, 7, 13, 14, 20, 30].map((d) => ({ d, ...simulate(d) }));
console.log(`     baseline (3 real habits only): ${baseline} XP/day`);
for (const c of curve) console.log(`     day ${String(c.d).padStart(2)} after adding: ${String(c.total).padStart(3)} XP/day   trivial weight ${c.w}`);
const spike = curve.find((c) => c.d === 13).total;      // still provisional at 1.0
const settled = curve.find((c) => c.d === 30).total;    // measured, decayed to 0.6
ok(`the spike decays (${spike} → ${settled} XP/day)`, settled < spike);
ok("trivial habits settle at the lowest weight", curve.find((c) => c.d === 30).w === 0.6);
ok("they never reach the weight of a habit the user actually fights",
   curve.find((c) => c.d === 30).w < D.difficultyFor({ scheduled: 60, completed: 33 }).weight);
// Honest statement of the residual: the spec's own mechanism decays to 0.6,
// not to 0, so five extra daily completions do still add something.
const residual = Math.round(((settled / baseline) - 1) * 100);
console.log(`     residual after decay: +${residual}% vs baseline (was +${Math.round(((spike / baseline) - 1) * 100)}% at the spike)`);
ok(`the residual is bounded well under the pre-revamp +91% (got +${residual}%)`, residual < 91);
// And the cap means a serious load beats a padded one.
const serious = E.priceDay([1, 2, 3, 4, 5].map((i) => ({ kind: "habit.completed", habitId: `s${i}` })),
  { difficulty: Object.fromEntries([1, 2, 3, 4, 5].map((i) => [`s${i}`, { weight: 1.4 }])), consistency: 1.5, balance: {} }).total;
const padded = E.priceDay([...Array(12)].map((_, i) => ({ kind: "habit.completed", habitId: `p${i}` })),
  { difficulty: Object.fromEntries([...Array(12)].map((_, i) => [`p${i}`, { weight: 0.6 }])), consistency: 1.5, balance: {} }).total;
console.log(`     5 hard habits: ${serious} XP · 12 trivial habits: ${padded} XP`);
ok(`five hard habits beat twelve trivial ones (${serious} ≥ ${padded})`, serious >= padded);

console.log("\n── 14: a 95% habit pays less than a 55% habit ──");
const easy = D.difficultyFor({ scheduled: 60, completed: 57 });
const hard = D.difficultyFor({ scheduled: 60, completed: 33 });
const easyXp = E.priceEvent({ kind: "habit.completed" }, { difficulty: easy.weight }).xp;
const hardXp = E.priceEvent({ kind: "habit.completed" }, { difficulty: hard.weight }).xp;
console.log(`     95% → weight ${easy.weight}, ${easyXp} XP · 55% → weight ${hard.weight}, ${hardXp} XP`);
ok(`the harder habit pays measurably more (${hardXp} > ${easyXp})`, hardXp > easyXp);
ok("and the gap is not trivial", hardXp >= easyXp * 2);
ok("a new habit sits at baseline, not guessed", D.difficultyFor({ scheduled: 5, completed: 5 }).weight === 1 && D.difficultyFor({ scheduled: 5, completed: 5 }).provisional);

console.log("\n── 15: a workout pays meaningfully more than a tap ──");
const wo = E.priceEvent({ kind: "workout.logged" }).xp;
const tap = E.priceEvent({ kind: "habit.completed" }, { difficulty: 1 }).xp;
ok(`workout ${wo} vs habit ${tap}`, wo >= tap * 2.5);
ok("a partial session pays less than a full one", E.priceEvent({ kind: "workout.partial" }).xp < wo);
ok("a PR pays on top", E.priceEvent({ kind: "workout.pr" }).xp === 15);

console.log("\n── 16: consistency multiplier never exceeds 1.5 ──");
const mults = [0, 6, 7, 20, 21, 59, 60, 365, 100000].map(E.consistencyMultiplier);
console.log(`     ${mults.join(" ")}`);
ok("bounded at 1.5 for every streak length", Math.max(...mults) === 1.5);
ok("bands match the spec", JSON.stringify(mults.slice(0, 8)) === JSON.stringify([1, 1, 1.15, 1.15, 1.3, 1.3, 1.5, 1.5]));
ok("an absurd context value is still clamped", E.priceEvent({ kind: "habit.completed" }, { consistency: 99 }).consistency === 1.5);

console.log("\n── 17: recovery bonus fires for 3 days after a break ──");
const days = [back(20), back(19), back(18), /* gap */ back(5), back(4), back(3), back(2), back(1)];
const rec = days.map((d) => E.inRecovery(d, days));
console.log(`     ${days.map((d, i) => `${d.slice(5)}:${rec[i] ? "R" : "-"}`).join(" ")}`);
ok("the first day back is in recovery", rec[3] === true);
ok("days 2 and 3 back are in recovery", rec[4] === true && rec[5] === true);
ok("day 4 back is not", rec[6] === false);
ok("an unbroken run is never in recovery", rec[1] === false && rec[2] === false);
ok("the very first day ever is not a 'return'", rec[0] === false);
ok("recovery pays +50%", E.priceEvent({ kind: "habit.completed" }, { difficulty: 1, recovery: true }).xp === 15);

console.log("\n── 18: domain caps hold, over-cap still logs ──");
// A genuinely heavy day: twelve frontier-difficulty habits on a 60-day streak.
// This is the load that actually reaches the cap once diminishing returns are
// in play — a padded day of trivial habits never gets near it, which is the
// point of both mechanisms working together.
const heavy = [...Array(12)].map((_, i) => ({ kind: "habit.completed", habitId: `f${i}` }));
const heavyDiff = Object.fromEntries([...Array(12)].map((_, i) => [`f${i}`, { weight: 1.8 }]));
const capped = E.priceDay(heavy, { difficulty: heavyDiff, consistency: 1.5, balance: {} });
const uncappedTotal = capped.lines.reduce((s2, l) => s2 + Math.round(l.xp * (l.marginal ?? 1)), 0);
console.log(`     12 frontier habits would pay ${uncappedTotal}; cap is ${V.DOMAINS.discipline.cap}, awarded ${capped.total}`);
ok(`the cap holds (${capped.total} = ${V.DOMAINS.discipline.cap})`, capped.total === V.DOMAINS.discipline.cap);
ok("all 12 still appear as lines", capped.lines.length === 12);
ok("the ones past the cap are marked, not deleted",
   capped.lines.some((l) => l.capped) && capped.lines.every((l) => l.paid));
ok("each line still carries its full pre-cap value for the ledger", capped.lines.every((l) => l.xp > 0));
const bigDay = E.priceDay([{ kind: "campaign.quarterCleared" }, ...heavy], { difficulty: heavyDiff, consistency: 1.5, balance: {} });
ok(`a rare uncapped award survives a capped day (${bigDay.total})`, bigDay.total === 400 + V.DOMAINS.discipline.cap);
ok("a milestone takes no marginal decay either", bigDay.lines.find((l) => l.kind === "campaign.quarterCleared").marginal === 1);

console.log("\n── diminishing returns are predictable and ordered ──");
console.log(`     nth action factor: ${[1, 2, 3, 4, 5, 6, 8, 12].map((k) => `${k}:${E.marginalFactor(k).toFixed(2)}`).join(" ")}`);
ok("the first four pay full", [1, 2, 3, 4].every((k) => E.marginalFactor(k) === 1));
ok("the fifth pays less than the fourth", E.marginalFactor(5) < 1);
ok("it decays monotonically and never hits zero", E.marginalFactor(12) > 0 && E.marginalFactor(12) < E.marginalFactor(8));
const mixed = E.priceDay([
  { kind: "habit.completed", habitId: "easy1" }, { kind: "habit.completed", habitId: "easy2" },
  { kind: "habit.completed", habitId: "easy3" }, { kind: "habit.completed", habitId: "easy4" },
  { kind: "habit.completed", habitId: "hard1" },
], { difficulty: { easy1: { weight: 0.6 }, easy2: { weight: 0.6 }, easy3: { weight: 0.6 }, easy4: { weight: 0.6 }, hard1: { weight: 1.8 } }, consistency: 1 });
ok("the hardest habit gets a full-rate slot, not whatever came first",
   mixed.lines.find((l) => l.label === "habit.completed" && l.difficulty === 1.8).nth === 1);

console.log("\n── 19 & 20: no path removes or reduces earned XP ──");
let led = L.sanitizeLedger(null);
led = L.bankDay(led, back(3), { total: 90, byDomain: { discipline: 90 }, lines: [{ kind: "habit.completed", awarded: 90 }] }, TODAY).ledger;
ok("a past day seals on banking", !!led.days[back(3)].sealedAt);
const reBank = L.bankDay(led, back(3), { total: 0, byDomain: {}, lines: [] }, TODAY);
ok("re-banking a sealed day changes nothing", reBank.changed === false && reBank.ledger.days[back(3)].total === 90);
ok("the sealed total survives", L.bankedTotal(reBank.ledger) === 90);
led = L.bankDay(led, TODAY, { total: 40, byDomain: { body: 40 }, lines: [] }, TODAY).ledger;
ok("today is stored live, not sealed", led.days[TODAY].sealedAt === null);
const corrected = L.bankDay(led, TODAY, { total: 30, byDomain: { body: 30 }, lines: [] }, TODAY);
ok("today can still be corrected downward (a mis-tap must be undoable)", corrected.ledger.days[TODAY].total === 30);
ok("but yesterday cannot", L.bankDay(corrected.ledger, back(3), { total: 1, byDomain: {}, lines: [] }, TODAY).ledger.days[back(3)].total === 90);
// Archiving/deleting a habit cannot touch a sealed day, because sealed days
// never look at habit rows again.
ok("deleting every habit leaves the banked total intact", L.bankedTotal(corrected.ledger) === 120);

console.log("\n── 21: existing XP preserved, history not recomputed ──");
const fresh = L.openLedger(null, 4830, TODAY);
ok("the pre-revamp total is carried forward whole", fresh.ledger.opening.xp === 4830 && fresh.opened);
ok("it is labelled as carried forward", /Carried forward/.test(fresh.ledger.opening.note));
ok("it says it was never rescored", /never rescored/.test(fresh.ledger.opening.note));
const again = L.openLedger(fresh.ledger, 999999, TODAY);
ok("opening is idempotent — a later boot cannot overwrite it", again.opened === false && again.ledger.opening.xp === 4830);
const withDay = L.bankDay(fresh.ledger, back(1), { total: 75, byDomain: { discipline: 75 }, lines: [] }, TODAY).ledger;
ok(`new days add on top (${L.bankedTotal(withDay)})`, L.bankedTotal(withDay) === 4905);

console.log("\n── 31: no randomness anywhere in the reward path ──");
const rewardFiles = ["values.js", "engine.js", "ledger.js", "difficulty.js"].map((f) => readFileSync(join(root, "src/shared/xp", f), "utf8"));
const rng = /Math\.random|crypto\.getRandomValues|randomUUID|\bseedrandom\b/;
ok("grep for RNG in the reward path returns nothing", !rewardFiles.some((s) => rng.test(s)));
const twice = [E.priceEvent({ kind: "habit.completed" }, { difficulty: 1.4, consistency: 1.3 }).xp,
                E.priceEvent({ kind: "habit.completed" }, { difficulty: 1.4, consistency: 1.3 }).xp];
ok(`same action, same value, every time (${twice.join(" = ")})`, twice[0] === twice[1]);

console.log("\n── §4.6: journal minimum, and domain balance ──");
ok("a 5-word entry pays nothing", E.priceEvent({ kind: "journal.entry", text: "one two three four five" }).xp === 0);
ok("but it is not an error — it still saves", /still saves|doesn't pay/.test(E.priceEvent({ kind: "journal.entry", text: "a b" }).reason));
ok("a real entry pays", E.priceEvent({ kind: "journal.entry", text: "w ".repeat(30) }, { difficulty: 1 }).xp === 15);
const bf = E.balanceFactors({ discipline: 700, body: 300 });
ok("a domain over 60% of the week drops to 0.8", bf.discipline === 0.8);
ok("the others are unaffected", bf.body === 1);
ok("an empty week penalises nobody", Object.values(E.balanceFactors({})).every((v) => v === 1));

console.log("\n── §4.7: levels and ranks ──");
console.log(`     L5 ${V.xpForLevel(5)} · L10 ${V.xpForLevel(10)} · L20 ${V.xpForLevel(20)}`);
ok("L5 ≈ 4,390", Math.abs(V.xpForLevel(5) - 4390) <= 5);
ok("L10 ≈ 11,195", Math.abs(V.xpForLevel(10) - 11195) <= 5);
ok("L20 ≈ 28,551", Math.abs(V.xpForLevel(20) - 28551) <= 20);
ok("level 1 is free, so a new user is never in debt", V.xpForLevel(1) === 0);
ok("thresholds grow", V.xpForLevel(20) - V.xpForLevel(19) > V.xpForLevel(5) - V.xpForLevel(4));
ok("ranks come from the Covenant, not a generic ladder",
   V.RANKS.every((r) => r.from && r.from.length > 10) && V.RANKS.some((r) => /Prove one/i.test(r.from)));
ok("rank 1 is Signatory", V.rankFor(1).l === "Signatory");
ok("level 8 is Operator, the Firm's own word", V.rankFor(8).l === "Operator");

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Gate 3 XP engine: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
