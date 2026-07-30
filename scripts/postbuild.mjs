// Vite builds from index.dev.html, so its HTML output is dist/index.dev.html.
// Rename that to dist/index.html — the entry GitHub Pages serves (deploy.yml
// uploads the whole ./dist folder, including ./dist/assets/*, as the Pages
// artifact). The app is now code-split, so it is NOT a single self-contained
// file: it must be served over HTTP with its /assets/ chunks alongside, so
// there is no longer a portable repo-root copy to make.
import { renameSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const built = resolve(root, "dist/index.dev.html");
const distIndex = resolve(root, "dist/index.html");

if (!existsSync(built)) {
  console.error("postbuild: expected dist/index.dev.html, not found");
  process.exit(1);
}
renameSync(built, distIndex);
console.log("postbuild: dist/index.html ready (code-split; served with ./assets/)");
