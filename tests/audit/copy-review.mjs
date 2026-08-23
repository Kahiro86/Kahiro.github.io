// Criterion 34 — no copy in the app uses loss-framing or guilt.
//
// This app contains an abstinence tracker. Its purpose is to reduce
// compulsive behaviour, so "you're about to lose 47 days!" is not merely
// tacky here — it is the exact mechanic the app exists to fight (§4.0).
//
// A one-time read-through does not stay done. This sweeps every user-visible
// string literal in src/ on each run, so a nudge added next month is held to
// the same rule.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) { if (e !== "logic" && e !== "domain") walk(p); }
    else if (/\.(jsx?|tsx?)$/.test(e)) files.push(p);
  }
})(join(root, "src"));

// Patterns that constitute loss-framing or guilt in copy aimed at the user.
const BANNED = [
  { re: /\babout to lose\b/i, why: "loss-framing — states what will be taken away" },
  { re: /\bdon'?t lose\b/i, why: "loss-framing" },
  { re: /\byou'?(re|ve)? (failed|failing)\b/i, why: "tells the user they failed" },
  { re: /\b(streak|run) (is )?(on the line|at risk|about to break|dying|dead)\b/i, why: "threatens a streak" },
  { re: /\bkeeps? (it|them|your \w+) alive\b/i, why: "implies death if the user stops" },
  { re: /\byou'?re \d+ \w+ behind\b/i, why: "frames the user as behind rather than what remains" },
  { re: /\b(lazy|pathetic|weak-willed|no excuses?|shameful|disgrace)\b/i, why: "insult" },
  { re: /\bshould have\b/i, why: "retrospective blame" },
  { re: /\byou (blew|wasted|ruined|threw away)\b/i, why: "blame" },
  { re: /\bdisappoint(ed|ing)\b/i, why: "guilt" },
  { re: /\bdon'?t break\b/i, why: "loss-framing" },
];

// Strings that are plainly not user copy.
const NOT_COPY = /^(?:[a-z0-9_$-]+|[A-Z_]+|https?:\/\/|\/|\.\/|#|[\d\s.,:%+-]*|[a-z-]+\/[a-z-]+|(?:[a-zA-Z-]+ )*[a-zA-Z-]+\(\))$/;

let pass = 0, fail = 0; const findings = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };

let scanned = 0;
for (const f of files) {
  const rel = f.slice(root.length + 1).replace(/\\/g, "/");
  const src = readFileSync(f, "utf8");
  // Comments explain the rules and quote the banned phrases to forbid them.
  const code = src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l.trim())).join("\n");
  // Match within a single line only. A multi-line match glues unrelated
  // statements together and reads `lazy(() => import(...))` as prose.
  const lits = [];
  for (const line of code.split("\n")) {
    for (const re of [/"([^"\\\n]{6,})"/g, /'([^'\\\n]{6,})'/g, /`([^`\n]{6,})`/g]) {
      for (const m of line.matchAll(re)) lits.push(m[1]);
    }
  }
  const copy = lits.filter((l) => !NOT_COPY.test(l.trim()));
  scanned += copy.length;
  for (const lit of copy) {
    for (const b of BANNED) {
      if (b.re.test(lit)) findings.push({ rel, lit: lit.trim().slice(0, 90), why: b.why });
    }
  }
}

console.log(`\n── swept ${scanned} user-visible literals across ${files.length} files ──`);
ok(`no loss-framing or guilt in app copy${findings.length ? ` (${findings.length} found)` : ""}`, findings.length === 0);
for (const f of findings) console.log(`     ${f.rel}\n       "${f.lit}"\n       → ${f.why}`);

// The reward layer's own rules must be stated, not implied (§5.1).
const streak = readFileSync(join(root, "src/shared/streakInsurance.js"), "utf8");
const streakUi = readFileSync(join(root, "src/shared/StreakInsurance.jsx"), "utf8");
console.log("\n── criterion 33: tokens accrue at a stated rate and cap at 3 ──");
ok("one token per 14 active days", /DAYS_PER_TOKEN = 14/.test(streak));
ok("held tokens cap at 3", /MAX_HELD_TOKENS = 3/.test(streak));
ok("the cap is enforced, not just declared", /Math\.min\(MAX_HELD_TOKENS/.test(streak));
ok("the rate and ceiling are both stated on screen", /DAYS_PER_TOKEN\}/.test(streakUi) && /MAX_HELD_TOKENS\}/.test(streakUi));
ok("distance to the next token is shown", /daysToNextToken/.test(streakUi));

console.log("");
if (fail) console.log(`FAILURES: ${fail}`);
console.log(`Copy review: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
