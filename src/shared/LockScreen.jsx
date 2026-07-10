// ── Lock screen — shown before anything else when a PIN is set ───────
// Keypad + hardware keyboard input, auto-submits at the stored PIN
// length, calm shake on a wrong guess. Renders over the ambient
// background so even the lock feels like the app.
import { useEffect, useState } from "react";
import { ShieldCheck, Delete } from "lucide-react";
import { B1, BD, T1, T2, T3, GL, CY, GR, RE } from "./designTokens.js";
import { getLock, verifyPin } from "./lock.js";

export function LockScreen({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const len = getLock()?.len || 4;

  const press = (d) => { if (!checking && pin.length < len) { setError(false); setPin((p) => p + d); } };
  const back = () => { setError(false); setPin((p) => p.slice(0, -1)); };

  useEffect(() => {
    if (pin.length !== len) return;
    let cancelled = false;
    setChecking(true);
    verifyPin(pin).then((ok) => {
      if (cancelled) return;
      if (ok) onUnlock();
      else { setError(true); setPin(""); setChecking(false); }
    });
    return () => { cancelled = true; };
  }, [pin, len, onUnlock]);

  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [checking, pin.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const keyBtn = (label, onClick, aria) => (
    <button key={aria} onClick={onClick} aria-label={aria}
      style={{ height: 56, borderRadius: 14, background: GL, border: `1px solid ${BD}`, color: T1, fontSize: 19, fontWeight: 600, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {label}
    </button>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(5,6,13,0.86)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", padding: 20 }}>
      <div style={{ width: 300, maxWidth: "100%", background: B1, border: `1px solid ${BD}`, borderRadius: 20, padding: "30px 26px", textAlign: "center", boxShadow: "0 24px 70px rgba(0,0,0,0.55)", animation: error ? "lockShake 0.4s ease" : "fadeIn 0.4s ease" }}>
        <div style={{ width: 46, height: 46, margin: "0 auto 12px", borderRadius: 14, background: `${CY}14`, border: `1px solid ${CY}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ShieldCheck size={21} color={CY} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: T1, letterSpacing: 3 }}>KAHIRO</div>
        <div style={{ fontSize: 11.5, color: error ? RE : T3, marginTop: 5, marginBottom: 18, minHeight: 16 }}>
          {error ? "Wrong PIN — try again" : "Enter your PIN to unlock"}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 22 }} aria-label={`PIN ${pin.length} of ${len} digits entered`}>
          {Array.from({ length: len }, (_, i) => (
            <div key={i} style={{ width: 11, height: 11, borderRadius: "50%", background: i < pin.length ? GR : "transparent", border: `1.5px solid ${i < pin.length ? GR : BD}`, transition: "all 0.15s" }} />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9 }}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => keyBtn(d, () => press(d), `Digit ${d}`))}
          <div />
          {keyBtn("0", () => press("0"), "Digit 0")}
          {keyBtn(<Delete size={17} color={T2} />, back, "Delete digit")}
        </div>
        <div style={{ fontSize: 9.5, color: T3, marginTop: 16, lineHeight: 1.6 }}>
          Forgot it? Clearing this site's data removes the lock — cloud-synced data restores after you sign back in.
        </div>
      </div>
    </div>
  );
}
