// ── Guided tour — the spotlight walkthrough ──────────────────────────
// Dims the whole screen, cuts a lit "hole" over one target element, and
// floats a captioned tooltip beside it with Back / Skip / Next. Targets
// are found by their data-tour="…" attribute. A step with no target (or a
// target that isn't on screen — e.g. the sidebar on mobile) falls back to
// a centred card so the tour never dead-ends.
import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { B1, BD, T1, T2, T3, GL, CY, PU } from "./designTokens.js";

const PAD = 8; // breathing room around the spotlit element

export function GuidedTour({ steps, onNavigate, onClose, onFinish, startAt = 0 }) {
  const [i, setI] = useState(startAt);
  const [rect, setRect] = useState(null); // spotlight target rect, or null → centred
  const rafRef = useRef(0);
  const step = steps[i] || {};
  const last = i >= steps.length - 1;

  const measure = useCallback(() => {
    if (!step.target) { setRect(null); return; }
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) { setRect(null); return; }
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step.target]);

  // On each step: switch module if asked, then measure (with a couple of
  // retries so a just-navigated module has time to paint).
  useEffect(() => {
    if (step.module) onNavigate?.(step.module);
    setRect(null);
    const t1 = setTimeout(measure, 80);
    const t2 = setTimeout(measure, 360);
    const t3 = setTimeout(measure, 700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [i, step.module, measure, onNavigate]);

  // Keep the spotlight glued to the target through scroll/resize.
  useEffect(() => {
    const on = () => { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(measure); };
    window.addEventListener("resize", on);
    window.addEventListener("scroll", on, true);
    return () => { window.removeEventListener("resize", on); window.removeEventListener("scroll", on, true); cancelAnimationFrame(rafRef.current); };
  }, [measure]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // re-bind each render so next/back close over current i

  const next = () => { if (last) onFinish(); else setI((n) => Math.min(steps.length - 1, n + 1)); };
  const back = () => setI((n) => Math.max(0, n - 1));

  const vw = typeof window !== "undefined" ? window.innerWidth : 360;
  const vh = typeof window !== "undefined" ? window.innerHeight : 640;
  const TW = Math.min(320, vw - 28); // tooltip width

  // Tooltip placement: below the target if there's room, else above; when
  // there's no rect, dead-centre.
  let tip;
  if (rect) {
    const below = rect.top + rect.height + 12 + 150 < vh;
    const top = below ? rect.top + rect.height + PAD + 12 : Math.max(12, rect.top - PAD - 12 - 172);
    let left = rect.left + rect.width / 2 - TW / 2;
    left = Math.max(14, Math.min(left, vw - TW - 14));
    tip = { top, left, width: TW };
  } else {
    tip = { top: vh / 2 - 110, left: vw / 2 - TW / 2, width: TW };
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, animation: "fadeIn 0.25s ease", pointerEvents: "none" }}>
      {/* Dimmer + spotlight hole (a lit box using a giant outer shadow). The
          overlay is click-through so the user can tap the highlighted control
          and so it never blocks the rest of the app; only the card is live. */}
      {rect ? (
        <div style={{ position: "fixed", top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2,
          borderRadius: 12, boxShadow: `0 0 0 9999px rgba(0,0,0,0.74), 0 0 0 2px ${CY}, 0 0 22px ${CY}77`, transition: "all 0.28s cubic-bezier(0.4,0,0.2,1)", pointerEvents: "none" }} />
      ) : (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.74)", pointerEvents: "none" }} />
      )}

      {/* Caption card */}
      <div role="dialog" aria-label="Guided tour" style={{ pointerEvents: "auto", position: "fixed", top: tip.top, left: tip.left, width: tip.width,
        background: B1, border: `1px solid ${BD}`, borderRadius: 14, padding: "15px 16px", boxShadow: "0 18px 50px rgba(0,0,0,0.6)", animation: "fadeIn 0.28s ease" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
          <span style={{ fontSize: 9.5, color: CY, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>Step {i + 1} of {steps.length}</span>
          <button onClick={onClose} aria-label="Close tour" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", padding: 2 }}><X size={15} /></button>
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: T1, marginBottom: 5 }}>{step.title}</div>
        <div style={{ fontSize: 12.5, color: T2, lineHeight: 1.55, marginBottom: 13 }}>{step.body}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {/* progress dots */}
          <div style={{ display: "flex", gap: 4, flex: 1 }}>
            {steps.map((_, n) => (
              <span key={n} style={{ width: n === i ? 15 : 6, height: 6, borderRadius: 3, background: n === i ? CY : n < i ? `${CY}66` : GL, transition: "all 0.2s" }} />
            ))}
          </div>
          {i > 0 && (
            <button onClick={back} style={{ display: "flex", alignItems: "center", gap: 3, padding: "7px 11px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, color: T2, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}><ChevronLeft size={13} />Back</button>
          )}
          <button onClick={next} style={{ display: "flex", alignItems: "center", gap: 3, padding: "7px 13px", background: `linear-gradient(135deg,${CY},${PU})`, border: "none", borderRadius: 9, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {last ? "Done" : "Next"}{!last && <ChevronRight size={13} />}
          </button>
        </div>
        {!last && (
          <button onClick={onClose} style={{ marginTop: 9, background: "none", border: "none", color: T3, fontSize: 11, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", padding: 0 }}>Skip the tour</button>
        )}
      </div>
    </div>
  );
}
