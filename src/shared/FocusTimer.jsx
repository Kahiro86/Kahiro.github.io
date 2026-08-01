// ── Focus Timer — a distraction-free deep-work block ─────────────────
// Pick a length, name the work, and go. A completed (or ended-early) block
// logs real minutes to focus_sessions, feeding today's total. Opened from the
// command palette. Lazy.
import { useEffect, useRef, useState } from "react";
import { X, Play, Pause, Check, Square } from "lucide-react";
import { B1, B2, BD, BD2, T1, T2, T3, GL, AC2, GR } from "./designTokens.js";
import { useStorageState } from "./useStorageState.js";
import { useToast } from "./toast.jsx";
import { FOCUS_KEY, PRESETS, addSession, dayMinutes, sessionCount } from "./focusSessions.js";

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function FocusTimer({ onClose }) {
  const [sessions, setSessions] = useStorageState(FOCUS_KEY, []);
  const toast = useToast();
  const [target, setTarget] = useState(PRESETS[0]); // minutes
  const [label, setLabel] = useState("");
  const [left, setLeft] = useState(PRESETS[0] * 60); // seconds
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const tick = useRef(null);

  const todayMin = dayMinutes(sessions);
  const todayCount = sessionCount(sessions);

  useEffect(() => {
    if (!running) return;
    tick.current = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tick.current);
  }, [running]);

  // Natural completion → log the full block.
  useEffect(() => {
    if (started && left === 0) { log(target); }
  }, [left, started]); // eslint-disable-line

  const pickTarget = (m) => { if (started) return; setTarget(m); setLeft(m * 60); };

  const log = (minutes) => {
    setRunning(false);
    if (minutes >= 1) {
      setSessions((prev) => addSession(prev, { minutes, label }));
      toast(`Focused ${minutes} min${label ? ` · ${label}` : ""} 🎯`, { tone: "success" });
    }
    onClose();
  };

  const start = () => { setStarted(true); setRunning(true); };
  const endEarly = () => {
    const done = Math.round((target * 60 - left) / 60);
    if (done >= 1) log(done); else { setRunning(false); onClose(); }
  };

  const total = target * 60;
  const pct = total > 0 ? ((total - left) / total) * 100 : 0;
  const size = 200, stroke = 8, r = (size - stroke) / 2, circ = 2 * Math.PI * r;

  return (
    <div onClick={running ? undefined : onClose} style={{ position: "fixed", inset: 0, zIndex: 4200, background: "rgba(0,0,0,0.82)", display: "flex", justifyContent: "center", alignItems: "center", padding: "16px" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 380, background: B1, border: `1px solid ${BD2}`, borderRadius: 20, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.7)" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "15px 18px", borderBottom: `1px solid ${BD}` }}>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 800, color: T1 }}>Focus Session</div>
          <div style={{ fontSize: 11, color: T3, marginRight: 10 }}>{todayMin} min today · {todayCount}×</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={17} /></button>
        </div>

        <div style={{ padding: "22px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <div style={{ position: "relative", width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BD} strokeWidth={stroke} />
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={AC2} strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ} style={{ transition: "stroke-dashoffset 1s linear" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: T1, fontFamily: "monospace", letterSpacing: 1 }}>{fmt(left)}</div>
              {label && <div style={{ fontSize: 12, color: T3, marginTop: 2, maxWidth: 160, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>}
            </div>
          </div>

          {!started && (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                {PRESETS.map((m) => (
                  <button key={m} onClick={() => pickTarget(m)}
                    style={{ padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                      background: target === m ? `${AC2}22` : GL, border: `1px solid ${target === m ? AC2 : BD}`, color: target === m ? AC2 : T2 }}>
                    {m}m
                  </button>
                ))}
              </div>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What are you focusing on? (optional)"
                style={{ width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 10, padding: "10px 13px", fontSize: 13, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
            </>
          )}

          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            {!started ? (
              <button onClick={start} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700, background: `linear-gradient(135deg,${AC2},${GR})`, color: "#000", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <Play size={17} /> Start
              </button>
            ) : (
              <>
                <button onClick={() => setRunning((r) => !r)} style={{ flex: 1, padding: "13px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, background: GL, border: `1px solid ${BD}`, color: T1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                  {running ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Resume</>}
                </button>
                <button onClick={endEarly} style={{ flex: 1, padding: "13px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, background: `${GR}18`, border: `1px solid ${GR}55`, color: GR, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                  <Check size={16} /> End & log
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
