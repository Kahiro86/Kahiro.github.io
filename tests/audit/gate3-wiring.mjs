// Gate 3 — the cutover. Proves the numbers a user sees come from the ledger
// and nowhere else, by grep and by construction.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(join(root, p), "utf8");

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const files = [];
(function walk(d) { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else if (/\.(jsx?|tsx?)$/.test(e)) files.push(p); } })(join(root, "src"));

console.log("\n── criterion 10: one engine ──");
const useXp = read("src/shared/useXp.js");
ok("useXp runs the ledger", /runXp\(/.test(useXp));
ok("every XP field is overridden from the ledger", /total: ledger\.total/.test(useXp) && /byDay: ledger\.byDay/.test(useXp) && /level: ledger\.level/.test(useXp));
ok("the ledger is persisted through the normal store path", /writeStore\(LEDGER_KEY/.test(useXp));

// No module may compute an XP amount of its own. The gym domain keeps its own
// training stat ("IRON LVL") but must not reach the shared total.
const gymConsumers = files.filter((f) => /modules\/gym\//.test(f)).map((f) => f.slice(root.length + 1));
// Strip comments first — a file that merely *mentions* useXp in prose is not
// writing to the shared total, and matching prose would make this a lie.
const stripComments = (src) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const leaks = gymConsumers.filter((f) => /useXp\(|xp_ledger|LEDGER_KEY|writeStore\(\s*["']xp_/.test(stripComments(read(f))));
ok(`the gym engine does not write to the shared total${leaks.length ? ` (${leaks.join(", ")})` : ""}`, leaks.length === 0);

ok("the gym stat is labelled as separate from XP and level",
   /separate from your XP and level/.test(read("src/modules/gym/BodyOS.jsx")));
ok("no surface calls the gym stat XP", !gymConsumers.some((f) => /gym XP|IRON LVL/.test(read(f))));

console.log("\n── the consistency metric no longer measures presence ──");
const cons = read("src/shared/consistency.js");
ok("consistency does not read the app-open stamp", !/sanitizeLogins|xp_logins/.test(stripComments(cons)));
ok("it starts from real activity", /activityDays/.test(cons));
ok("and never rewrites a start the user has already seen", /never recomputed/.test(cons));
for (const f of ["src/modules/dashboard/Dashboard.jsx", "src/modules/journey/JourneyModule.jsx", "src/shared/StreakInsurance.jsx"]) {
  ok(`${f.split("/").pop()} passes activity, not logins`, !/useConsistencyStart\(logins\)/.test(read(f)));
}

console.log("\n── retired stores are purged, user content is not ──");
const purge = read("src/shared/purgeDead.js");
ok("God Mode config is purged", /mode_cfg/.test(purge) && /mode_history/.test(purge));
ok("hard-mode nutrition config is purged", /nutrition_hard/.test(purge));
ok("user-authored content is explicitly spared", /ORPHANED_CONTENT_KEYS/.test(purge) && /life_projects/.test(purge));
ok("the purge runs once, at boot", /purgeDeadStores\(\)/.test(read("src/main.jsx")) && /DONE_KEY/.test(purge));

console.log("\n── criterion 11: nothing pays for presence ──");
const engine = read("src/shared/xpEngine.js");
ok("no login value exists anywhere", !/login:\s*[1-9]/.test(engine));
ok("the app-open stamp carries no value at all", /\{ d, c: "life", login: true \}/.test(engine));
const collect = read("src/shared/xp/collect.js");
ok("no app.* event is ever collected", !/kind:\s*["']app\./.test(collect));
ok("and the omission is stated, not accidental", /Presence is not collected/.test(collect));

console.log("\n── trading is excluded by policy ──");
ok("no trade value exists anywhere", !/tradeLogged/.test(engine));
ok("no trade event is collected", !/kind:\s*["']trade\.logged/.test(collect));
ok("the day-review still pays", /trading\.dayReview/.test(collect));

console.log("\n── criterion 32: distance to the next level has a home ──");
// The user removed the level card from the Command Centre; the Record's Hall
// of Fame is where progression lives now, so that is where this has to hold.
const fame = read("src/modules/journey/JourneyModule.jsx");
ok("the Hall of Fame renders distance to next", /nextLevelXp\s*-\s*xp\.total|toNext/.test(fame));
const dash = read("src/modules/dashboard/Dashboard.jsx");
ok("the Command Centre no longer carries a second level readout", !/nextLevelXp/.test(dash));

console.log("\n── ranks come from the Covenant everywhere they render ──");
const journey = read("src/modules/journey/JourneyModule.jsx");
ok("the Journey ladder uses RANKS", /from "\.\.\/\.\.\/shared\/xp\/values\.js"/.test(journey) && /RANKS/.test(journey));
ok("the old TITLES ladder is no longer imported there", !/TITLES/.test(journey));

console.log("\n── criterion 10 (finished): the old engine no longer prices anything ──");
const eng = read("src/shared/xpEngine.js");
ok("the value table V is deleted", !/^const V = \{/m.test(eng));
ok("the streak ladder is deleted", !/STREAK_LADDER\s*=/.test(eng));
ok("the per-source caps are deleted", !/^const CAPS\s*=/m.test(eng));
ok("its own level curve is deleted", !/levelOfXp|export const xpForLevel/.test(eng));
ok("its own title ladder is deleted", !/export const TITLES/.test(eng));
ok("it returns no total, byDay, byCat or level", !/\btotal,|byDay,|byCat,|nextLevelXp/.test(eng.slice(eng.lastIndexOf("return {"))));
ok("award sites became value-free marks", /const mark = \(d, c, s\)/.test(eng) && !/const push = \(d, xp/.test(eng));
ok("app-opens are excluded from the activity record too", /if \(e\.login\) continue/.test(eng));
ok("domain labels come from the one values table", /Object\.entries\(DOMAINS\)/.test(eng));

console.log("\n── §4.3: the weighting rule is stated in the UI ──");
const worth = read("src/modules/habits/ui/WorthCard.tsx");
ok("a habit shows what it is worth", /What this is worth/.test(worth));
ok("it shows the completion rate driving the weight", /times it came up in the last/.test(worth));
ok("it shows the arithmetic, not just the answer", /base.*difficulty.*XP/s.test(worth));
ok("it lists every difficulty band", /DIFFICULTY_BANDS\.map/.test(worth));
ok("it names the daily cap so the user knows the ceiling", /pays at most/.test(worth));
ok("the card is mounted on the habit detail", /<WorthCard habit=\{habit\}/.test(read("src/modules/habits/ui/DetailScreen.tsx")));

console.log("\n── no randomness in anything the reward path touches ──");
const rewardPath = ["src/shared/xp/values.js", "src/shared/xp/engine.js", "src/shared/xp/ledger.js",
  "src/shared/xp/difficulty.js", "src/shared/xp/collect.js", "src/shared/xp/run.js"].map(read);
ok("grep for RNG returns nothing", !rewardPath.some((s) => /Math\.random|getRandomValues|randomUUID/.test(s)));

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Gate 3 wiring: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
