// The sync check exists to be SENT — pasted into a message when two devices
// disagree. That makes "what can end up in the report" a security question,
// not a formatting one: the anon key, the access token and the user's own
// entries are all one careless template literal away from being in it.
//
// buildReport is pure precisely so this can be tested rather than promised.
import { readFileSync } from "node:fs";
import { buildReport, countOf, WATCHED } from "../../src/shared/syncCheck.js";
import { ROOT } from "../fixtures/harness.mjs";
import { join } from "node:path";

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const T = (h) => `2026-08-30T${String(h).padStart(2, "0")}:00:00.000Z`;
const SECRETS = ["eyJhbGciOiJIUzI1NiIsInR", "sb-secret-anon-key-xyz", "Confessed the lie to Mum", "kahiro.willyss@gmail.com"];

const facts = (over = {}) => ({
  now: T(12), agent: "Mozilla/5.0 (Linux; Android 14)",
  configured: true, host: "abcd.supabase.co",
  signedIn: true, userId: "8f3c1d2e-aaaa-bbbb-cccc-000000000001",
  meta: { ht_habits: T(10) }, base: { ht_habits: { ts: T(9), ids: ["h1"] } }, dirty: [],
  local: {}, cloud: {}, cloudError: "",
  ...over,
});

console.log("\n1. Nothing private can reach the report");
{
  // Everything a report could plausibly be handed, including the things it
  // must never repeat back.
  const r = buildReport(facts({
    local: {
      nutrition_profile: { email: SECRETS[3], age: 27 },
      ht_habits: [{ id: "h1", name: SECRETS[2] }, { id: "h2", name: "Read" }],
      journal_entries: [{ id: "j1", text: SECRETS[2] }],
      architect_sync: { anonKey: SECRETS[1] },
    },
    cloud: { ht_habits: { key: "ht_habits", value: [{ id: "h1", name: SECRETS[2] }], updated_at: T(11) } },
  }));
  for (const s of SECRETS) ok(`no "${s.slice(0, 18)}…" in the report`, !r.includes(s));
  ok("the account is identified by a prefix only", /account 8f3c1d2e…/.test(r));
  ok("but the counts that answer the question are there", /2 here vs 1 in the cloud/.test(r));
  ok("and it says which way round that is", /has NOT PUSHED/.test(r));
}

console.log("\n2. It answers the question it was opened for");
{
  ok("an unconfigured device says so and stops",
    /NOT CONFIGURED/.test(buildReport(facts({ configured: false }))));
  ok("a signed-out device says so and stops",
    /signed in\s+NO/.test(buildReport(facts({ signedIn: false }))));
  ok("a device that cannot read the cloud says why",
    /HTTP 401/.test(buildReport(facts({ cloudError: "HTTP 401" }))));
  ok("and what to do about a missing table",
    /0002_kv\.sql/.test(buildReport(facts({ cloudError: "HTTP 404" }))));

  const behind = buildReport(facts({
    meta: { ht_habits: T(8) },
    local: { ht_habits: [{ id: "h1" }] },
    cloud: { ht_habits: { key: "ht_habits", value: [{ id: "h1" }, { id: "h2" }], updated_at: T(11) } },
  }));
  ok("a device the cloud is ahead of is told it has not pulled", /has NOT PULLED/.test(behind));

  const queued = buildReport(facts({ dirty: ["ht_habits", "gym_routines"] }));
  ok("a stuck push queue is named", /queued\s+ht_habits, gym_routines/.test(queued));

  ok("a store nothing has ever pushed is distinguished from an empty one",
    /never pushed/.test(buildReport(facts({ local: { ht_habits: [{ id: "h1" }] } }))));
}

console.log("\n3. Absent, empty and one are three different answers");
{
  ok("absent is null, not zero", countOf(undefined) === null && countOf(null) === null);
  ok("an empty list is zero", countOf([]) === 0);
  ok("a by-date map counts its days", countOf({ "2026-08-01": 1, "2026-08-02": 1 }) === 2);
  ok("a scalar counts as one", countOf("3.1") === 1 && countOf(7) === 1);
  // The distinction that matters on screen: a store nobody has ever written
  // must not read as "0 items", which looks like data loss.
  const r = buildReport(facts({ local: { ht_habits: null }, cloud: {} }));
  ok("and the report says 'empty on both' rather than claiming zero", /empty on both/.test(r));
}

console.log("\n4. It is read-only, and it does not trust the code it is checking");
{
  const src = readFileSync(join(ROOT, "src", "shared", "syncCheck.js"), "utf8");
  ok("it never writes to storage", !/localStorage\.(setItem|removeItem|clear)|storage\.(set|remove)/.test(src));
  ok("nor triggers a push or a pull", !/\b(flush|pull|markDirty|applyExternal|stampBase)\s*\(/.test(src));
  ok("it reads the cloud directly rather than through sync.js",
    /rest\/v1\/kv/.test(src) && !/from "\.\/sync\.js"/.test(src));
  ok("the secrets are used to authenticate and never passed to the report",
    /Authorization: `Bearer \$\{token\}`/.test(src) && !/token,\s*$|anonKey,\s*$/m.test(src));

  const panel = readFileSync(join(ROOT, "src", "shared", "SettingsPanel.jsx"), "utf8");
  ok("and Settings offers it where the sync status already is", /runSyncCheck/.test(panel) && /Sync check/.test(panel));
}

console.log("\n5. The stores the report is usually opened about");
{
  ok(`habits and Body routines are both watched (${WATCHED.join(", ")})`,
    WATCHED.includes("ht_habits") && WATCHED.includes("gym_routines"));
  ok("along with the entries behind them", WATCHED.includes("ht_entries"));
  // Anything else still appears, but only when it actually disagrees — a
  // sixty-line report nobody reads is the same as no report.
  const quiet = buildReport(facts({
    local: { finance_state: { a: 1 } },
    cloud: { finance_state: { key: "finance_state", value: { a: 1 }, updated_at: T(11) } },
  }));
  ok("a store that matches is not listed", !/finance_state/.test(quiet));
  const loud = buildReport(facts({
    local: { finance_state: { a: 1, b: 2 } },
    cloud: { finance_state: { key: "finance_state", value: { a: 1 }, updated_at: T(11) } },
  }));
  ok("a store that disagrees is, even unwatched", /finance_state/.test(loud));
}

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Sync check: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
