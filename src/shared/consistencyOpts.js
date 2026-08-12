// ── Consistency predicate — one definition of "a day that counts" ────
// Every consistency view (Command Center, Journey) must agree on which days
// count toward the streak and rate, so this builds the single isFull predicate
// they both hand to consistencyStats. A day counts when:
//   · it's a marked rest or cheat day — a planned day off is not a gap: it
//     counts as done and never breaks the streak or drags the rate.
//   · it's a protected (frozen) streak-insurance day.
//   · otherwise: a genuine action happened in BOTH Life and Athlete that day.
//     A bare app-open (the auto login) no longer qualifies — showing up means
//     doing something real in each domain, not just launching the app.
// `lifeDays`/`fitnessDays` come from the XP engine (login excluded). When they
// aren't supplied the predicate returns undefined, so consistencyStats falls
// back to its old "any activity that day" rule.
import { frozenSet } from "./streakInsurance.js";

export function consistencyOpts({ habits = [], marks = {}, freezes = null, lifeDays = null, fitnessDays = null } = {}) {
  const safe = new Set([...(marks?.rest || []), ...(marks?.cheat || [])]);
  const frozen = frozenSet(freezes);
  const haveDomains = lifeDays instanceof Set && fitnessDays instanceof Set;
  const isFull = (d) => {
    if (safe.has(d) || frozen.has(d)) return true;        // rest/cheat/protected → always a day done
    if (haveDomains) return lifeDays.has(d) && fitnessDays.has(d); // real action in BOTH domains
    return undefined;                                     // no domain data → engine falls back to anyXp
  };
  return { isFull };
}
