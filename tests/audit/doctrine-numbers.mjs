// The numbers the app ships as defaults have to agree with the doctrine they
// claim to serve, and each one has to have exactly one definition.
//
// Both failed. The emergency-fund default implied a 50,000/month life against
// a covenant that freezes it at 30,000, and the KES↔USD rate was a bare `130`
// repeated in eight fallbacks that agreed only by coincidence.
import { DEFAULT_FINANCE_STATE, DEFAULT_XRATE } from "../../src/modules/finance/constants.js";
import { DEFAULT_FIRM_CONFIG } from "../../src/shared/firm.js";
import { xpForLevel, levelFromXp } from "../../src/shared/xp/values.js";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

console.log("\n1. The emergency fund is sized for the life the covenant mandates");
{
  const ef = DEFAULT_FINANCE_STATE.goals.find((g) => g.id === "g_ef");
  const life = DEFAULT_FIRM_CONFIG.lifeCostKsh;
  ok(`the fund names six months (${ef.name})`, /6 months/i.test(ef.name));
  ok(`and its target is six of them (${ef.target} = 6 × ${life})`, ef.target === life * 6);
  ok("not the 300,000 it shipped with, which implied a 50,000 life", ef.target !== 300000);
}

console.log("\n2. One exchange rate, one definition");
{
  ok(`the default is exported (${DEFAULT_XRATE})`, DEFAULT_XRATE === 130);
  ok("and the stored state uses it", DEFAULT_FINANCE_STATE.xRate === DEFAULT_XRATE);

  // A bare 130 used as a rate fallback anywhere is the bug returning.
  const files = [];
  (function walk(d) {
    for (const e of readdirSync(d)) {
      const p2 = join(d, e);
      if (statSync(p2).isDirectory()) walk(p2);
      else if (/\.(jsx?|tsx?)$/.test(e)) files.push(p2);
    }
  })(join(root, "src"));
  const offenders = [];
  const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const f of files) {
    for (const line of stripComments(readFileSync(f, "utf8")).split("\n")) {
      // Only lines that are about the rate — a width of 130px is not a rate,
      // and the comment explaining the fix is not the fix coming undone.
      if (/\b130\b/.test(line) && /xRate|exchange|usd|USD/.test(line) && !/DEFAULT_XRATE/.test(line)) {
        offenders.push(`${relative(root, f)}: ${line.trim().slice(0, 70)}`);
      }
    }
  }
  ok(`no file falls back to a bare 130${offenders.length ? `\n      ${offenders.join("\n      ")}` : ""}`, offenders.length === 0);
}

console.log("\n3. The level curve does not go backwards at the bottom");
{
  const step = (l) => xpForLevel(l) - xpForLevel(l - 1);
  ok(`reaching level 2 no longer costs more than level 3 (${step(2)} then ${step(3)})`, step(2) <= step(3));
  ok("level 1 is still free", xpForLevel(1) === 0);
  // Only level 2 moved, and only downward — nobody may lose a level they had.
  for (const l of [3, 4, 5, 10, 20, 42]) {
    ok(`L${l} is the formula verbatim (${xpForLevel(l)})`, xpForLevel(l) === Math.round(500 * Math.pow(l, 1.35)));
  }
  ok("and L2 only came down", xpForLevel(2) < 1275);
  ok("so someone on 1,200 XP gained a level rather than losing one", levelFromXp(1200).level === 2);
  ok("while someone on 5,000 is where they were", levelFromXp(5000).level === 5);

  // The dip at L4 is inherited from 500 × l^1.35 itself. It is documented as
  // such rather than quietly smoothed, because smoothing it means rebasing
  // every threshold and moving people's levels.
  const src = readFileSync(join(root, "src/shared/xp/values.js"), "utf8");
  ok("the inherited dip at level 4 is stated, not hidden", /mild dip at\n\/\/ level 4|dip at\s+\/\/ level 4|its own mild dip/.test(src));
  ok("and the comment's figures match the function", /L3 2,203 · L5 4,391 · L10 11,194 · L20 28,534/.test(src));
}

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Doctrine numbers: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
