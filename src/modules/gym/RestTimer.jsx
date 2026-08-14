// ── Gym · Rest timer ──────────────────────────────────────────────────────
// A compact countdown shown at the bottom of an active workout, so rest
// between sets is tracked without leaving the app. Self-contained; the Gym
// facet toggles it. Presets + fine adjust + pause/skip; a soft buzz on zero
// where the device supports it.
import { useState, useEffect, useRef } from "react";
import { X, Pause, Play, Plus, Minus } from "lucide-react";
import { B1, BD, T1, T2, T3, GL, AC, AC2, GR } from "../../shared/designTokens.js";

const PRESETS = [60, 90, 120, 180];
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

export function RestTimer({ initialSeconds = 90, onClose }) {
  const [total, setTotal] = useState(initialSeconds);
  const [remaining, setRemaining] = useState(initialSeconds);
  const [running, setRunning] = useState(true);
  const buzzed = useRef(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (remaining === 0 && !buzzed.current) {
      buzzed.current = true;
      setRunning(false);
      try { navigator.vibrate?.([120, 60, 120]); } catch { /* unsupported */ }
    }
    if (remaining > 0) buzzed.current = false;
  }, [remaining]);

  const setPreset = (s) => { setTotal(s); setRemaining(s); setRunning(true); buzzed.current = false; };
  const adjust = (d) => { setRemaining((r) => Math.max(0, r + d)); setTotal((t) => Math.max(0, t + d)); };
  const done = remaining === 0;
  const pct = total ? (remaining / total) * 100 : 0;

  return (
    <div style={{ position: "sticky", bottom: 0, zIndex: 8, background: B1, border: `1px solid ${done ? GR + "66" : BD}`, borderRadius: 14, padding: "10px 12px", boxShadow: "0 -8px 24px rgba(0,0,0,0.35)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => setRunning((r) => !r)} aria-label={running ? "Pause" : "Resume"}
          style={{ width: 34, height: 34, borderRadius: 9, border: "none", cursor: "pointer", background: `${AC}1E`, color: AC, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {running ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <div style={{ minWidth: 62, fontSize: 22, fontWeight: 800, color: done ? GR : T1, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(remaining)}</div>
        <button onClick={() => adjust(-15)} aria-label="-15s" style={adjBtn}><Minus size={13} /></button>
        <button onClick={() => adjust(15)} aria-label="+15s" style={adjBtn}><Plus size={13} /></button>
        <div style={{ flex: 1 }} />
        {PRESETS.map((s) => (
          <button key={s} onClick={() => setPreset(s)}
            style={{ padding: "5px 8px", borderRadius: 8, border: `1px solid ${total === s ? AC + "66" : BD}`, cursor: "pointer", background: total === s ? `${AC}18` : GL, color: total === s ? AC : T2, fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>{fmt(s)}</button>
        ))}
        <button onClick={onClose} aria-label="Close timer" style={{ ...adjBtn, color: T3, marginLeft: 2 }}><X size={15} /></button>
      </div>
      <div style={{ height: 3, background: BD, borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: done ? GR : `linear-gradient(90deg,${AC},${AC2})`, borderRadius: 2, transition: "width 1s linear" }} />
      </div>
    </div>
  );
}

const adjBtn = { width: 30, height: 30, borderRadius: 8, border: `1px solid ${BD}`, cursor: "pointer", background: GL, color: T2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
