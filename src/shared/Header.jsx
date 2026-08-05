import { useState, useEffect, useRef } from "react";
import { Flame, Cpu, Menu, HelpCircle, Settings, Gem, Search, MoreHorizontal } from "lucide-react";
import { BD, T1, T2, T3, GL, CY, PU, GR, AM, AC, AC2, RE } from "./designTokens.js";
import { getActiveKillzone, getEATTimeStr } from "../modules/trading/timezone.js";
import { NAV } from "./nav.js";
import { Meter } from "./ui.jsx";
import { CAT_LABEL } from "./xpEngine.js";
import { NotificationCenter } from "./NotificationCenter.jsx";
import { ModeIndicator } from "./ModeIndicator.jsx";
import { useIdentity } from "./identity.jsx";

const CAT_COLOR = { life: GR, trading: CY, fitness: PU, finance: AM, faith: "#9C9C9C", mind: "#B8B8B8", awards: AM };

// Thin divider between items inside the one status cluster, so the pieces read
// as a grouped set rather than separate floating pills.
const Divider = () => <span aria-hidden style={{ width: 1, height: 18, background: BD, flexShrink: 0 }} />;

// One "More" control that folds the secondary icons (search, identity, help)
// behind a single button, keeping the bar to its most-used actions.
function MoreMenu({ items, size = 34 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const shown = items.filter(Boolean);
  if (!shown.length) return null;
  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button onClick={() => setOpen((o) => !o)} aria-label="More" aria-expanded={open} title="More" data-tour="more-btn"
        style={{ width: size, height: size, borderRadius: 10, border: `1px solid ${open ? AC2 + "44" : BD}`, cursor: "pointer", background: open ? `${AC2}12` : GL, color: open ? AC2 : T2, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 40, width: 190, background: "rgba(10,10,10,0.96)", backdropFilter: "blur(14px)", border: `1px solid ${BD}`, borderRadius: 12, boxShadow: "0 14px 40px rgba(0,0,0,0.5)", padding: 6 }}>
          {shown.map((it) => (
            <button key={it.label} onClick={() => { setOpen(false); it.onClick(); }} aria-label={it.label}
              style={{ width: "100%", minHeight: 44, display: "flex", alignItems: "center", gap: 11, padding: "0 11px", borderRadius: 9, border: "none", cursor: "pointer", background: "transparent", color: T1, fontFamily: "inherit", fontSize: 13, textAlign: "left" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = GL; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
              <span style={{ color: it.color || T2, display: "flex", flexShrink: 0 }}>{it.icon}</span>{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Header({ module, aiOpen, onAIToggle, isMobile, onMenu, onNavigate, onOpenHelp, onOpenSettings, onOpenWhoIAm, onOpenSearch, streak = 0, xp = 0, level = 1, xpTitle = "", pctToNext = 0, toNext = 0, xpToday = 0, xpTodayByCat = {} }) {
  const { appName } = useIdentity();
  const label = NAV.find((n) => n.id === module)?.label || "Command Center";
  const [kz, setKz] = useState(getActiveKillzone);
  const [eatTime, setEatTime] = useState(getEATTimeStr);
  const [xpOpen, setXpOpen] = useState(false);
  const xpRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => { setKz(getActiveKillzone()); setEatTime(getEATTimeStr()); }, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!xpOpen) return;
    const onDown = (e) => { if (xpRef.current && !xpRef.current.contains(e.target)) setXpOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [xpOpen]);

  const todayCats = Object.entries(xpTodayByCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

  // Secondary icons folded behind "More" — search, identity, help. Notifications
  // and settings stay at full visibility; identity/AI stays rightmost.
  const moreItems = [
    onOpenSearch && { label: "Search  ⌘K", icon: <Search size={15} />, onClick: onOpenSearch },
    onOpenWhoIAm && { label: "Who I Am", icon: <Gem size={15} />, color: AC2, onClick: onOpenWhoIAm },
    onOpenHelp && { label: "Help & guide", icon: <HelpCircle size={15} />, onClick: onOpenHelp },
  ];

  // ── The XP / level item (shared between layouts) — keeps its breakdown. ──
  const xpItem = xp > 0 && (
    <div ref={xpRef} style={{ position: "relative" }}>
      <button onClick={() => setXpOpen((o) => !o)} aria-label="XP breakdown" title="Tap for today's XP breakdown"
        style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 8px", background: xpOpen ? `${AC2}1E` : "transparent", borderRadius: 8, border: `1px solid ${xpOpen ? AC2 + "44" : "transparent"}`, cursor: "pointer", fontFamily: "inherit" }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: AC2, letterSpacing: 0.5 }}>LVL {level}</span>
        <Meter pct={pctToNext} height={4} fill={`linear-gradient(90deg,${AC2}88,${AC2})`} style={{ width: 46 }} />
        <span style={{ fontSize: 10, color: T3, fontFamily: "monospace" }}>{xp.toLocaleString()}</span>
      </button>
      {xpOpen && (
        <>
          <div onClick={() => setXpOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
          <div style={{ position: "absolute", top: "calc(100% + 10px)", right: 0, zIndex: 40, width: 244, background: "rgba(10,10,10,0.96)", backdropFilter: "blur(14px)", border: `1px solid ${BD}`, borderRadius: 13, boxShadow: "0 14px 40px rgba(0,0,0,0.5)", padding: "14px 15px" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: T1 }}>{xpTitle || `Level ${level}`}</span>
              <span style={{ fontSize: 10, color: T3 }}>{toNext.toLocaleString()} XP to L{level + 1}</span>
            </div>
            <Meter pct={pctToNext} height={5} fill={`linear-gradient(90deg,${AC2}77,${AC2})`} glow={`${AC2}44`} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 9.5, color: T3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Earned today{xpToday > 0 ? ` · +${xpToday.toLocaleString()} XP` : ""}</div>
            {todayCats.length === 0 ? (
              <div style={{ fontSize: 11.5, color: T3, lineHeight: 1.5, padding: "2px 0 4px" }}>Nothing yet today. Complete a habit, log a workout or journal a line — every real action pays in.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {todayCats.map(([c, v]) => (
                  <div key={c} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: CAT_COLOR[c] || T3, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 11.5, color: T2 }}>{CAT_LABEL[c] || c}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: CAT_COLOR[c] || T2, fontFamily: "monospace" }}>+{v.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 9.5, color: T3, marginTop: 11, paddingTop: 9, borderTop: `1px solid ${BD}`, lineHeight: 1.5 }}>
              XP is earned by doing the work — never edited, always in sync.
            </div>
          </div>
        </>
      )}
    </div>
  );

  // ── The one status cluster — killzone/time · level/XP · streak · mode. ──
  const cluster = (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 8px", background: GL, border: `1px solid ${BD}`, borderRadius: 12, flexShrink: 0 }}>
      <div title={kz.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: kz.active ? kz.color : T3, boxShadow: kz.active ? `0 0 6px ${kz.color}` : undefined, flexShrink: 0 }} />
        <span style={{ fontSize: 10, color: kz.active ? kz.color : T2, fontWeight: 600, letterSpacing: 0.3, whiteSpace: "nowrap" }}>{kz.label.split("(")[0].trim()}</span>
        <span style={{ fontSize: 10, color: T3, whiteSpace: "nowrap" }}>{eatTime}</span>
      </div>
      {xpItem && <Divider />}
      {xpItem}
      {streak > 0 && <Divider />}
      {streak > 0 && (
        <div title="Longest active habit streak" style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 2px" }}>
          <Flame size={12} color={AM} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: T1, fontFamily: "monospace" }}>{streak}</span>
        </div>
      )}
      <Divider />
      <ModeIndicator />
    </div>
  );

  if (isMobile) {
    return (
      <div style={{ position: "relative", zIndex: 30, height: 56, background: "rgba(10,10,10,0.72)", backdropFilter: "blur(15px) saturate(125%)", WebkitBackdropFilter: "blur(15px) saturate(125%)", borderBottom: `1px solid ${BD}`, display: "flex", alignItems: "center", padding: "0 12px", gap: 8, flexShrink: 0 }}>
        <button onClick={onMenu} aria-label="Open menu" style={{ width: 40, height: 40, borderRadius: 10, background: GL, border: `1px solid ${BD}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Menu size={18} color={T2} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
          <div style={{ fontSize: 9.5, color: T3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{kz.label.split("(")[0].trim()} · {eatTime} EAT</div>
        </div>
        <ModeIndicator />
        <NotificationCenter onNavigate={onNavigate} />
        {onOpenSettings && (
          <button onClick={onOpenSettings} aria-label="Settings" style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${BD}`, cursor: "pointer", background: GL, color: T2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Settings size={16} />
          </button>
        )}
        <MoreMenu items={moreItems} size={40} />
        <button onClick={onAIToggle} aria-label={`${appName} AI`} style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${aiOpen ? CY + "55" : BD}`, cursor: "pointer", background: aiOpen ? `linear-gradient(135deg,${CY}22,${PU}22)` : GL, color: aiOpen ? CY : T2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Cpu size={16} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", zIndex: 30, height: 60, background: "rgba(10,10,10,0.72)", backdropFilter: "blur(15px) saturate(125%)", WebkitBackdropFilter: "blur(15px) saturate(125%)", borderBottom: `1px solid ${BD}`, display: "flex", alignItems: "center", padding: "0 22px", gap: 14, flexShrink: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T1 }}>{label}</div>
        <div style={{ fontSize: 10, color: T3 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
      </div>

      {cluster}

      <NotificationCenter onNavigate={onNavigate} />
      {onOpenSettings && (
        <button onClick={onOpenSettings} aria-label="Settings" title="Settings" style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${BD}`, cursor: "pointer", background: GL, color: T2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Settings size={15} />
        </button>
      )}
      <MoreMenu items={moreItems} />
      <button onClick={onAIToggle} title={`${appName} AI`} style={{ height: 34, padding: "0 13px", borderRadius: 10, border: `1px solid ${aiOpen ? CY + "55" : BD}`, cursor: "pointer", background: aiOpen ? `linear-gradient(135deg,${CY}22,${PU}22)` : GL, color: aiOpen ? CY : T2, fontSize: 11.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 7, transition: "all 0.2s", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>
        <Cpu size={13} />{appName}
      </button>
    </div>
  );
}
