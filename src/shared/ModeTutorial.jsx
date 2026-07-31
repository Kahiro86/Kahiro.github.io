// ── Mode tutorials — God & Hell ──────────────────────────────────────
// Plain, neutral, factual. No shame language anywhere — Hell's especially is
// the screen most likely to be read on an actually bad day. Reachable from
// the state detail view and from Settings. Serif, in keeping with the app's
// solemn identity.
import { SERIF } from "./designTokens.js";

const BROWN0 = "#140d05", BROWN1 = "#1d1408", BROWN2 = "#271a0b";
const GOLD = "#E7C775", GOLD_DIM = "rgba(231,199,117,0.6)";
const PARCH = "#EBDFC4", PARCH_DIM = "rgba(235,223,196,0.62)";
const LINE = "rgba(231,199,117,0.16)";

const GOD = [
  ["What it is", "Every gate clean at once. Not a reward, not a prize — a description of a day where the structure held. It is a read-out, nothing more."],
  ["What it isn't", "Not a streak to protect at all costs. Not a licence to add volume or risk because “today's going well.” A good state is never a reason to break a rule — not one more trade past the cap because you're “reading the market well,” not one exception anywhere. The rules don't bend for a good day."],
  ["What to do", "Nothing different. Change nothing about how you act. God Mode is a read-out, not a mode to perform for. The moment you start trading to keep the label, the label has cost you something."],
  ["How it ends", "A single missed gate reverts to Normal that same day. No grace, no “one exception.” That is the point — the state is only ever as honest as the day."],
];

const HELL = [
  ["What it is", "Multiple gates failing together. A description of a bad day — not a punishment, not a verdict on you. Days like this happen; the state just names it plainly."],
  ["What it isn't", "Not a signal to abandon the day. “Already ruined it, might as well” is the trap. It isn't true: one more violation on a bad day is still one more violation, never free. The day is not a write-off."],
  ["What to do", "Take the single lowest-effort recovery available. Hit the one gate most within reach right now — log the missed meal even if it's late and flagged, complete one checklist item. Recovery is partial and incremental. You are not trying to fix the whole day; you are trying to make the next hour count."],
  ["How it ends", "The same way it began — gate by gate. No reset button, no “start fresh.” The day closes as it closes. Tomorrow is a new evaluation, not this day carried forward. Nothing is held against you."],
];

export function ModeTutorial({ which = "god", onClose }) {
  const rows = which === "hell" ? HELL : GOD;
  const title = which === "hell" ? "Hell Mode" : "God Mode";
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 4200, background: `radial-gradient(120% 90% at 50% 0%, ${BROWN2} 0%, ${BROWN1} 45%, ${BROWN0} 100%)`, fontFamily: SERIF, color: PARCH, overflowY: "auto" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "clamp(28px,6vw,64px) clamp(22px,6vw,36px) 90px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
          <span style={{ fontSize: 13, letterSpacing: 3, textTransform: "uppercase", color: GOLD_DIM }}>{title}</span>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: GOLD_DIM, fontFamily: SERIF, fontSize: 22, lineHeight: 1, cursor: "pointer" }}>✕</button>
        </div>
        {rows.map(([h, body], i) => (
          <div key={h} style={{ marginBottom: 26, paddingBottom: 22, borderBottom: i < rows.length - 1 ? `1px solid ${LINE}` : "none" }}>
            <div style={{ fontSize: 12.5, letterSpacing: 1.5, textTransform: "uppercase", color: GOLD, marginBottom: 9 }}>{h}</div>
            <div style={{ fontSize: 17, lineHeight: 1.75, color: PARCH_DIM }}>{body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
