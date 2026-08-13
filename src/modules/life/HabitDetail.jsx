// ── Screen 2 · Habit Detail (spec §4) — STAGED BUILD ─────────────────────
// This response builds ONLY Card A (header + meta + management) so the list →
// detail navigation works and habit editing/deleting (which moved off the list
// cards) is preserved. Cards B–D (Overview ring, Score trend, History) are
// intentionally left as labelled placeholders and will be built at the Screen 2
// review gate. Nothing here fabricates a score.
import { useState } from "react";
import { ChevronLeft, Pencil, MoreVertical, Flame, Trophy, Copy, Pause, Play, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { currentStreak, longestStreak } from "../../shared/habitEngine.js";
import { HT, frequencyLabel } from "./habitTheme.js";

function subtitleOf(h) {
  const note = (h.notes || "").trim();
  if (note) return note;
  return `${h.name} · ${frequencyLabel(h)}`;
}

export function HabitDetail({ habit, onBack, onEdit, onDuplicate, onTogglePause, onToggleArchive, onDelete }) {
  const [menu, setMenu] = useState(false);
  const cur = currentStreak(habit);
  const best = longestStreak(habit);

  const Placeholder = ({ label }) => (
    <div style={{ background: HT.bgCard, border: `1px solid ${HT.border}`, borderRadius: 12, padding: "18px 16px" }}>
      <div style={{ fontSize: 12, color: HT.textSecondary, textTransform: "lowercase", letterSpacing: 0.5, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 12, color: HT.textSecondary, opacity: 0.7 }}>Coming in the next step.</div>
    </div>
  );

  return (
    <div style={{ padding: "16px 16px 40px", display: "flex", flexDirection: "column", gap: 12, maxWidth: 640, margin: "0 auto" }}>
      {/* Card A — header */}
      <div style={{ background: HT.bgCard, border: `1px solid ${HT.border}`, borderRadius: 12, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} aria-label="Back" style={{ background: "transparent", border: "none", color: HT.textSecondary, cursor: "pointer", display: "flex", padding: 2 }}><ChevronLeft size={20} /></button>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `${HT.gold}1A`, border: `1px solid ${HT.gold}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{habit.icon}</div>
          <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 500, color: HT.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{habit.name}</div>
          <button onClick={() => onEdit(habit)} aria-label="Edit" style={{ background: "transparent", border: "none", color: HT.textSecondary, cursor: "pointer", display: "flex", padding: 4 }}><Pencil size={16} /></button>
          <div style={{ position: "relative" }}>
            <button onClick={() => setMenu((o) => !o)} aria-label="More" style={{ background: "transparent", border: "none", color: HT.textSecondary, cursor: "pointer", display: "flex", padding: 4 }}><MoreVertical size={17} /></button>
            {menu && (
              <>
                <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
                <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 21, width: 168, background: HT.bgCard, border: `1px solid ${HT.border}`, borderRadius: 11, boxShadow: "0 14px 40px rgba(0,0,0,0.5)", padding: 6 }}>
                  {[
                    { icon: <Copy size={14} />, label: "Duplicate", fn: () => onDuplicate(habit), color: HT.textPrimary },
                    { icon: habit.paused ? <Play size={14} /> : <Pause size={14} />, label: habit.paused ? "Resume" : "Pause", fn: () => onTogglePause(habit), color: HT.textPrimary },
                    { icon: habit.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />, label: habit.archived ? "Restore" : "Archive", fn: () => onToggleArchive(habit), color: HT.textPrimary },
                    { icon: <Trash2 size={14} />, label: "Delete", fn: () => { onDelete(habit); onBack(); }, color: HT.red },
                  ].map((it) => (
                    <button key={it.label} onClick={() => { setMenu(false); it.fn(); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, border: "none", background: "transparent", color: it.color, fontSize: 13, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                      {it.icon}{it.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ fontSize: 12.5, color: HT.textSecondary, lineHeight: 1.5, margin: "10px 0 12px", paddingLeft: 2 }}>{subtitleOf(habit)}</div>

        <div style={{ display: "flex", gap: 18, paddingLeft: 2, flexWrap: "wrap" }}>
          <Meta label={frequencyLabel(habit)} />
          <Meta icon={<Flame size={13} color={HT.gold} />} value={`${cur}d`} label="streak" />
          <Meta icon={<Trophy size={13} color={HT.gold} />} value={`${best}d`} label="best" />
        </div>
      </div>

      {/* Cards B–D — placeholders until the Screen 2 gate */}
      <Placeholder label="overview" />
      <Placeholder label="score trend" />
      <Placeholder label="history" />
    </div>
  );
}

function Meta({ icon, value, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {icon}
      {value && <span style={{ fontSize: 13, fontWeight: 600, color: HT.textPrimary, fontFamily: "monospace" }}>{value}</span>}
      <span style={{ fontSize: 11.5, color: HT.textSecondary }}>{label}</span>
    </div>
  );
}
