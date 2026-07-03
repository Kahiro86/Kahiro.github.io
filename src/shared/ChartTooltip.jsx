import { B2, BD2, T3, CY } from "./designTokens.js";

export function ChartTooltip({ active, payload, label, prefix = "", suffix = "" }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: B2, border: `1px solid ${BD2}`, borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
      <div style={{ color: T3, marginBottom: 5 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || CY, fontWeight: 700, fontFamily: "monospace" }}>
          {prefix}{typeof p.value === "number" ? p.value.toLocaleString() : p.value}{suffix}
        </div>
      ))}
    </div>
  );
}

export const mkTT = (prefix, suffix) => (props) => <ChartTooltip {...props} prefix={prefix} suffix={suffix} />;
