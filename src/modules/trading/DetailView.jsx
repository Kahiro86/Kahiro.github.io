import { useState, useRef } from "react";
import { ChevronLeft, Edit3, ExternalLink, Cpu, Check, X } from "lucide-react";
import { B1, BD, T1, T2, T3, GL, CY, PU, GR, RE, AM, OR } from "../../shared/designTokens.js";
import { callClaude } from "../../shared/anthropic.js";
import { MACRO_CONFIG, SILVER_BULLET_CONFIG, CHECKLIST } from "./constants.js";
import { calcPnl, gcol, ocol } from "./helpers.js";
import { checklistEdge } from "./checklists.js";

export function DetailView({ trade, trades = [], onBack, onEdit }) {
  const [aiReview, setAiReview] = useState("");
  const [ldState, setLdState] = useState(false);
  const loadingRef = useRef(false);
  const pnl = calcPnl(trade);

  // Prefer the trade's own logged checklist items (customizable). Fall back to
  // the legacy fixed 7-point CHECKLIST for older trades that predate templates.
  const clItems = trade.checklistItems && trade.checklistItems.length ? trade.checklistItems : CHECKLIST;
  const clChecks = trade.checklist || [];
  const clScore = trade.checklistScore ?? clChecks.filter(Boolean).length;
  const clTotal = trade.checklistTotal ?? clItems.length;

  const fetchReview = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLdState(true);
    try {
      // Per-item checklist detail for THIS trade.
      const checklistDetail = clItems.map((text, i) => ({ item: text, done: !!clChecks[i] }));
      // Cross-trade edge: which checklist items correlate with wins vs losses,
      // so the coach can flag "the step you skip on your losers."
      const edge = checklistEdge(trades)
        .filter((e) => e.checkedN + e.skippedN >= 2)
        .map((e) => ({ item: e.text, winRateWhenChecked: e.checkedWr, winRateWhenSkipped: e.skippedWr, timesChecked: e.checkedN, timesSkipped: e.skippedN }));

      const reply = await callClaude({
        system: `You are ARCHITECT — master ICT trading coach with a Kaizen mindset. Analyze this trade from Irisu (Nairobi, Kenya) on a FundedNext $15,000 challenge. Use expert ICT methodology. Be direct, specific, under 320 words. Structure your review around: (1) how the COMPLETED PRE-TRADE CHECKLIST lines up with the outcome — call out any mandatory step that was skipped and whether that skip pattern shows up on losses; (2) emotional discipline before vs after, and any mistakes logged; (3) which of Irisu's habits are becoming a real edge. Reference actual ICT concepts and praise real strengths. Be compassionate about losses — they are tuition, not failure. Measure this trade against Irisu's OWN past process, not perfection. End with the ONE smallest Kaizen adjustment to apply on the very next trade. No guilt.`,
        messages: [{
          role: "user",
          content: `Analyze this trade:\n${JSON.stringify({
            instrument: trade.instrument, direction: trade.direction, session: trade.session,
            ictMacro: trade.ictMacro, silverBullet: trade.silverBullet, mmModel: trade.mmModel,
            models: trade.models, marketStructure: trade.marketStructure, htfBias: trade.htfBias,
            premiumDiscount: trade.premiumDiscount, dol: trade.dol, liquidityTarget: trade.liquidityTarget,
            dealingRange: { h: trade.dealingRangeH, l: trade.dealingRangeL },
            judasSwing: trade.judasSwing, smtDivergence: trade.smtDivergence,
            po3Phase: trade.po3Phase, entryTimeframe: trade.entryTimeframe,
            projectedRR: trade.projectedRR, actualRR: trade.actualRR,
            riskPercent: trade.riskPercent,
            preTradeChecklist: { template: trade.checklistTemplate, score: `${clScore}/${clTotal}`, skipped: !!trade.checklistSkipped, items: checklistDetail },
            outcome: trade.outcome, grade: trade.grade,
            entryQuality: trade.entryQuality, exitQuality: trade.exitQuality,
            psychologyTag: trade.psychologyTag, executionScore: trade.executionScore,
            emotionBefore: trade.emotionBefore, emotionAfter: trade.emotionAfter,
            mistakes: trade.mistakes, commission: trade.commission, swapFees: trade.swapFees,
            notes: trade.notes, lessons: trade.lessons,
            yourChecklistEdgeAcrossAllTrades: edge,
          }, null, 2)}`,
        }],
        maxTokens: 1000,
      });
      setAiReview(reply || "Unable to generate review.");
    } catch (err) {
      setAiReview(`Error: ${err.message}. Check connection and retry.`);
    } finally {
      loadingRef.current = false;
      setLdState(false);
    }
  };

  const Row = ({ label, value, color }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${BD}` }}>
      <span style={{ fontSize: 12, color: T3 }}>{label}</span>
      <span style={{ fontSize: 12, color: color || T1, fontWeight: 500 }}>{value || "—"}</span>
    </div>
  );

  return (
    <div>
      <div style={{ padding: "14px 22px", borderBottom: `1px solid ${BD}`, display: "flex", alignItems: "center", gap: 11, background: B1 }}>
        <button onClick={onBack} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 8, padding: "6px 11px", color: T2, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
          <ChevronLeft size={13} />Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: T1 }}>{trade.instrument}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: trade.direction === "LONG" ? GR : RE }}>{trade.direction}</span>
            {trade.outcome && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 7, background: `${ocol(trade.outcome)}22`, color: ocol(trade.outcome), border: `1px solid ${ocol(trade.outcome)}44` }}>{trade.outcome}</span>}
            {trade.grade && <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 7, background: `${gcol(trade.grade)}22`, color: gcol(trade.grade), border: `1px solid ${gcol(trade.grade)}44` }}>{trade.grade}</span>}
            {trade.ictMacro && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: `${CY}22`, color: CY, border: `1px solid ${CY}33` }}>MACRO</span>}
            {trade.silverBullet && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: `${GR}22`, color: GR, border: `1px solid ${GR}33` }}>SILVER BULLET</span>}
          </div>
          <div style={{ fontSize: 11, color: T3, marginTop: 2 }}>{trade.date} · {trade.time} NY · {trade.session}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: pnl > 0 ? GR : pnl < 0 ? RE : AM, fontFamily: "monospace" }}>
            {trade.status === "OPEN" ? "OPEN" : `${pnl >= 0 ? "+" : ""}$${Math.abs(pnl)}`}
          </div>
          {trade.actualRR !== null && trade.actualRR !== undefined && (
            <div style={{ fontSize: 12, color: T2, fontFamily: "monospace" }}>{trade.actualRR}R</div>
          )}
        </div>
        <button onClick={() => onEdit(trade)} style={{ background: GL, border: `1px solid ${CY}44`, borderRadius: 8, padding: "6px 11px", color: CY, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
          <Edit3 size={11} />Edit
        </button>
      </div>

      <div style={{ padding: "20px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div>
          <div style={{ fontSize: 11, color: CY, letterSpacing: 1.5, marginBottom: 9, fontWeight: 700, textTransform: "uppercase" }}>ICT Setup</div>
          <div style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 12, padding: "14px" }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9.5, color: T3, letterSpacing: 1, marginBottom: 7, textTransform: "uppercase" }}>Models Used</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {(trade.models || []).map((mm) => (
                  <span key={mm} style={{ fontSize: 10.5, padding: "3px 9px", borderRadius: 14, background: `${CY}22`, color: CY, border: `1px solid ${CY}44` }}>{mm}</span>
                ))}
              </div>
            </div>
            <Row label="Market Structure"   value={trade.marketStructure} color={AM} />
            <Row label="HTF Bias"           value={trade.htfBias} color={trade.htfBias === "Bullish" ? GR : trade.htfBias === "Bearish" ? RE : T2} />
            <Row label="Array"              value={trade.premiumDiscount} />
            <Row label="Draw on Liquidity"  value={trade.dol} color={PU} />
            <Row label="Liquidity Swept"    value={trade.liquidityTarget} />
            <Row label="PO3 Phase"          value={trade.po3Phase} />
            <Row label="ICT Macro"          value={MACRO_CONFIG.find((x) => x.v === trade.ictMacro)?.l || "None"} color={trade.ictMacro ? CY : T3} />
            <Row label="Silver Bullet"      value={SILVER_BULLET_CONFIG.find((x) => x.v === trade.silverBullet)?.l || "None"} color={trade.silverBullet ? GR : T3} />
            <Row label="MM Model"           value={trade.mmModel || "None"} color={trade.mmModel === "Buy Program" ? GR : trade.mmModel === "Sell Program" ? RE : T3} />
            <Row label="Judas Swing"        value={trade.judasSwing ? "Yes — manipulation sweep before entry" : "No"} color={trade.judasSwing ? AM : T3} />
            <Row label="SMT Divergence"     value={trade.smtDivergence ? `Yes — ${trade.smtPair}` : "No"} />
            <Row label="Entry TF"           value={trade.entryTimeframe} color={OR} />
            {trade.dealingRangeH && <Row label="Dealing Range" value={`${trade.dealingRangeL} — ${trade.dealingRangeH}`} />}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: GR, letterSpacing: 1.5, marginBottom: 9, fontWeight: 700, textTransform: "uppercase" }}>Execution & Risk</div>
          <div style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 12, padding: "14px" }}>
            <Row label="Entry"          value={trade.entryPrice} color={CY} />
            <Row label="Stop"           value={trade.stopPrice} color={RE} />
            <Row label="Target (DOL)"   value={trade.targetPrice} color={GR} />
            {trade.hasPartial
              ? <>
                  <Row label={`Partial (${(+(trade.partialSize || 0.5) * 100).toFixed(0)}%)`} value={trade.partialExitPrice} color={AM} />
                  <Row label="Runner Exit" value={trade.remainingExitPrice} color={GR} />
                </>
              : <Row label="Exit" value={trade.exitPrice} color={pnl > 0 ? GR : RE} />}
            <Row label="Stop Distance"  value={trade.stopDistance ? `${trade.stopDistance} pts` : "—"} />
            <Row label="Projected R:R"  value={trade.projectedRR ? `${trade.projectedRR}R` : "—"} color={PU} />
            <Row label="Actual R:R"     value={trade.actualRR !== null && trade.actualRR !== undefined ? `${trade.actualRR}R` : "—"} color={pnl > 0 ? GR : pnl < 0 ? RE : AM} />
            <Row label="Risk %"         value={trade.riskPercent ? `${trade.riskPercent}%` : "—"} color={+(trade.riskPercent || 0) > 1 ? AM : GR} />
            <Row label="Risk $"         value={trade.riskAmount ? `$${trade.riskAmount}` : "—"} />
            {trade.tvUrl && (
              <div style={{ marginTop: 9, padding: "7px 10px", background: `${CY}11`, border: `1px solid ${CY}22`, borderRadius: 8, display: "flex", alignItems: "center", gap: 7 }}>
                <ExternalLink size={11} color={CY} />
                <a href={trade.tvUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: CY, textDecoration: "none" }}>TradingView Chart</a>
              </div>
            )}
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: PU, letterSpacing: 1.5, marginBottom: 9, fontWeight: 700, textTransform: "uppercase" }}>Reflection</div>
            <div style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 12, padding: "14px" }}>
              <Row label="Entry Quality"   value={trade.entryQuality} />
              <Row label="Exit Quality"    value={trade.exitQuality} />
              <Row label="Psychology"      value={trade.psychologyTag} color={["Disciplined", "Patient", "Confident", "Process-Focused"].includes(trade.psychologyTag) ? GR : RE} />
              <Row label="Execution Score" value={trade.executionScore ? `${trade.executionScore}/10` : "—"} color={+(trade.executionScore || 0) >= 8 ? GR : +(trade.executionScore || 0) >= 5 ? AM : RE} />
              <Row label="Checklist"       value={`${clScore}/${clTotal}`} color={clScore === clTotal ? GR : AM} />
              <Row label="Emotion Before"  value={trade.emotionBefore} />
              <Row label="Emotion After"   value={trade.emotionAfter} color={/frustrat|revenge|angry|tilt|fomo/i.test(trade.emotionAfter || "") ? RE : T1} />
              {(trade.commission || trade.swapFees) && <Row label="Costs" value={`$${((+trade.commission || 0) + (+trade.swapFees || 0)).toLocaleString()}`} color={AM} />}
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: clScore === clTotal ? GR : AM, letterSpacing: 1.5, marginBottom: 9, fontWeight: 700, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
            <span>Pre-Trade Checklist — {clScore}/{clTotal}</span>
            {trade.checklistTemplate && <span style={{ fontSize: 9.5, color: T3, letterSpacing: 0.5, textTransform: "none" }}>· {trade.checklistTemplate}</span>}
            {trade.checklistSkipped && <span style={{ fontSize: 9, color: AM, padding: "1px 7px", borderRadius: 8, background: `${AM}18`, border: `1px solid ${AM}44`, letterSpacing: 0.5 }}>SKIPPED</span>}
          </div>
          <div style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 12, padding: "13px", display: "flex", flexDirection: "column", gap: 7 }}>
            {clItems.map((item, i) => {
              const checked = clChecks[i];
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 5, background: checked ? `${GR}33` : `${RE}22`, border: `1.5px solid ${checked ? GR : RE}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                    {checked ? <Check size={10} color={GR} /> : <X size={8} color={RE} />}
                  </div>
                  <span style={{ fontSize: 11.5, color: checked ? T1 : T3, lineHeight: 1.4 }}>{item}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: AM, letterSpacing: 1.5, marginBottom: 9, fontWeight: 700, textTransform: "uppercase" }}>Notes & Lessons</div>
          <div style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 12, padding: "14px" }}>
            {trade.notes && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9.5, color: T3, letterSpacing: 1, marginBottom: 5, textTransform: "uppercase" }}>Trade Notes</div>
                <div style={{ fontSize: 12, color: T2, lineHeight: 1.6 }}>{trade.notes}</div>
              </div>
            )}
            {trade.mistakes && (
              <div style={{ marginBottom: 12, padding: "10px 11px", background: `${RE}0A`, borderRadius: 8 }}>
                <div style={{ fontSize: 9.5, color: T3, letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>Mistakes Made</div>
                <div style={{ fontSize: 12, color: RE, lineHeight: 1.6 }}>{trade.mistakes}</div>
              </div>
            )}
            {trade.lessons && (
              <div style={{ padding: "10px 11px", background: `${AM}0A`, borderRadius: 8 }}>
                <div style={{ fontSize: 9.5, color: T3, letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>Lessons Learned</div>
                <div style={{ fontSize: 12, color: AM, lineHeight: 1.6 }}>{trade.lessons}</div>
              </div>
            )}
            {!trade.notes && !trade.mistakes && !trade.lessons && (
              <div style={{ fontSize: 12, color: T3 }}>No notes recorded for this trade.</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ margin: "0 22px 22px", padding: "16px", background: `${CY}08`, border: `1px solid ${CY}22`, borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: aiReview ? 13 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Cpu size={14} color={CY} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: CY }}>ARCHITECT — Expert ICT Trade Review</div>
              <div style={{ fontSize: 10.5, color: T3 }}>Master ICT methodology analysis · AI coaching</div>
            </div>
          </div>
          {!aiReview && !ldState && (
            <button onClick={fetchReview} style={{ padding: "7px 13px", background: `${CY}22`, border: `1px solid ${CY}44`, borderRadius: 9, color: CY, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
              <Cpu size={12} />Generate ICT Review
            </button>
          )}
          {ldState && <div style={{ fontSize: 12, color: T2, display: "flex", gap: 5, alignItems: "center" }}><Cpu size={12} color={CY} />Analysing…</div>}
        </div>
        {aiReview && <div style={{ fontSize: 13, color: T2, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{aiReview}</div>}
      </div>
    </div>
  );
}
