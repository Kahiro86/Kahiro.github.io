// ── Prayer List — carry requests, remember answers ───────────────────
// Add what you're praying for; mark it answered and the date is stamped into
// a permanent answered log. Own store. Opened from the palette. Lazy.
import { useMemo, useState } from "react";
import { X, HandHeart, Check, Trash2, RotateCcw, ChevronDown } from "lucide-react";
import { B1, B2, BD, BD2, T1, T2, T3, GL, AC2, GR } from "./designTokens.js";
import { useStorageState } from "./useStorageState.js";
import { PRAYER_KEY, CATEGORIES, addPrayer, answerPrayer, reopenPrayer, removePrayer, prayerStats, activePrayers, answeredPrayers } from "./prayerList.js";

export function PrayerList({ onClose }) {
  const [raw, setRaw] = useStorageState(PRAYER_KEY, []);
  const [text, setText] = useState("");
  const [category, setCategory] = useState("Other");
  const [showAnswered, setShowAnswered] = useState(false);

  const stats = useMemo(() => prayerStats(raw), [raw]);
  const active = useMemo(() => activePrayers(raw), [raw]);
  const answered = useMemo(() => answeredPrayers(raw), [raw]);

  const add = () => { if (!text.trim()) return; setRaw((prev) => addPrayer(prev, text, category)); setText(""); };

  const field = { background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "9px 11px", fontSize: 13, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 4200, background: "rgba(0,0,0,0.66)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "7vh 16px 24px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, background: B1, border: `1px solid ${BD2}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: `1px solid ${BD}` }}>
          <HandHeart size={18} color={AC2} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T1 }}>Prayer List</div>
            <div style={{ fontSize: 11, color: T3 }}>{stats.active} active · {stats.answered} answered</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={17} /></button>
        </div>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, background: B2, border: `1px solid ${BD}`, borderRadius: 11, padding: 11 }}>
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="What are you praying for?" style={{ ...field, width: "100%" }} />
            <div style={{ display: "flex", gap: 7 }}>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...field, flex: 1 }}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              <button onClick={add} disabled={!text.trim()} style={{ padding: "0 18px", borderRadius: 8, border: "none", background: text.trim() ? `linear-gradient(135deg,${AC2},#4C8DFF)` : GL, color: text.trim() ? "#000" : T3, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {active.length === 0 && <div style={{ padding: "16px 8px", textAlign: "center", color: T3, fontSize: 12.5 }}>Nothing on the list. Bring it here.</div>}
            {active.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", background: B2, border: `1px solid ${BD}`, borderRadius: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: T1, lineHeight: 1.4 }}>{p.text}</div>
                  <div style={{ fontSize: 10, color: T3, marginTop: 3 }}>{p.category} · since {p.addedAt.slice(5)}</div>
                </div>
                <button onClick={() => setRaw((prev) => answerPrayer(prev, p.id))} title="Mark answered" style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit", fontSize: 10.5, fontWeight: 700, background: `${GR}18`, border: `1px solid ${GR}55`, color: GR }}><Check size={12} /> Answered</button>
                <button onClick={() => setRaw((prev) => removePrayer(prev, p.id))} aria-label="Remove" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", marginTop: 2 }}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>

          {answered.length > 0 && (
            <div>
              <button onClick={() => setShowAnswered((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 10.5, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, color: GR, padding: "4px 0" }}>
                <ChevronDown size={13} style={{ transform: showAnswered ? "none" : "rotate(-90deg)", transition: "transform .15s" }} /> Answered ({answered.length})
              </button>
              {showAnswered && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                  {answered.map((p) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 12px", background: `${GR}0C`, border: `1px solid ${GR}2A`, borderRadius: 10 }}>
                      <Check size={14} color={GR} style={{ marginTop: 1, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12.5, color: T2, lineHeight: 1.4, textDecoration: "line-through", textDecorationColor: `${GR}66` }}>{p.text}</div>
                        <div style={{ fontSize: 10, color: T3, marginTop: 3 }}>Answered {p.answeredAt.slice(5)}{p.note ? ` · ${p.note}` : ""}</div>
                      </div>
                      <button onClick={() => setRaw((prev) => reopenPrayer(prev, p.id))} aria-label="Reopen" title="Reopen" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><RotateCcw size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
