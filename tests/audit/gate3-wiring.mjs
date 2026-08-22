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

console.log("\n── criterion 11: nothing pays for presence ──");
const engine = read("src/shared/xpEngine.js");
ok("the login value is gone from the old table", !/login:\s*[1-9]/.test(engine));
ok("the login award pushes zero", /xp: 0, c: "life", login: true/.test(engine));
const collect = read("src/shared/xp/collect.js");
ok("no app.* event is ever collected", !/kind:\s*["']app\./.test(collect));
ok("and the omission is stated, not accidental", /Presence is not collected/.test(collect));

console.log("\n── trading is excluded by policy ──");
ok("trade awards are zeroed in the old table", /tradeLogged: 0/.test(engine));
ok("no trade event is collected", !/kind:\s*["']trade\.logged/.test(collect));
ok("the day-review still pays", /trading\.dayReview/.test(collect));

console.log("\n── criterion 32: distance to the next level is on the main surface ──");
const dash = read("src/modules/dashboard/Dashboard.jsx");
ok("the dashboard renders distance to next", /toNext|nextLevelXp/.test(dash));

console.log("\n── ranks come from the Covenant everywhere they render ──");
const journey = read("src/modules/journey/JourneyModule.jsx");
ok("the Journey ladder uses RANKS", /from "\.\.\/\.\.\/shared\/xp\/values\.js"/.test(journey) && /RANKS/.test(journey));
ok("the old TITLES ladder is no longer imported there", !/TITLES/.test(journey));

console.log("\n── no randomness in anything the reward path touches ──");
const rewardPath = ["src/shared/xp/values.js", "src/shared/xp/engine.js", "src/shared/xp/ledger.js",
  "src/shared/xp/difficulty.js", "src/shared/xp/collect.js", "src/shared/xp/run.js"].map(read);
ok("grep for RNG returns nothing", !rewardPath.some((s) => /Math\.random|getRandomValues|randomUUID/.test(s)));

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Gate 3 wiring: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
