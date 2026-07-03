import { useState } from "react";
import { BD, T1, T2, T3, GL, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, Chip } from "../../shared/ui.jsx";
import { ocol } from "./helpers.js";

export function PlaybookBuilder({ trades }) {
  const [gradeFilter, setGradeFilter] = useState("A+");

  const qualTrades = trades.filter((t) =>
    t.status === "CLOSED" &&
    (gradeFilter === "all" ? true : t.grade === gradeFilter)
  );

  const setups = {};
  qualTrades.forEach((t) => {
    const key = (t.models || []).slice().sort().join(" + ") || "Unclassified";
    if (!setups[key]) setups[key] = { models: t.models || [], trades: [] };
    setups[key].trades.push(t);
  });

  const setupList = Object.entries(setups)
    .map(([key, s]) => {
      const wins = s.trades.filter((t) => t.outcome === "WIN" || t.outcome === "PARTIAL");
      const wr = s.trades.length > 0 ? Math.round((wins.length / s.trades.length) * 100) : 0;
      const avgRR = wins.length > 0 ? +(wins.reduce((sum, t) => sum + (t.actualRR || 0), 0) / wins.length).toFixed(1) : 0;
      const avgExec = s.trades.length > 0 ? +(s.trades.reduce((sum, t) => sum + (t.executionScore || 0), 0) / s.trades.length).toFixed(1) : 0;
      const sessions = [...new Set(s.trades.map((t) => t.session).filter(Boolean))];
      const tfs = [...new Set(s.trades.map((t) => t.entryTimeframe).filter(Boolean))];
      return { key, ...s, wins: wins.length, wr, avgRR, avgExec, sessions, tfs };
    })
    .sort((a, b) => b.wr - a.wr || b.trades.length - a.trades.length);

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T1 }}>Playbook</div>
          <div style={{ fontSize: 13, color: T3, marginTop: 3 }}>Proven setups derived from your trade history · Your personal ICT edge library</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[{ v: "A+", l: "A+ Only" }, { v: "A", l: "A Only" }, { v: "A-", l: "A−" }, { v: "all", l: "All Grades" }].map((f) => (
            <button key={f.v} onClick={() => setGradeFilter(f.v)} style={{ padding: "7px 13px", borderRadius: 9, border: `1px solid ${gradeFilter === f.v ? CY + "66" : BD}`, background: gradeFilter === f.v ? `${CY}22` : GL, color: gradeFilter === f.v ? CY : T2, fontSize: 12, fontWeight: gradeFilter === f.v ? 700 : 400, cursor: "pointer", fontFamily: "inherit" }}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {qualTrades.length === 0 ? (
        <Card style={{ padding: "40px", textAlign: "center" }}>
          <div style={{ fontSize: 14, color: T3, marginBottom: 8 }}>No {gradeFilter === "all" ? "" : gradeFilter} trades logged yet</div>
          <div style={{ fontSize: 12, color: T3 }}>Log trades and grade them to build your playbook automatically.</div>
        </Card>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <Chip label="Setup Types"  value={setupList.length}      color={CY} />
            <Chip label="Total Trades" value={qualTrades.length}     color={T2} />
            <Chip label="Best WR"      value={setupList[0] ? `${setupList[0].wr}%` : "—"} color={GR} />
            <Chip label="Best Avg RR"  value={setupList.length ? `${Math.max(...setupList.map((s) => s.avgRR))}R` : "—"} color={PU} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {setupList.map((s) => (
              <Card key={s.key} style={{ padding: "20px", borderColor: s.wr >= 60 ? GR + "33" : s.wr >= 50 ? CY + "22" : BD }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                      {(s.models.length > 0 ? s.models : [s.key]).map((m) => (
                        <span key={m} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 14, background: `${CY}22`, color: CY, border: `1px solid ${CY}44` }}>
                          {m.split("(")[0].trim()}
                        </span>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 11, color: T3 }}>
                        <span style={{ color: T2, fontWeight: 600 }}>Sessions: </span>
                        {s.sessions.slice(0, 3).join(", ") || "Various"}
                      </div>
                      <div style={{ fontSize: 11, color: T3 }}>
                        <span style={{ color: T2, fontWeight: 600 }}>Entry TFs: </span>
                        {s.tfs.join(", ") || "Various"}
                      </div>
                      <div style={{ fontSize: 11, color: T3 }}>
                        <span style={{ color: T2, fontWeight: 600 }}>Avg Exec: </span>
                        <span style={{ color: s.avgExec >= 8 ? GR : s.avgExec >= 6 ? AM : RE }}>{s.avgExec}/10</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexShrink: 0 }}>
                    {[
                      { l: "Trades",  v: s.trades.length,    c: T2 },
                      { l: "W/L",     v: `${s.wins}/${s.trades.length - s.wins}`, c: T2 },
                      { l: "Win Rate",v: `${s.wr}%`,          c: s.wr >= 60 ? GR : s.wr >= 50 ? CY : AM },
                      { l: "Avg RR",  v: `${s.avgRR}R`,       c: +s.avgRR >= 2 ? GR : +s.avgRR >= 1 ? CY : RE },
                    ].map((x) => (
                      <div key={x.l} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 9.5, color: T3, letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>{x.l}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: x.c, fontFamily: "monospace" }}>{x.v}</div>
                      </div>
                    ))}

                    <div style={{ padding: "8px 14px", borderRadius: 10, background: s.wr >= 60 && s.trades.length >= 3 ? `${GR}22` : s.wr >= 50 ? `${CY}22` : `${AM}22`, border: `1px solid ${s.wr >= 60 && s.trades.length >= 3 ? GR : s.wr >= 50 ? CY : AM}44`, textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: T3, letterSpacing: 1, marginBottom: 3 }}>CONFIDENCE</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: s.wr >= 60 && s.trades.length >= 3 ? GR : s.wr >= 50 ? CY : AM }}>
                        {s.wr >= 60 && s.trades.length >= 3 ? "HIGH" : s.wr >= 50 ? "MODERATE" : "LOW"}
                      </div>
                      {s.trades.length < 3 && <div style={{ fontSize: 9, color: T3, marginTop: 2 }}>Need {3 - s.trades.length} more</div>}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${BD}` }}>
                  <div style={{ fontSize: 10.5, color: T3, letterSpacing: 1, marginBottom: 9, textTransform: "uppercase" }}>
                    Recent {gradeFilter === "all" ? "" : gradeFilter} executions of this setup
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {s.trades.slice(0, 5).map((t) => (
                      <div key={t.id} style={{ padding: "6px 12px", borderRadius: 8, background: GL, border: `1px solid ${ocol(t.outcome)}33`, display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: T2 }}>{t.date?.slice(5)}</span>
                        <span style={{ fontSize: 11, color: t.direction === "LONG" ? GR : RE, fontWeight: 700 }}>{t.direction}</span>
                        <span style={{ fontSize: 11, color: ocol(t.outcome), fontWeight: 700 }}>{t.outcome}</span>
                        <span style={{ fontSize: 11, color: T3, fontFamily: "monospace" }}>{t.actualRR ? `${t.actualRR}R` : "—"}</span>
                      </div>
                    ))}
                    {s.trades.length > 5 && <div style={{ padding: "6px 12px", background: GL, borderRadius: 8, fontSize: 11, color: T3 }}>+{s.trades.length - 5} more</div>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
