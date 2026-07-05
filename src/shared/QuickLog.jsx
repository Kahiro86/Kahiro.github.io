// Floating quick-log: complete any of today's habits from anywhere in the
// app with one tap. The button itself is a live progress ring for the day.
import { useState } from "react";
import { Zap, Check, X } from "lucide-react";
import { B1, BD, BD2, T1, T2, T3, GL, CY, GR } from "./designTokens.js";
import { localDateStr } from "./dates.js";
import { isScheduled, isDone, isSkipped, valueOn } from "./habitEngine.js";

export function QuickLog({ habits, onTap, hidden, offsetRight = 24 }) {
  const [open, setOpen] = useState(false);
  const ds = localDateStr();
  const scheduled = habits.filter((h) => !h.archived && !h.paused && isScheduled(h, ds));
  if (hidden || !scheduled.length) return null;

  const done = scheduled.filter((h) => isDone(h, ds));
  const pct = Math.round((done.length / scheduled.length) * 100);
  const remaining = scheduled.filter((h) => !isDone(h, ds) && !isSkipped(h, ds));
  const size = 52, stroke = 3.5, r = (size - stroke) / 2, c = 2 * Math.PI * r;

  return (
    <>
      {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 88 }} />}
      {open && (
        <div style={{ position: "fixed", bottom: 86, right: offsetRight, width: "min(320px, calc(100vw - 32px))", maxHeight: "55vh", overflowY: "auto", background: B1, border: `1px solid ${BD2}`, borderRadius: 16, padding: "14px", zIndex: 89, boxShadow: "0 18px 60px rgba(0,0,0,0.6)", animation: "fadeIn 0.18s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 11 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: T1, letterSpacing: 0.5 }}>⚡ Quick Log · {done.length}/{scheduled.length} today</span>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={14} /></button>
          </div>
          {remaining.length === 0 ? (
            <div style={{ padding: "18px 10px", textAlign: "center", fontSize: 12.5, color: GR }}>⭐ Everything's done. Perfect day.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {remaining.map((h) => {
                const v = valueOn(h, ds), target = h.target || 1;
                return (
                  <button key={h.id} onClick={() => onTap(h.id)}
                    style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", background: GL, border: `1px solid ${BD}`, borderRadius: 10, cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%" }}>
                    <span style={{ fontSize: 15 }}>{h.icon}</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: T1 }}>{h.name}</span>
                    {target > 1
                      ? <span style={{ fontSize: 10.5, color: h.color, fontFamily: "monospace" }}>{v}/{target}{h.unit ? ` ${h.unit}` : ""} +1</span>
                      : <Check size={13} color={h.color} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <button onClick={() => setOpen((o) => !o)} title="Quick log habits" aria-label="Quick log habits"
        style={{ position: "fixed", bottom: 22, right: offsetRight, width: size, height: size, borderRadius: "50%", background: B1, border: `1px solid ${BD2}`, cursor: "pointer", zIndex: 89, boxShadow: "0 8px 28px rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
        <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BD} strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={pct === 100 ? GR : CY} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * c} ${c}`} style={{ transition: "stroke-dasharray 0.4s ease" }} />
        </svg>
        {pct === 100 ? <Check size={20} color={GR} /> : <Zap size={18} color={CY} />}
      </button>
    </>
  );
}
