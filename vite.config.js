import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// The Vite HTML entry lives in `index.dev.html` (not `index.html`) so the
// build can write its self-contained output to the repo-root `index.html`
// without clobbering its own source template. The build script in
// package.json renames dist/index.dev.html -> dist/index.html afterwards.
export default defineConfig({
  // Inline JS/CSS into a single self-contained HTML file so the deployed page
  // has no separate /assets/ requests — it renders at the domain root or any
  // project subpath and can't go blank from a base-path mismatch.
  plugins: [react(), viteSingleFile()],
  base: "./",
  build: {
    rollupOptions: {
      input: resolve(__dirname, "index.dev.html"),
    },
  },
});
