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

// ── Work that must not block the first frame ─────────────────────────
// All four of these used to run before createRoot().render(), so a person
// with three years of history paid for a migration scan, a store purge, an
// XP replay and a 60-day reconcile before seeing a single pixel. Every one
// of them is idempotent and none is needed to draw the app: they write
// through writeStore, which broadcasts, so any screen already mounted
// re-renders when their results land.
//
// installLinkSync stays synchronous and stays here — it only registers a
// hook, and a tap logged in the first second must still mirror.
installLinkSync();

function afterPaint(fn) {
  const run = () => { try { fn(); } catch { /* boot work is best-effort */ } };
  // Two frames, then idle: the first frame is React's commit, the second is
  // the browser actually painting it. requestIdleCallback alone can fire
  // before paint on a busy main thread, which is the case we are fixing.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 2000 });
    else setTimeout(run, 0);
  }));
}

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

// Gate 1 — Discipline merge. Purity days and journal entries become entries
// on an abstinence / journal habit, on their original dates. Idempotent: it
// plans against what's already there and writes only what's missing.
// Then: the dead-store purge, the pre-revamp XP carry-forward, and the
// linked-metric reverse pass (sleep hours and fluid recorded elsewhere
// becoming entries on the habits that stand for them, bounded to 60 days).
afterPaint(() => {
  try { runDisciplineMigration(writeStore); } catch { /* never block on a migration */ }
  try { purgeDeadStores(); } catch { /* nor on a cleanup */ }
  openLedgerWithHistory(writeStore).catch(() => { /* the ledger is idempotent */ });
  reconcileLinks().catch(() => { /* the hook is live either way */ });
  // Cloud sync: a no-op until a Supabase project is connected in Settings.
  initSync();
});

// Offline shell + home-screen install. Relative path keeps the scope correct
// on the GitHub Pages subpath; failures (e.g. file://) are non-fatal.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
