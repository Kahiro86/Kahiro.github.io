// Runs the vendored habit-tracker pure-logic tests under Node. esbuild
// bundles each *.test.ts with `vitest` aliased to our shim, and rewrites the
// original repo's import paths onto Kaizen's vendored copies:
//   ../../src/logic/<x>.js  → src/modules/habits/logic/<x>.ts
//   ../../src/db/types.js   → src/modules/habits/logic/dbTypes.ts
//   ../../src/db/dates.js   → src/modules/habits/logic/dbDates.ts
// This is exactly the resolution Vite performs at build time (bare/.js →
// .ts via resolve.extensions), so a green run here proves the vendored
// domain still computes the same scores, streaks, calendars and validations
// it did in its own repo. Only Layer 2 (pure) tests are ported; the Layer 1
// SQLite tests were replaced by localDb.js and its own smoke test.
import { build } from "esbuild";
import { readdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, basename, resolve } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const shim = join(here, "_shim.mjs");
const logicDir = resolve(here, "..", "..", "src", "modules", "habits", "logic");
const testFiles = readdirSync(here).filter((f) => f.endsWith(".test.ts")).sort();
const outDir = mkdtempSync(join(tmpdir(), "habittest-"));

const aliasVendored = {
  name: "alias-vendored",
  setup(b) {
    b.onResolve({ filter: /^vitest$/ }, () => ({ path: shim, external: true }));
    // Original repo paths → Kaizen's vendored logic. db/types→dbTypes,
    // db/dates→dbDates; every logic/<x> maps to the same basename .ts.
    b.onResolve({ filter: /src\/(logic|db)\// }, (args) => {
      const m = args.path.match(/src\/(?:logic|db)\/([^/]+)\.js$/);
      if (!m) return null;
      let name = m[1];
      if (name === "types") name = "dbTypes";
      else if (args.path.includes("/db/") && name === "dates") name = "dbDates";
      else if (args.path.includes("/db/") && name === "errors") name = "errors";
      return { path: join(logicDir, name + ".ts") };
    });
  },
};

for (const file of testFiles) {
  const result = await build({
    entryPoints: [join(here, file)],
    bundle: true, format: "esm", platform: "node", write: false,
    logLevel: "silent", plugins: [aliasVendored],
  });
  const outPath = join(outDir, basename(file, ".ts") + ".mjs");
  writeFileSync(outPath, result.outputFiles[0].text);
  await import(pathToFileURL(outPath).href);
}

const { __finish } = await import(pathToFileURL(shim).href);
const summary = await __finish();
const total = summary.passed + summary.failed;
if (summary.failed > 0) {
  console.log(`\nFAILURES (${summary.failed}):`);
  for (const f of summary.failures) console.log(`  ✗ ${f.name}\n      ${f.error?.message ?? f.error}`);
}
console.log(`\nHabit domain tests: ${summary.passed}/${total} passed across ${testFiles.length} files`);
process.exit(summary.failed > 0 ? 1 : 0);
