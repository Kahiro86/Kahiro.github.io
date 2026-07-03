import { AlertTriangle } from "lucide-react";
import { GL, BD, T2, T3, GR, CY, AM, RE } from "../../shared/designTokens.js";

export function RiskMeter({ rp, ra }) {
  const p = Math.min(+rp, 5);
  const col = p <= 0.5 ? GR : p <= 1 ? CY : p <= 2 ? AM : RE;
  return (
    <div style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 12, padding: "12px 15px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
        <span style={{ fontSize: 10, color: T3, letterSpacing: 1, textTransform: "uppercase" }}>Risk Exposure</span>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: col, fontFamily: "monospace" }}>{rp}%</span>
          <span style={{ fontSize: 13, color: T2, fontFamily: "monospace" }}>${(ra || 0).toLocaleString()}</span>
        </div>
      </div>
      <div style={{ height: 7, background: BD, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(p / 5) * 100}%`, background: `linear-gradient(90deg,${col}88,${col})`, borderRadius: 4, transition: "width 0.4s ease", boxShadow: `0 0 8px ${col}66` }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 9.5, color: T3 }}>
        <span>0%</span><span>Safe ≤1%</span><span>⚠ 2%</span><span>🔴 5%</span>
      </div>
      {+rp > 1 && (
        <div style={{ marginTop: 9, padding: "7px 10px", background: `${RE}11`, border: `1px solid ${RE}33`, borderRadius: 8, fontSize: 11, color: RE, display: "flex", gap: 6, alignItems: "center" }}>
          <AlertTriangle size={11} />Risk exceeds 1% — reduce size or widen target
        </div>
      )}
    </div>
  );
}
