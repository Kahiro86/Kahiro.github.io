import { useState } from "react";
import { Flame, Check, Star } from "lucide-react";
import { BD, T1, T2, T3, GL, CY, PU, GR, AM, OR, RE } from "../../shared/designTokens.js";
import { Card, SH } from "../../shared/ui.jsx";
import { useStorageState } from "../../shared/useStorageState.js";

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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card style={{ padding: "20px" }}>
          <SH title="Habit Tracker" sub={`${done}/${habits.length} complete today`} action={
            <div style={{ display: "flex", gap: 3 }}>
              {habits.map((_, i) => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i < done ? GR : "rgba(255,255,255,0.15)" }} />)}
            </div>
          } />
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
            <SH title="Evening Journal" sub={new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} />
            <div style={{ fontSize: 12, color: T3, marginBottom: 9, lineHeight: 1.6 }}>Trading process · Training output · Daily lesson · Tomorrow's intention</div>
            <textarea value={journal} onChange={(e) => setJournal(e.target.value)} placeholder="Write freely..."
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
        <SH title="Active Goals" sub="12-month horizon — current progress" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 13 }}>
          {[
            { goal: "Consistent Trading Profitability", p: 22, h: "12 months", c: CY, icon: "📈" },
            { goal: "Elite Hybrid Athlete",             p: 35, h: "12 months", c: PU, icon: "🏆" },
            { goal: "Emergency Fund $6,000",            p: 40, h: "5 months",  c: GR, icon: "🛡️" },
            { goal: "Read 24 Books This Year",          p: 54, h: "6 months",  c: AM, icon: "📚" },
            { goal: "Net Worth $100k",                  p: 24, h: "36 months", c: OR, icon: "💰" },
            { goal: "VO2max > 55 ml/kg/min",            p: 30, h: "8 months",  c: RE, icon: "❤️" },
          ].map((g) => (
            <div key={g.goal} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 12, padding: "14px" }}>
              <div style={{ fontSize: 16, marginBottom: 6 }}>{g.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T1, marginBottom: 6, lineHeight: 1.4 }}>{g.goal}</div>
              <div style={{ height: 3, background: BD, borderRadius: 2, marginBottom: 6 }}>
                <div style={{ height: "100%", width: `${g.p}%`, background: `linear-gradient(90deg,${g.c}77,${g.c})`, borderRadius: 2 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: g.c, fontFamily: "monospace", fontWeight: 700 }}>{g.p}%</span>
                <span style={{ fontSize: 10, color: T3 }}>{g.h}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
