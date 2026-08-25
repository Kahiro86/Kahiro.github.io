import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ErrorBoundary } from "./shared/ErrorBoundary.jsx";
import { IdentityProvider } from "./shared/identity.jsx";
import { initSync } from "./shared/sync.js";
import { runDisciplineMigration } from "./modules/habits/migrateDiscipline.js";
import { purgeDeadStores } from "./shared/purgeDead.js";
import { openLedgerWithHistory } from "./shared/xp/openMigration.js";
import { installLinkSync, reconcileLinks } from "./modules/habits/linkSync.js";
import { writeStore } from "./shared/useStorageState.js";

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

// Gate 1 — Discipline merge. Purity days and journal entries become entries on
// an abstinence / journal habit, on their original dates. Idempotent: it plans
// against what's already there and writes only what's missing, so this is safe
// on every launch. The source stores are left untouched.
try { runDisciplineMigration(writeStore); } catch { /* never block boot on a migration */ }
try { purgeDeadStores(); } catch { /* nor on a cleanup */ }
// Carry the pre-revamp XP total forward before the first render reads the
// ledger. Async, but the ledger is idempotent — a render that beats it sees
// an unopened ledger and simply re-reads once this lands.
openLedgerWithHistory(writeStore).catch(() => { /* never block boot */ });

// Linked metrics. Register the habit-entry hook first, so anything logged
// from here on mirrors into its metric's store, then run the reverse pass:
// sleep hours and fluid already recorded elsewhere become entries on the
// habits that stand for them. Idempotent — it writes only the days that
// disagree — and bounded to the last 60 days so boot stays cheap.
installLinkSync();
reconcileLinks().catch(() => { /* the hook is live either way */ });

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
