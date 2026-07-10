// ── Module tab bar — the one sub-navigation shell every OS uses ──────
// Seven modules previously carried byte-identical copies of this header,
// differing only in tint, accent and what sits beside the tabs. The frosted
// bar, pill group and active styling live here once; modules pass their
// accent and drop extra widgets (`left` renders before the tabs, children
// after — add your own spacer where needed).
import { BD, GL, T2 } from "./designTokens.js";

export function ModuleTabs({
  tabs, active, onSelect,
  activeBg, activeColor,
  tint = "rgba(9,13,24,0.5)",
  topBorder,             // trading/finance style: accent hairline on the active tab
  pad = "6px 12px", fontSize = 12, gap = 12,
  left, children,
}) {
  return (
    <div style={{ background: tint, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", borderBottom: `1px solid ${BD}`, padding: "10px 24px", display: "flex", alignItems: "center", gap, flexShrink: 0, overflowX: "auto" }}>
      {left}
      <div style={{ display: "flex", gap: 3, background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: 3 }}>
        {tabs.map(({ id, l, i: Icon }) => (
          <button key={id} onClick={() => onSelect(id)}
            style={{
              display: "flex", alignItems: "center", gap: 5, padding: pad, borderRadius: 8, border: "none",
              cursor: "pointer", background: active === id ? activeBg : "transparent",
              color: active === id ? activeColor : T2, fontSize, fontWeight: active === id ? 600 : 400,
              fontFamily: "inherit", whiteSpace: "nowrap",
              ...(topBorder ? { borderTop: active === id ? `1px solid ${topBorder}` : "1px solid transparent" } : {}),
            }}>
            {Icon && <Icon size={11} />}{l}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
