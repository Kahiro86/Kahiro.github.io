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

// ── Known drift, 2026-08-29 ──────────────────────────────────────────
// Seeded by tests, gone from the app. Each is a feature that was removed
// while its fixtures stayed behind.
const DEAD_OK = {
  // God Mode — removed at the owner's request; config purged (purgeDead.js:21-23).
  mode_cfg: "God Mode, deleted", mode_history: "God Mode, deleted",
  nutrition_hard: "God Mode's hard-mode targets, deleted",
  hell_mode: "never shipped under this name",
  // Retired with the Command Centre trim; data kept, surface gone.
  daily_checklist: "TodayTrackers retired", daily_checklist_log: "TodayTrackers retired",
  weekly_goal: "TodayTrackers retired", life_pings: "TodayTrackers retired",
  checklist_items: "TodayTrackers retired",
  // Superseded by the vendored habit tracker (ht_*).
  routines: "old habit tracker, deleted", life_routines: "old habit tracker, deleted",
  life_projects: "module removed; data kept in ORPHANED_CONTENT_KEYS",
  // Trading stores that were folded into ti_settings / trade_gates.
  ict_active_checklist: "folded into trade_checklists",
  ict_checklist_templates: "folded into trade_checklists",
  ti_conditions: "folded into ti_settings", ti_confluences: "folded into ti_settings",
  ti_instruments: "folded into ti_settings", ti_sessions: "folded into ti_settings",
  ti_strategies: "folded into ti_settings",
  // Superseded by gym_sessions + the exercise registry.
  workout_splits: "superseded by gym_routines", workout_split_log: "superseded by gym_sessions",
  workout_week: "superseded by weekly_plan",
};

// In the app, seeded by nothing. Each is a real store no test has ever put a
// value into, so no test has ever exercised the code that reads it.
const BLIND_OK = {
  evening_review: "Phase 5 — belongs in a daily-instrument scenario",
  focus_checkins: "Phase 5 — belongs in activeMonth()",
  focus_checkin_cfg: "Phase 5 — config for the above",
  review_cards: "Phase 5 — belongs in activeMonth()",
  weekly_plan: "Phase 5 — belongs in the training scenarios",
  prayer_list: "Phase 5 — belongs in a faith scenario",
  ht_routines: "Phase 5 — habit routines have no coverage at all",
  overhead_cfg: "Phase 5 — overhead ledger has no coverage at all",
  overhead_alerts: "Phase 5 — as above",
  overhead_archive: "Phase 5 — as above",
};

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
  const rogue = [...dead].filter((k) => !DEAD_OK[k]).sort();
  ok(`every dead fixture is a known one${rogue.length ? ` — NEW: ${rogue.join(", ")}` : ` (${dead.size} known)`}`,
    rogue.length === 0);
}

console.log(`\n2. No store in the app goes unseeded`);
{
  const rogue = blind.filter((k) => !BLIND_OK[k]).sort();
  ok(`every blind spot is a known one${rogue.length ? ` — NEW: ${rogue.join(", ")}` : ` (${blind.length} known)`}`,
    rogue.length === 0);
}

console.log(`\n3. The allowlist has no stale entries`);
{
  const fixedDead = Object.keys(DEAD_OK).filter((k) => !dead.has(k)).sort();
  ok(`no dead-fixture entry outlived its drift${fixedDead.length ? ` — remove: ${fixedDead.join(", ")}` : ""}`,
    fixedDead.length === 0);
  const fixedBlind = Object.keys(BLIND_OK).filter((k) => !blind.includes(k)).sort();
  ok(`no blind-spot entry outlived its drift${fixedBlind.length ? ` — remove: ${fixedBlind.join(", ")}` : ""}`,
    fixedBlind.length === 0);
}

console.log(`\n4. Every allowlist entry states a reason`);
{
  const bare = [...Object.entries(DEAD_OK), ...Object.entries(BLIND_OK)]
    .filter(([, why]) => !why || String(why).trim().length < 8).map(([k]) => k);
  ok(`each of the ${Object.keys(DEAD_OK).length + Object.keys(BLIND_OK).length} entries says why it is there`, bare.length === 0);
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
