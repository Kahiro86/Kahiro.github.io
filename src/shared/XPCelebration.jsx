// ── XP celebration layer ─────────────────────────────────────────────
// Watches the derived XP total and turns changes into feedback:
//   · a small "+N XP · Pillar" pill (subtle, near the header)
//   · a full level-up moment with title reveal
//   · achievement unlock toasts, auto-stamping xp_achievements
//   · the daily check-in stamp (xp_logins) — one per day, silent bookkeeping
// It renders above everything but passes every pointer event through.
import { useEffect, useRef, useState } from "react";
import { T1, T2, T3, BD, GL, GR, AM } from "./designTokens.js";
import { useToast } from "./toast.jsx";
import { localDateStr } from "./dates.js";
import { CAT_LABEL, ACHIEVEMENTS, sanitizeUnlocked, sanitizeLogins } from "./xpEngine.js";

export function XPCelebration({ xp }) {
  const toast = useToast();
  const prev = useRef(null); // { total, level, byCat } snapshot after load
  const [pill, setPill] = useState(null);     // { key, delta, label }
  const [levelUp, setLevelUp] = useState(null); // { key, level, title }

  // Daily check-in: stamp today once. Idempotent — the guard makes repeat
  // renders and double-fires no-ops, so no duplicate XP is possible.
  useEffect(() => {
    if (!xp.loaded) return;
    const ds = localDateStr();
    xp.setLogins((prevRaw) => {
      const clean = sanitizeLogins(prevRaw);
      return clean[ds] ? clean : { ...clean, [ds]: 1 };
    });
  }, [xp.loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Achievements: auto-stamp anything newly earned. On the very first load
  // historical qualifications stamp silently; from then on each unlock toasts.
  useEffect(() => {
    if (!xp.loaded || !xp.newly.length) return;
    const ds = localDateStr();
    const announce = prev.current !== null;
    xp.setUnlocked((prevRaw) => {
      const clean = sanitizeUnlocked(prevRaw);
      const next = { ...clean };
      for (const id of xp.newly) if (!next[id]) next[id] = ds;
      return next;
    });
    if (announce) {
      for (const id of xp.newly.slice(0, 3)) {
        const a = ACHIEVEMENTS.find((x) => x.id === id);
        if (a) toast(`${a.icon} Achievement unlocked: ${a.name}`, { tone: "success", duration: 6000 });
      }
    }
  }, [xp.loaded, xp.newly.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  // XP delta → pill; level crossing → the big moment.
  useEffect(() => {
    if (!xp.loaded) return;
    const snap = { total: xp.total, level: xp.level, byCat: xp.byCat };
    if (prev.current === null) { prev.current = snap; return; }
    const delta = xp.total - prev.current.total;
    if (delta > 0) {
      // attribute the gain to the pillar that moved most
      let label = null, best = 0;
      for (const [c, v] of Object.entries(xp.byCat)) {
        const d = v - (prev.current.byCat[c] || 0);
        if (d > best) { best = d; label = CAT_LABEL[c] || c; }
      }
      // a big jump is another device syncing in, not a single action
      setPill({ key: Date.now(), delta, label: delta > 500 ? "synced" : label });
    }
    if (xp.level > prev.current.level) {
      setLevelUp({ key: Date.now(), level: xp.level, title: xp.title });
    }
    prev.current = snap;
  }, [xp.loaded, xp.total, xp.level]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-expire the animations.
  useEffect(() => {
    if (!pill) return;
    const t = setTimeout(() => setPill(null), 2100);
    return () => clearTimeout(t);
  }, [pill]);
  useEffect(() => {
    if (!levelUp) return;
    const t = setTimeout(() => setLevelUp(null), 2700);
    return () => clearTimeout(t);
  }, [levelUp]);

  return (
    <>
      {pill && (
        <div key={pill.key} style={{ position: "fixed", top: 62, right: 20, zIndex: 70, pointerEvents: "none", animation: "xpPill 2.1s ease forwards" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", background: "rgba(9,13,24,0.92)", border: `1px solid ${AM}44`, borderRadius: 20, boxShadow: `0 6px 22px rgba(0,0,0,0.4), 0 0 18px ${AM}22`, backdropFilter: "blur(10px)" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: AM, fontFamily: "'JetBrains Mono',monospace" }}>+{pill.delta} XP</span>
            {pill.label && <span style={{ fontSize: 10.5, color: T3, letterSpacing: 0.5 }}>· {pill.label}</span>}
          </div>
        </div>
      )}
      {levelUp && (
        <div key={levelUp.key} style={{ position: "fixed", inset: 0, zIndex: 80, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", width: 420, height: 420, borderRadius: "50%", background: `radial-gradient(circle, ${AM}2E, transparent 65%)`, animation: "levelGlow 2.7s ease forwards" }} />
          <div style={{ textAlign: "center", animation: "levelUp 2.7s cubic-bezier(0.2,0.8,0.3,1) forwards" }}>
            <div style={{ fontSize: 12, color: AM, letterSpacing: 6, fontWeight: 700 }}>LEVEL UP</div>
            <div style={{ fontSize: 74, fontWeight: 900, color: T1, lineHeight: 1.15, fontFamily: "'JetBrains Mono',monospace", textShadow: `0 0 44px ${AM}66` }}>{levelUp.level}</div>
            <div style={{ display: "inline-block", padding: "5px 16px", background: GL, border: `1px solid ${AM}44`, borderRadius: 16, fontSize: 12.5, fontWeight: 700, color: T2, letterSpacing: 1 }}>{levelUp.title}</div>
          </div>
        </div>
      )}
    </>
  );
}
