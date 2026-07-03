import { useState } from "react";
import { X, Check, AlertCircle } from "lucide-react";
import { B0, B1, BD, T1, T2, T3, GL, CY, PU, GR, RE } from "./designTokens.js";
import { getApiKey, setApiKey, callClaude } from "./anthropic.js";

export function SettingsPanel({ onClose }) {
  const [key, setKey] = useState(getApiKey());
  const [status, setStatus] = useState(null); // null | "testing" | "ok" | "error"
  const [errorMsg, setErrorMsg] = useState("");

  const save = () => {
    setApiKey(key.trim());
    setStatus(null);
  };

  const test = async () => {
    setApiKey(key.trim());
    setStatus("testing");
    setErrorMsg("");
    try {
      await callClaude({ system: "Reply with the single word: OK", messages: [{ role: "user", content: "ping" }], maxTokens: 5 });
      setStatus("ok");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message);
    }
  };

  const clear = () => {
    setApiKey("");
    setKey("");
    setStatus(null);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={onClose}>
      <div style={{ width: 420, background: B1, border: `1px solid ${BD}`, borderRadius: 16, padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T1 }}>Settings — Anthropic API Key</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={16} /></button>
        </div>
        <div style={{ fontSize: 12, color: T3, lineHeight: 1.6, marginBottom: 14 }}>
          Your key is stored only in this browser's local storage and calls go directly from your browser to Anthropic. It is never sent anywhere else.
        </div>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-ant-..."
          style={{ width: "100%", background: B0, border: `1px solid ${BD}`, borderRadius: 9, padding: "10px 13px", fontSize: 13, color: T1, outline: "none", fontFamily: "'JetBrains Mono',monospace", boxSizing: "border-box", marginBottom: 14 }}
        />
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button onClick={save} style={{ flex: 1, padding: "9px", background: `linear-gradient(135deg,${CY},${PU})`, border: "none", borderRadius: 9, color: "#000", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
          <button onClick={test} disabled={!key.trim() || status === "testing"} style={{ flex: 1, padding: "9px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, color: T2, fontSize: 12.5, cursor: key.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
            {status === "testing" ? "Testing…" : "Test Connection"}
          </button>
          <button onClick={clear} style={{ padding: "9px 14px", background: "none", border: `1px solid ${RE}44`, borderRadius: 9, color: RE, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Clear</button>
        </div>
        {status === "ok" && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: GR }}>
            <Check size={13} />Connection successful.
          </div>
        )}
        {status === "error" && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: RE }}>
            <AlertCircle size={13} />{errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}
