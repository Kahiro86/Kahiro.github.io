// Vite builds from index.dev.html, so its output is dist/index.dev.html.
// Rename that to dist/index.html (what GitHub Pages serves via the Actions
// artifact) and also copy it to the repo-root index.html so the site still
// works when Pages is set to "Deploy from a branch" and serves the repo root.
import { renameSync, copyFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const built = resolve(root, "dist/index.dev.html");
const distIndex = resolve(root, "dist/index.html");
const rootIndex = resolve(root, "index.html");

if (!existsSync(built)) {
  console.error("postbuild: expected dist/index.dev.html, not found");
  process.exit(1);
}
renameSync(built, distIndex);
copyFileSync(distIndex, rootIndex);
console.log("postbuild: dist/index.html written and copied to repo-root index.html");
