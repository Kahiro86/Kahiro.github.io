import { Cpu, ChevronRight, ChevronLeft, Settings, X } from "lucide-react";
import { B1, BD, T1, T2, T3, GL, CY, PU } from "./designTokens.js";
import { NAV } from "./nav.js";

export function Sidebar({ active, onNavigate, collapsed, onToggle, onOpenSettings, overlay }) {
  // In overlay (mobile drawer) mode the sidebar is always expanded and
  // floats above content; the toggle becomes a close button.
  const isCollapsed = overlay ? false : collapsed;
  const overlayStyle = overlay
    ? { position: "fixed", top: 0, left: 0, zIndex: 46, boxShadow: "0 0 44px rgba(0,0,0,0.6)" }
    : {};
  return (
    <div style={{ width: isCollapsed ? 64 : 226, height: "100vh", background: B1, borderRight: `1px solid ${BD}`, display: "flex", flexDirection: "column", flexShrink: 0, transition: "width 0.28s cubic-bezier(0.4,0,0.2,1)", overflow: "hidden", ...overlayStyle }}>
      <div style={{ padding: "16px 13px", borderBottom: `1px solid ${BD}`, display: "flex", alignItems: "center", gap: 10, height: 60 }}>
        <div style={{ width: 31, height: 31, borderRadius: 8, background: `linear-gradient(135deg,${CY},${PU})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 0 18px ${CY}44` }}>
          <Cpu size={15} color="#000" />
        </div>
        {!isCollapsed && (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: T1, letterSpacing: 3, whiteSpace: "nowrap" }}>ARCHITECT</div>
            <div style={{ fontSize: 8.5, color: T3, letterSpacing: 2 }}>LIFE OS v2.1</div>
          </div>
        )}
        {overlay && (
          <button onClick={onToggle} aria-label="Close menu" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", padding: 4 }}>
            <X size={18} />
          </button>
        )}
      </div>
      <div style={{ flex: 1, padding: "9px 7px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {NAV.filter((n) => !n.soon).map(({ id, label, icon: Icon }) => {
          const on = active === id;
          return (
            <button
              key={id} onClick={() => onNavigate(id)} title={isCollapsed ? label : ""}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: isCollapsed ? "10px 16px" : "9px 11px", borderRadius: 10, border: "none", cursor: "pointer", background: on ? `linear-gradient(135deg,${CY}16,${PU}16)` : "transparent", color: on ? CY : T2, borderLeft: `2px solid ${on ? CY : "transparent"}`, fontSize: 12.5, fontWeight: on ? 600 : 400, textAlign: "left", transition: "all 0.15s", whiteSpace: "nowrap", width: "100%", fontFamily: "inherit" }}
              onMouseEnter={(e) => { if (!on) { e.currentTarget.style.background = GL; e.currentTarget.style.color = T1; } }}
              onMouseLeave={(e) => { if (!on) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T2; } }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />{!isCollapsed && label}
            </button>
          );
        })}

        {!isCollapsed && (
          <div style={{ fontSize: 8.5, color: T3, letterSpacing: 2, padding: "12px 11px 4px", textTransform: "uppercase" }}>Coming soon</div>
        )}
        {NAV.filter((n) => n.soon).map(({ id, label, icon: Icon }) => {
          const on = active === id;
          return (
            <button
              key={id} onClick={() => onNavigate(id)} title={isCollapsed ? `${label} (coming soon)` : ""}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: isCollapsed ? "8px 16px" : "7px 11px", borderRadius: 10, border: "none", cursor: "pointer", background: on ? `linear-gradient(135deg,${CY}16,${PU}16)` : "transparent", color: on ? CY : T3, borderLeft: `2px solid ${on ? CY : "transparent"}`, fontSize: 12, fontWeight: on ? 600 : 400, textAlign: "left", transition: "all 0.15s", whiteSpace: "nowrap", width: "100%", fontFamily: "inherit", opacity: on ? 1 : 0.6 }}
              onMouseEnter={(e) => { if (!on) { e.currentTarget.style.background = GL; e.currentTarget.style.opacity = 1; } }}
              onMouseLeave={(e) => { if (!on) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.opacity = 0.6; } }}
            >
              <Icon size={15} style={{ flexShrink: 0 }} />{!isCollapsed && label}
            </button>
          );
        })}
      </div>
      <div style={{ padding: "9px 7px", borderTop: `1px solid ${BD}`, display: "flex", flexDirection: "column", gap: 2 }}>
        {[
          { icon: overlay ? X : isCollapsed ? ChevronRight : ChevronLeft, label: overlay ? "Close" : "Collapse", fn: onToggle },
          { icon: Settings, label: "Settings", fn: onOpenSettings },
        ].map(({ icon: Icon, label, fn }) => (
          <button key={label} onClick={fn} style={{ display: "flex", alignItems: "center", gap: 10, padding: isCollapsed ? "10px 16px" : "9px 11px", borderRadius: 10, border: "none", cursor: "pointer", background: "transparent", color: T3, fontSize: 12.5, textAlign: "left", transition: "all 0.15s", whiteSpace: "nowrap", width: "100%", fontFamily: "inherit" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = GL; e.currentTarget.style.color = T1; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T3; }}>
            <Icon size={16} style={{ flexShrink: 0 }} />{!isCollapsed && label}
          </button>
        ))}
      </div>
    </div>
  );
}
