// Collapsible section — keeps dense modules calm. Header always visible,
// body folds; open state persists per section id across visits.
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { BD, T1, T3, GL } from "./designTokens.js";

const KEY = "kahiro_collapse"; // ui preference only — device-local by design

const readPrefs = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
};

export function Collapse({ id, title, sub, count, defaultOpen = true, children, right }) {
  const [open, setOpen] = useState(() => readPrefs()[id] ?? defaultOpen);
  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      try { localStorage.setItem(KEY, JSON.stringify({ ...readPrefs(), [id]: next })); } catch { /* ui pref only */ }
      return next;
    });
  };
  return (
    <div>
      <button onClick={toggle} aria-expanded={open}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 4px", background: "none", border: "none", borderBottom: `1px solid ${BD}`, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
        <ChevronDown size={13} color={T3} style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform 0.2s", flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: T1, letterSpacing: 1.5, textTransform: "uppercase" }}>{title}</span>
        {count != null && <span style={{ fontSize: 10, color: T3, background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "1px 7px" }}>{count}</span>}
        {sub && <span style={{ fontSize: 10.5, color: T3 }}>{sub}</span>}
        <span style={{ flex: 1 }} />
        {right}
      </button>
      {open && <div style={{ paddingTop: 12 }}>{children}</div>}
    </div>
  );
}
