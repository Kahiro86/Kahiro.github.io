// ── Pre-trade checklist gate ─────────────────────────────────────────
// A real gate, not a nudge: "Log Trade" stays locked until every process
// rule is ticked. Shown when the owner starts a new trade with the checklist
// not yet cleared this session. The completed list is stored per-trade.
import { useState } from "react";
import { X, Check } from "lucide-react";
import { B1, B2, BD, T1, T2, T3, GL, GR, RE } from "../../../shared/designTokens.js";

export function PreTradeGate({ items, onProceed, onClose }) {
  const list = Array.isArray(items) && items.length ? items : [];
  const [checked, setChecked] = useState(() => list.map(() => false));
  const allDone = checked.length > 0 && checked.every(Boolean);
  const toggle = (i) => setChecked((c) => c.map((v, k) => (k === i ? !v : v)));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 92, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(520px,100%)", background: B1, border: `1px solid ${BD}`, borderRadius: 16, padding: "20px 22px", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: RE, fontWeight: 800 }}>Pre-trade gate</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={17} /></button>
        </div>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: T1 }}>Clear the process first</h2>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: T3, lineHeight: 1.5 }}>Logging stays locked until every rule is true. This isn&apos;t a reminder — it&apos;s the gate.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
          {list.map((it, i) => (
            <button key={i} onClick={() => toggle(i)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", background: checked[i] ? `${GR}12` : B2, border: `1px solid ${checked[i] ? GR + "55" : BD}`, borderRadius: 10, cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%" }}>
              <span style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${checked[i] ? GR : T3}`, background: checked[i] ? GR : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {checked[i] && <Check size={13} color="#04130a" />}
              </span>
              <span style={{ fontSize: 14, color: T1, lineHeight: 1.4 }}>{it}</span>
            </button>
          ))}
          {list.length === 0 && <div style={{ fontSize: 12.5, color: T3 }}>No checklist items configured — add your process rules in Settings.</div>}
        </div>
        <button onClick={() => allDone && onProceed(list)} disabled={!allDone}
          style={{ width: "100%", padding: "12px", background: allDone ? GR : GL, border: "none", borderRadius: 11, color: allDone ? "#04130a" : T3, fontSize: 14, fontWeight: 800, cursor: allDone ? "pointer" : "default", fontFamily: "inherit" }}>
          {allDone ? "Unlock — log the trade" : `Tick all ${list.length} to unlock`}
        </button>
      </div>
    </div>
  );
}
