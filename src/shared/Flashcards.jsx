// ── Flashcards — review what you've learned ──────────────────────────
// Spaced repetition over your own cards. Review the due ones (forgot → soon,
// knew it → later), or add new cards. Own store. Palette. Lazy.
import { useMemo, useState } from "react";
import { X, Layers, Plus, Trash2 } from "lucide-react";
import { B1, B2, BD, BD2, T1, T2, T3, GL, AC2, GR, AM, RE } from "./designTokens.js";
import { useStorageState } from "./useStorageState.js";
import { CARD_KEY, GRADES, addCard, removeCard, applyReview, dueCards, cardStats, sanitizeCards } from "./flashcards.js";

const TONE = { bad: RE, ok: AM, good: GR };

export function Flashcards({ onClose }) {
  const [raw, setRaw] = useStorageState(CARD_KEY, []);
  const [mode, setMode] = useState("review"); // review | add | browse
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [revealed, setRevealed] = useState(false);

  const cards = useMemo(() => sanitizeCards(raw), [raw]);
  const due = useMemo(() => dueCards(raw), [raw]);
  const stats = useMemo(() => cardStats(raw), [raw]);
  const current = due[0] || null;

  const grade = (g) => { if (!current) return; setRaw((prev) => applyReview(prev, current.id, g)); setRevealed(false); };
  const add = () => { if (!front.trim()) return; setRaw((prev) => addCard(prev, front, back)); setFront(""); setBack(""); };

  const field = { width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "10px 12px", fontSize: 13.5, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const tab = (id, l) => (
    <button onClick={() => { setMode(id); setRevealed(false); }} style={{ flex: 1, padding: "7px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: mode === id ? `${AC2}22` : "transparent", border: `1px solid ${mode === id ? AC2 : BD}`, color: mode === id ? AC2 : T3 }}>{l}</button>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 4200, background: "rgba(0,0,0,0.66)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "7vh 16px 24px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 440, background: B1, border: `1px solid ${BD2}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: `1px solid ${BD}` }}>
          <Layers size={18} color={AC2} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T1 }}>Flashcards</div>
            <div style={{ fontSize: 11, color: T3 }}>{stats.due} due · {stats.total} cards · {stats.learned} learned</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={17} /></button>
        </div>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 7 }}>{tab("review", "Review")}{tab("add", "Add")}{tab("browse", "Browse")}</div>

          {mode === "review" && (
            current ? (
              <>
                <div style={{ minHeight: 130, background: B2, border: `1px solid ${BD}`, borderRadius: 12, padding: "18px 16px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
                  <div style={{ fontSize: 15.5, color: T1, fontWeight: 600, lineHeight: 1.45, textAlign: "center" }}>{current.front}</div>
                  {revealed && current.back && <><div style={{ height: 1, background: BD }} /><div style={{ fontSize: 13.5, color: T2, lineHeight: 1.5, textAlign: "center" }}>{current.back}</div></>}
                </div>
                {!revealed ? (
                  <button onClick={() => setRevealed(true)} style={{ padding: "12px", borderRadius: 11, border: `1px solid ${BD}`, background: GL, color: T1, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Show answer</button>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    {GRADES.map((g) => (
                      <button key={g.id} onClick={() => grade(g.id)} style={{ flex: 1, padding: "12px 6px", borderRadius: 11, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, background: `${TONE[g.tone]}18`, border: `1px solid ${TONE[g.tone]}66`, color: TONE[g.tone] }}>{g.label}</button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: "30px 10px", textAlign: "center", color: T3, fontSize: 13.5 }}>{stats.total === 0 ? "No cards yet. Add a few from lessons worth keeping." : "✓ All caught up. Nothing due today."}</div>
            )
          )}

          {mode === "add" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <input value={front} onChange={(e) => setFront(e.target.value)} placeholder="Front — the prompt / question" style={field} />
              <textarea value={back} onChange={(e) => setBack(e.target.value)} placeholder="Back — the answer / lesson" rows={3} style={{ ...field, resize: "vertical" }} />
              <button onClick={add} disabled={!front.trim()} style={{ padding: "11px", borderRadius: 11, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, background: front.trim() ? `linear-gradient(135deg,${AC2},#4C8DFF)` : GL, color: front.trim() ? "#000" : T3, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Plus size={16} /> Add card</button>
            </div>
          )}

          {mode === "browse" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {cards.length === 0 && <div style={{ padding: "18px 8px", textAlign: "center", color: T3, fontSize: 12.5 }}>No cards yet.</div>}
              {cards.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 12px", background: B2, border: `1px solid ${BD}`, borderRadius: 9 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, color: T1, lineHeight: 1.4 }}>{c.front}</div>
                    <div style={{ fontSize: 10, color: T3, marginTop: 3 }}>due {c.due.slice(5)} · {c.reps} reps</div>
                  </div>
                  <button onClick={() => setRaw((prev) => removeCard(prev, c.id))} aria-label="Remove" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", marginTop: 1 }}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
