// ── Reflect — a guided journal entry ─────────────────────────────────
// Today's prompt, a mood, optional tags, and a few honest lines. Saves into
// the normal journal_entries store so it shows in the Journal tab and feeds
// streaks/XP exactly like any entry. Opened from the palette. Lazy.
import { useMemo, useState } from "react";
import { X, PenLine, Shuffle } from "lucide-react";
import { B1, B2, BD, BD2, T1, T2, T3, GL, AC2, GR } from "./designTokens.js";
import { useStorageState } from "./useStorageState.js";
import { localDateStr } from "./dates.js";
import { useToast } from "./toast.jsx";
import { PROMPTS, MOODS, promptOfDay, parseTags } from "./journalPrompts.js";

export function QuickJournal({ onClose }) {
  const ds = localDateStr();
  const [entries, setEntries] = useStorageState("journal_entries", []);
  const toast = useToast();
  const [promptIdx, setPromptIdx] = useState(() => PROMPTS.indexOf(promptOfDay(ds)));
  const [mood, setMood] = useState("");
  const [tagStr, setTagStr] = useState("");
  const [text, setText] = useState("");

  const prompt = PROMPTS[(promptIdx + PROMPTS.length) % PROMPTS.length];
  const tags = useMemo(() => parseTags(tagStr), [tagStr]);

  const save = () => {
    const body = text.trim();
    if (!body) return;
    const entry = { id: `j${Date.now()}`, date: ds, text: body, prompt, mood: mood || "", tags, editedAt: null };
    setEntries((prev) => [entry, ...(Array.isArray(prev) ? prev : [])]);
    toast("Reflection saved ✍️", { tone: "success" });
    onClose();
  };

  const field = { width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "10px 12px", fontSize: 13.5, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const label = { fontSize: 10.5, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700, color: T3, marginBottom: 7 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 4200, background: "rgba(0,0,0,0.66)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "7vh 16px 24px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, background: B1, border: `1px solid ${BD2}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: `1px solid ${BD}` }}>
          <PenLine size={18} color={AC2} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T1 }}>Reflect</div>
            <div style={{ fontSize: 11, color: T3 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={17} /></button>
        </div>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: `${AC2}0E`, border: `1px solid ${AC2}33`, borderRadius: 11, padding: "12px 13px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, fontSize: 13.5, color: T1, fontStyle: "italic", lineHeight: 1.4 }}>{prompt}</div>
            <button onClick={() => setPromptIdx((i) => (i + 1) % PROMPTS.length)} aria-label="New prompt" title="Different prompt" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: T2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Shuffle size={14} /></button>
          </div>

          <div>
            <div style={label}>Mood</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {MOODS.map((m) => (
                <button key={m.id} onClick={() => setMood((cur) => (cur === m.id ? "" : m.id))}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                    background: mood === m.id ? `${AC2}22` : GL, border: `1px solid ${mood === m.id ? AC2 : BD}`, color: mood === m.id ? T1 : T2 }}>
                  <span>{m.emoji}</span>{m.label}
                </button>
              ))}
            </div>
          </div>

          <textarea value={text} onChange={(e) => setText(e.target.value)} autoFocus rows={5} placeholder="A few honest lines…" style={{ ...field, resize: "vertical", fontSize: 14, lineHeight: 1.5 }} />

          <div>
            <div style={label}>Tags (comma-separated)</div>
            <input value={tagStr} onChange={(e) => setTagStr(e.target.value)} placeholder="discipline, trading, family…" style={field} />
            {tags.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {tags.map((t) => <span key={t} style={{ fontSize: 11, color: AC2, background: `${AC2}14`, border: `1px solid ${AC2}33`, borderRadius: 6, padding: "2px 8px" }}>#{t}</span>)}
              </div>
            )}
          </div>

          <button onClick={save} disabled={!text.trim()}
            style={{ padding: "12px", borderRadius: 11, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, background: text.trim() ? `linear-gradient(135deg,${AC2},${GR})` : GL, color: text.trim() ? "#000" : T3 }}>
            Save reflection
          </button>
        </div>
      </div>
    </div>
  );
}
