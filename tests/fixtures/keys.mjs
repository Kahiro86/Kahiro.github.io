// ── The live store-key inventory, derived from src/ ──────────────────
// Not a hand-kept list. A hand-kept list is exactly what drifted: the test
// suite still seeds 23 stores that no longer exist, because nothing checked.
//
// The definition of a store key is precise and comes from the app itself:
// a key is a store key iff it flows through one of the four APIs that
// prepend `architect:` (storage.js:2). Everything else in localStorage —
// `architect_sync`, `kahiro_lock`, the migration flags — is device-local by
// deliberate design and is NOT a store. So this reads call sites, not
// string literals, and resolves constants to their values.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative } from "node:path";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(m?jsx?|tsx?)$/.test(e)) out.push(p);
  }
  return out;
}

export const srcFiles = () => walk(join(ROOT, "src"));
// `_*.js` under tests/audit are esbuild scratch entries written at run time
// and gitignored; they are generated, not authored, and must not count as a
// test seeding anything.
// tests/fixtures IS the seeding mechanism now, so it counts: a store covered
// by a scenario is a store with coverage. Only two files are excluded, and
// for the same reason — they enumerate key names as data rather than seeding
// them, so counting them would let the audit satisfy its own rules.
export const testFiles = () => walk(join(ROOT, "tests"))
  .filter((p) => rel(p) !== "tests/fixtures/keys.mjs")
  .filter((p) => !/\/_[^/]*\.js$/.test(rel(p)))
  .filter((p) => rel(p) !== "tests/audit/fixture-contract.mjs");
export const rel = (p) => relative(ROOT, p).replace(/\\/g, "/");

// The four call sites that prepend the prefix. `read` is disciplineWriters'
// local alias for the same thing.
const STORE_API = String.raw`(?:useStorageState|writeStore|readKey|readKeyLocal|read|storage\.(?:get|set|remove))`;

/**
 * Every key the app actually stores, with the files that touch it.
 * Returns Map<key, Set<relative file path>>.
 */
export function appKeys() {
  const files = srcFiles();
  const sources = new Map(files.map((p) => [p, readFileSync(p, "utf8")]));

  // Pass 1 — constants a file defines, so an identifier can be resolved to
  // the string it stands for. Scoped per file, then merged: these are module
  // constants and the codebase does not shadow them.
  const consts = new Map();
  for (const src of sources.values()) {
    for (const m of src.matchAll(/(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*"([a-z_0-9]+)"/g)) {
      consts.set(m[1], m[2]);
    }
  }

  const out = new Map();
  const note = (key, p) => {
    if (!out.has(key)) out.set(key, new Set());
    out.get(key).add(rel(p));
  };

  // Pass 2 — arguments at the call sites, literal or identifier.
  const callRe = new RegExp(`${STORE_API}\\(\\s*(?:"([a-z_0-9]+)"|([A-Za-z_$][\\w$]*))`, "g");
  for (const [p, src] of sources) {
    for (const m of src.matchAll(callRe)) {
      const key = m[1] || consts.get(m[2]);
      // An identifier that resolves to nothing is a variable holding a key at
      // runtime (a loop over stores, say) — not a key in itself.
      if (key) note(key, p);
    }
  }
  return out;
}

/** Which of `keys` are mentioned anywhere under tests/ (excluding fixtures). */
export function seededKeys(keys) {
  const blob = testFiles().map((p) => readFileSync(p, "utf8")).join("\n");
  const hit = new Set();
  for (const k of keys) if (new RegExp(`\\b${k}\\b`).test(blob)) hit.add(k);
  return hit;
}

/**
 * Keys the tests seed that the app does not have. Read from the shapes the
 * tests actually use to seed: an object key assigned JSON.stringify, or an
 * explicit `architect:<key>` string.
 */
export function testOnlyKeys(app) {
  const found = new Set();
  for (const p of testFiles()) {
    const src = readFileSync(p, "utf8");
    for (const m of src.matchAll(/["']?([a-z][a-z_0-9]{2,})["']?\s*:\s*JSON\.stringify/g)) found.add(m[1]);
    for (const m of src.matchAll(/architect:([a-z_0-9]+)/g)) found.add(m[1]);
  }
  return new Set([...found].filter((k) => !app.has(k)));
}
