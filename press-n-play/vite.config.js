import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base: "./"` keeps asset URLs relative, so the same build works at a
// domain root, at /press-n-play/ on GitHub Pages, or opened from a
// subfolder on any static host.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // Recharts and its d3 dependencies are most of the bundle and
          // change rarely — a named chunk keeps them cached across deploys.
          if (id.includes("recharts") || id.includes("d3-") || id.includes("victory") || id.includes("internmap")) return "vendor-charts";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) return "vendor-react";
        },
      },
    },
  },
});
