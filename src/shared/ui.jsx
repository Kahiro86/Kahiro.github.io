import { ArrowUp, ArrowDown } from "lucide-react";
import { B1, B2, GL, BD, T1, T2, T3, RE, GR, CY, PU } from "./designTokens.js";

export const Card = ({ children, style = {}, ...rest }) => (
  <div {...rest} style={{ background: B1, border: `1px solid ${BD}`, borderRadius: 16, ...style }}>
    {children}
  </div>
);

export const SH = ({ title, sub, action }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: T1 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: T3, marginTop: 3 }}>{sub}</div>}
    </div>
    {action}
  </div>
);

export const Chip = ({ label, value, color = CY, delta }) => (
  <div style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 12, padding: "13px 16px" }}>
    <div style={{ fontSize: 10, color: T3, letterSpacing: 1.2, marginBottom: 7, textTransform: "uppercase" }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "'JetBrains Mono',monospace" }}>{value}</div>
    {delta !== undefined && (
      <div style={{ fontSize: 11, color: delta >= 0 ? GR : RE, marginTop: 4, display: "flex", alignItems: "center", gap: 3 }}>
        {delta >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
        {Math.abs(delta)}%
      </div>
    )}
  </div>
);

export const Fld = ({ label, required, children, hint }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
      <label style={{ fontSize: 10.5, color: T3, letterSpacing: 1.2, textTransform: "uppercase" }}>
        {label}{required && <span style={{ color: RE, marginLeft: 3 }}>*</span>}
      </label>
      {hint && <span style={{ fontSize: 10, color: T3, fontStyle: "italic" }}>{hint}</span>}
    </div>
    {children}
  </div>
);

export const Inp = ({ value, onChange, placeholder, type = "text", mono }) => (
  <input
    type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
    style={{
      width: "100%", background: GL, border: `1px solid ${BD}`, borderRadius: 9,
      padding: "10px 13px", fontSize: 13, color: T1, outline: "none",
      fontFamily: mono ? "'JetBrains Mono',monospace" : "inherit", boxSizing: "border-box",
    }}
  />
);

export const Sel = ({ value, onChange, options, placeholder }) => (
  <select
    value={value} onChange={(e) => onChange(e.target.value)}
    style={{
      width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 9,
      padding: "10px 13px", fontSize: 12.5, color: value ? T1 : T3,
      outline: "none", fontFamily: "inherit", cursor: "pointer", appearance: "none",
    }}
  >
    {placeholder && <option value="">{placeholder}</option>}
    {options.map((o) => {
      const v = o.v ?? o.value ?? o;
      const l = o.l ?? o.label ?? o;
      return <option key={v} value={v}>{l}</option>;
    })}
  </select>
);

export const DirTog = ({ value, onChange }) => (
  <div style={{ display: "flex", background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: 4, gap: 4 }}>
    {["LONG", "SHORT"].map((d) => (
      <button
        key={d} onClick={() => onChange(d)}
        style={{
          flex: 1, padding: "9px", borderRadius: 8, border: "none", cursor: "pointer",
          background: value === d ? (d === "LONG" ? GR : RE) : "transparent",
          color: value === d ? "#000" : T2, fontSize: 13, fontWeight: 700,
          transition: "all 0.2s", fontFamily: "inherit",
        }}
      >
        {d}
      </button>
    ))}
  </div>
);

export const DirTogGeneric = ({ value, onChange, options }) => (
  <div style={{ display: "flex", background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: 4, gap: 4 }}>
    {options.map((o) => (
      <button
        key={o.v} onClick={() => onChange(o.v)}
        style={{
          flex: 1, padding: "9px", borderRadius: 8, border: "none", cursor: "pointer",
          background: value === o.v ? `linear-gradient(135deg,${PU},${CY})` : "transparent",
          color: value === o.v ? "#000" : T2, fontSize: 12.5, fontWeight: 700,
          transition: "all 0.2s", fontFamily: "inherit",
        }}
      >
        {o.l}
      </button>
    ))}
  </div>
);

export const Tags = ({ selected, options, onChange, color = CY }) => {
  const toggle = (o) => onChange(selected.includes(o) ? selected.filter((s) => s !== o) : [...selected, o]);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o} onClick={() => toggle(o)}
            style={{
              padding: "4px 10px", borderRadius: 20,
              border: `1px solid ${on ? color + "66" : BD}`,
              background: on ? `${color}22` : GL,
              color: on ? color : T2, fontSize: 11, cursor: "pointer",
              transition: "all 0.15s", fontWeight: on ? 600 : 400, fontFamily: "inherit",
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
};

export const Radio = ({ value, onChange, options, color = CY }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
    {options.map((o) => {
      const v = o.v ?? o.value ?? o;
      const l = o.l ?? o.label ?? o;
      const on = value === v;
      return (
        <button
          key={v} onClick={() => onChange(v)}
          style={{
            padding: "5px 11px", borderRadius: 20,
            border: `1px solid ${on ? color + "66" : BD}`,
            background: on ? `${color}22` : GL,
            color: on ? color : T2, fontSize: 11.5, cursor: "pointer",
            transition: "all 0.15s", fontWeight: on ? 600 : 400, fontFamily: "inherit",
          }}
        >
          {l}
        </button>
      );
    })}
  </div>
);

export const SL = ({ value, onChange }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <input type="range" min={1} max={10} value={value} onChange={(e) => onChange(+e.target.value)} style={{ flex: 1, accentColor: CY }} />
    <span style={{ fontSize: 16, fontWeight: 800, color: CY, fontFamily: "monospace", width: 24, textAlign: "right" }}>{value}</span>
  </div>
);
