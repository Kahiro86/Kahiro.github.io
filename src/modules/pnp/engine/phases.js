// ── Session phases ───────────────────────────────────────────────────
// The fourteen windows of the trading day, plus Custom.
//
// Two deliberate departures from the Notion table this is seeded from:
//
// 1. Start/End are **minutes since midnight**, not text. Notion stores
//    "10:00" as a string, which is why it cannot auto-assign a phase to a
//    trade — you cannot compare strings by time. Numbers can, so the phase
//    is derived from the entry time and never typed.
//
// 2. Phases are anchored to their session's **real open**, not to a wall
//    clock. The Notion table's own warning: "These assume London and New
//    York are on summer time. From early November to mid-March both shift
//    one hour later in your clock. Edit the Settings rows twice a year."
//    Anchoring instead means a trade logged in January is assigned
//    correctly with nothing to remember. You still edit a phase — you edit
//    its offset from the session open, which is what the phase actually
//    is.
import { SAMPLE_NONE } from "./constants.js";

/** Local zone the times are displayed in. EAT has no DST of its own. */
export const DISPLAY_TZ = "EAT (UTC+3)";
const EAT_OFFSET = 3;

/**
 * Session opens, in each market's own standard time and its UTC offsets.
 * `dstOffset` applies during that market's summer time.
 */
export const SESSIONS = {
  Asian: { open: 9 * 60, stdOffset: 9, dstOffset: 9, label: "Tokyo 09:00 JST" },      // Japan has no DST
  London: { open: 8 * 60, stdOffset: 0, dstOffset: 1, label: "London 08:00 UK" },
  "New York": { open: 9 * 60 + 30, stdOffset: -5, dstOffset: -4, label: "NY 09:30 ET" },
  Other: { open: 0, stdOffset: EAT_OFFSET, dstOffset: EAT_OFFSET, label: "—" },
};

const mod1440 = (m) => ((m % 1440) + 1440) % 1440;
export const toMin = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
  return m ? mod1440(+m[1] * 60 + +m[2]) : null;
};
export const toHHMM = (mins) => {
  const m = mod1440(Math.round(mins));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

// ── Daylight saving ──────────────────────────────────────────────────
const lastSunday = (y, monthIdx) => {
  const d = new Date(Date.UTC(y, monthIdx + 1, 0));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
};
const nthSunday = (y, monthIdx, n) => {
  const d = new Date(Date.UTC(y, monthIdx, 1));
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7) + (n - 1) * 7);
  return d;
};

/** EU summer time: last Sunday in March → last Sunday in October. */
export function isEuDst(ds) {
  const d = new Date(`${ds}T12:00:00Z`);
  const y = d.getUTCFullYear();
  return d >= lastSunday(y, 2) && d < lastSunday(y, 9);
}

/** US daylight time: 2nd Sunday in March → 1st Sunday in November. */
export function isUsDst(ds) {
  const d = new Date(`${ds}T12:00:00Z`);
  const y = d.getUTCFullYear();
  return d >= nthSunday(y, 2, 2) && d < nthSunday(y, 10, 1);
}

/** How far this session's open sits from midnight EAT, on this date. */
export function sessionOpenEat(sessionName, ds) {
  const s = SESSIONS[sessionName] || SESSIONS.Other;
  const dst = sessionName === "London" ? isEuDst(ds) : sessionName === "New York" ? isUsDst(ds) : false;
  const offset = dst ? s.dstOffset : s.stdOffset;
  return mod1440(s.open + (EAT_OFFSET - offset) * 60);
}

