// Runs the ported GymXP domain tests under Node. esbuild bundles each
// *.test.ts (resolving the `.js` import specifiers to the copied `.ts`
// domain files, exactly as Vite does at build time) with `vitest` aliased
// to our shim. Every test file is bundled and imported separately so the
// domain's module-level state (e.g. the compound registry) starts fresh per
// file — matching vitest's per-file isolation. The shim is kept external so
// its pass/fail tallies are shared across every bundle.
import { build } from "esbuild";
import { readdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, basename } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const shim = join(here, "_shim.mjs");
const testFiles = readdirSync(here).filter((f) => f.endsWith(".test.ts")).sort();
const outDir = mkdtempSync(join(tmpdir(), "gymtest-"));

const vitestAlias = {
  name: "vitest-alias",
  setup(b) {
    b.onResolve({ filter: /^vitest$/ }, () => ({ path: shim, external: true }));
  },
};

for (const file of testFiles) {
  const result = await build({
    entryPoints: [join(here, file)],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    logLevel: "silent",
    plugins: [vitestAlias],
  });
  const outPath = join(outDir, basename(file, ".ts") + ".mjs");
  writeFileSync(outPath, result.outputFiles[0].text);
  await import(pathToFileURL(outPath).href); // registers + runs its it() blocks
}

const { __finish } = await import(pathToFileURL(shim).href);
const summary = await __finish();

const total = summary.passed + summary.failed;
if (summary.failed > 0) {
  console.log(`\nFAILURES (${summary.failed}):`);
  for (const f of summary.failures) {
    console.log(`  ✗ ${f.name}\n      ${f.error?.message ?? f.error}`);
  }
}
console.log(`\nGym domain tests: ${summary.passed}/${total} passed across ${testFiles.length} files`);
process.exit(summary.failed > 0 ? 1 : 0);
