import { useState, useCallback, useEffect, useRef } from "react";
import { Cpu, X, Send } from "lucide-react";
import { B1, BD, T1, T2, T3, GL, CY, PU, GR } from "./designTokens.js";
import { callClaude } from "./anthropic.js";

const SYSTEM_PROMPT = (tradingStats) => `You are ARCHITECT — elite AI operating system for Irisu (based in Nairobi, Kenya). Master ICT and hybrid athlete expertise.

ICT TRADING: FVG, OB, Breaker Blocks, BPR, SIBI/BISI, Displacement, MSS/BOS/MSB. Killzones in EAT: London Open 9AM-12PM, NY Open 2-5PM, NY PM 8PM-Midnight. ICT Macros: 4:50PM, 5:50PM, 8:10PM, 9:10PM, 10:15PM EAT. Silver Bullet: 5-6PM and 9-10PM EAT. PO3 (AMD), SMT Divergence, Draw on Liquidity, Judas Swing, Dealing Ranges, OTE 62-79%.
FUNDED ACCOUNT: FundedNext $15,000. Daily limit $750. Max DD $1,500.
TRADING STATS: WR ${tradingStats.wr || 0}% · PF ${tradingStats.pf || 0} · Avg RR ${tradingStats.avgRR || 0}R · ${tradingStats.total || 0} trades · Net $${tradingStats.totalPnl || 0}.
HYBRID ATHLETE: Concurrent training interference effect. Strength BEFORE cardio if same day (8+ hr gap). Zone 2: 60-70% HRMax, below VT1, nasal breathing. Block periodization. Protein 2.2g/kg. HRV monitoring. Deload every 4th week.
SCHEDULE: Afternoon/evening shift 1PM-12:30AM EAT. Morning window after 9:30AM.
STYLE: Sharp, direct, data-driven. Reference actual ICT concepts and training physiology. Under 250 words. No filler.`;

export function AIPanel({ onClose, tradingStats }) {
  const [msgs, setMsgs] = useState([{
    role: "assistant",
    content: `ARCHITECT online. All systems nominal.\n\n→ Trading: ${tradingStats.wr || 0}% WR · PF ${tradingStats.pf || 0} · ${tradingStats.total || 0} trades · Net $${tradingStats.totalPnl || 0}\n→ Athletic: Phase 1 Accumulation · W6 · Zone 2 sessions on track\n→ Recovery: HRV 74ms (Normal) · Readiness 76%\n→ Habits: 4/6 complete · Journal streak 15 days\n\nWhat do you need?`,
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const QUICK = ["Review today's trades", "Generate tomorrow plan", "Analyse my edge", "Optimal training today"];

  const send = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const reply = await callClaude({
        system: SYSTEM_PROMPT(tradingStats),
        messages: msgs.map((m) => ({ role: m.role, content: m.content })).concat([{ role: "user", content: msg }]),
        maxTokens: 1000,
      });
      setMsgs((m) => [...m, { role: "assistant", content: reply || "Signal lost. Retry." }]);
    } catch (err) {
      setMsgs((m) => [...m, { role: "assistant", content: `Connection error: ${err.message}. Retry.` }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, msgs, tradingStats]);

  return (
    <div style={{ width: 340, height: "100vh", background: B1, borderLeft: `1px solid ${BD}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "16px 18px", borderBottom: `1px solid ${BD}`, display: "flex", alignItems: "center", gap: 11 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg,${CY}22,${PU}22)`, border: `1px solid ${CY}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Cpu size={17} color={CY} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: T1, letterSpacing: 2.5 }}>ARCHITECT</div>
          <div style={{ fontSize: 10, color: GR, display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
            <span style={{ width: 5, height: 5, background: GR, borderRadius: "50%", display: "inline-block", boxShadow: `0 0 6px ${GR}` }} />
            MASTER ICT · ELITE ATHLETE
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: T3, cursor: "pointer", padding: 4, borderRadius: 6, display: "flex" }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ padding: "9px 12px", borderBottom: `1px solid ${BD}`, display: "flex", flexWrap: "wrap", gap: 5 }}>
        {QUICK.map((q) => (
          <button key={q} onClick={() => send(q)} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 20, padding: "4px 10px", fontSize: 10, color: T2, cursor: "pointer", fontFamily: "inherit" }}>
            {q}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "13px", display: "flex", flexDirection: "column", gap: 10 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: 8 }}>
            {m.role === "assistant" && (
              <div style={{ width: 21, height: 21, borderRadius: 6, background: `${CY}22`, border: `1px solid ${CY}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                <Cpu size={11} color={CY} />
              </div>
            )}
            <div style={{ maxWidth: "85%", padding: "9px 12px", borderRadius: 12, background: m.role === "user" ? `linear-gradient(135deg,${CY}18,${PU}18)` : GL, border: `1px solid ${m.role === "user" ? CY + "33" : BD}`, fontSize: 12.5, lineHeight: 1.7, color: T1, whiteSpace: "pre-wrap" }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 5, padding: "8px 12px", alignItems: "center" }}>
            <Cpu size={11} color={CY} style={{ marginRight: 4 }} />
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: CY, animation: `dp 1.4s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div style={{ padding: "11px", borderTop: `1px solid ${BD}`, display: "flex", gap: 8 }}>
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Query ARCHITECT..."
          style={{ flex: 1, background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "9px 12px", fontSize: 12.5, color: T1, outline: "none", fontFamily: "inherit" }}
        />
        <button
          onClick={() => send()} disabled={!input.trim() || loading}
          style={{ width: 36, height: 36, borderRadius: 10, border: "none", cursor: input.trim() ? "pointer" : "default", background: input.trim() ? `linear-gradient(135deg,${CY},${PU})` : GL, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <Send size={14} color={input.trim() ? "#000" : T3} />
        </button>
      </div>
    </div>
  );
}
