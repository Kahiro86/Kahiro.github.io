// ── Nutrition God Mode — structure replacing willpower ──────────────
// A strict, opt-in mode for the nutrition tracker. The rules here are
// enforced, not advisory: floors matter as much as ceilings, logging is
// time-bound, closed days lock, and the escapes (turn it off, lower a floor,
// skip a meal to make room) are deliberately blocked or delayed. Friction is
// the point — every guard below exists so a rough evening can't quietly
// rewrite the day's standard.
//
// Pure functions + a tiny config store (nutrition_hard). No day is ever
// graded until the practice is on and the date is in force. Framing is
// neutral by contract: a failed day reports one cause and nothing else.
import { localDateStr, daysAgoStr } from "../../shared/dates.js";
import { dayTotals, calcTargets } from "./nutrition.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const tomorrowStr = (ds = localDateStr()) => {
  const [y, m, d] = ds.split("-").map(Number);
  return localDateStr(new Date(y, m - 1, d + 1));
};

export const DEFAULT_HARD = {
  enabled: false,
  offFrom: null,          // date the practice switches OFF (tomorrow) — stays on until then
  proteinFloor: 0,        // g; 0 = derive from targets
  kcalFloor: 0,           // kcal; 0 = derive (90% of target)
  kcalCeil: 0,            // kcal; 0 = derive (110% of target)
  logWindowMin: 20,       // an item logged >N min after eating is "late"
  postShiftRequired: true,
  sugaredCap: 2,          // sugared beverages/day; cap disables one-tap, not manual
  pending: null,          // { proteinFloor, kcalFloor, kcalCeil, from } — threshold edit staged for a future day
  tutorialSeen: false,
  updatedAt: null,
};

export function sanitizeHard(raw) {
  const p = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const nn = (v, d) => (Number.isFinite(+v) && +v >= 0 ? Math.round(+v) : d);
  const pend = p.pending && typeof p.pending === "object" && DATE_RE.test(p.pending.from) ? {
    proteinFloor: nn(p.pending.proteinFloor, 0), kcalFloor: nn(p.pending.kcalFloor, 0),
    kcalCeil: nn(p.pending.kcalCeil, 0), from: p.pending.from,
  } : null;
  return {
    enabled: !!p.enabled,
    offFrom: DATE_RE.test(p.offFrom) ? p.offFrom : null,
    proteinFloor: nn(p.proteinFloor, 0),
    kcalFloor: nn(p.kcalFloor, 0),
    kcalCeil: nn(p.kcalCeil, 0),
    logWindowMin: Number.isFinite(+p.logWindowMin) && +p.logWindowMin >= 1 ? Math.round(+p.logWindowMin) : 20,
    postShiftRequired: p.postShiftRequired !== false,
    sugaredCap: nn(p.sugaredCap, 2),
    pending: pend,
    tutorialSeen: !!p.tutorialSeen,
    updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : null,
  };
}

// Is the practice enforced on `ds`? Enabled, past any pending off-date.
export const hardActiveOn = (cfg, ds = localDateStr()) =>
  !!cfg.enabled && (!cfg.offFrom || ds < cfg.offFrom);

// The floors/ceiling in force on `ds`. A staged threshold edit only takes
// hold from its `from` date — never mid-day.
export function effectiveFloors(cfg, profile, ds = localDateStr(), floorAdjust = null) {
  const t = calcTargets(profile);
  let src = cfg;
  if (cfg.pending && ds >= cfg.pending.from) src = { ...cfg, ...cfg.pending };
  const pMult = floorAdjust?.proteinFloorMult ?? 1;
  const kMult = floorAdjust?.kcalFloorMult ?? 1;
  return {
    proteinFloor: Math.round((src.proteinFloor || t.p) * pMult),
    kcalFloor: Math.round((src.kcalFloor || Math.round(t.kcal * 0.9)) * kMult),
    kcalCeil: src.kcalCeil || Math.round(t.kcal * 1.1),
  };
}

// An entry is "late" when it was logged more than the window past the meal
// time it claims. Only meaningful once loggedAt was captured (new entries).
export function isLate(entry, windowMin = 20) {
  if (!entry || typeof entry.loggedAt !== "number" || !entry.time) return false;
  const [h, m] = entry.time.split(":").map(Number);
  if (!Number.isFinite(h)) return false;
  const logged = new Date(entry.loggedAt);
  const meal = new Date(logged.getFullYear(), logged.getMonth(), logged.getDate(), h, m);
  return Math.abs(logged - meal) > windowMin * 60000;
}

export const isSugaredBev = (e) => !!(e && e.bev && (e.sugared || (Array.isArray(e.tags) && e.tags.includes("SUGAR"))));

