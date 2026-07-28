// ── What's New — the post-update highlight ───────────────────────────
// Shown once when the stored seen-version differs from the current build's.
// Short, dismissable, and re-openable from the Help Centre's What's New.
import { useEffect } from "react";
import { X, Sparkles } from "lucide-react";
import { B1, B0, BD, T1, T2, T3, CY, PU, GL } from "./designTokens.js";
import { WHATS_NEW } from "./onboarding.js";

export function WhatsNew({ onClose, onStartTour }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.62)", zIndex: 210, display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="What's new"
        style={{ width: 440, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto", background: B1, border: `1px solid ${BD}`, borderRadius: 18, padding: 22, animation: "reviewRise .3s cubic-bezier(0.16,1,0.3,1) both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
          <Sparkles size={17} color={CY} />
          <div style={{ flex: 1, fontSize: 16, fontWeight: 800, color: T1 }}>{WHATS_NEW.title}</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={17} /></button>
        </div>
        <div style={{ fontSize: 11.5, color: T3, marginBottom: 16 }}>Version {WHATS_NEW.version}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {WHATS_NEW.items.map((it, i) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: "12px 14px", background: B0, border: `1px solid ${BD}`, borderRadius: 12 }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>{it.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T1, marginBottom: 3 }}>{it.h}</div>
                <div style={{ fontSize: 12, color: T2, lineHeight: 1.5 }}>{it.p}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {onStartTour && (
            <button onClick={() => { onClose(); onStartTour(); }} style={{ flex: 1, padding: "10px", background: GL, border: `1px solid ${BD}`, borderRadius: 10, color: T2, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Take the tour</button>
          )}
          <button onClick={onClose} style={{ flex: 1, padding: "10px", background: `linear-gradient(135deg,${CY},${PU})`, border: "none", borderRadius: 10, color: "#000", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Got it</button>
        </div>
      </div>
    </div>
  );
}
