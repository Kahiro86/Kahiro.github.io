// ── The fixture contract ─────────────────────────────────────────────
// Fixtures drift silently. Nothing in this repo compared what the tests seed
// against what the app stores, so by the time anyone looked, the suite was
// seeding 22 stores that no longer exist (God Mode, the daily checklist, the
// old workout splits) and had never once put data into 10 that do.
//
// This is a RATCHET, not a red light. Every known gap is enumerated below
// with the reason it is there and the phase that closes it; the contract
// passes at today's state and fails the moment the gap grows. A permanently
// failing audit teaches people to ignore the audit — which is how the suite
// got here.
//
// Three rules:
//   1. No test may seed a store the app does not have.  (dead fixtures)
//   2. No store the app has may go unseeded.            (blind spots)
//   3. No entry may sit in the allowlist after it stops drifting.
//
// Rule 3 is the one that keeps the other two honest. An allowlist nobody
// prunes becomes a second kind of drift.
import { appKeys, seededKeys, testOnlyKeys } from "../fixtures/keys.mjs";

// ── Drift, and the deliberate exceptions ─────────────────────────────
// This list was 22 entries long on 2026-08-29 and is empty now. Keeping it
// empty is the whole point of the file: an entry here means a test seeds a
// store the app does not have, and the next person to add one has to say why
// in writing.
const DEAD_OK = {};

// Junk under keys no feature owns any more — seeded on purpose by qa.mjs's
// orphanJunk scenario. Sync and backup enumerate every `architect:` key, so a
// removed feature's leftovers still ride in every payload and the app has to
// boot past them. These are permanent by design, which is why they are not in
// DEAD_OK: that list is debt to clear, this one is a decision.
const ORPHAN_BY_DESIGN = {
  mode_cfg: "God Mode's config — orphan junk, proves boot survives leftovers",
  hell_mode: "never-shipped mode — orphan junk",
  daily_checklist: "retired with TodayTrackers — orphan junk",
  workout_splits: "superseded by gym_routines — orphan junk",
  life_routines: "old habit tracker — orphan junk, seeded as invalid JSON",
};

// In the app, seeded by nothing. Empty as of the dailyInstrument() scenario:
// every one of the 88 stores now has a fixture, which means every reader has
// been run at least once.
const BLIND_OK = {};

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const app = appKeys();
const appSet = new Set(app.keys());
const seeded = seededKeys(appSet);
const dead = testOnlyKeys(appSet);
const blind = [...appSet].filter((k) => !seeded.has(k));

console.log(`\n── the inventory ──`);
console.log(`  ${appSet.size} store keys in src/ · ${seeded.size} seeded by tests · ${dead.size} seeded but gone`);

console.log(`\n1. No test seeds a store the app does not have`);
{
  const rogue = [...dead].filter((k) => !DEAD_OK[k] && !ORPHAN_BY_DESIGN[k]).sort();
  ok(`no test seeds a store that no longer exists${rogue.length ? ` — NEW: ${rogue.join(", ")}` : ` (${Object.keys(ORPHAN_BY_DESIGN).length} deliberate orphans aside)`}`,
    rogue.length === 0);
}

console.log(`\n2. No store in the app goes unseeded`);
{
  const rogue = blind.filter((k) => !BLIND_OK[k]).sort();
  ok(`every one of the ${appSet.size} stores has a fixture${rogue.length ? ` — MISSING: ${rogue.join(", ")}` : ""}`,
    rogue.length === 0);
}

console.log(`\n3. The allowlist has no stale entries`);
{
  const fixedDead = Object.keys(DEAD_OK).filter((k) => !dead.has(k)).sort();
  ok(`no dead-fixture entry outlived its drift${fixedDead.length ? ` — remove: ${fixedDead.join(", ")}` : ` (list is empty)`}`,
    fixedDead.length === 0);
  // An orphan nobody seeds any more is not an orphan; it is a stale note.
  const goneOrphans = Object.keys(ORPHAN_BY_DESIGN).filter((k) => !dead.has(k)).sort();
  ok(`every deliberate orphan is still actually seeded${goneOrphans.length ? ` — remove: ${goneOrphans.join(", ")}` : ""}`,
    goneOrphans.length === 0);
  const fixedBlind = Object.keys(BLIND_OK).filter((k) => !blind.includes(k)).sort();
  ok(`no blind-spot entry outlived its drift${fixedBlind.length ? ` — remove: ${fixedBlind.join(", ")}` : ""}`,
    fixedBlind.length === 0);
}

console.log(`\n4. Every allowlist entry states a reason`);
{
  const bare = [...Object.entries(DEAD_OK), ...Object.entries(BLIND_OK), ...Object.entries(ORPHAN_BY_DESIGN)]
    .filter(([, why]) => !why || String(why).trim().length < 8).map(([k]) => k);
  ok(`each of the ${Object.keys(DEAD_OK).length + Object.keys(BLIND_OK).length + Object.keys(ORPHAN_BY_DESIGN).length} entries says why it is there`, bare.length === 0);
}

// ── 5. Round-trip ────────────────────────────────────────────────────
// The rule that makes a fixture trustworthy: the app's own sanitizer is the
// authority on every store's shape, so a fixture is correct exactly when the
// sanitizer hands it back unchanged. This is what catches a seed that says
// `gymSessions` where the reader wants `workouts`, or `createdDate` where the
// field is `createdAt` — both of which were written by hand into this suite
// and produced green tests that asserted nothing.
console.log(`\n5. Every scenario survives the app's own sanitizers`);
{
  let scenarios = null;
  try { scenarios = await import("../fixtures/scenarios.mjs"); } catch { /* Phase 3 */ }
  if (!scenarios) {
    ok("scenarios.mjs not present yet — Phase 3 activates this check", true);
  } else {
    const { validateScenario, SCENARIOS, ADVERSARIAL } = scenarios;
    const names = Object.keys(SCENARIOS);
    ok(`${names.length} scenarios to check`, names.length > 0);
    for (const name of names) {
      const problems = await validateScenario(SCENARIOS[name]());
      ok(`${name}() round-trips every store${problems.length ? ` — ${problems.join("; ")}` : ""}`,
        problems.length === 0);
    }
    // A scenario may only seed keys the app reads. Same rule as 1, but aimed
    // at the fixtures themselves, which rule 1 deliberately does not scan.
    for (const name of [...names, ...Object.keys(ADVERSARIAL || {})]) {
      const build = SCENARIOS[name] || ADVERSARIAL[name];
      const rogue = Object.keys(build()).filter((k) => !appSet.has(k)).sort();
      ok(`${name}() seeds only live stores${rogue.length ? ` — ${rogue.join(", ")}` : ""}`, rogue.length === 0);
    }
    // And the inverse, which matters just as much: a corruption fixture the
    // sanitizers happily accept is not corrupt, and the blank-page harness
    // built on it proves nothing.
    for (const name of Object.keys(ADVERSARIAL || {})) {
      const problems = await validateScenario(ADVERSARIAL[name]());
      ok(`${name}() is genuinely rejected by the sanitizers (${problems.length} stores)`, problems.length > 0);
    }
  }
}

console.log("");
if (fail) {
  console.log("FAILURES:\n  " + fails.join("\n  "));
  console.log("\nA new entry in either list is not a reason to widen the allowlist.");
  console.log("Either the fixture is wrong, or the store is — find out which.");
}
console.log(`Fixture contract: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
