// ── The defect register ──────────────────────────────────────────────
// Findings from the 2026-08-28 audit, written as code instead of prose.
//
// Each one DEMONSTRATES the defect and asserts it is still present. That is
// deliberate and it is not a green rubber stamp: a report goes stale the day
// after it is written, and nobody re-reads it. This runs on every `npm run
// test:audit`, so a claim that stops being true fails loudly and says so —
// "appears fixed, verify and remove this entry" — instead of quietly
// misinforming the next person to open the file.
//
// The inversion matters. Writing these as ordinary failing tests would leave
// the suite permanently red, and a permanently red suite is one nobody reads,
// which is most of how the fixture drift this work started from happened.
//
// When you fix one: this audit fails, you delete the entry, and the real
// assertion belongs wherever the behaviour lives.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const p = (rel) => join(root, rel).replace(/\\/g, "/");

writeFileSync(join(here, "_kd.js"), `
export * as collect from "${p("src/shared/xp/collect.js")}";
export * as migrate from "${p("src/modules/habits/migrateDiscipline.js")}";
`);
const r = await build({ entryPoints: [join(here, "_kd.js")], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
const out = join(mkdtempSync(join(tmpdir(), "kd-")), "b.mjs");
writeFileSync(out, r.outputFiles[0].text);
const { collect, migrate } = await import(pathToFileURL(out).href);

const D = "2026-08-20";
const TODAY = "2026-08-28";
const PROFILE = { age: 27, sex: "male", heightCm: 178, weightKg: 78, activity: 1.55, goal: "muscle" };

// ─────────────────────────────────────────────────────────────────────
// All six findings this file was opened with are now fixed, and each one's
// assertion moved to where the behaviour lives:
//
//   1  supabase/migrations/0002_kv.sql   (the live database still needs checking)
//   2  tests/audit/day-score.mjs
//   3  tests/audit/gate-awards.mjs
//   4  tests/audit/purity-mirror.mjs
//   7  tests/audit/gate3-run.mjs         (overlap resolution, now at pricing time)
//  10  tests/audit/dated-events.mjs
//  11  tests/audit/dated-events.mjs
//
// The file stays because the shape is worth keeping: the next audit's findings
// go here, asserted as PRESENT, and the suite tells you when one stops being
// true instead of letting a report go quietly stale.
const DEFECTS = [
];

// ─────────────────────────────────────────────────────────────────────
let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

console.log(`\n${DEFECTS.length} findings from the 2026-08-28 audit, still open.\n`);
for (const d of DEFECTS) {
  let res;
  try { res = d.demonstrate(); }
  catch (e) { res = { present: false, detail: `the demonstration itself threw: ${e.message}` }; }
  console.log(`── Finding ${d.n} · ${d.title}`);
  console.log(`   ${d.where}`);
  console.log(`   ${res.detail}`);
  console.log(`   should be: ${d.should}`);
  ok(`finding ${d.n} is still present${res.present ? "" : " — APPEARS FIXED: verify, then delete this entry and assert the fix where the behaviour lives"}`,
    res.present);
  console.log("");
}

if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Known defects: ${pass}/${pass + fail} still present, as recorded`);
process.exit(fail ? 1 : 0);
