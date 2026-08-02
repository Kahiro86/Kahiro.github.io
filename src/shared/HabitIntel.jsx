// ── Habit Intelligence — read your own patterns ──────────────────────
// For each active habit: an 8-week completion rate, a weekday heat strip, and
// an evidence-based nudge about your strongest/weakest day. Read-only over the
// existing habit log. Opened from the command palette. Lazy.
import { useMemo } from "react";
import { X, Brain } from "lucide-react";
import { B1, B2, BD, BD2, T1, T2, T3, GL, AC2, GR, AM, RE } from "./designTokens.js";
import { localDateStr } from "./dates.js";
import { WD, weekdayStats, overallRate, suggestion } from "./habitInsights.js";

const rateColor = (r) => (r == null ? BD : r >= 80 ? GR : r >= 50 ? AM : RE);

export function HabitIntel({ onClose, habits = [] }) {
  const ds = localDateStr();
  const rows = useMemo(() => {
    const active = (Array.isArray(habits) ? habits : []).filter((h) => h && !h.archived && !h.paused);
    // Only habits with some scheduling history are worth analysing.
    return active
      .map((h) => ({ h, rate: overallRate(h), wd: weekdayStats(h), tip: suggestion(h) }))
      .filter((r) => r.rate != null);
  }, [habits, ds]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 4200, background: "rgba(0,0,0,0.66)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "7vh 16px 24px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 500, background: B1, border: `1px solid ${BD2}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: `1px solid ${BD}` }}>
          <Brain size={18} color={AC2} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T1 }}>Habit Intelligence</div>
            <div style={{ fontSize: 11, color: T3 }}>Your last 8 weeks, by the numbers</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={17} /></button>
        </div>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.length === 0 && (
            <div style={{ padding: "26px 8px", textAlign: "center", color: T3, fontSize: 13 }}>Not enough habit history yet. Keep logging — patterns appear within a couple of weeks.</div>
          )}
          {rows.map(({ h, rate, wd, tip }) => (
            <div key={h.id} style={{ background: B2, border: `1px solid ${BD}`, borderRadius: 11, padding: "12px 13px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                <span style={{ fontSize: 15 }}>{h.icon}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: T1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</span>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: rateColor(rate), fontFamily: "monospace" }}>{rate}%</span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {wd.map((d) => (
                  <div key={d.w} style={{ flex: 1, textAlign: "center" }} title={d.scheduled ? `${d.name}: ${d.done}/${d.scheduled}` : `${d.name}: no data`}>
                    <div style={{ height: 22, borderRadius: 5, background: d.rate == null ? GL : `${rateColor(d.rate)}33`, border: `1px solid ${d.rate == null ? BD : rateColor(d.rate)}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: d.rate == null ? T3 : rateColor(d.rate) }}>
                      {d.rate == null ? "·" : d.rate}
                    </div>
                    <div style={{ fontSize: 8.5, color: T3, marginTop: 3 }}>{d.name[0]}</div>
                  </div>
                ))}
              </div>
              {tip && <div style={{ fontSize: 11, color: T2, marginTop: 9, lineHeight: 1.4 }}>💡 {tip}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
