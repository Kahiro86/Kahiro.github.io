import { useEffect, useRef } from "react";
import { themeFor } from "./ambient.js";

const hexToRgb = (h) => {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Pre-render a soft glow disc to an offscreen canvas once, so the animation
// loop only blits (drawImage) instead of allocating a radial gradient every
// frame for every particle — the single biggest cost of the old version.
function makeSprite(rgb, size = 26) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`);
  g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  x.fillStyle = g;
  x.beginPath();
  x.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  x.fill();
  return c;
}

// A living, per-module background. The particle canvas only runs on desktop
// with motion allowed; on phones (and reduced-motion) the static gradient /
// mountains / grid layers carry the mood with zero continuous repaint — which
// is what keeps the frosted-glass UI smooth on mobile.
export function AmbientBackground({ module, animate = true }) {
  const t = themeFor(module);
  const canvasRef = useRef(null);
  const doAnim = animate && !prefersReducedMotion();

  useEffect(() => {
    if (!doAnim) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf, w, h, dpr, running = true;
    const spriteA = makeSprite(hexToRgb(t.accent));
    const spriteB = makeSprite(hexToRgb(t.accent2));
    const [ar, ag, ab] = hexToRgb(t.accent);

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = canvas.width = Math.floor(window.innerWidth * dpr);
      h = canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    };
    resize();
    window.addEventListener("resize", resize);

    const mode = t.mode;
    const count = mode === "network" ? 34 : mode === "data" ? 44 : 40;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const parts = Array.from({ length: count }, () => {
      const b = Math.random() > 0.62;
      return {
        x: Math.random() * w, y: Math.random() * h,
        vx: rnd(-0.1, 0.1) * dpr,
        vy: (mode === "embers" ? rnd(-0.45, -0.16) : mode === "data" ? rnd(0.14, 0.44) : rnd(-0.1, 0.1)) * dpr,
        r: (mode === "data" ? rnd(1.2, 2.6) : rnd(4, 10)) * dpr,
        a: rnd(0.14, 0.5),
        tw: rnd(0.006, 0.02),
        ph: Math.random() * Math.PI * 2,
        b,
        sway: rnd(0.2, 0.7),
      };
    });

    let frame = 0, last = 0;
    const FRAME_MS = 33; // ~30fps cap — plenty for calm drift, half the cost of 60
    const draw = (ts) => {
      raf = requestAnimationFrame(draw);
      if (!running) return;
      if (ts - last < FRAME_MS) return;
      last = ts;
      frame++;
      ctx.clearRect(0, 0, w, h);

      if (mode === "network") {
        ctx.lineWidth = dpr * 0.6;
        const max = (140 * dpr) ** 2;
        for (let i = 0; i < parts.length; i++) {
          for (let j = i + 1; j < parts.length; j++) {
            const dx = parts[i].x - parts[j].x, dy = parts[i].y - parts[j].y;
            const d2 = dx * dx + dy * dy;
            if (d2 < max) {
              ctx.strokeStyle = `rgba(${ar},${ag},${ab},${(1 - d2 / max) * 0.1})`;
              ctx.beginPath();
              ctx.moveTo(parts[i].x, parts[i].y);
              ctx.lineTo(parts[j].x, parts[j].y);
              ctx.stroke();
            }
          }
        }
      }

      for (const p of parts) {
        p.x += p.vx + (mode === "petals" ? Math.sin(frame * 0.02 + p.ph) * p.sway * 0.3 * dpr : 0);
        p.y += p.vy;
        p.ph += p.tw;
        if (p.x < -12) p.x = w + 12; else if (p.x > w + 12) p.x = -12;
        if (p.y < -12) p.y = h + 12; else if (p.y > h + 12) p.y = -12;
        const alpha = p.a * (0.55 + 0.45 * Math.sin(p.ph));
        ctx.globalAlpha = alpha;
        if (mode === "data") {
          ctx.fillStyle = p.b ? t.accent2 : t.accent;
          ctx.fillRect(p.x, p.y, p.r, p.r);
        } else {
          const sp = p.b ? spriteB : spriteA;
          const s = p.r * 2.4;
          ctx.drawImage(sp, p.x - s / 2, p.y - s / 2, s, s);
        }
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);

    // Stop the loop entirely when the tab is hidden — no wasted CPU/battery.
    const onVis = () => { running = !document.hidden; if (running) last = 0; };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [t.accent, t.accent2, t.mode, doAnim]);

  const a = t.accent;
  const layer = { position: "absolute", inset: 0, pointerEvents: "none" };
  const anim = (v) => (doAnim ? v : "none"); // static layers still show; motion off when disabled

  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", background: t.base, transition: "background 1.2s ease" }}>
      <div style={{ ...layer, background: `radial-gradient(120% 80% at 50% -10%, ${a}14, transparent 55%), radial-gradient(90% 70% at 85% 110%, ${t.accent2}10, transparent 60%)` }} />

      <div style={{ ...layer, background: `radial-gradient(closest-side, ${a}18, transparent)`, width: "60vw", height: "60vw", left: "-10vw", top: "-15vw", filter: "blur(30px)", animation: anim("ambientDrift 34s ease-in-out infinite") }} />
      <div style={{ ...layer, background: `radial-gradient(closest-side, ${t.accent2}12, transparent)`, width: "55vw", height: "55vw", right: "-15vw", bottom: "-20vw", left: "auto", top: "auto", filter: "blur(34px)", animation: anim("ambientDrift2 44s ease-in-out infinite") }} />

      {t.mood === "grid" && (
        <>
          <div style={{ ...layer, opacity: 0.5, backgroundImage: `linear-gradient(${a}0a 1px, transparent 1px), linear-gradient(90deg, ${a}0a 1px, transparent 1px)`, backgroundSize: "46px 46px", maskImage: "radial-gradient(120% 90% at 50% 30%, #000, transparent 80%)", WebkitMaskImage: "radial-gradient(120% 90% at 50% 30%, #000, transparent 80%)" }} />
          <div style={{ ...layer, height: "38%", background: `linear-gradient(180deg, transparent, ${a}0e, transparent)`, animation: anim("ambientScan 9s linear infinite") }} />
        </>
      )}

      {t.mood === "marble" && (
        <div style={{ ...layer, opacity: 0.5, background: `repeating-linear-gradient(115deg, ${a}00 0px, ${a}00 42px, ${a}0c 44px, ${a}00 48px)`, maskImage: "radial-gradient(80% 60% at 50% 0%, #000, transparent 70%)", WebkitMaskImage: "radial-gradient(80% 60% at 50% 0%, #000, transparent 70%)", animation: anim("ambientRays 26s ease-in-out infinite alternate") }} />
      )}

      {t.mood === "night" && (
        <>
          <div style={{ position: "absolute", top: "10%", right: "16%", width: 90, height: 90, borderRadius: "50%", background: `radial-gradient(circle at 38% 38%, ${a}66, ${a}18 45%, transparent 70%)`, filter: "blur(2px)", pointerEvents: "none" }} />
          <svg viewBox="0 0 1440 320" preserveAspectRatio="none" style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "34vh", opacity: 0.55, pointerEvents: "none" }}>
            <path d="M0 220 L160 150 L320 210 L470 120 L620 200 L780 110 L930 190 L1090 130 L1260 205 L1440 150 L1440 320 L0 320 Z" fill={`${a}12`} />
            <path d="M0 260 L200 200 L360 250 L540 180 L720 245 L900 175 L1080 240 L1280 195 L1440 250 L1440 320 L0 320 Z" fill={`${a}1c`} />
          </svg>
        </>
      )}

      {t.mood === "command" && (
        <svg viewBox="0 0 800 800" style={{ position: "absolute", top: "50%", left: "50%", width: "min(90vw,900px)", height: "min(90vw,900px)", transform: "translate(-50%,-50%)", opacity: 0.24, pointerEvents: "none" }}>
          <g fill="none" stroke={a} strokeWidth="1">
            <circle cx="400" cy="400" r="180" strokeDasharray="4 10" style={{ transformOrigin: "400px 400px", animation: anim("ambientSpin 60s linear infinite") }} />
            <circle cx="400" cy="400" r="280" strokeDasharray="2 16" strokeOpacity="0.6" style={{ transformOrigin: "400px 400px", animation: anim("ambientSpinRev 90s linear infinite") }} />
            <polygon points="400,150 620,400 400,650 180,400" strokeOpacity="0.35" style={{ transformOrigin: "400px 400px", animation: anim("ambientSpin 120s linear infinite") }} />
          </g>
        </svg>
      )}

      {t.mood === "arena" && (
        <div style={{ ...layer, background: `radial-gradient(50% 60% at 22% 0%, ${a}12, transparent 60%), radial-gradient(50% 60% at 78% 0%, ${t.accent2}12, transparent 60%)` }} />
      )}

      {doAnim && <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />}

      <div style={{ ...layer, opacity: 0.05, mixBlendMode: "overlay", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
      <div style={{ ...layer, background: "radial-gradient(130% 100% at 50% 40%, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
    </div>
  );
}
