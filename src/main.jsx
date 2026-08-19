import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ErrorBoundary } from "./shared/ErrorBoundary.jsx";
import { IdentityProvider } from "./shared/identity.jsx";
import { initSync } from "./shared/sync.js";

// One-time cleanup: the habit tracker was removed, so wipe its stored data.
// Runs once per browser; nothing in the app reads habits/routines any more, so
// any cloud-synced copies are inert even if they re-appear.
try {
  if (!localStorage.getItem("kahiro_habits_removed")) {
    localStorage.removeItem("architect:habits");
    localStorage.removeItem("architect:routines");
    localStorage.setItem("kahiro_habits_removed", "1");
  }
} catch { /* storage best-effort */ }

// Cloud sync engine: no-op until the user connects a Supabase project in
// Settings → Cloud Sync; from then on every device converges on the same data.
initSync();

// Top-level boundary: catches crashes in App's own body (state derivation,
// memoised selectors, storage reads) that run *outside* the per-module
// boundary — the difference between a recovery card and a blank white page.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <IdentityProvider>
        <App />
      </IdentityProvider>
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
