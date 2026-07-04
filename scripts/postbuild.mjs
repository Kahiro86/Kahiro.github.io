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

// PWA assets must also live at the repo root for branch-mode Pages serving.
const extras = ["manifest.webmanifest", "sw.js", "icon-192.png", "icon-512.png"];
for (const f of extras) {
  const src = resolve(root, "dist", f);
  if (existsSync(src)) copyFileSync(src, resolve(root, f));
}
console.log("postbuild: index.html + PWA assets copied to repo root");
