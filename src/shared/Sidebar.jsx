import { Cpu, ChevronRight, ChevronLeft, Settings } from "lucide-react";
import { B1, BD, T1, T2, T3, GL, CY, PU } from "./designTokens.js";
import { NAV } from "./nav.js";

export function Sidebar({ active, onNavigate, collapsed, onToggle, onOpenSettings }) {
  return (
    <div style={{ width: collapsed ? 64 : 226, height: "100vh", background: B1, borderRight: `1px solid ${BD}`, display: "flex", flexDirection: "column", flexShrink: 0, transition: "width 0.28s cubic-bezier(0.4,0,0.2,1)", overflow: "hidden" }}>
      <div style={{ padding: "16px 13px", borderBottom: `1px solid ${BD}`, display: "flex", alignItems: "center", gap: 10, height: 60 }}>
        <div style={{ width: 31, height: 31, borderRadius: 8, background: `linear-gradient(135deg,${CY},${PU})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 0 18px ${CY}44` }}>
          <Cpu size={15} color="#000" />
        </div>
        {!collapsed && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: T1, letterSpacing: 3, whiteSpace: "nowrap" }}>ARCHITECT</div>
            <div style={{ fontSize: 8.5, color: T3, letterSpacing: 2 }}>LIFE OS v2.1</div>
          </div>
        )}
      </div>
      <div style={{ flex: 1, padding: "9px 7px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {NAV.map(({ id, label, icon: Icon }) => {
          const on = active === id;
          return (
            <button
              key={id} onClick={() => onNavigate(id)} title={collapsed ? label : ""}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: collapsed ? "10px 16px" : "9px 11px", borderRadius: 10, border: "none", cursor: "pointer", background: on ? `linear-gradient(135deg,${CY}16,${PU}16)` : "transparent", color: on ? CY : T2, borderLeft: `2px solid ${on ? CY : "transparent"}`, fontSize: 12.5, fontWeight: on ? 600 : 400, textAlign: "left", transition: "all 0.15s", whiteSpace: "nowrap", width: "100%", fontFamily: "inherit" }}
              onMouseEnter={(e) => { if (!on) { e.currentTarget.style.background = GL; e.currentTarget.style.color = T1; } }}
              onMouseLeave={(e) => { if (!on) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T2; } }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />{!collapsed && label}
            </button>
          );
        })}
      </div>
      <div style={{ padding: "9px 7px", borderTop: `1px solid ${BD}`, display: "flex", flexDirection: "column", gap: 2 }}>
        {[
          { icon: collapsed ? ChevronRight : ChevronLeft, label: "Collapse", fn: onToggle },
          { icon: Settings, label: "Settings", fn: onOpenSettings },
        ].map(({ icon: Icon, label, fn }) => (
          <button key={label} onClick={fn} style={{ display: "flex", alignItems: "center", gap: 10, padding: collapsed ? "10px 16px" : "9px 11px", borderRadius: 10, border: "none", cursor: "pointer", background: "transparent", color: T3, fontSize: 12.5, textAlign: "left", transition: "all 0.15s", whiteSpace: "nowrap", width: "100%", fontFamily: "inherit" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = GL; e.currentTarget.style.color = T1; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T3; }}>
            <Icon size={16} style={{ flexShrink: 0 }} />{!collapsed && label}
          </button>
        ))}
      </div>
    </div>
  );
}
