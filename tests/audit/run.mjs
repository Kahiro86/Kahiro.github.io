// One command for the audit suite. Splits it in two, because the two halves
// have very different costs and failure modes:
//
//   pure     ~20 node-only checks, seconds each. Run these constantly.
//   browser  Playwright against dist/, minutes each. Needs a real build.
//
// A pure audit that crashes is a FAILURE, not a skip: two dead scripts sat
// in this directory for weeks crashing on every run while "the audits pass"
// kept being said out loud, because nobody checked the exit codes.
import { readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");

// These drive a real browser against dist/ and are minutes, not seconds.
const BROWSER = new Set([
  "dashboard-trim", "quick-log", "record-merge", "linked-sync",
  "meal-plans-ui", "exercise-picker", "launch-perf", "console-clean", "empty-state",
]);

const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const wantBrowser = process.argv.includes("--browser") || process.argv.includes("--all");
const wantPure = !process.argv.includes("--browser") || process.argv.includes("--all");

const all = readdirSync(here)
  .filter((f) => f.endsWith(".mjs") && f !== "run.mjs")
  .map((f) => f.replace(/\.mjs$/, ""))
  .sort();

const chosen = all.filter((n) => {
  if (only.length) return only.includes(n);
  return BROWSER.has(n) ? wantBrowser : wantPure;
});

if (!chosen.length) {
  console.log("Nothing to run. Names:", all.join(", "));
  process.exit(1);
}

const run = (name) => new Promise((res) => {
  const started = Date.now();
  const p = spawn(process.execPath, [join(here, `${name}.mjs`)], {
    cwd: root,
    env: { ...process.env, PLAYWRIGHT_CHROMIUM_PATH: process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" },
  });
  let out = "";
  p.stdout.on("data", (d) => { out += d; });
  p.stderr.on("data", (d) => { out += d; });
  p.on("close", (code) => res({ name, code, out, ms: Date.now() - started }));
});

const results = [];
for (const name of chosen) {
  const r = await run(name);
  results.push(r);
  // The last line each audit prints is its own tally; show that, not 60 ticks.
  const summary = r.out.trim().split("\n").filter((l) => l.trim()).pop() || "(no output)";
  const mark = r.code === 0 ? "✓" : "✗";
  console.log(`${mark} ${name.padEnd(24)} ${String(r.ms).padStart(6)}ms  ${summary.slice(0, 90)}`);
  if (r.code !== 0) {
    for (const line of r.out.trim().split("\n").filter((l) => /✗|FAILURES|Error|error/.test(l)).slice(0, 8)) {
      console.log(`    ${line.trim()}`);
    }
  }
}

const failed = results.filter((r) => r.code !== 0);
const total = results.reduce((s, r) => s + r.ms, 0);
console.log("");
console.log(`${results.length - failed.length}/${results.length} audits passed in ${(total / 1000).toFixed(1)}s`);
if (failed.length) {
  console.log(`FAILED: ${failed.map((f) => f.name).join(", ")}`);
  process.exit(1);
}
