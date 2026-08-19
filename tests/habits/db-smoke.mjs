// End-to-end smoke test: drives the vendored Layer 2 logic through the
// localStorage Db (localDb.js), the exact path the running app takes. Proves
// the Db's method contracts (shapes, sorting, archived filtering, tri-state
// toggle, write-counter cache invalidation) line up with what the pure
// domain expects — the one thing the ported unit tests (which use plain
// objects, never a Db) cannot check.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");

// A minimal localStorage shim over a Map — the Db and writeStore only need
// getItem/setItem/removeItem plus Object.keys enumeration.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  key: (i) => [...store.keys()][i],
  get length() { return store.size; },
};
globalThis.window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };

// Bundle the app's localDb + logic index into one ESM module we can import.
const entry = join(here, "_db-entry.ts");
writeFileSync(entry, `
export { db } from "${join(root, "src/modules/habits/localDb.js").replace(/\\/g, "/")}";
export * as logic from "${join(root, "src/modules/habits/logic/index.ts").replace(/\\/g, "/")}";
`);
const out = join(mkdtempSync(join(tmpdir(), "habitdb-")), "bundle.mjs");
const result = await build({
  entryPoints: [entry], bundle: true, format: "esm", platform: "node",
  write: false, logLevel: "silent",
});
writeFileSync(out, result.outputFiles[0].text);
const { db, logic } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const fails = [];
const eq = (name, got, want) => {
  const okv = JSON.stringify(got) === JSON.stringify(want);
  if (okv) pass++; else { fail++; fails.push(`${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
};
const ok = (name, cond) => { if (cond) pass++; else { fail++; fails.push(name); } };

// ── create + read back ────────────────────────────────────────────────
const daily = await db.createHabit({ name: "Read", type: "boolean", frequencyType: "daily" });
ok("createHabit returns an id", typeof daily.id === "string" && daily.id.length > 0);
eq("listHabits has 1", (await db.listHabits()).length, 1);

// ── fill a wide window ending today: every scheduled day complete → 100 ─
// getScore takes a named Period ("week"/"month"/…) resolved relative to
// getToday(); filling generously past both windows makes both fully complete.
const today = await db.getToday();
const toDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
for (let i = 0; i <= 45; i++) { const dt = toDate(today); dt.setDate(dt.getDate() - i); await db.setEntry(daily.id, iso(dt), 1); }
eq("full week scores 100", await logic.getScore(db, daily.id, "week"), 100);
eq("full month scores 100", await logic.getScore(db, daily.id, "month"), 100);

// ── a genuinely partial window scores below 100 ───────────────────────
// Logging a day 6 days back sets the effective start there (first-entry
// backfill), so the week window has 7 scheduled days with only 2 complete.
const h2 = await db.createHabit({ name: "Partial", type: "boolean", frequencyType: "daily" });
const back6 = toDate(today); back6.setDate(back6.getDate() - 6);
await db.setEntry(h2.id, iso(back6), 1);
await db.setEntry(h2.id, today, 1);
const wk = await logic.getScore(db, h2.id, "week");
ok(`partial week 0<score<100 (got ${wk})`, wk > 0 && wk < 100);

// ── tri-state toggle: unlogged → complete → missed → unlogged ─────────
const t = await db.createHabit({ name: "Toggle", type: "boolean", frequencyType: "daily" });
await logic.toggleEntry(db, t.id, "2026-08-10");
eq("toggle → complete", (await db.getEntry(t.id, "2026-08-10"))?.value, 1);
await logic.toggleEntry(db, t.id, "2026-08-10");
eq("toggle → missed", (await db.getEntry(t.id, "2026-08-10"))?.value, 0);
await logic.toggleEntry(db, t.id, "2026-08-10");
ok("toggle → unlogged (row gone)", (await db.getEntry(t.id, "2026-08-10")) === null);

// ── write counters bump per habit ─────────────────────────────────────
const before = (await db.getWriteCounters())[daily.id] || 0;
await db.setEntry(daily.id, "2026-08-17", 1);
const after = (await db.getWriteCounters())[daily.id] || 0;
ok("write counter bumps on setEntry", after === before + 1);

// ── archive hides from the default list, keeps entries ────────────────
await db.archiveHabit(h2.id);
eq("archived habit hidden", (await db.listHabits()).length, 2);
eq("archived habit visible with flag", (await db.listHabits({ includeArchived: true })).length, 3);
eq("entries survive archive", await db.getEntryCount(h2.id), 2);

// ── validation: numeric habit needs a target ──────────────────────────
let threw = false;
try { await db.createHabit({ name: "Bad", type: "numeric", frequencyType: "daily" }); } catch { threw = true; }
ok("numeric habit without target is refused", threw);

// ── deleteHabit requires confirmation, then cascades ──────────────────
threw = false;
try { await db.deleteHabit(daily.id); } catch { threw = true; }
ok("deleteHabit needs confirmation", threw);
await db.deleteHabit(daily.id, { confirmed: true });
eq("delete cascades entries", await db.getEntryCount(daily.id), 0);

// ── export / import round-trip ────────────────────────────────────────
const backup = await logic.exportAll(db); // the versioned BackupFile
ok("export carries habits", Array.isArray(backup.habits) && backup.habits.length >= 1);
const report = logic.validateImport(backup, backup.schemaVersion ?? 1);
ok(`validateImport accepts our own export (${report.errors?.map((e) => e.message).join("; ")})`, report.ok === true);

console.log(fail ? `\nFAILURES:\n  ${fails.join("\n  ")}` : "");
console.log(`Db smoke: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