// ── The seeded table ─────────────────────────────────────────────────
// `startOffset`/`endOffset` are minutes from the session's open. They were
// derived from the Notion table's summer-time clock values, which is the
// clock those descriptions were written against.
const SEED = [
  ["A1", "Asian", 0, 60, "Selective", "Tokyo open. First real expansion after the New York close drift. Often sets the high or low of the Asian range."],
  ["A2", "Asian", 60, 180, "Avoid", "Asian range builds out. Low volatility, tight ranges, liquidity pools forming on both sides."],
  ["A3", "Asian", 180, 300, "Avoid", "Late Asia. Range completes. Occasional false break that gets reclaimed before London."],
  ["A4", "Asian", 300, 420, "Selective", "Asian close into London pre-market. Frankfurt opens 09:00 EAT and volume starts arriving."],
  ["L1", "London", 0, 60, "Yes", "London open. The judas swing window — the first move frequently sweeps Asian range liquidity and reverses."],
  ["L2", "London", 60, 120, "Yes", "London expansion. The real directional leg usually develops here after L1 has taken liquidity."],
  ["L3", "London", 120, 180, "Yes", "Continuation of the London leg, or the first meaningful pullback into an imbalance."],
  ["L4", "London", 180, 240, "Avoid", "London lunch. Volume drains, ranges tighten, chop punishes continuation entries."],
  ["L5", "London", 240, 330, "Selective", "Pre-New-York drift. Positioning ahead of US data. Can trend quietly or fake out entirely."],
  ["NY1", "New York", -60, 0, "Selective", "US pre-market and the high-impact data window. CPI, NFP and jobless claims land at 15:30 EAT."],
  ["NY2", "New York", 0, 60, "Yes", "New York cash open. Second major manipulation window of the day, often reversing the London leg."],
  ["NY3", "New York", 60, 150, "Yes", "New York AM expansion. The day's high or low is frequently set in this window."],
  ["NY4", "New York", 150, 270, "Avoid", "New York lunch into early afternoon. Consolidation, reduced follow-through."],
  ["NY5", "New York", 270, 390, "Selective", "New York PM into the close. Late reversals, position squaring, thinning liquidity."],
];

export const TRADEABLE = ["Yes", "Selective", "Avoid"];

export function seedPhases() {
  const rows = SEED.map(([phase, session, startOffset, endOffset, tradeable, behaviour], i) => ({
    id: `ph_${phase.toLowerCase()}`,
    phase, session, startOffset, endOffset,
    order: i + 1, tradeable, behaviour, notes: "",
  }));
  rows.push({
    id: "ph_custom", phase: "Custom", session: "Other",
    startOffset: null, endOffset: null, order: 99, tradeable: "Selective",
    behaviour: "Anything outside the defined windows.", notes: "",
  });
  return rows;
}

export function sanitizePhases(raw) {
  if (!Array.isArray(raw)) return seedPhases();
  const int = (v) => (Number.isFinite(+v) ? Math.round(+v) : null);
  const out = raw
    .filter((p) => p && typeof p === "object" && p.id && typeof p.phase === "string")
    .map((p) => ({
      id: String(p.id),
      phase: String(p.phase).slice(0, 20),
      session: SESSIONS[p.session] ? p.session : "Other",
      startOffset: int(p.startOffset),
      endOffset: int(p.endOffset),
      order: Number.isFinite(+p.order) ? +p.order : 50,
      tradeable: TRADEABLE.includes(p.tradeable) ? p.tradeable : "Selective",
      behaviour: String(p.behaviour || "").slice(0, 400),
      notes: String(p.notes || "").slice(0, 400),
    }))
    .sort((a, b) => a.order - b.order);
  return out.length ? out : seedPhases();
}

/** A phase's actual clock window in EAT, on a given date. DST-aware. */
export function phaseWindow(phase, ds) {
  if (phase.startOffset == null || phase.endOffset == null) return null;
  const open = sessionOpenEat(phase.session, ds);
  return {
    start: mod1440(open + phase.startOffset),
    end: mod1440(open + phase.endOffset),
  };
}

export const phaseWindowLabel = (phase, ds) => {
  const w = phaseWindow(phase, ds);
  return w ? `${toHHMM(w.start)} – ${toHHMM(w.end)}` : "—";
};

/**
 * Which phase a trade fell in, from its entry time.
 *
 * Wrap-around aware, because the Asian session starts before midnight in
 * some offsets. A time in no defined window returns the Custom phase
 * rather than null — "outside the windows" is itself a finding, and the
 * spec keeps a bucket for it.
 */
export function phaseForTime(phases, time, ds) {
  const mins = toMin(time);
  if (mins == null) return null;
  for (const p of phases) {
    const w = phaseWindow(p, ds);
    if (!w) continue;
    const inside = w.start <= w.end
      ? mins >= w.start && mins < w.end
      : mins >= w.start || mins < w.end;
    if (inside) return p.id;
  }
  return phases.find((p) => p.phase === "Custom")?.id || null;
}

/** Assign a phase to any trade that has an entry time but no phase yet. */
export const withAutoPhase = (trade, phases) =>
  trade.phaseId ? trade : { ...trade, phaseId: phaseForTime(phases, trade.time, trade.date) || "" };

export { SAMPLE_NONE };
