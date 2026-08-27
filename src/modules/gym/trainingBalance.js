// ── Training balance — what is getting worked, and what is not ───────
// §3 asks Body to say what is being neglected and where progression has
// stalled. The catalog gained a discipline axis (strength · calisthenics ·
// plyometric · hiit · liit · hybrid · mobility · stretching · recovery), and
// this is the first thing that reads it back: a month of sessions, split by
// what kind of training they actually were.
//
// It reports SETS, not sessions. A session tagged "Push" that contained one
// mobility set and nineteen bench sets is not a mobility day, and counting it
// as one is how a balance report ends up flattering.
//
// Pure. Takes sessions and resolves each set's exercise through the registry.
import { localDateStr } from "../../shared/dates.js";
import { getExercise, DISCIPLINES } from "./engine.js";

const arr = (x) => (Array.isArray(x) ? x.filter(Boolean) : []);

const back = (today, n) => {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() - n);
  return localDateStr(d);
};

/**
 * Sets and days per discipline over a window.
 *   [{ id, label, sets, days, share, lastOn }]
 * `share` is of all sets in the window. `lastOn` is the most recent day it
 * appeared, or null — which is what makes "neglected" answerable rather than
 * merely "zero".
 */
export function trainingBalance({ sessions, today = localDateStr(), days = 30 } = {}) {
  const from = back(today, days - 1);
  const byId = new Map(DISCIPLINES.map((d) => [d.id, { id: d.id, label: d.label, sets: 0, days: new Set(), lastOn: null }]));

  for (const s of arr(sessions)) {
    const date = String(s.date || "").slice(0, 10);
    if (!date || date < from || date > today) continue;
    // A session stores entries of sets; older shapes store a flat set list.
    const sets = s.entries ? arr(s.entries).flatMap((e) => arr(e.sets).map((x) => ({ ...x, exerciseId: e.exerciseId }))) : arr(s.sets);
    for (const set of sets) {
      const ex = set.exerciseId ? getExercise(set.exerciseId) : null;
      if (!ex) continue;
      const row = byId.get(ex.discipline);
      if (!row) continue;
      row.sets += 1;
      row.days.add(date);
      if (!row.lastOn || date > row.lastOn) row.lastOn = date;
    }
  }

  const rows = [...byId.values()].map((r) => ({ ...r, days: r.days.size }));
  const total = rows.reduce((s, r) => s + r.sets, 0);
  return {
    days,
    totalSets: total,
    rows: rows
      .map((r) => ({ ...r, share: total > 0 ? Math.round((r.sets / total) * 100) : 0 }))
      .sort((a, b) => b.sets - a.sets),
  };
}

/**
 * What is missing, said plainly. Only speaks when there is enough training in
 * the window to have an opinion — with three sets logged all month, every
 * discipline is "neglected" and none of it means anything.
 */
export const MIN_SETS_FOR_BALANCE = 20;

export function balanceFindings(balance) {
  if (!balance || balance.totalSets < MIN_SETS_FOR_BALANCE) return [];
  const out = [];
  const by = Object.fromEntries(balance.rows.map((r) => [r.id, r]));

  // The two that hold a body together and are the first to be dropped.
  for (const id of ["mobility", "stretching"]) {
    const r = by[id];
    if (r && r.sets === 0) {
      out.push({ id: `missing:${id}`, text: `No ${r.label.toLowerCase()} logged in ${balance.days} days.`, weight: 70 });
    }
  }

  const strength = (by.strength?.sets || 0) + (by.calisthenics?.sets || 0);
  const conditioning = (by.hiit?.sets || 0) + (by.liit?.sets || 0);
  if (strength > 0 && conditioning === 0) {
    out.push({ id: "missing:conditioning", text: `All strength, no conditioning — nothing logged as HIIT or LIIT this month.`, weight: 55 });
  }

  // Something that used to appear and has stopped.
  for (const r of balance.rows) {
    if (r.sets === 0 || !r.lastOn) continue;
    const gap = Math.round((new Date(`${localDateStr()}T12:00:00`) - new Date(`${r.lastOn}T12:00:00`)) / 86400000);
    if (gap >= 14) out.push({ id: `stalled:${r.id}`, text: `${r.label} has not appeared in ${gap} days.`, weight: 50 });
  }

  return out.sort((a, b) => b.weight - a.weight).slice(0, 3);
}
