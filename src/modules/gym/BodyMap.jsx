// ── Gym Wave 4 · Muscle radar ─────────────────────────────────────────────
// A hexagon radar of the six muscle groups (chest / back / shoulders / arms /
// core / legs), each axis reaching out by the group's rank — the spatial
// "body map" of where the work has gone. Mirrors GymXP's own group-radar
// approach rather than an anatomical SVG. Pure SVG, theme-gold.
import { GROUPS, groupRollup } from "./engine.js";
import { AC, AC2, GR, T1, T2, T3, BD, B1 } from "../../shared/designTokens.js";

const RANK_TIER = { unranked: 0, F: 1, E: 2, D: 3, C: 4, B: 5, A: 6, S: 7 };
const RANK_COLOR = { unranked: "#5A5348", F: "#6B6456", E: "#8A8378", D: "#A67D1F", C: "#C9962B", B: AC, A: AC2, S: GR };

export function MuscleRadar({ muscleTotals }) {
  const groups = groupRollup(muscleTotals);
  const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
  // Fixed axis order around the hexagon.
  const axes = GROUPS.map((g) => {
    const gr = byId[g.id] || { xp: 0, rank: "unranked" };
    return { id: g.id, label: g.displayName, rank: gr.rank, frac: RANK_TIER[gr.rank] / 7 };
  });

  const size = 260, cx = size / 2, cy = size / 2, R = 92;
  const angle = (i) => (-90 + i * 60) * (Math.PI / 180);
  const pt = (i, r) => [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];

  const ring = (frac) => GROUPS.map((_, i) => pt(i, R * frac).join(",")).join(" ");
  const shape = axes.map((a, i) => pt(i, Math.max(0.04, a.frac) * R).join(",")).join(" ");

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", maxWidth: 280 }}>
        {/* grid rings */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={ring(f)} fill="none" stroke={BD} strokeWidth={1} />
        ))}
        {/* axes */}
        {GROUPS.map((_, i) => {
          const [x, y] = pt(i, R);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={BD} strokeWidth={1} />;
        })}
        {/* filled shape */}
        <polygon points={shape} fill={`${AC}33`} stroke={AC} strokeWidth={2} strokeLinejoin="round" />
        {/* vertices */}
        {axes.map((a, i) => {
          const [x, y] = pt(i, Math.max(0.04, a.frac) * R);
          return <circle key={i} cx={x} cy={y} r={3} fill={RANK_COLOR[a.rank] || AC} />;
        })}
        {/* labels */}
        {axes.map((a, i) => {
          const [x, y] = pt(i, R + 18);
          return (
            <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
              fontSize={9} fontWeight={700} fill={T2} fontFamily="monospace">
              {a.label}
              <tspan x={x} dy={11} fill={RANK_COLOR[a.rank] || T3} fontSize={9}>{a.rank === "unranked" ? "–" : a.rank}</tspan>
            </text>
          );
        })}
      </svg>
    </div>
  );
}
