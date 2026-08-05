// ── God Mode tutorial — one screen, plain and factual ────────────────
// God Mode is one continuous 0–100 score, not a state to win or a label to
// protect. No shame language — this is the screen most likely to be read on a
// hard day. Reachable from the score detail view and from Settings. Serif, in
// keeping with the app's solemn identity.
import { SERIF } from "./designTokens.js";

const BROWN0 = "#140d05", BROWN1 = "#1d1408", BROWN2 = "#271a0b";
const GOLD = "#E7C775", GOLD_DIM = "rgba(231,199,117,0.6)";
const PARCH = "#EBDFC4", PARCH_DIM = "rgba(235,223,196,0.62)";
const LINE = "rgba(231,199,117,0.16)";

const GOD = [
  ["What it is", "One score, 0 to 100, read from the gates that already run: your daily checklist, sleep, nutrition floors, trading cap and cooldown, your weekly focus and monthly overhead. Not a manual switch, not a mood — a plain measure of how much of the day's structure actually held."],
  ["How it's counted", "Each gate is met or it isn't — no partial credit for almost. Gates are weighted: sleep and trading discipline count for more than a recurring reminder. The score is the weighted share of gates held, so doing extra of an easy one can never paper over a real miss on a hard one."],
  ["Full vs partial", "A day at the top threshold is a full-structure day. Below it is honestly shown as partial — not folded in with a clean day. The number never rounds up to flatter you."],
  ["The week is the truth", "One clean day next to a shaky week isn't a clean week. The 7-day average sits beside today's score for exactly this reason — a single good day can't overwrite the pattern."],
  ["What it isn't", "Not a streak to protect at all costs, not a licence to add risk because “today's going well.” A good score is never a reason to break a rule — not one more trade past the cap. And a low score is never a write-off: close the one gate most within reach, and the next hour counts. Tomorrow is a fresh evaluation, never this day carried forward."],
];

export function ModeTutorial({ onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 4200, background: `radial-gradient(120% 90% at 50% 0%, ${BROWN2} 0%, ${BROWN1} 45%, ${BROWN0} 100%)`, fontFamily: SERIF, color: PARCH, overflowY: "auto" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "clamp(28px,6vw,64px) clamp(22px,6vw,36px) 90px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
          <span style={{ fontSize: 13, letterSpacing: 3, textTransform: "uppercase", color: GOLD_DIM }}>God Mode</span>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: GOLD_DIM, fontFamily: SERIF, fontSize: 22, lineHeight: 1, cursor: "pointer" }}>✕</button>
        </div>
        {GOD.map(([h, body], i) => (
          <div key={h} style={{ marginBottom: 26, paddingBottom: 22, borderBottom: i < GOD.length - 1 ? `1px solid ${LINE}` : "none" }}>
            <div style={{ fontSize: 12.5, letterSpacing: 1.5, textTransform: "uppercase", color: GOLD, marginBottom: 9 }}>{h}</div>
            <div style={{ fontSize: 17, lineHeight: 1.75, color: PARCH_DIM }}>{body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
