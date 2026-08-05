// ── Mode indicator — small, always-visible day-state mark ────────────
// A restrained glyph + one-word label on the today surface (never a banner).
// Tap it for the plain list of gates driving the current state. Drives a
// `data-mode` attribute the global stylesheet uses for the subtle palette
// treatment (God: faint gold warmth; Hell: a quiet darkening; Normal: none).
// Urgency lives in individual locks, never here.
import { useEffect, useState } from "react";
import { AC2, T1, T2, T3, GL, BD, B1, B2, GR, AM } from "./designTokens.js";
import { useModeState } from "./useModeState.js";
import { MODE_META, godScore, scoreTier } from "./modes.js";
import { ModeTutorial } from "./ModeTutorial.jsx";

const TONE = {
  god: { fg: AC2, bd: `${AC2}55`, bg: `${AC2}12` },
  normal: { fg: T3, bd: BD, bg: GL },
  hell: { fg: "#9AA0A6", bd: "#3A3E44", bg: "rgba(30,32,36,0.6)" },
};
const DOT = { fail: AM, incomplete: T3, pass: GR };
const STATUS_WORD = { fail: "not met", incomplete: "pending", pass: "clean" };

export function ModeIndicator() {
  const { mode, result, statuses } = useModeState();
  const [open, setOpen] = useState(false);
  const [tut, setTut] = useState(null); // "god" | "hell"
  // Single-spectrum God score drives the badge; colour follows the score tier,
  // while the veil/detail below still use the discrete `mode`.
  const score = godScore(statuses);
  const tier = scoreTier(score);
  const meta = MODE_META[mode] || MODE_META.normal;
  const tone = TONE[tier] || TONE.normal;

  // Broadcast the state so the global stylesheet can apply the subtle veil.
  useEffect(() => {
    document.documentElement.setAttribute("data-mode", mode);
    return () => document.documentElement.removeAttribute("data-mode");
  }, [mode]);

  const ordered = [...statuses]
    .filter((s) => s.status !== "off")
    .sort((a, b) => {
      const rank = { fail: 0, incomplete: 1, pass: 2 };
      return rank[a.status] - rank[b.status];
    });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`God score ${score == null ? "not yet scored" : score + " percent"}. View detail.`}
        title={`God score${score == null ? "" : ` ${score}%`} — tap for detail`}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, border: `1px solid ${tone.bd}`, background: tone.bg, color: tone.fg, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}
      >
        <span style={{ fontSize: 12, lineHeight: 1 }}>{MODE_META[tier]?.glyph || meta.glyph}</span>
        {score == null ? (
          <span style={{ letterSpacing: 1 }}>GOD —</span>
        ) : (
          <>
            <span style={{ width: 30, height: 4, borderRadius: 2, background: `${tone.fg}22`, overflow: "hidden", flexShrink: 0 }}>
              <span style={{ display: "block", height: "100%", width: `${score}%`, background: tone.fg }} />
            </span>
            <span style={{ fontFamily: "monospace" }}>{score}%</span>
          </>
        )}
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 4100, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: B1, border: `1px solid ${BD}`, borderRadius: 16, padding: "18px 18px 16px", boxShadow: "0 18px 50px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
              <span style={{ fontSize: 15, color: tone.fg }}>{meta.glyph}</span>
              <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: 1, color: tone.fg }}>{meta.label}{score != null ? ` · ${score}%` : ""}</span>
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ marginLeft: "auto", background: "none", border: "none", color: T3, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ fontSize: 11.5, color: T3, lineHeight: 1.55, marginBottom: 13 }}>
              {mode === "god" && "Every active gate is clean. Nothing to do differently — this is a read-out, not a mode to perform for."}
              {mode === "normal" && "Some gates are still open or one has slipped. This is where most days live."}
              {mode === "hell" && "More than one gate is failing at once. Take the single most recoverable one — recovery is partial, never all-or-nothing."}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {ordered.map((s) => (
                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 2px", borderTop: `1px solid ${BD}` }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: DOT[s.status] || T3, flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: T1 }}>{s.label}</span>
                  <span style={{ marginLeft: "auto", fontSize: 10.5, color: DOT[s.status] || T3, textTransform: "uppercase", letterSpacing: 0.5 }}>{STATUS_WORD[s.status]}</span>
                </div>
              ))}
            </div>

            {result?.ambiguous && (
              <div style={{ marginTop: 11, fontSize: 10.5, color: T3, fontStyle: "italic", lineHeight: 1.5 }}>
                This day sits exactly on the boundary — recorded as the plainer state, flagged for review.
              </div>
            )}

            {mode !== "normal" && (
              <button onClick={() => setTut(mode)} style={{ marginTop: 14, width: "100%", padding: "9px", borderRadius: 10, border: `1px solid ${tone.bd}`, background: tone.bg, color: tone.fg, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                What {meta.label} mode means
              </button>
            )}
          </div>
        </div>
      )}

      {tut && <ModeTutorial which={tut} onClose={() => setTut(null)} />}
    </>
  );
}
