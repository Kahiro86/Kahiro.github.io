// ── God Mode indicator — one continuous score, always visible ────────
// A small badge showing today's God Mode score (0–100). Tap it for the
// gate-by-gate detail: what's holding, what's down, and exactly how much each
// miss costs the score. One score, one colour logic (gold intensity scales
// with the number), one tutorial. No shame language — rigorous, not harsh.
import { useState, useEffect } from "react";
import { AC2, T1, T2, T3, GL, BD, B1, GR, AM } from "./designTokens.js";
import { useModeState } from "./useModeState.js";
import { TIER_META, GATE_LABEL, scoreColor } from "./modes.js";
import { ModeTutorial } from "./ModeTutorial.jsx";

const DOT = { fail: AM, incomplete: T3, pass: GR };
const STATUS_WORD = { fail: "not met", incomplete: "pending", pass: "held" };

export function ModeIndicator() {
  const { score, tier, weekAvg, impacts, statuses } = useModeState();
  const [open, setOpen] = useState(false);
  const [tut, setTut] = useState(false);
  const col = scoreColor(score);
  const meta = tier ? TIER_META[tier] : null;

  // Broadcast the score tier so the global stylesheet can apply the faint
  // gold warmth on a full-structure day (one-directional, never a darkening).
  // Set-only (no unmount cleanup): this renders in two places, and the
  // always-mounted header instance keeps the attribute correct.
  useEffect(() => {
    if (tier) document.documentElement.setAttribute("data-mode", tier);
    else document.documentElement.removeAttribute("data-mode");
  }, [tier]);

  // Not-passed gates first (with the biggest cost on top), then the held ones.
  const active = statuses.filter((s) => s.status !== "off");
  const ordered = [...active].sort((a, b) => {
    const rank = { fail: 0, incomplete: 1, pass: 2 };
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return (impacts[b.key] || 0) - (impacts[a.key] || 0);
  });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`God Mode score ${score == null ? "not yet scored" : score + " percent"}. View detail.`}
        title={`God Mode${score == null ? "" : ` ${score}%`} — tap for detail`}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, border: `1px solid ${score == null ? BD : col + "66"}`, background: score == null ? GL : `${col}14`, color: score == null ? T3 : col, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}
      >
        <span style={{ fontSize: 12, lineHeight: 1 }}>◆</span>
        {score == null ? (
          <span style={{ letterSpacing: 1 }}>GOD —</span>
        ) : (
          <>
            <span style={{ width: 30, height: 4, borderRadius: 2, background: `${col}33`, overflow: "hidden", flexShrink: 0 }}>
              <span style={{ display: "block", height: "100%", width: `${score}%`, background: col }} />
            </span>
            <span style={{ fontFamily: "monospace" }}>{score}%</span>
          </>
        )}
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 4100, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: B1, border: `1px solid ${BD}`, borderRadius: 16, padding: "18px 18px 16px", boxShadow: "0 18px 50px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 15, color: col }}>◆</span>
              <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: 0.5, color: T1 }}>God Mode</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: col, fontFamily: "'JetBrains Mono',monospace", marginLeft: 2 }}>{score == null ? "—" : `${score}%`}</span>
              {meta && <span style={{ fontSize: 10, color: T3, letterSpacing: 1, textTransform: "uppercase" }}>{meta.label}</span>}
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ marginLeft: "auto", background: "none", border: "none", color: T3, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>

            {weekAvg != null && (
              <div style={{ fontSize: 11.5, color: T2, marginBottom: 12 }}>
                <b style={{ color: T1, fontFamily: "monospace" }}>{weekAvg}%</b> over the last 7 days — one clean day doesn&apos;t overwrite the week.
              </div>
            )}
            <div style={{ fontSize: 11.5, color: T3, lineHeight: 1.55, marginBottom: 13 }}>
              {score == null && "No gate is active yet today — set your structures and the score begins."}
              {tier === "full" && "Every structure that matters is held. This is a full-structure day — nothing to perform for, just a read-out."}
              {tier === "partial" && "Most of the day is held; some gates are still open or one slipped. Honest middle ground, not a clean day."}
              {tier === "low" && "Several gates are down at once. Take the single most recoverable one — recovery is partial, never all-or-nothing."}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {ordered.map((s) => {
                const cost = impacts[s.key] || 0;
                const held = s.status === "pass";
                return (
                  <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 2px", borderTop: `1px solid ${BD}` }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: DOT[s.status] || T3, flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, color: T1 }}>{GATE_LABEL[s.key] || s.label}</span>
                    <span style={{ marginLeft: "auto", fontSize: 10.5, color: DOT[s.status] || T3, textTransform: "uppercase", letterSpacing: 0.5 }}>{STATUS_WORD[s.status]}</span>
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: held ? GR : AM, minWidth: 42, textAlign: "right" }}>{held ? `+${cost}%` : `−${cost}%`}</span>
                  </div>
                );
              })}
            </div>

            <button onClick={() => setTut(true)} style={{ marginTop: 14, width: "100%", padding: "9px", borderRadius: 10, border: `1px solid ${AC2}44`, background: `${AC2}12`, color: AC2, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              What God Mode means
            </button>
          </div>
        </div>
      )}

      {tut && <ModeTutorial onClose={() => setTut(false)} />}
    </>
  );
}
