import { useEffect, useRef } from "react";
import { themeFor } from "./ambient.js";

const hexToRgb = (h) => {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// A living, per-module background: soft drifting light, a particle field whose
// behaviour matches the module's mood, and mood-specific structure (grid,
// mountains, gold rays, holographic geometry). Calm by design — low counts,
// slow speeds, gentle opacity. Honors prefers-reduced-motion.
export function AmbientBackground({ module }) {
  const t = themeFor(module);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf, w, h, dpr;
    const [ar, ag, ab] = hexToRgb(t.accent);
    const [br, bg, bb] = hexToRgb(t.accent2);

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.width = Math.floor(window.innerWidth * dpr);
      h = canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    };
    resize();
    window.addEventListener("resize", resize);

    const mode = t.mode;
    const count = mode === "network" ? 46 : mode === "data" ? 58 : mode === "embers" ? 40 : 52;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const parts = Array.from({ length: count }, () => {
      const useB = Math.random() > 0.62;
      return {
        x: Math.random() * w, y: Math.random() * h,
        vx: rnd(-0.12, 0.12) * dpr,
        vy: (mode === "embers" ? rnd(-0.5, -0.18) : mode === "data" ? rnd(0.15, 0.5) : rnd(-0.12, 0.12)) * dpr,
        r: (mode === "data" ? rnd(0.6, 1.6) : rnd(0.7, 2.2)) * dpr,
        a: rnd(0.15, 0.6),
        tw: rnd(0.005, 0.02),
        ph: Math.random() * Math.PI * 2,
        c: useB ? [br, bg, bb] : [ar, ag, ab],
        sway: rnd(0.2, 0.8),
      };
    });

    let frame = 0;
    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, w, h);

      // network mode: thin connection lines between near particles
      if (mode === "network") {
        for (let i = 0; i < parts.length; i++) {
          for (let j = i + 1; j < parts.length; j++) {
            const dx = parts[i].x - parts[j].x, dy = parts[i].y - parts[j].y;
            const d2 = dx * dx + dy * dy, max = (150 * dpr) ** 2;
            if (d2 < max) {
              const o = (1 - d2 / max) * 0.12;
              ctx.strokeStyle = `rgba(${ar},${ag},${ab},${o})`;
              ctx.lineWidth = dpr * 0.6;
              ctx.beginPath();
              ctx.moveTo(parts[i].x, parts[i].y);
              ctx.lineTo(parts[j].x, parts[j].y);
              ctx.stroke();
            }
          }
        }
      }

      for (const p of parts) {
        p.x += p.vx + (mode === "petals" ? Math.sin(frame * 0.01 + p.ph) * p.sway * 0.3 * dpr : 0);
        p.y += p.vy;
        p.ph += p.tw;
        const flick = 0.55 + 0.45 * Math.sin(p.ph);
        // wrap around
        if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10;

        const [cr, cg, cb] = p.c;
        const alpha = p.a * (mode === "network" || mode === "data" ? flick : 0.85 * flick + 0.15);
        if (mode === "data") {
          ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
          ctx.fillRect(p.x, p.y, p.r * 1.4, p.r * 1.4);
        } else {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
          g.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha})`);
          g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [t.accent, t.accent2, t.mode]);

  const a = t.accent;
  const layer = { position: "absolute", inset: 0, pointerEvents: "none" };

  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", background: t.base, transition: "background 1.2s ease" }}>
      {/* base vertical wash */}
      <div style={{ ...layer, background: `radial-gradient(120% 80% at 50% -10%, ${a}14, transparent 55%), radial-gradient(90% 70% at 85% 110%, ${t.accent2}10, transparent 60%)` }} />

      {/* drifting soft light blobs */}
      <div style={{ ...layer, background: `radial-gradient(closest-side, ${a}18, transparent)`, width: "60vw", height: "60vw", left: "-10vw", top: "-15vw", filter: "blur(30px)", animation: "ambientDrift 34s ease-in-out infinite" }} />
      <div style={{ ...layer, background: `radial-gradient(closest-side, ${t.accent2}12, transparent)`, width: "55vw", height: "55vw", right: "-15vw", bottom: "-20vw", left: "auto", top: "auto", filter: "blur(34px)", animation: "ambientDrift2 44s ease-in-out infinite" }} />

      {/* mood: trading / productivity — grid + scanline */}
      {t.mood === "grid" && (
        <>
          <div style={{ ...layer, opacity: 0.5, backgroundImage: `linear-gradient(${a}0a 1px, transparent 1px), linear-gradient(90deg, ${a}0a 1px, transparent 1px)`, backgroundSize: "46px 46px", maskImage: "radial-gradient(120% 90% at 50% 30%, #000, transparent 80%)", WebkitMaskImage: "radial-gradient(120% 90% at 50% 30%, #000, transparent 80%)" }} />
          <div style={{ ...layer, height: "38%", background: `linear-gradient(180deg, transparent, ${a}0e, transparent)`, animation: "ambientScan 9s linear infinite" }} />
        </>
      )}

      {/* mood: finance — faint gold rays from top */}
      {t.mood === "marble" && (
        <div style={{ ...layer, opacity: 0.5, background: `repeating-linear-gradient(115deg, ${a}00 0px, ${a}00 42px, ${a}0c 44px, ${a}00 48px)`, maskImage: "radial-gradient(80% 60% at 50% 0%, #000, transparent 70%)", WebkitMaskImage: "radial-gradient(80% 60% at 50% 0%, #000, transparent 70%)", animation: "ambientRays 26s ease-in-out infinite alternate" }} />
      )}

      {/* mood: life — distant mountains + moon */}
      {t.mood === "night" && (
        <>
          <div style={{ position: "absolute", top: "10%", right: "16%", width: 90, height: 90, borderRadius: "50%", background: `radial-gradient(circle at 38% 38%, ${a}66, ${a}18 45%, transparent 70%)`, filter: "blur(2px)", pointerEvents: "none" }} />
          <svg viewBox="0 0 1440 320" preserveAspectRatio="none" style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "34vh", opacity: 0.55, pointerEvents: "none" }}>
            <path d="M0 220 L160 150 L320 210 L470 120 L620 200 L780 110 L930 190 L1090 130 L1260 205 L1440 150 L1440 320 L0 320 Z" fill={`${a}12`} />
            <path d="M0 260 L200 200 L360 250 L540 180 L720 245 L900 175 L1080 240 L1280 195 L1440 250 L1440 320 L0 320 Z" fill={`${a}1c`} />
          </svg>
        </>
      )}

      {/* mood: command — slow holographic rings */}
      {t.mood === "command" && (
        <svg viewBox="0 0 800 800" style={{ position: "absolute", top: "50%", left: "50%", width: "min(90vw,900px)", height: "min(90vw,900px)", transform: "translate(-50%,-50%)", opacity: 0.28, pointerEvents: "none" }}>
          <g fill="none" stroke={a} strokeWidth="1">
            <circle cx="400" cy="400" r="180" strokeDasharray="4 10" style={{ transformOrigin: "400px 400px", animation: "ambientSpin 60s linear infinite" }} />
            <circle cx="400" cy="400" r="280" strokeDasharray="2 16" strokeOpacity="0.6" style={{ transformOrigin: "400px 400px", animation: "ambientSpinRev 90s linear infinite" }} />
            <polygon points="400,150 620,400 400,650 180,400" strokeOpacity="0.35" style={{ transformOrigin: "400px 400px", animation: "ambientSpin 120s linear infinite" }} />
          </g>
        </svg>
      )}

      {/* mood: athlete — twin spotlight gradients */}
      {t.mood === "arena" && (
        <div style={{ ...layer, background: `radial-gradient(50% 60% at 22% 0%, ${a}12, transparent 60%), radial-gradient(50% 60% at 78% 0%, ${t.accent2}12, transparent 60%)` }} />
      )}

      {/* particle field */}
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

      {/* fine grain + vignette */}
      <div style={{ ...layer, opacity: 0.05, mixBlendMode: "overlay", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
      <div style={{ ...layer, background: "radial-gradient(130% 100% at 50% 40%, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
    </div>
  );
}
