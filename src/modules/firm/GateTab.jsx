// ── Gate — the scaling proof ─────────────────────────────────────────
// The one gate that governs the whole fleet: three consecutive clean
// withdrawal months on Account #1 before Account #2 exists. Clean = a written
// monthly review with zero checklist breaches AND a withdrawal that month.
// A month that isn't clean doesn't cost one month — it resets the count,
// because the fleet grows on proof and is never "won back."
import { useMemo } from "react";
import { Target, Check, X, AlertTriangle, ChevronRight } from "lucide-react";
import { BD, T1, T2, T3, GL, B2, AC, GR, AM, RE } from "../../shared/designTokens.js";
import { Card } from "../../shared/ui.jsx";
import { scalingGate } from "../../shared/firm.js";

const Label = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 700, color: T3, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>{children}</div>
);

// Why a given month isn't clean, in the manual's own terms.
const monthReason = (m) => {
  if (m.clean) return "Clean";
  if (!m.reviewed) return "No monthly review written";
  if (m.adherence !== 100) return `Checklist breach (${m.adherence ?? 0}% adherence)`;
  if (!m.withdrew) return "No withdrawal recorded";
  return "Incomplete";
};

export function GateTab({ trades, reviews, withdrawals }) {
  const gate = useMemo(() => scalingGate(trades, reviews, withdrawals), [trades, reviews, withdrawals]);

  return (
    <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 980 }}>
      {/* Headline */}
      <Card style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Target size={15} color={AC} />
          <Label>Current Gate</Label>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: T1 }}>Three clean withdrawal months</div>
        <div style={{ fontSize: 12, color: T2, marginTop: 4, marginBottom: 14 }}>
          Account #1 must post a withdrawal with zero rule breaches, three months running, before Account #2 unlocks.
        </div>

        {/* Month cells */}
        <div style={{ display: "flex", gap: 8 }}>
          {gate.months.map((m) => (
            <div key={m.ym} title={`${m.label} — ${monthReason(m)}`}
              style={{ flex: 1, borderRadius: 10, padding: "12px 6px", textAlign: "center", background: m.clean ? `${GR}14` : B2, border: `1px solid ${m.clean ? GR + "55" : BD}` }}>
              {m.clean
                ? <Check size={18} color={GR} />
                : <X size={16} color={m.reviewed && m.adherence !== 100 ? RE : T3} />}
              <div style={{ fontSize: 9.5, color: T3, marginTop: 6, fontFamily: "monospace" }}>{m.label.split(" ")[0]}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
          <span style={{ fontSize: 12, color: T2 }}>Progress</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 900, fontSize: 16, color: gate.met ? GR : AM }}>{gate.have} / {gate.need}</span>
        </div>
        {gate.met && (
          <div style={{ marginTop: 10, padding: "10px 12px", background: `${GR}14`, border: `1px solid ${GR}44`, borderRadius: 10, fontSize: 12.5, color: T1, display: "flex", alignItems: "center", gap: 8 }}>
            <Check size={15} color={GR} /> Gate passed. Account #2 is ready to fund from the fleet fund.
          </div>
        )}
      </Card>

      {/* Reset explanation */}
      {!gate.met && gate.resetAt && (
        <Card style={{ padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <AlertTriangle size={16} color={gate.resetAt.reviewed && gate.resetAt.adherence !== 100 ? RE : AM} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 12.5, color: T1 }}>
              {gate.resetAt.reviewed && gate.resetAt.adherence !== 100
                ? `${gate.resetAt.label} broke the count.`
                : `The count is waiting on ${gate.resetAt.label}.`}
            </div>
            <div style={{ fontSize: 10.5, color: T3, marginTop: 3 }}>
              {monthReason(gate.resetAt)}. A breach resets the count to zero — the fleet grows on proof, never on the calendar, and a lost gate is never won back with a rebuy.
            </div>
          </div>
        </Card>
      )}

      {/* The anti-rule */}
      <Card style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ fontSize: 12, color: T2 }}>Log this month's review in Trading OS</span>
        </div>
        <ChevronRight size={15} color={T3} />
      </Card>
    </div>
  );
}
