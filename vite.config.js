import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";

// Route-level code splitting: each module is a lazy chunk (see App.jsx's
// React.lazy imports), so nothing but the shell + the landing module loads
// on first paint. Heavy vendors (charts, supabase, react) are pinned to
// named chunks for stable long-term caching. `base: "./"` keeps asset URLs
// relative so the build deploys at the domain root or any subpath.
//
// NOTE: dropping vite-plugin-singlefile means the app now loads /assets/*.js
// chunks — it must be served over HTTP (GitHub Pages; the harness's local
// server), not opened as a bare file:// (module imports are CORS-blocked
// there). Deploy uses the CI-built ./dist artifact (see deploy.yml).
export default defineConfig({
  plugins: [react()],
  base: "./",
  // The habit module's database runs in a Web Worker built as an ES
  // module, and @sqlite.org/sqlite-wasm must not be pre-bundled — esbuild
  // rewrites the import.meta.url the package uses to locate its .wasm.
  //
  // No COOP/COEP headers, deliberately: the database uses the OPFS
  // access-handle pool VFS, which needs neither SharedArrayBuffer nor
  // cross-origin isolation. Adding them in dev would give the dev server
  // a capability GitHub Pages cannot grant, hiding a regression until it
  // reached the host.
  optimizeDeps: { exclude: ["@sqlite.org/sqlite-wasm"] },
  worker: { format: "es" },
  build: {
    rollupOptions: {
      // Two pages from one build. habits.html is the habit tracker on its
      // own — the same component the Kahiro tab mounts, with a root
      // around it — and it is what the habit acceptance suites drive.
      input: {
        app: resolve(__dirname, "index.dev.html"),
        habits: resolve(__dirname, "habits.html"),
        pnp: resolve(__dirname, "pnp.html"),
      },
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("recharts") || id.includes("d3-") || id.includes("victory") || id.includes("internmap")) return "vendor-charts";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) return "vendor-react";
        },
      },
    },
  },
});
