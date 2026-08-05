// ── Consistency predicate — one definition of "a day that counts" ────
// Every consistency view (Command Center, Journey) must agree on which days
// count toward the streak and rate, so this builds the single isFull predicate
// they both hand to consistencyStats. A day counts when:
//   · it's a marked rest or cheat day — a planned day off is not a gap: it
//     counts as done and never breaks the streak or drags the rate.
//   · it's a protected (frozen) streak-insurance day.
// Anything else returns undefined, so consistencyStats falls back to its normal
// "any activity that day" check.
import { frozenSet } from "./streakInsurance.js";

export function consistencyOpts({ habits = [], marks = {}, freezes = null } = {}) {
  const safe = new Set([...(marks?.rest || []), ...(marks?.cheat || [])]);
  const frozen = frozenSet(freezes);
  const isFull = (d) => {
    if (safe.has(d) || frozen.has(d)) return true; // rest/cheat/protected → always a day done
    return undefined;                              // undefined → engine falls back to anyXp
  };
  return { isFull };
}
