// ── SubTabs — a lightweight in-tab segmented switcher ────────────────
// When several former top-level tabs are merged into one destination, this
// renders the inner switch: a small pill row sitting above the chosen
// section's own content. Lighter than ModuleTabs (no frosted header bar) so
// it reads as sub-navigation, not a second module header. Reused across the
// finance/faith/mind/life merges.
import { BD, GL, T2 } from "./designTokens.js";

export function SubTabs({ tabs, active, onSelect, accent = "#78C8FF" }) {
  return (
    <div style={{ display: "flex", gap: 3, background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: 3, margin: "16px 24px 0", width: "fit-content", maxWidth: "100%", flexWrap: "wrap" }}>
      {tabs.map(({ id, l, i: Icon }) => (
        <button key={id} onClick={() => onSelect(id)}
          style={{
            display: "flex", alignItems: "center", gap: 5, padding: "6px 13px", borderRadius: 8, border: "none",
            cursor: "pointer", background: active === id ? `${accent}22` : "transparent",
            color: active === id ? "#FFFFFF" : T2, fontSize: 12, fontWeight: active === id ? 700 : 400,
            fontFamily: "inherit", whiteSpace: "nowrap",
          }}>
          {Icon && <Icon size={12} />}{l}
        </button>
      ))}
    </div>
  );
}
