// ── First-run: "Name your system" ───────────────────────────────────
// A small centred card shown once, before the tour, when no identity has
// been chosen. Two inputs (app name, your name) and Continue; skippable —
// skipping keeps the defaults. Native to the app's dark theme.
import { useState } from "react";
import { B0, B1, BD, T1, T2, T3, GL, CY, PU } from "./designTokens.js";
import { DEFAULT_APP_NAME } from "./identity.jsx";

export function NameYourSystem({ onDone }) {
  const [appName, setAppName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const input = { width: "100%", background: B0, border: `1px solid ${BD}`, borderRadius: 10, padding: "11px 13px", fontSize: 14, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 260, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-label="Name your system"
        style={{ width: 400, maxWidth: "100%", background: B1, border: `1px solid ${BD}`, borderRadius: 18, padding: 24, animation: "reviewRise .32s cubic-bezier(0.16,1,0.3,1) both" }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: T1, marginBottom: 5 }}>Name your system</div>
        <div style={{ fontSize: 12.5, color: T3, lineHeight: 1.55, marginBottom: 18 }}>Make it yours. You can change these anytime in Settings.</div>

        <label style={{ fontSize: 10.5, color: T3, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>App name</label>
        <input autoFocus value={appName} onChange={(e) => setAppName(e.target.value.slice(0, 32))} placeholder={DEFAULT_APP_NAME} maxLength={32} style={{ ...input, marginBottom: 14 }} />

        <label style={{ fontSize: 10.5, color: T3, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Your name <span style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
        <input value={ownerName} onChange={(e) => setOwnerName(e.target.value.slice(0, 40))} placeholder="e.g. Alex" maxLength={40} style={{ ...input, marginBottom: 20 }}
          onKeyDown={(e) => { if (e.key === "Enter") onDone({ appName, ownerName }); }} />

        <div style={{ display: "flex", gap: 9 }}>
          <button onClick={() => onDone(null)} style={{ padding: "11px 16px", background: GL, border: `1px solid ${BD}`, borderRadius: 11, color: T2, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Skip</button>
          <button onClick={() => onDone({ appName, ownerName })} style={{ flex: 1, padding: "11px 16px", background: `linear-gradient(135deg,${CY},${PU})`, border: "none", borderRadius: 11, color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Continue</button>
        </div>
      </div>
    </div>
  );
}
