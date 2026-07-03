import { CheckCircle, Lock, Check, AlertCircle, Shield } from "lucide-react";
import { GL, BD, BD2, T1, T2, T3, GR, AM, RE } from "../../shared/designTokens.js";
import { CHECKLIST } from "./constants.js";
import { suggestGrade } from "./helpers.js";

export function ChecklistGate({ values, onChange, submitted }) {
  const score = values.filter(Boolean).length;
  const all = score === 7;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 13 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T1 }}>Pre-Trade Checklist — ICT Protocol</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: T2 }}>{score}/7</span>
          {all
            ? <span style={{ display: "flex", alignItems: "center", gap: 5, color: GR, fontSize: 12, fontWeight: 700 }}><CheckCircle size={13} />GATE CLEARED</span>
            : <span style={{ display: "flex", alignItems: "center", gap: 5, color: AM, fontSize: 12, fontWeight: 700 }}><Lock size={12} />LOCKED</span>}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 13 }}>
        {CHECKLIST.map((item, i) => (
          <div
            key={i}
            onClick={() => { const n = [...values]; n[i] = !n[i]; onChange(n); }}
            style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 13px", background: values[i] ? `${GR}0D` : GL, border: `1px solid ${values[i] ? GR + "44" : BD}`, borderRadius: 10, cursor: "pointer", transition: "all 0.2s", userSelect: "none" }}
          >
            <div style={{ width: 20, height: 20, borderRadius: 6, background: values[i] ? `${GR}33` : GL, border: `2px solid ${values[i] ? GR : BD2}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
              {values[i] && <Check size={11} color={GR} />}
            </div>
            <span style={{ fontSize: 12.5, color: values[i] ? T1 : T2, lineHeight: 1.45 }}>{item}</span>
            <span style={{ marginLeft: "auto", fontSize: 10, color: T3 }}>#{i + 1}</span>
          </div>
        ))}
      </div>
      {!all && submitted && (
        <div style={{ padding: "10px 13px", background: `${RE}14`, border: `1px solid ${RE}44`, borderRadius: 10, display: "flex", gap: 9, alignItems: "center" }}>
          <AlertCircle size={14} color={RE} />
          <span style={{ fontSize: 13, color: RE }}>All 7 ICT criteria must be confirmed. Hard gate — no exceptions.</span>
        </div>
      )}
      {all && (
        <div style={{ padding: "10px 13px", background: `${GR}12`, border: `1px solid ${GR}33`, borderRadius: 10, display: "flex", gap: 9, alignItems: "center" }}>
          <Shield size={13} color={GR} />
          <span style={{ fontSize: 13, color: T2 }}>Full ICT criteria met. Suggested grade: <strong style={{ color: GR }}>{suggestGrade(score)}</strong></span>
        </div>
      )}
    </div>
  );
}
