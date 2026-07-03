import { useState } from "react";
import { Flame, Check, Star, Sprout } from "lucide-react";
import { BD, T1, T2, T3, GL, CY, PU, GR, AM, OR, RE } from "../../shared/designTokens.js";
import { Card, SH } from "../../shared/ui.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { REFLECTION_PROMPTS } from "../../shared/kaizen.js";

export function LifeOSModule({ habits, setHabits }) {
  const [journal, setJournal] = useState("");
  const [entries, setEntries] = useStorageState("journal_entries", []);
  const done = habits.filter((h) => h.done).length;

  const saveEntry = () => {
    if (!journal.trim()) return;
    setEntries((prev) => [{ id: `j${Date.now()}`, date: new Date().toISOString(), text: journal }, ...prev]);
    setJournal("");
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
            {habits.map((h, i) => (
              <div key={h.name} onClick={() => setHabits((p) => p.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: GL, borderRadius: 10, border: `1px solid ${h.done ? GR + "33" : BD}`, cursor: "pointer" }}>
                <span style={{ fontSize: 16 }}>{h.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: T1, fontWeight: 600 }}>{h.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Flame size={10} color={AM} /><span style={{ fontSize: 10, color: T3 }}>{h.streak} day streak</span>
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
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8, maxHeight: 160, overflowY: "auto" }}>
                {entries.map((e) => (
                  <div key={e.id} style={{ padding: "9px 11px", background: GL, borderRadius: 9, border: `1px solid ${BD}` }}>
                    <div style={{ fontSize: 10, color: T3, marginBottom: 4 }}>{new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                    <div style={{ fontSize: 12, color: T2, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{e.text}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card style={{ padding: "16px", borderColor: AM + "33" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
              <Star size={13} color={AM} />
              <div style={{ fontSize: 13, fontWeight: 700, color: AM }}>Weekly Review Due Sunday</div>
            </div>
            <div style={{ fontSize: 12, color: T2, lineHeight: 1.6, marginBottom: 9 }}>Review all 6 domains. Grade your process not your results. Set W7 priorities.</div>
            <button style={{ padding: "7px 13px", background: `${AM}22`, border: `1px solid ${AM}44`, borderRadius: 8, color: AM, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Schedule Review →
            </button>
          </Card>
        </div>
      </div>
      <Card style={{ padding: "20px" }}>
        <SH title="Active Goals" sub="Big horizons, tiny next steps — do just the smallest one today" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 13 }}>
          {[
            { goal: "Consistent Trading Profitability", p: 22, h: "12 months", c: CY, icon: "📈", step: "Grade one past trade against your checklist." },
            { goal: "Elite Hybrid Athlete",             p: 35, h: "12 months", c: PU, icon: "🏆", step: "Log today's session — even a 10-min walk." },
            { goal: "Emergency Fund $6,000",            p: 40, h: "5 months",  c: GR, icon: "🛡️", step: "Move one small transfer to the fund." },
            { goal: "Read 24 Books This Year",          p: 54, h: "6 months",  c: AM, icon: "📚", step: "Read one page. Just one." },
            { goal: "Net Worth $100k",                  p: 24, h: "36 months", c: OR, icon: "💰", step: "Update one balance so today is honest." },
            { goal: "VO2max > 55 ml/kg/min",            p: 30, h: "8 months",  c: RE, icon: "❤️", step: "Add 5 easy Zone 2 minutes today." },
          ].map((g) => (
            <div key={g.goal} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 12, padding: "14px" }}>
              <div style={{ fontSize: 16, marginBottom: 6 }}>{g.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T1, marginBottom: 6, lineHeight: 1.4 }}>{g.goal}</div>
              <div style={{ height: 3, background: BD, borderRadius: 2, marginBottom: 6 }}>
                <div style={{ height: "100%", width: `${g.p}%`, background: `linear-gradient(90deg,${g.c}77,${g.c})`, borderRadius: 2 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
                <span style={{ fontSize: 11, color: g.c, fontFamily: "monospace", fontWeight: 700 }}>{g.p}%</span>
                <span style={{ fontSize: 10, color: T3 }}>{g.h}</span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start", paddingTop: 9, borderTop: `1px solid ${BD}` }}>
                <Sprout size={11} color={g.c} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 10.5, color: T2, lineHeight: 1.45 }}>{g.step}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