// The whole verdict for one day. Neutral: `failReason` is a single line.
export function evalDay(entries, cfg, profile, ds = localDateStr(), floorAdjust = null) {
  const list = Array.isArray(entries) ? entries : [];
  const floors = effectiveFloors(cfg, profile, ds, floorAdjust);
  const totals = dayTotals(list);
  const lateItems = list.filter((e) => isLate(e, cfg.logWindowMin));
  const sugaredCount = list.filter(isSugaredBev).length;
  const postShiftLogged = list.some((e) => e.slot === "dinner");

  const proteinMet = totals.p >= floors.proteinFloor;
  const overFloor = totals.kcal >= floors.kcalFloor;
  const underCeil = totals.kcal <= floors.kcalCeil;
  const postShiftOk = !cfg.postShiftRequired || postShiftLogged;

  // Completion gate: floors first, then the ceiling and the post-shift meal.
  const canComplete = proteinMet && overFloor && underCeil && postShiftOk;
  const clean = canComplete && lateItems.length === 0 && sugaredCount <= cfg.sugaredCap;

  let failReason = null;
  if (!proteinMet) failReason = `Protein floor not met — ${Math.round(totals.p)}g of ${floors.proteinFloor}g.`;
  else if (!overFloor) failReason = `Under the calorie floor — ${Math.round(totals.kcal)} of ${floors.kcalFloor} kcal.`;
  else if (!underCeil) failReason = `Over the calorie ceiling — ${Math.round(totals.kcal)} of ${floors.kcalCeil} kcal.`;
  else if (!postShiftOk) failReason = "Post-shift meal not logged yet.";

  return {
    floors, totals, proteinMet, overFloor, underCeil, postShiftOk, postShiftLogged,
    lateItems, sugaredCount, capReached: sugaredCount >= cfg.sugaredCap,
    canComplete, clean, failReason,
  };
}

// A day is closed (no retroactive editing) once it is in the past while the
// practice was enforced. Today is always editable.
export const isDayClosed = (cfg, ds, today = localDateStr()) => hardActiveOn(cfg, ds) && ds < today;

// One-tap sugared-bev logging is blocked at the cap; manual entry still works.
export const oneTapSugaredBlocked = (cfg, entries, ds = localDateStr()) =>
  hardActiveOn(cfg, ds) && (Array.isArray(entries) ? entries.filter(isSugaredBev).length : 0) >= cfg.sugaredCap;

// ── Prohibited actions — return { ok, reason } ──────────────────────
// Turning the practice OFF only takes effect tomorrow.
export function disableHard(cfg, today = localDateStr()) {
  return { ...sanitizeHard(cfg), offFrom: tomorrowStr(today), updatedAt: new Date().toISOString() };
}
export function enableHard(cfg, today = localDateStr()) {
  return { ...sanitizeHard(cfg), enabled: true, offFrom: null, updatedAt: new Date().toISOString() };
}

// Threshold edits apply from the next day, never mid-day. Lowering a floor
// on the same day you ran a surplus is blocked outright — you cannot rebase
// the standard to absorb an overshoot.
export function proposeFloors(cfg, next, dayEval, today = localDateStr()) {
  const c = sanitizeHard(cfg);
  const cur = { proteinFloor: c.proteinFloor || dayEval.floors.proteinFloor, kcalFloor: c.kcalFloor || dayEval.floors.kcalFloor, kcalCeil: c.kcalCeil || dayEval.floors.kcalCeil };
  const loweringFloor = (+next.proteinFloor > 0 && +next.proteinFloor < cur.proteinFloor) ||
                        (+next.kcalFloor > 0 && +next.kcalFloor < cur.kcalFloor);
  const surplusToday = dayEval.totals.kcal > dayEval.floors.kcalCeil;
  if (loweringFloor && surplusToday) {
    return { ok: false, reason: "You ran a surplus today — a floor can't be lowered to absorb it. Raise it, or leave it and let tomorrow stand on its own." };
  }
  const from = tomorrowStr(today);
  return {
    ok: true,
    cfg: { ...c, pending: {
      proteinFloor: Math.max(0, Math.round(+next.proteinFloor || 0)),
      kcalFloor: Math.max(0, Math.round(+next.kcalFloor || 0)),
      kcalCeil: Math.max(0, Math.round(+next.kcalCeil || 0)),
      from,
    }, updatedAt: new Date().toISOString() },
    from,
  };
}

// Low-appetite path for the mandatory post-shift meal: never a skip button,
// always a softer, calorie-dense alternative.
export const LOW_APPETITE_OPTIONS = [
  "A glass of whole milk + a scoop of peanut butter (~350 kcal, liquid-easy).",
  "Greek yoghurt blended with banana and honey (~300 kcal, soft).",
  "A mug of warm milk with oats and a spoon of nut butter (~320 kcal).",
  "A protein shake with olive oil stirred in (~400 kcal, drink slowly).",
];
