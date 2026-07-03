import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  // Inline JS/CSS into a single self-contained index.html so the deployed
  // page has no separate /assets/ requests — it renders at the domain root
  // or any project subpath and can't go blank from a base-path mismatch.
  plugins: [react(), viteSingleFile()],
  base: "./",
});
