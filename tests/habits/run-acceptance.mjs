// Runs the habit module's eight browser suites against the built app.
//
// They need three things standing at once — a static host serving ./dist
// the way GitHub Pages will, a PostgREST-shaped fake for the sync engine,
// and a Chromium — and eight separate invocations of each would be eight
// chances to forget one. Starting them here also means the exit code is
// the honest sum: one failing test in one suite fails the run.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const PORT = process.env.SERVE_PORT || "5199";
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}/habits.html`;

const SUITES = [
  "layer1", "layer1-extended", "layer2", "layer2b",
  "storage", "sync", "editor", "backup",
];

if (!existsSync(resolve(ROOT, "dist/habits.html"))) {
  console.error("dist/habits.html is missing — run `npm run build` first.");
  process.exit(1);
}

const children = [];
function background(script) {
  const child = spawn(process.execPath, [resolve(HERE, script)], {
    cwd: ROOT,
    stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, SERVE_PORT: PORT },
  });
  children.push(child);
  return child;
}

function run(script) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [resolve(HERE, script)], {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, BASE_URL },
    });
    child.on("exit", (code) => done(code ?? 1));
  });
}

/** Polls rather than sleeping: a fixed wait is either slow or flaky. */
async function waitFor(url, what) {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch { /* not listening yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${what} never came up at ${url}`);
}

background("serve-dist.mjs");
background("fake-supabase.mjs");

const failures = [];
try {
  await waitFor(`http://localhost:${PORT}/habits.html`, "the static host");
  await waitFor("http://localhost:5299/__control", "the fake Supabase");

  for (const suite of SUITES) {
    console.log(`\n── ${suite} ${"─".repeat(Math.max(0, 60 - suite.length))}`);
    if ((await run(`acceptance/${suite}.mjs`)) !== 0) failures.push(suite);
  }
} finally {
  for (const child of children) child.kill();
}

if (failures.length) {
  console.error(`\n${failures.length} suite(s) failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log(`\nAll ${SUITES.length} habit acceptance suites passed.`);
