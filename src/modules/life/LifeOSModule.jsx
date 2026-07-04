import { useState } from "react";
import { Flame, Check, Star, Sprout, ChevronRight, Trash2 } from "lucide-react";
import { BD, T1, T2, T3, GL, CY, PU, GR, AM } from "../../shared/designTokens.js";
import { Card, SH } from "../../shared/ui.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { useToast } from "../../shared/toast.jsx";
import { REFLECTION_PROMPTS, nudgeOfTheDay } from "../../shared/kaizen.js";
import { DEFAULT_FINANCE_STATE } from "../finance/constants.js";

export function LifeOSModule({ habits, onToggleHabit, onNavigate }) {
  const [journal, setJournal] = useState("");
  const [entries, setEntries] = useStorageState("journal_entries", []);
  const [finance] = useStorageState("finance_state", DEFAULT_FINANCE_STATE);
  const toast = useToast();
  const done = habits.filter((h) => h.done).length;
  const goals = (finance.goals || []).filter((g) => !g.archived);

  const saveEntry = () => {
    if (!journal.trim()) return;
    setEntries((prev) => [{ id: `j${Date.now()}`, date: new Date().toISOString(), text: journal }, ...prev]);
    setJournal("");
    toast("Reflection saved 🌱", { tone: "success", duration: 2500 });
  };

  const deleteEntry = (id) => {
    const entry = entries.find((e) => e.id === id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast("Entry deleted", { action: "Undo", onAction: () => setEntries((prev) => [entry, ...prev]), tone: "danger" });
  };

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: T1 }}>Life OS</div>
        <div style={{ fontSize: 13, color: T3, marginTop: 3 }}>Habits · Goals · Journal · Time Architecture</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        <Card style={{ padding: "20px" }}>
          <SH title="Habit Tracker" sub="Consistency over perfection — showing up is the win" action={
            <div style={{ display: "flex", gap: 3 }}>
              {habits.map((_, i) => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i < done ? GR : "rgba(255,255,255,0.15)" }} />)}
            </div>
          } />
          <div style={{ padding: "9px 12px", background: `${GR}0A`, border: `1px solid ${GR}22`, borderRadius: 9, display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
            <Sprout size={14} color={GR} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, color: T2, lineHeight: 1.5 }}>
              {done === habits.length
                ? "Every habit tended today. Beautiful consistency — this is how small actions compound."
                : done === 0
                ? "A fresh start. Pick just one and do the two-minute version — momentum begins with a single rep."
                : `${done} tended so far. No pressure on the rest — even one more tiny rep moves you 1% forward.`}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {habits.map((h) => (
              <div key={h.name} onClick={() => onToggleHabit(h.name)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: GL, borderRadius: 10, border: `1px solid ${h.done ? GR + "33" : BD}`, cursor: "pointer" }}>
                <span style={{ fontSize: 16 }}>{h.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: T1, fontWeight: 600 }}>{h.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Flame size={10} color={AM} />
                    <span style={{ fontSize: 10, color: T3 }}>{h.streak > 0 ? `${h.streak} day streak` : "start a streak today"}</span>
                  </div>
                </div>
                <div style={{ width: 23, height: 23, borderRadius: "50%", background: h.done ? `${GR}22` : GL, border: `2px solid ${h.done ? GR : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {h.done && <Check size={12} color={GR} />}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card style={{ padding: "20px", flex: 1 }}>
            <SH title="Daily Reflection" sub={new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} />
            <div style={{ fontSize: 11.5, color: T3, marginBottom: 10, lineHeight: 1.6 }}>Reflect to learn, not to judge. Tap a prompt to begin.</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 11 }}>
              {REFLECTION_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => setJournal((j) => (j ? `${j}\n\n${p}\n` : `${p}\n`))}
                  style={{ padding: "5px 11px", borderRadius: 20, border: `1px solid ${CY}33`, background: `${CY}12`, color: CY, fontSize: 11, cursor: "pointer", fontFamily: "inherit", lineHeight: 1.4, textAlign: "left" }}
                >
                  {p}
                </button>
              ))}
            </div>
            <textarea value={journal} onChange={(e) => setJournal(e.target.value)} placeholder="One honest sentence is enough. What improved today?"
              style={{ width: "100%", minHeight: 110, background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "11px 13px", fontSize: 13, color: T1, lineHeight: 1.7, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
            />
            <button onClick={saveEntry} style={{ marginTop: 9, width: "100%", padding: "9px", background: `linear-gradient(135deg,${CY}22,${PU}22)`, border: `1px solid ${CY}44`, borderRadius: 10, color: CY, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Save Entry
            </button>
            {entries.length > 0 && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto" }}>
                {entries.map((e) => (
                  <div key={e.id} style={{ padding: "9px 11px", background: GL, borderRadius: 9, border: `1px solid ${BD}`, display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: T3, marginBottom: 4 }}>{new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                      <div style={{ fontSize: 12, color: T2, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{e.text}</div>
                    </div>
                    <button onClick={() => deleteEntry(e.id)} title="Delete entry" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", alignSelf: "flex-start", padding: 2 }}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card style={{ padding: "16px", borderColor: AM + "33" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
              <Star size={13} color={AM} />
              <div style={{ fontSize: 13, fontWeight: 700, color: AM }}>Sunday Weekly Review</div>
            </div>
            <div style={{ fontSize: 12, color: T2, lineHeight: 1.6 }}>
              Each Sunday, glance across all domains and grade your <em>process</em>, not your results. {nudgeOfTheDay(1)}
            </div>
          </Card>
        </div>
      </div>

      <Card style={{ padding: "20px" }}>
        <SH title="Active Goals" sub="Live from your Finance goals — big horizons, tiny next steps" action={
          <button onClick={() => onNavigate?.("finance")} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: CY, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
            Manage<ChevronRight size={12} />
          </button>
        } />
        {goals.length === 0 ? (
          <div style={{ padding: "26px", textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🎯</div>
            <div style={{ fontSize: 12.5, color: T2, marginBottom: 12 }}>No active goals yet — create your first in Finance.</div>
            <button onClick={() => onNavigate?.("finance")} style={{ padding: "8px 16px", background: `${CY}18`, border: `1px solid ${CY}44`, borderRadius: 9, color: CY, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Open Finance Goals →
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 13 }}>
            {goals.map((g) => {
              const pct = g.target > 0 ? Math.min(100, Math.round(((+g.current || 0) / g.target) * 100)) : 0;
              return (
                <div key={g.id} onClick={() => onNavigate?.("finance")} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 12, padding: "14px", cursor: "pointer" }}>
                  <div style={{ fontSize: 16, marginBottom: 6 }}>{g.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T1, marginBottom: 6, lineHeight: 1.4 }}>{g.name}</div>
                  <div style={{ height: 3, background: BD, borderRadius: 2, marginBottom: 6 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${g.color || CY}77,${g.color || CY})`, borderRadius: 2 }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
                    <span style={{ fontSize: 11, color: g.color || CY, fontFamily: "monospace", fontWeight: 700 }}>{pct}%</span>
                    <span style={{ fontSize: 10, color: T3 }}>KES {Math.round(+g.target || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-start", paddingTop: 9, borderTop: `1px solid ${BD}` }}>
                    <Sprout size={11} color={g.color || CY} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 10.5, color: T2, lineHeight: 1.45 }}>
                      {g.monthly > 0 ? `One transfer of KES ${Math.round(g.monthly).toLocaleString()} keeps this on pace.` : "Log one small contribution today."}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
