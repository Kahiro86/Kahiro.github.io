// ── Risk Calculator — position size from a fixed % risk ──────────────
// Type the account, the % you'll risk, and entry/stop; get the exact size and
// the reward:risk. Account + risk% persist for next time. Palette. Lazy.
import { useMemo, useState } from "react";
import { X, Calculator, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { B1, B2, BD, BD2, T1, T2, T3, GL, AC2, GR, RE } from "./designTokens.js";
import { useStorageState } from "./useStorageState.js";
import { computeRisk } from "./riskCalc.js";

export function RiskCalculator({ onClose }) {
  const [prefs, setPrefs] = useStorageState("risk_calc", { account: "", riskPct: "1" });
  const [account, setAccount] = useState(prefs.account ?? "");
  const [riskPct, setRiskPct] = useState(prefs.riskPct ?? "1");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");

  const r = useMemo(() => computeRisk({ account, riskPct, entry, stop, target }), [account, riskPct, entry, stop, target]);

  // Remember account + risk% for next time (not the per-trade prices).
  const persist = () => setPrefs({ account, riskPct });

  const field = { width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 12px", fontSize: 14, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const label = { fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, color: T3, marginBottom: 5 };
  const Out = ({ k, v, c = T1 }) => (
    <div style={{ background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "10px 12px" }}>
      <div style={{ fontSize: 9.5, color: T3, textTransform: "uppercase", letterSpacing: 0.6 }}>{k}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: c, marginTop: 3, fontFamily: "monospace" }}>{v}</div>
    </div>
  );

  const num = (v) => (v == null ? "—" : v.toLocaleString(undefined, { maximumFractionDigits: 4 }));

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 4200, background: "rgba(0,0,0,0.66)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "7vh 16px 24px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 440, background: B1, border: `1px solid ${BD2}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: `1px solid ${BD}` }}>
          <Calculator size={18} color={AC2} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T1 }}>Risk Calculator</div>
            <div style={{ fontSize: 11, color: T3 }}>Size the position, cap the loss</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={17} /></button>
        </div>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 2 }}><div style={label}>Account</div><input value={account} onChange={(e) => setAccount(e.target.value)} onBlur={persist} inputMode="decimal" placeholder="10000" style={field} /></div>
            <div style={{ flex: 1 }}><div style={label}>Risk %</div><input value={riskPct} onChange={(e) => setRiskPct(e.target.value)} onBlur={persist} inputMode="decimal" placeholder="1" style={field} /></div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><div style={label}>Entry</div><input value={entry} onChange={(e) => setEntry(e.target.value)} inputMode="decimal" placeholder="1.2500" style={field} /></div>
            <div style={{ flex: 1 }}><div style={label}>Stop</div><input value={stop} onChange={(e) => setStop(e.target.value)} inputMode="decimal" placeholder="1.2450" style={field} /></div>
            <div style={{ flex: 1 }}><div style={label}>Target</div><input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" placeholder="opt." style={field} /></div>
          </div>

          {r.dir && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: r.dir === "long" ? GR : RE }}>
              {r.dir === "long" ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />} {r.dir.toUpperCase()} setup
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Out k="Risk amount" v={r.valid ? num(r.riskAmount) : "—"} c={RE} />
            <Out k="Stop distance" v={r.valid ? num(r.stopDist) : "—"} />
            <Out k="Position size" v={r.valid ? num(r.size) : "—"} c={AC2} />
            <Out k="Reward : Risk" v={r.rr != null ? `${r.rr}R` : "—"} c={r.rr != null && r.rr >= 2 ? GR : T1} />
          </div>
          {r.reward != null && (
            <div style={{ fontSize: 11.5, color: T2, textAlign: "center" }}>Hitting target returns <span style={{ color: GR, fontWeight: 700 }}>{num(r.reward)}</span> for <span style={{ color: RE, fontWeight: 700 }}>{num(r.riskAmount)}</span> risked.</div>
          )}
          {!r.valid && <div style={{ fontSize: 11.5, color: T3, textAlign: "center" }}>Enter account, risk %, and a stop different from entry.</div>}
        </div>
      </div>
    </div>
  );
}
