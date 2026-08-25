// The notification audit's rule, enforced: a notification either leads
// somewhere or it should not be interrupting anyone. Every fired entry
// carries a destination, the row offers it, and the push path lands on it.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const p = (rel) => join(root, rel).replace(/\\/g, "/");
const read = (rel) => readFileSync(join(root, rel), "utf8");

writeFileSync(join(here, "_na.js"), `export * from "${p("src/shared/notify.js")}";`);
const r = await build({ entryPoints: [join(here, "_na.js")], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
const out = join(mkdtempSync(join(tmpdir(), "na-")), "b.mjs");
writeFileSync(out, r.outputFiles[0].text);
const N = await import(pathToFileURL(out).href);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

// ── 1. Every category answers to a screen ────────────────────────────
console.log("\n1. Every category has somewhere to go");
const targets = new Set(N.NAV_TARGETS.map((t) => t.id).filter(Boolean));
for (const c of N.NOTIF_CATS) {
  const nav = N.navForCat(c.id);
  ok(`${c.l} → ${nav}`, !!nav && targets.has(nav));
}

// ── 2. A fired reminder carries it ───────────────────────────────────
console.log("\n2. A fired reminder carries its destination");
const rem = N.newReminder({ title: "Log lunch", cat: "nutrition" });
ok("a new reminder starts with no explicit destination", rem.nav === "");
const fired = N.newLogEntry(rem, "occ-1");
ok("but the fired entry resolves one from its category", fired.nav === "gym:today");

const explicit = N.newReminder({ title: "Read", cat: "custom", nav: "analytics:library" });
ok("an explicit destination is kept", N.newLogEntry(explicit, "occ-2").nav === "analytics:library");

const sys = N.systemLogEntry({ title: "Achievement unlocked: X", cat: "achievements" });
ok("a system notice gets one too", sys.nav === "analytics:progress");
ok("and an explicit one still wins",
  N.systemLogEntry({ title: "x", cat: "system", nav: "habits" }).nav === "habits");

console.log("\n2b. It survives storage");
const round = N.sanitizeNotifLog([fired])[0];
ok("the destination round-trips through sanitize", round.nav === "gym:today");
ok("a junk destination is dropped, not carried", N.sanitizeNotifLog([{ ...fired, nav: 42 }])[0].nav === "");

console.log("\n2c. No fired notification is a dead end");
const dead = N.NOTIF_CATS
  .map((c) => ({ c, e: N.newLogEntry(N.newReminder({ title: "t", cat: c.id }), `o-${c.id}`) }))
  .filter(({ e }) => !e.nav);
ok(`every category produces an actionable notification${dead.length ? ` (dead: ${dead.map((d) => d.c.id).join(", ")})` : ""}`, dead.length === 0);

// ── 3. The row offers the action ─────────────────────────────────────
console.log("\n3. The notification row offers it");
const centre = read("src/shared/NotificationCenter.jsx");
ok("an Open control exists on the row", /aria-label=\{`Open \$\{e\.title\}`\}/.test(centre));
ok("it navigates to the entry's destination", /onNavigate\?\.\(e\.nav\)/.test(centre));
ok("it only appears when there is somewhere to go", /\{e\.nav && \(/.test(centre));
ok("opening marks it seen but leaves it actionable", /const markRead = \(e\) =>/.test(centre) && /state: "read"/.test(centre));

// ── 4. The push path lands on it too ─────────────────────────────────
console.log("\n4. A tapped push lands on the right screen");
const sw = read("public/sw.js");
ok("the push payload carries a url", /data: \{ url: d\.url/.test(sw));
ok("an already-open window is navigated, not just focused", /c\.navigate\(target\)/.test(sw));
ok("with a message fallback where navigate is unavailable", /notification-click/.test(sw));
const app = read("src/App.jsx");
ok("the app listens for that message", /notification-click/.test(app));
ok("and routes it through the one navigator", /navTo\(id\)/.test(app));
ok("a bare module id and a hashed url both work", /raw\.indexOf\("#"\)/.test(app));

// ── 5. Every destination is a real place ─────────────────────────────
console.log("\n5. Every destination resolves to a real screen");
// A reminder pointing at a route that no longer exists silently lands on
// the dashboard — it still "works", which is exactly why nobody notices.
const navSrc = read("src/shared/nav.js");
const facets = new Set([...navSrc.matchAll(/\{\s*id:\s*"([a-z]+)"/g)].map((m) => m[1]));
const appSrc = read("src/App.jsx");
const bad = [];
for (const t of N.NAV_TARGETS) {
  if (!t.id) continue;
  const [base, group] = t.id.split(":");
  if (!facets.has(base)) { bad.push(`${t.id} — no facet "${base}"`); continue; }
  if (!group) continue;
  // A compound id lands on an inner group, which App forwards via navHint.
  const owner = { analytics: "src/modules/analytics/AnalyticsOS.jsx", firm: "src/modules/firm/FirmOS.jsx", gym: "src/modules/gym/BodyOS.jsx" }[base];
  if (!owner) continue;
  let ownerSrc = "";
  try { ownerSrc = read(owner); } catch { bad.push(`${t.id} — ${owner} is missing`); continue; }
  if (!new RegExp(`["']${group}["']`).test(ownerSrc)) bad.push(`${t.id} — ${base} has no "${group}"`);
}
ok(`every nav target exists${bad.length ? ` (${bad.join("; ")})` : ""}`, bad.length === 0);
ok("navTo forwards a compound id as a group hint", /setNavHint\(\{ module: base, group/.test(appSrc));
const derived = [...new Set(Object.values(N.NAV_BY_CAT))];
const unknown = derived.filter((d) => !N.NAV_TARGETS.some((t) => t.id === d));
ok(`every category default is a selectable target${unknown.length ? ` (${unknown.join(", ")})` : ""}`, unknown.length === 0);

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Notification actions: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
