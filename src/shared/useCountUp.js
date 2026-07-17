// ── useCountUp ───────────────────────────────────────────────────────
// Animates a number toward its target with an ease-out, so figures feel
// alive — they roll up on first paint and tick when the underlying data
// changes, instead of snapping. Honors prefers-reduced-motion (snaps).
import { useEffect, useRef, useState } from "react";

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function useCountUp(target, { duration = 700, decimals = 0 } = {}) {
  const to = Number.isFinite(+target) ? +target : 0;
  const [val, setVal] = useState(to);
  const fromRef = useRef(to);
  const rafRef = useRef(0);

  useEffect(() => {
    if (reduced()) { fromRef.current = to; setVal(to); return; }
    const from = fromRef.current;
    if (from === to) return;
    const start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3); // easeOutCubic
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      setVal(from + (to - from) * ease(p));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else { fromRef.current = to; setVal(to); }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [to, duration]);

  const f = Math.pow(10, decimals);
  return Math.round(val * f) / f;
}
