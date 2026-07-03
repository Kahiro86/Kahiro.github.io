import { useState, useEffect } from "react";
import { B1, BD2, T1, T3, CY } from "../../shared/designTokens.js";
import { DOMAINS } from "./domains.js";

export function LifeMatrix({ size = 280 }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), 300);
    return () => clearTimeout(t);
  }, []);
  const cx = size / 2, cy = size / 2;
  const overall = Math.round(DOMAINS.reduce((s, d) => s + d.score, 0) / DOMAINS.length);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <div style={{ width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ overflow: "visible", display: "block" }}>
        <defs>
          <radialGradient id="cg">
            <stop offset="0%" stopColor={CY} stopOpacity="0.12" />
            <stop offset="100%" stopColor={CY} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={32} fill="url(#cg)" />
        {DOMAINS.map(({ key, r, color }) => (
          <circle key={`b${key}`} cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={9} opacity={0.10} />
        ))}
        {DOMAINS.map(({ key, r, color, score }) => {
          const c = 2 * Math.PI * r;
          const f = on ? (score / 100) * c : 0;
          return (
            <circle
              key={`a${key}`} cx={cx} cy={cy} r={r} fill="none"
              stroke={color} strokeWidth={9} strokeLinecap="round"
              strokeDasharray={`${f} ${c}`} strokeDashoffset={-(c / 4)}
              style={{
                transition: "stroke-dasharray 1.8s cubic-bezier(0.34,1.4,0.64,1)",
                filter: `drop-shadow(0 0 7px ${color}88)`,
              }}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={26} fill={B1} />
        <circle cx={cx} cy={cy} r={26} fill="none" stroke={BD2} strokeWidth={1} />
        <text x={cx} y={cy - 5} textAnchor="middle" fill={T1} fontSize="21" fontWeight="900" fontFamily="'JetBrains Mono',monospace">
          {overall}
        </text>
        <text x={cx} y={cy + 11} textAnchor="middle" fill={T3} fontSize="7" letterSpacing="2.5" fontFamily="system-ui">
          LIFE SCORE
        </text>
      </svg>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, flexShrink: 0 }}>
        {DOMAINS.map(({ key, label, color, score }) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` }} />
            <span style={{ fontSize: 9.5, color: T3, letterSpacing: 1.2, width: 58 }}>{label}</span>
            <span style={{ fontSize: 11, color, fontFamily: "monospace", fontWeight: 700 }}>{score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
