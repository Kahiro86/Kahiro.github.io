// A screen nobody can open is worse than no screen: it looks like a feature
// in the source tree, it rides in every build, and the audits that check
// "does this store have a surface" answer yes because the file exists.
//
// TodayTrackers sat unmounted for weeks that way, holding the only surface
// for three stores. It is gone now, and this keeps the count at zero: every
// exported component in src/ must be referenced somewhere other than its own
// definition. The check is deliberately narrow — components only, not every
// helper — because a helper with no caller is untidy and a screen with no
// mount is a lie about what the app does.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|tsx?)$/.test(e)) files.push(p);
  }
})(join(root, "src"));

const text = new Map(files.map((p) => [p, readFileSync(p, "utf8")]));

// Entry points answer to index.html, not to another module.
const ENTRIES = new Set(["src/main.jsx", "src/App.jsx"]);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const COMPONENT = /^export\s+(?:default\s+)?function\s+([A-Z][\w$]*)/gm;
const orphans = [];
for (const [p, src] of text) {
  const rel = relative(root, p).replace(/\\/g, "/");
  if (!/\.(jsx|tsx)$/.test(rel) || ENTRIES.has(rel)) continue;
  for (const m of src.matchAll(COMPONENT)) {
    const name = m[1];
    const re = new RegExp(`\\b${name}\\b`, "g");
    // Every mention anywhere in src/, minus the one in its own signature.
    let seen = 0;
    for (const v of text.values()) seen += (v.match(re) || []).length;
    if (seen <= 1) orphans.push(`${rel} → ${name}`);
  }
}

console.log("\n── every exported screen is reachable ──");
ok(`no component is exported and never rendered${orphans.length ? `\n      ${orphans.join("\n      ")}` : ""}`,
  orphans.length === 0);

// The other half of the same bug: a route in the nav with nothing behind it.
const nav = text.get(join(root, "src", "shared", "nav.js")) || "";
const app = text.get(join(root, "src", "App.jsx")) || "";
const navIds = [...nav.matchAll(/\bid:\s*"([a-z_]+)"/g)].map((m) => m[1]);
ok(`the nav declares ${navIds.length} facets`, navIds.length >= 6);
const unrouted = navIds.filter((id) => !new RegExp(`case\\s+"${id}"`).test(app));
ok(`every facet has a route${unrouted.length ? ` (${unrouted.join(", ")})` : ""}`, unrouted.length === 0);

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Reachable surfaces: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
