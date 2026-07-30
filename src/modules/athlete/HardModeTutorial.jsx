// ── Hard Mode walkthrough — 4 screens, the app's own voice ───────────
// Shown once on first activation, and re-readable any time from Settings.
// It never auto-repeats. The last screen contrasts a clean day with a
// failed one so the standard is concrete before the practice begins.
import { useState } from "react";
import { X, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { B1, B2, BD, T1, T2, T3, GL, AC2, GR, RE } from "../../shared/designTokens.js";

const GOLD = AC2;

const DayCol = ({ title, tone, lines }) => (
  <div style={{ flex: 1, background: B2, border: `1px solid ${tone}44`, borderRadius: 12, padding: "14px 15px" }}>
    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: tone, marginBottom: 10 }}>{title}</div>
    {lines.map((l, i) => (
      <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8, fontSize: 12.5, color: T2, lineHeight: 1.5 }}>
        <span style={{ color: tone, marginTop: 1, flexShrink: 0 }}>{l.ok ? <Check size={13} /> : "—"}</span>
        <span>{l.t}</span>
      </div>
    ))}
  </div>
);

export function HardModeTutorial({ mode = "read", onClose, onConfirm }) {
  const [i, setI] = useState(0);

  const screens = [
    {
      k: "what",
      title: "Hard Mode",
      body: (
        <>
          <p style={{ margin: "0 0 12px" }}>Hard Mode replaces willpower with structure. The rules stop being suggestions and start being enforced.</p>
          <p style={{ margin: 0 }}>The key shift: <b style={{ color: GOLD }}>floors matter as much as ceilings.</b> Under-eating fails a day exactly the way overeating does. A day only stands when it clears both.</p>
        </>
      ),
    },
    {
      k: "do",
      title: "What to do",
      body: (
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Log each item <b style={{ color: T1 }}>within 20 minutes</b> of eating. Later, and it logs as “late”.</li>
          <li>Hit your <b style={{ color: T1 }}>protein floor first</b> — the day can’t be completed until it’s met.</li>
          <li>The <b style={{ color: T1 }}>post-shift meal is non-negotiable.</b> Log it even when appetite is low; there’s a soft-food path if it is.</li>
          <li>Hydrate on the electrolyte fizz during hot service — it counts toward fluids.</li>
        </ul>
      ),
    },
    {
      k: "dont",
      title: "What not to do",
      body: (
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Don’t <b style={{ color: T1 }}>skip a meal to make room</b> for a later one.</li>
          <li>Don’t try to <b style={{ color: T1 }}>lower a floor mid-day</b> — threshold changes only take effect tomorrow.</li>
          <li>Don’t <b style={{ color: T1 }}>cut tomorrow’s floor</b> to pay for a high day. A floor edit after a surplus is blocked.</li>
          <li>Don’t <b style={{ color: T1 }}>turn Hard Mode off mid-day</b>. Off takes effect tomorrow.</li>
        </ul>
      ),
    },
    {
      k: "pass",
      title: "How days pass and fail",
      body: (
        <div style={{ display: "flex", gap: 12 }}>
          <DayCol title="Clean day" tone={GR} lines={[
            { ok: true, t: "Protein floor met" },
            { ok: true, t: "Calories between floor and ceiling" },
            { ok: true, t: "Post-shift meal logged" },
            { ok: true, t: "Everything logged on time" },
          ]} />
          <DayCol title="Failed day" tone={RE} lines={[
            { ok: false, t: "Under the protein floor, or" },
            { ok: false, t: "Under the calorie floor, or" },
            { ok: false, t: "Over the ceiling" },
            { ok: false, t: "One neutral line names the cause. Nothing else." },
          ]} />
        </div>
      ),
    },
  ];

  const s = screens[i];
  const last = i === screens.length - 1;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(560px,100%)", background: B1, border: `1px solid ${BD}`, borderRadius: 18, padding: "22px 24px 20px", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 10.5, letterSpacing: 2, textTransform: "uppercase", color: GOLD, fontWeight: 800 }}>Step {i + 1} of {screens.length}</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={17} /></button>
        </div>

        <h2 style={{ margin: "0 0 12px", fontSize: 24, fontWeight: 800, color: T1, letterSpacing: -0.3 }}>{s.title}</h2>
        <div style={{ fontSize: 14, color: T2, lineHeight: 1.6, minHeight: 150 }}>{s.body}</div>

        <div style={{ display: "flex", gap: 5, margin: "18px 0 16px" }}>
          {screens.map((_, k) => (
            <span key={k} style={{ height: 3, flex: 1, borderRadius: 2, background: k <= i ? GOLD : BD }} />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => (i === 0 ? onClose() : setI(i - 1))}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "9px 14px", background: GL, border: `1px solid ${BD}`, borderRadius: 10, color: T2, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            <ChevronLeft size={15} />{i === 0 ? "Close" : "Back"}
          </button>
          <div style={{ flex: 1 }} />
          {!last ? (
            <button onClick={() => setI(i + 1)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "9px 18px", background: GOLD, border: "none", borderRadius: 10, color: "#1a1400", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              Next <ChevronRight size={15} />
            </button>
          ) : (
            <button onClick={() => (mode === "activate" ? onConfirm?.() : onClose())}
              style={{ padding: "9px 20px", background: GOLD, border: "none", borderRadius: 10, color: "#1a1400", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              {mode === "activate" ? "Turn on Hard Mode" : "Got it"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
