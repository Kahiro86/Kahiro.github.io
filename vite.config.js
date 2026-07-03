import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative base so the build works whether GitHub Pages serves it from the
  // domain root or a project subpath (this repo deploys at /Kahiro.github.io/).
  base: "./",
});
