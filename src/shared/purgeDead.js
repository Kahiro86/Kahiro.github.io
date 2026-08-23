// ── One-time cleanup of retired stores ───────────────────────────────
// Backups and sync enumerate every `architect:` key, so a store nothing reads
// still rides in every payload forever. These four were left inert when the
// features that owned them were removed.
//
// What is purged and what is not is a deliberate distinction:
//   · CONFIG remnants are purged. They are settings for features that no
//     longer exist — nobody can want them back, and they cannot be recreated
//     by hand because the UI that wrote them is gone.
//   · USER CONTENT is never purged, even when nothing reads it. `life_projects`
//     holds things the user typed. The module that displayed it was removed;
//     that is a reason to bring the data somewhere new, not to delete it.
//     It stays on disk and in backups until there is somewhere for it to go.
import { localDateStr } from "./dates.js";

const PREFIX = "architect:";
const DONE_KEY = "kahiro_purged_v1";

// Config for features that were removed outright.
export const DEAD_CONFIG_KEYS = [
  "mode_cfg",        // God Mode — removed at the user's request
  "mode_history",    // God Mode — removed at the user's request
  "nutrition_hard",  // God Mode's hard-mode nutrition targets
];

// Read by nothing, but authored by the user. Left alone on purpose.
export const ORPHANED_CONTENT_KEYS = ["life_projects"];

/**
 * Runs once, ever. Returns what it removed so the caller can report it.
 * Safe to call on every boot.
 */
export function purgeDeadStores() {
  try {
    if (localStorage.getItem(DONE_KEY)) return { ran: false, removed: [] };
  } catch { return { ran: false, removed: [] }; }

  const removed = [];
  for (const k of DEAD_CONFIG_KEYS) {
    try {
      if (localStorage.getItem(PREFIX + k) !== null) {
        localStorage.removeItem(PREFIX + k);
        removed.push(k);
      }
    } catch { /* a key that will not delete is not worth failing boot over */ }
  }
  try { localStorage.setItem(DONE_KEY, localDateStr()); } catch { /* best effort */ }
  return { ran: true, removed };
}
