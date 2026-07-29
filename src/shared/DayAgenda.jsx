// ── Today · This Week — one glance across every daily domain ─────────
// An additive Command-Center panel: a row per domain (habits, nutrition,
// workout, journal, bills…) with a done/due/empty dot and a tap that jumps
// into that module, plus a 7-day activity strip. It renders only data the
// dashboard already holds — no new stores, no new plumbing.
import { Card } from "./ui.jsx";
import { CalendarDays, ChevronRight } from "lucide-react";
import { BD, T1, T2, T3, GL, GR, AM, AC } from "./designTokens.js";

const DOT = { done: GR, due: AM, empty: T3 };

export function DayAgenda({ items = [], week = [], onNavigate }) {
  return (
    <Card style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        <CalendarDays size={13} color={AC} />
        <span style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: AC, fontWeight: 700 }}>Today · This Week</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((it) => (
          <button key={it.key} onClick={() => it.nav && onNavigate?.(it.nav)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", background: "transparent", border: "none", borderRadius: 9, cursor: it.nav ? "pointer" : "default", textAlign: "left", fontFamily: "inherit", width: "100%" }}
            onMouseEnter={(e) => { if (it.nav) e.currentTarget.style.background = GL; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: DOT[it.state] || T3, flexShrink: 0 }} />
            <span style={{ fontSize: 14 }}>{it.icon}</span>
            <span style={{ flex: 1, fontSize: 13, color: T1, fontWeight: 500 }}>{it.label}</span>
            <span style={{ fontSize: 11.5, color: it.state === "done" ? GR : it.state === "due" ? AM : T3 }}>{it.detail}</span>
            {it.nav && <ChevronRight size={13} color={T3} style={{ flexShrink: 0 }} />}
          </button>
        ))}
      </div>

      {week.length > 0 && (
        <div style={{ marginTop: 13, paddingTop: 13, borderTop: `1px solid ${BD}` }}>
          <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: T3, marginBottom: 8 }}>Last 7 days</div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
            {week.map((d) => (
              <div key={d.ds} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flex: 1 }}>
                <div title={d.ds} style={{ width: "100%", maxWidth: 34, height: 26, borderRadius: 7, background: d.active ? `${GR}26` : GL, border: `1px solid ${d.today ? AC : d.active ? GR + "66" : BD}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {d.active && <span style={{ width: 6, height: 6, borderRadius: "50%", background: GR }} />}
                </div>
                <span style={{ fontSize: 9, color: d.today ? AC : T3, fontWeight: d.today ? 700 : 400 }}>{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
