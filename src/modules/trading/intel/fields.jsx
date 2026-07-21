// ── Trading Intelligence — field-type primitives ─────────────────────
// The modular entry form is built from these so every field uses the most
// suitable input type (rating, multi-select, toggle, segment, auto-calc…).
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { BD, B2, T1, T2, T3, GL, CY, GR, RE } from "../../../shared/designTokens.js";

export const AK = CY;

export const Lbl = ({ children, hint }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
    <span style={{ fontSize: 10, color: T3, letterSpacing: 1.1, textTransform: "uppercase" }}>{children}</span>
    {hint && <span style={{ fontSize: 10, color: T3, fontStyle: "italic" }}>{hint}</span>}
  </div>
);

// Collapsible form section — keeps the long entry form uncluttered.
export function Section({ title, sub, children, defaultOpen = true, accent = AK }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid ${BD}`, borderRadius: 12, background: "rgba(255,255,255,0.02)", overflow: "hidden" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 15px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: T1 }}>{title}</span>
          {sub && <span style={{ fontSize: 10, color: T3 }}>{sub}</span>}
        </span>
        <span style={{ fontSize: 11, color: accent, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>▸</span>
      </button>
      {open && <div style={{ padding: "0 15px 15px", display: "flex", flexDirection: "column", gap: 13 }}>{children}</div>}
    </div>
  );
}

export const NumInp = ({ value, onChange, placeholder, step, mono = true }) => (
  <input type="text" inputMode="decimal" value={value} placeholder={placeholder}
    onChange={(e) => { const v = e.target.value; if (v === "" || /^-?\d*\.?\d*$/.test(v)) onChange(v); }}
    style={{ width: "100%", background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 12px", fontSize: 12.5, color: T1, outline: "none", fontFamily: mono ? "'JetBrains Mono',monospace" : "inherit", boxSizing: "border-box" }} />
);

export const TextArea = ({ value, onChange, placeholder, rows = 2 }) => (
  <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{ width: "100%", background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 12px", fontSize: 12.5, color: T1, lineHeight: 1.5, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
);

// Single-select segment.
export function Seg({ options, value, onChange, accent = AK }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((o) => {
        const v = o.v ?? o, l = o.l ?? o;
        const on = value === v;
        return (
          <button key={v} onClick={() => onChange(v)} style={{ padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: on ? 700 : 500, background: on ? `${accent}22` : GL, border: `1px solid ${on ? accent + "66" : BD}`, color: on ? "#FFFFFF" : T3 }}>{l}</button>
        );
      })}
    </div>
  );
}

// Multi-select chips with inline "add custom" — the workhorse for
// conditions / confluences / mistakes / emotions / sessions.
export function ChipMulti({ options, selected, onChange, accent = AK, allowAdd = true, placeholder = "Add custom…" }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const toggle = (name) => onChange(selected.includes(name) ? selected.filter((s) => s !== name) : [...selected, name]);
  const add = () => { const v = draft.trim(); if (v && !options.includes(v) && !selected.includes(v)) onChange([...selected, v]); setDraft(""); setAdding(false); };
  const extras = selected.filter((s) => !options.includes(s));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {[...options, ...extras].map((name) => {
        const on = selected.includes(name);
        return (
          <button key={name} onClick={() => toggle(name)} style={{ padding: "5px 11px", borderRadius: 16, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: on ? 600 : 400, background: on ? `${accent}22` : GL, border: `1px solid ${on ? accent + "66" : BD}`, color: on ? accent : T2 }}>{name}</button>
        );
      })}
      {allowAdd && (adding ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") { setAdding(false); setDraft(""); } }} onBlur={add} placeholder={placeholder}
            style={{ width: 120, background: B2, border: `1px solid ${accent}55`, borderRadius: 16, padding: "5px 11px", fontSize: 11, color: T1, outline: "none", fontFamily: "inherit" }} />
        </span>
      ) : (
        <button onClick={() => setAdding(true)} style={{ padding: "5px 10px", borderRadius: 16, cursor: "pointer", fontFamily: "inherit", fontSize: 11, background: "none", border: `1px dashed ${BD}`, color: T3, display: "inline-flex", alignItems: "center", gap: 3 }}><Plus size={11} /> add</button>
      ))}
    </div>
  );
}

// 1–10 rating with a live value and a colour that warms with the score.
export function Rating({ value, onChange, accent = AK }) {
  const v = Number.isFinite(+value) ? +value : 0;
  const col = v === 0 ? T3 : v >= 8 ? GR : v >= 5 ? accent : v >= 3 ? "#E3B341" : RE;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <input type="range" min={0} max={10} value={v} onChange={(e) => onChange(+e.target.value)} style={{ flex: 1, accentColor: col }} />
      <span style={{ fontSize: 15, fontWeight: 800, color: col, fontFamily: "'JetBrains Mono',monospace", width: 26, textAlign: "right" }}>{v || "—"}</span>
    </div>
  );
}

export const Toggle = ({ on, onChange, label, accent = AK }) => (
  <button onClick={() => onChange(!on)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 12, background: on ? `${accent}18` : GL, border: `1px solid ${on ? accent + "55" : BD}`, color: on ? "#FFFFFF" : T2 }}>
    <span style={{ width: 30, height: 16, borderRadius: 10, background: on ? accent : BD, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
    </span>
    {label}
  </button>
);

// Read-only auto-calculated value display.
export const AutoCalc = ({ label, value, color = AK }) => (
  <div style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "8px 11px" }}>
    <div style={{ fontSize: 9, color: T3, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 800, color, fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>{value}</div>
  </div>
);

export { X };
