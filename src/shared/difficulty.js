// ── Difficulty — opt-in "Hell mode" hardcore rules ───────────────────
// One toggle that makes the system unforgiving, without ever rewriting
// history. Enabling snapshots the current level + total XP as an "anchor";
// from there three things get harder (see below). Disabling restores the
// normal rules. Nothing earned is ever deleted — the anchor guarantees the
// user never drops a level the instant they flip the switch.
//
//   1. Steeper level-up curve — XP earned *after* the anchor counts for
//      1/HELL_MULT toward new levels, so each new level costs HELL_MULT×
//      more. Everything up to the anchor is preserved exactly.
//   2. Unforgiving streaks + 3. All-or-nothing days — handled in
//      consistency.js via `isFullDay`: a day only counts when everything
//      scheduled is actually done (rest/cheat days stay streak-safe), so
//      the app-wide streak becomes "consecutive complete days" and one
//      unfinished day resets it.
import { useCallback } from "react";
import { useStorageState } from "./useStorageState.js";
import { isScheduled, isDone, isSkipped } from "./habitEngine.js";
import { hasRest, hasCheat } from "./dayMarks.js";

export const HELL_KEY = "hell_mode";
// Each level beyond the anchor costs this multiple of the normal XP.
export const HELL_MULT = 2.5;
export const DEFAULT_HELL = { on: false, since: null, anchorXp: 0, anchorLevel: 1 };

export function sanitizeHell(raw) {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const num = (v, min, dflt) => (Number.isFinite(+v) && +v >= min ? Math.floor(+v) : dflt);
  return {
    on: !!o.on,
    since: typeof o.since === "string" ? o.since : null,
    anchorXp: num(o.anchorXp, 0, 0),
    anchorLevel: num(o.anchorLevel, 1, 1),
  };
}

// Compress surplus XP (everything above the anchor) by HELL_MULT, so the
// level engine sees a smaller number and levelling slows down. XP at or
// below the anchor is untouched.
export function toEffectiveXp(total, hell) {
  const h = sanitizeHell(hell);
  if (!h.on || total <= h.anchorXp) return total;
  return h.anchorXp + (total - h.anchorXp) / HELL_MULT;
}

// Inverse of toEffectiveXp: map an effective-XP level threshold back to
// real earned XP, so "XP to next level" is shown in the XP the user
// actually earns.
export function toRealXp(eff, hell) {
  const h = sanitizeHell(hell);
  if (!h.on || eff <= h.anchorXp) return eff;
  return h.anchorXp + (eff - h.anchorXp) * HELL_MULT;
}

// Is `ds` a "full" day under Hell rules?
//   · a marked rest or cheat day is always full (the exception is deliberate)
//   · otherwise every scheduled, active habit must be done or skipped
//   · returns null when nothing is scheduled, so the caller can fall back
//     to the normal "any activity counts" rule for empty days.
export function isFullDay(habits, marks, ds) {
  if (hasRest(marks, ds) || hasCheat(marks, ds)) return true;
  const sched = (habits || []).filter((h) => h && !h.archived && !h.paused && isScheduled(h, ds));
  if (!sched.length) return null;
  return sched.every((h) => isDone(h, ds) || isSkipped(h, ds));
}

// Hook: the Hell config plus non-destructive enable/disable. `enable` takes
// the current total XP and level so the anchor is stamped from live state.
export function useHell() {
  const [raw, setRaw, loaded] = useStorageState(HELL_KEY, DEFAULT_HELL);
  const hell = sanitizeHell(raw);
  const enable = useCallback((total, level) => setRaw({
    on: true, since: new Date().toISOString(),
    anchorXp: Math.max(0, Math.floor(total || 0)),
    anchorLevel: Math.max(1, Math.floor(level || 1)),
  }), [setRaw]);
  const disable = useCallback(() => setRaw((p) => ({ ...sanitizeHell(p), on: false })), [setRaw]);
  return { hell, loaded, enable, disable };
}
