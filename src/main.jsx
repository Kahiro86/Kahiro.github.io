import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ErrorBoundary } from "./shared/ErrorBoundary.jsx";
import { initSync } from "./shared/sync.js";

// Cloud sync engine: no-op until the user connects a Supabase project in
// Settings → Cloud Sync; from then on every device converges on the same data.
initSync();

// Top-level boundary: catches crashes in App's own body (state derivation,
// memoised selectors, storage reads) that run *outside* the per-module
// boundary — the difference between a recovery card and a blank white page.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

// Offline shell + home-screen install. Relative path keeps the scope correct
// on the GitHub Pages subpath; failures (e.g. file://) are non-fatal.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
