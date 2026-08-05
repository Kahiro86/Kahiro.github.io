// ── Body map — a schematic front/back silhouette in the app's dark-brown /
// gold line-art style (no anatomical photorealism). Muscle groups worked in a
// session light up gold; everything else stays a dim outline. Used on the
// day's closed workout view and in the weekly Journals record.
import { T2, T3, AC2 } from "./designTokens.js";

const DIM = "#5b5048";       // warm-brown dim outline for unworked groups
const GOLD = AC2;            // worked groups
const NEUTRAL = "#3a342e";   // head/neck — never a muscle group

// A muscle zone: highlighted (gold stroke + faint gold fill) when worked, or
// when the session is tagged full-body.
function Zone({ on, children }) {
  return <g style={{ stroke: on ? GOLD : DIM, fill: on ? `${GOLD}26` : "transparent", strokeWidth: 1.6, strokeLinejoin: "round", transition: "stroke .2s, fill .2s" }}>{children}</g>;
}

export function BodyMap({ muscles = [], size = 220, showLabels = true, caption = null }) {
  const set = new Set(muscles);
  const on = (m) => set.has(m) || set.has("full-body");
  const h = Math.round(size * 0.62);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={size} height={h} viewBox="0 0 200 130" role="img" aria-label={`Muscles worked: ${muscles.length ? muscles.join(", ") : "none"}`} style={{ maxWidth: "100%" }}>
        {/* ── FRONT (left figure, cx≈52) ── */}
        {/* head + neck — neutral */}
        <g style={{ stroke: NEUTRAL, fill: "transparent", strokeWidth: 1.6 }}>
          <circle cx="52" cy="13" r="8" />
          <path d="M48 20 L48 25 M56 20 L56 25" />
        </g>
        <Zone on={on("shoulders")}><ellipse cx="37" cy="30" rx="7" ry="5" /><ellipse cx="67" cy="30" rx="7" ry="5" /></Zone>
        <Zone on={on("chest")}><path d="M40 28 h24 a3 3 0 0 1 3 3 v9 a4 4 0 0 1 -4 4 h-22 a4 4 0 0 1 -4 -4 v-9 a3 3 0 0 1 3 -3 z" /></Zone>
        <Zone on={on("arms")}><rect x="28" y="30" width="7" height="26" rx="3.5" /><rect x="69" y="30" width="7" height="26" rx="3.5" /></Zone>
        <Zone on={on("core")}><rect x="42" y="46" width="20" height="24" rx="4" /></Zone>
        <Zone on={on("legs")}><rect x="42" y="72" width="9" height="42" rx="4" /><rect x="53" y="72" width="9" height="42" rx="4" /></Zone>
        {showLabels && <text x="52" y="126" textAnchor="middle" style={{ fill: T3, fontSize: 8, letterSpacing: 1, textTransform: "uppercase", stroke: "none", fontFamily: "inherit" }}>Front</text>}

        {/* ── BACK (right figure, cx≈148) ── */}
        <g style={{ stroke: NEUTRAL, fill: "transparent", strokeWidth: 1.6 }}>
          <circle cx="148" cy="13" r="8" />
          <path d="M144 20 L144 25 M152 20 L152 25" />
        </g>
        <Zone on={on("shoulders")}><ellipse cx="133" cy="30" rx="7" ry="5" /><ellipse cx="163" cy="30" rx="7" ry="5" /></Zone>
        <Zone on={on("back")}><path d="M136 28 h24 a3 3 0 0 1 3 3 v18 a4 4 0 0 1 -4 4 h-22 a4 4 0 0 1 -4 -4 v-18 a3 3 0 0 1 3 -3 z" /></Zone>
        <Zone on={on("arms")}><rect x="124" y="30" width="7" height="26" rx="3.5" /><rect x="165" y="30" width="7" height="26" rx="3.5" /></Zone>
        <Zone on={on("glutes")}><rect x="138" y="55" width="20" height="15" rx="5" /></Zone>
        <Zone on={on("legs")}><rect x="138" y="72" width="9" height="42" rx="4" /><rect x="149" y="72" width="9" height="42" rx="4" /></Zone>
        {showLabels && <text x="148" y="126" textAnchor="middle" style={{ fill: T3, fontSize: 8, letterSpacing: 1, textTransform: "uppercase", stroke: "none", fontFamily: "inherit" }}>Back</text>}
      </svg>
      {caption && <div style={{ fontSize: 11, color: T2, textAlign: "center" }}>{caption}</div>}
    </div>
  );
}
