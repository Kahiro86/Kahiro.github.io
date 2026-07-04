import { useRef, useState } from "react";
import { X, Check, AlertCircle, Download, Upload, ShieldAlert } from "lucide-react";
import { B0, B1, BD, T1, T2, T3, GL, CY, PU, GR, RE, AM } from "./designTokens.js";
import { getApiKey, setApiKey, callClaude } from "./anthropic.js";
import { storage } from "./storage.js";
import { localDateStr } from "./dates.js";

export function SettingsPanel({ onClose }) {
  const [key, setKey] = useState(getApiKey());
  const [status, setStatus] = useState(null); // null | "testing" | "ok" | "error"
  const [errorMsg, setErrorMsg] = useState("");
  const [dataMsg, setDataMsg] = useState(null); // { text, tone }
  const [armErase, setArmErase] = useState(false);
  const fileRef = useRef(null);

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

  // ── Data: everything lives in this browser, so backups matter ──────
  const exportData = async () => {
    const keys = await storage.list();
    const data = { _app: "ARCHITECT", _exported: new Date().toISOString(), _version: 1 };
    for (const k of keys) {
      try { data[k] = JSON.parse(await storage.get(k)); } catch { /* skip unparseable */ }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `architect-backup-${localDateStr()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setDataMsg({ text: `Backup saved (${keys.length} datasets). Keep it somewhere safe.`, tone: GR });
  };

  const importData = async (file) => {
    try {
      const data = JSON.parse(await file.text());
      if (data._app !== "ARCHITECT") throw new Error("Not an ARCHITECT backup file.");
      const keys = Object.keys(data).filter((k) => !k.startsWith("_"));
      if (!keys.length) throw new Error("Backup contains no data.");
      for (const k of keys) await storage.set(k, JSON.stringify(data[k]));
      setDataMsg({ text: `Restored ${keys.length} datasets. Reloading…`, tone: GR });
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setDataMsg({ text: `Import failed: ${err.message}`, tone: RE });
    }
  };

  const eraseAll = async () => {
    const keys = await storage.list();
    for (const k of keys) await storage.remove(k);
    window.location.reload();
  };

  const btn = (extra = {}) => ({ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 12px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, color: T2, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", flex: 1, ...extra });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 14 }} onClick={onClose}>
      <div style={{ width: 440, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", background: B1, border: `1px solid ${BD}`, borderRadius: 16, padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T1 }}>Settings</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={16} /></button>
        </div>

        <div style={{ fontSize: 11, color: CY, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Anthropic API Key</div>
        <div style={{ fontSize: 12, color: T3, lineHeight: 1.6, marginBottom: 12 }}>
          Stored only in this browser; calls go directly from your browser to Anthropic. Powers the AI analyst, trade reviews and reports.
        </div>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-ant-..."
          style={{ width: "100%", background: B0, border: `1px solid ${BD}`, borderRadius: 9, padding: "10px 13px", fontSize: 13, color: T1, outline: "none", fontFamily: "'JetBrains Mono',monospace", boxSizing: "border-box", marginBottom: 12 }}
        />
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button onClick={save} style={btn({ background: `linear-gradient(135deg,${CY},${PU})`, border: "none", color: "#000", fontWeight: 700 })}>Save</button>
          <button onClick={test} disabled={!key.trim() || status === "testing"} style={btn({ cursor: key.trim() ? "pointer" : "default" })}>
            {status === "testing" ? "Testing…" : "Test Connection"}
          </button>
          <button onClick={clear} style={btn({ flex: "none", background: "none", border: `1px solid ${RE}44`, color: RE })}>Clear</button>
        </div>
        {status === "ok" && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: GR, marginBottom: 6 }}>
            <Check size={13} />Connection successful.
          </div>
        )}
        {status === "error" && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: RE, marginBottom: 6 }}>
            <AlertCircle size={13} />{errorMsg}
          </div>
        )}

        <div style={{ height: 1, background: BD, margin: "16px 0" }} />

        <div style={{ fontSize: 11, color: GR, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Your Data</div>
        <div style={{ fontSize: 12, color: T3, lineHeight: 1.6, marginBottom: 12 }}>
          Everything is stored on this device. Export a backup regularly — clearing browser data would otherwise erase your trades, workouts, finances and journal.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button onClick={exportData} style={btn({ borderColor: `${GR}44`, color: GR })}><Download size={13} />Export backup</button>
          <button onClick={() => fileRef.current?.click()} style={btn({ borderColor: `${CY}44`, color: CY })}><Upload size={13} />Import backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ""; }} />
        </div>
        {dataMsg && <div style={{ fontSize: 12, color: dataMsg.tone, marginBottom: 8, lineHeight: 1.5 }}>{dataMsg.text}</div>}

        <div style={{ height: 1, background: BD, margin: "16px 0" }} />

        <div style={{ fontSize: 11, color: RE, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Danger Zone</div>
        {!armErase ? (
          <button onClick={() => setArmErase(true)} style={btn({ width: "100%", flex: "none", borderColor: `${RE}33`, color: RE })}>
            <ShieldAlert size={13} />Erase all data on this device…
          </button>
        ) : (
          <div style={{ padding: "12px", background: `${RE}0D`, border: `1px solid ${RE}33`, borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: T2, lineHeight: 1.55, marginBottom: 10 }}>
              This permanently deletes every trade, workout, goal and journal entry on this device. Export a backup first.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={eraseAll} style={btn({ background: `${RE}22`, borderColor: `${RE}66`, color: RE, fontWeight: 700 })}>Yes, erase everything</button>
              <button onClick={() => setArmErase(false)} style={btn({})}>Keep my data</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
