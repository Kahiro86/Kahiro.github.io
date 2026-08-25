// Criterion 21, re-checked after the teardown — the pre-revamp total must
// still reach the ledger. Deleting computeXp's total silently broke this:
// useXp passed `xp.total`, which had become undefined, so any ledger opened
// after that shipped carried forward zero.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i], get length() { return store.size; } };
const entry = join(here, "_cf.js");
writeFileSync(entry, `export { openLedgerWithHistory } from "${join(root, "src/shared/xp/openMigration.js").replace(/\\/g, "/")}";
export { sanitizeLedger, bankedTotal } from "${join(root, "src/shared/xp/ledger.js").replace(/\\/g, "/")}";`);
const out = join(mkdtempSync(join(tmpdir(), "cf-")), "b.mjs");
const r = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
writeFileSync(out, r.outputFiles[0].text);
const M = await import(pathToFileURL(out).href);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };
const writeFn = (k, v) => store.set(`architect:${k}`, JSON.stringify(v));
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

console.log("\n── a user with real history carries it forward ──");
const purity = {}, journal = [];
for (let i = 1; i <= 40; i++) purity[ago(i)] = { s: i % 9 === 0 ? "relapse" : "pure", triggers: [] };
for (let i = 1; i <= 20; i++) journal.push({ id: `j${i}`, date: ago(i), text: "a real entry with enough words to count" });
store.set("architect:purity_log", JSON.stringify(purity));
store.set("architect:journal_entries", JSON.stringify(journal));
store.set("architect:athlete_workouts", JSON.stringify([...Array(12)].map((_, i) => ({ id: `w${i}`, type: "strength", date: ago(i * 2 + 1), exercises: [] }))));

const res = await M.openLedgerWithHistory(writeFn);
console.log(`     opened with ${res.xp} XP`);
ok("the ledger opened", res.opened === true);
ok("with a real historical total, not zero", res.xp > 0);
const led = M.sanitizeLedger(JSON.parse(store.get("architect:xp_ledger")));
ok("the opening row is stored", led.opening && led.opening.xp === res.xp);
ok("labelled as carried forward", /Carried forward/.test(led.opening.note));
ok("banked total starts from it", M.bankedTotal(led) === res.xp);

console.log("\n── it runs once, ever ──");
const again = await M.openLedgerWithHistory(writeFn);
ok("a second boot does not reopen", again.opened === false);
ok("and does not change the number", again.xp === res.xp);

console.log("\n── a genuinely new user opens at zero ──");
store.clear();
const fresh = await M.openLedgerWithHistory(writeFn);
ok("opens", fresh.opened === true);
ok("at zero, with no history to carry", fresh.xp === 0);

console.log("\n── the frozen engine is a migration, not an award path ──");
const legacy = read("src/shared/xp/legacyTotal.js");
ok("it exports exactly one function", (legacy.match(/^export /gm) || []).length === 1);
ok("and that function is the carry-forward total", /export function legacyDerivedTotal/.test(legacy));
ok("it is marked frozen", /FROZEN/.test(legacy));
const useXp = read("src/shared/useXp.js");
ok("no render path imports it", !/legacyTotal/.test(useXp));
ok("useXp never opens a ledger from a zero total", /rawLedger\?\.opening\?\.xp \?\? 0/.test(useXp));
ok("it is loaded lazily, so migrated users never fetch it", /await import\("\.\/legacyTotal\.js"\)/.test(read("src/shared/xp/openMigration.js")));

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Carry-forward: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
