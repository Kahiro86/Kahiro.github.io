import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, CheckCircle, ClipboardCheck } from "lucide-react";
import { B0, B1, BD, T1, T2, T3, CY, PU, GR, RE, AM, OR, GL } from "../../shared/designTokens.js";
import { Fld, Inp, Sel, DirTog, Radio, Tags, SL } from "../../shared/ui.jsx";
import {
  INSTRUMENTS, SESSIONS_FULL, MACRO_CONFIG, SILVER_BULLET_CONFIG, MM_MODELS,
  ICT_MODELS, LIQ, PO3, HTF_TF, INT_TF, ENTRY_TF, OUTCOMES, GRADES, ENTRY_Q, EXIT_Q, PSYCH,
} from "./constants.js";
import { calcMetrics, calcActualRR, calcPnl, gcol, getPV, genId, initForm } from "./helpers.js";
import { getActiveKillzone } from "./timezone.js";
import { RiskMeter } from "./RiskMeter.jsx";

export function EntryForm({ onSubmit, onCancel, editTrade, accountBalance, checklistResult }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(editTrade ? { ...editTrade } : initForm());

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const m = calcMetrics(form, accountBalance);
  const STEPS = ["Context", "ICT Model", "Execution"];
  const kz = getActiveKillzone();
  // The pre-trade checklist gate runs before this form. Capture its result for
  // new trades; edited trades keep whatever checklist they were logged with.
  const cl = checklistResult
    ? {
        checklist: checklistResult.checks,
        checklistItems: checklistResult.items,
        checklistScore: checklistResult.score,
        checklistTotal: checklistResult.total,
        checklistTemplate: checklistResult.template,
        checklistSkipped: checklistResult.skipped,
      }
    : null;

  const submit = () => {
    const id = editTrade?.id || genId();
    const actualRR = form.status === "CLOSED" ? calcActualRR({ ...form, ...m }) : null;
    const pnl = form.status === "CLOSED" ? calcPnl(form) : 0;
    onSubmit({ ...form, ...(cl || {}), id, ...m, actualRR, pnl, createdAt: editTrade?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: B0 }}>
      <div style={{ padding: "16px 22px", borderBottom: `1px solid ${BD}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: B1 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T1 }}>{editTrade ? "Edit Trade" : "Log New Trade"}</div>
          <div style={{ fontSize: 11, color: T3, marginTop: 2 }}>ICT Master Methodology · FundedNext $15,000</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {cl && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", background: cl.checklistSkipped ? `${AM}14` : `${GR}14`, border: `1px solid ${cl.checklistSkipped ? AM : GR}44`, borderRadius: 8 }}>
              <ClipboardCheck size={12} color={cl.checklistSkipped ? AM : GR} />
              <span style={{ fontSize: 10, color: cl.checklistSkipped ? AM : GR, fontWeight: 600 }}>
                {cl.checklistSkipped ? "Checklist skipped" : `Checklist ${cl.checklistScore}/${cl.checklistTotal}`}
              </span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", background: `${kz.color}11`, border: `1px solid ${kz.color}33`, borderRadius: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: kz.active ? kz.color : T3 }} />
            <span style={{ fontSize: 10, color: kz.color, fontWeight: 600 }}>{kz.label.split("(")[0].trim()}</span>
          </div>
          <button onClick={onCancel} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 8, padding: "7px 13px", color: T2, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        </div>
      </div>

      <div style={{ padding: "16px 22px 0" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: i < step ? GR : i === step ? CY : GL, border: `1.5px solid ${i <= step ? (i < step ? GR : CY) : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: i <= step ? "#000" : T3, flexShrink: 0 }}>
                  {i < step ? <Check size={10} /> : i + 1}
                </div>
                <span style={{ fontSize: 10.5, color: i === step ? T1 : i < step ? GR : T3, fontWeight: i === step ? 600 : 400, whiteSpace: "nowrap" }}>{s}</span>
              </div>
              <div style={{ height: 2, background: i < step ? GR : i === step ? CY : BD, borderRadius: 1 }} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
        {step === 0 && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
              <Fld label="Date" required><Inp type="date" value={form.date} onChange={(v) => set("date", v)} /></Fld>
              <Fld label="Time (NY EST/EDT)" required><Inp type="time" value={form.time} onChange={(v) => set("time", v)} /></Fld>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
              <Fld label="Instrument" required><Sel value={form.instrument} onChange={(v) => set("instrument", v)} options={INSTRUMENTS.map((i) => i.l)} /></Fld>
              <Fld label="Contracts" required><Inp type="number" value={form.contracts} onChange={(v) => set("contracts", v)} placeholder="1" mono /></Fld>
            </div>
            <Fld label="Direction" required><DirTog value={form.direction} onChange={(v) => set("direction", v)} /></Fld>
            <Fld label="Session / Killzone (EAT shown)" required>
              <Sel value={form.session} onChange={(v) => set("session", v)} options={SESSIONS_FULL} placeholder="Select session..." />
            </Fld>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
              <Fld label="ICT Macro (EAT shown)"><Sel value={form.ictMacro} onChange={(v) => set("ictMacro", v)} options={MACRO_CONFIG} /></Fld>
              <Fld label="Silver Bullet (EAT shown)"><Sel value={form.silverBullet} onChange={(v) => set("silverBullet", v)} options={SILVER_BULLET_CONFIG} /></Fld>
            </div>
            <Fld label="HTF Bias" required><Radio value={form.htfBias} onChange={(v) => set("htfBias", v)} options={["Bullish", "Bearish", "Neutral"]} color={PU} /></Fld>
            <Fld label="Market Maker Model"><Radio value={form.mmModel} onChange={(v) => set("mmModel", v)} options={MM_MODELS} color={AM} /></Fld>
          </div>
        )}

        {step === 1 && (
          <div>
            <Fld label="ICT Setup Models" required hint="Multi-select all confluences">
              <Tags selected={form.models} options={ICT_MODELS} onChange={(v) => set("models", v)} color={CY} />
            </Fld>
            <Fld label="Market Structure" required>
              <Radio value={form.marketStructure} onChange={(v) => set("marketStructure", v)} options={["BOS", "MSS", "MSB"]} color={AM} />
            </Fld>
            <Fld label="Premium / Discount Array" required>
              <Radio value={form.premiumDiscount} onChange={(v) => set("premiumDiscount", v)} options={["Premium Array", "Equilibrium / CE", "Discount Array"]} color={PU} />
            </Fld>
            <Fld label="Draw on Liquidity (DOL)" required hint="What is price drawing to?">
              <Sel value={form.dol} onChange={(v) => set("dol", v)} options={LIQ} placeholder="Select DOL..." />
            </Fld>
            <Fld label="Liquidity Swept at Entry">
              <Sel value={form.liquidityTarget} onChange={(v) => set("liquidityTarget", v)} options={LIQ} placeholder="Select..." />
            </Fld>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
              <Fld label="Dealing Range High"><Inp type="number" value={form.dealingRangeH} onChange={(v) => set("dealingRangeH", v)} placeholder="Range high" mono /></Fld>
              <Fld label="Dealing Range Low"><Inp type="number" value={form.dealingRangeL} onChange={(v) => set("dealingRangeL", v)} placeholder="Range low" mono /></Fld>
            </div>
            {form.dealingRangeH && form.dealingRangeL && (
              <div style={{ padding: "10px 13px", background: `${CY}0A`, border: `1px solid ${CY}22`, borderRadius: 9, marginBottom: 13, fontSize: 12, color: T2 }}>
                <span style={{ color: CY, fontWeight: 700 }}>CE (Midpoint): </span>
                {((+form.dealingRangeH + +form.dealingRangeL) / 2).toFixed(2)}
                {"   "}
                <span style={{ color: PU, fontWeight: 700 }}>OTE 62%: </span>
                {form.direction === "LONG"
                  ? (+form.dealingRangeL + (+form.dealingRangeH - +form.dealingRangeL) * 0.62).toFixed(2)
                  : (+form.dealingRangeH - (+form.dealingRangeH - +form.dealingRangeL) * 0.62).toFixed(2)}
              </div>
            )}
            <Fld label="PO3 Phase"><Radio value={form.po3Phase} onChange={(v) => set("po3Phase", v)} options={PO3} color={OR} /></Fld>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
              <Fld label="HTF Confirmed"><Tags selected={form.htfConfirmed} options={HTF_TF} onChange={(v) => set("htfConfirmed", v)} color={GR} /></Fld>
              <Fld label="Intermediate Context"><Tags selected={form.intermediateContext} options={INT_TF} onChange={(v) => set("intermediateContext", v)} color={AM} /></Fld>
            </div>
            <Fld label="Entry Timeframe" required>
              <Radio value={form.entryTimeframe} onChange={(v) => set("entryTimeframe", v)} options={ENTRY_TF} color={OR} />
            </Fld>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
              <Fld label="Judas Swing Present?">
                <Radio value={form.judasSwing ? "YES" : "NO"} onChange={(v) => set("judasSwing", v === "YES")} options={["YES", "NO"]} color={RE} />
              </Fld>
              <Fld label="SMT Divergence?">
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <Radio value={form.smtDivergence ? "YES" : "NO"} onChange={(v) => set("smtDivergence", v === "YES")} options={["YES", "NO"]} color={PU} />
                  {form.smtDivergence && <Inp value={form.smtPair} onChange={(v) => set("smtPair", v)} placeholder="Correlated pair (e.g. NQ1!)" />}
                </div>
              </Fld>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 13 }}>
              <Fld label="Entry Price" required><Inp type="number" value={form.entryPrice} onChange={(v) => set("entryPrice", v)} placeholder="21480" mono /></Fld>
              <Fld label="Stop Loss" required hint="Beyond invalidation"><Inp type="number" value={form.stopPrice} onChange={(v) => set("stopPrice", v)} placeholder="21455" mono /></Fld>
              <Fld label="Target / DOL" required><Inp type="number" value={form.targetPrice} onChange={(v) => set("targetPrice", v)} placeholder="21535" mono /></Fld>
            </div>
            {form.entryPrice && form.stopPrice && form.targetPrice && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 11, marginBottom: 13 }}>
                {[
                  { l: "Stop Distance", v: `${m.stopDistance} pts`, c: AM },
                  { l: "Projected R:R", v: `${m.projectedRR}R`, c: m.projectedRR >= 2 ? GR : m.projectedRR >= 1 ? CY : RE },
                  { l: "Pt Value", v: `$${getPV(form.instrument)}/pt`, c: PU },
                ].map((x) => (
                  <div key={x.l} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "11px 13px" }}>
                    <div style={{ fontSize: 9.5, color: T3, letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>{x.l}</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: x.c, fontFamily: "monospace" }}>{x.v}</div>
                  </div>
                ))}
              </div>
            )}
            <RiskMeter rp={m.riskPercent} ra={m.riskAmount} />
            <div style={{ height: 1, background: BD, margin: "13px 0" }} />
            <Fld label="TradingView Chart URL"><Inp value={form.tvUrl} onChange={(v) => set("tvUrl", v)} placeholder="https://www.tradingview.com/chart/..." /></Fld>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
              <Fld label="Slippage (points)"><Inp type="number" value={form.slippage} onChange={(v) => set("slippage", v)} placeholder="0" mono /></Fld>
              <Fld label="Emotion Before Entry"><Inp value={form.emotionBefore} onChange={(v) => set("emotionBefore", v)} placeholder="Calm, confident, anxious, FOMO..." /></Fld>
            </div>
            <Fld label="Screenshot URLs" hint="Comma-separate multiple"><Inp value={form.screenshots} onChange={(v) => set("screenshots", v)} placeholder="Paste chart image / TradingView snapshot URLs" /></Fld>
            <div style={{ height: 1, background: BD, margin: "13px 0" }} />
            <div style={{ padding: "11px", background: `${PU}11`, border: `1px solid ${PU}22`, borderRadius: 10, marginBottom: 11 }}>
              <div style={{ fontSize: 12, color: PU, fontWeight: 600, marginBottom: 2 }}>Post-Trade (optional now)</div>
              <div style={{ fontSize: 11, color: T3 }}>Fill exit data immediately after close, or update later from the detail view.</div>
            </div>
            <Fld label="Trade Status">
              <Radio value={form.status} onChange={(v) => set("status", v)} options={[{ value: "OPEN", label: "Still Open" }, { value: "CLOSED", label: "Trade Closed" }]} color={CY} />
            </Fld>
            {form.status === "CLOSED" && (
              <>
                <Fld label="Partial Exit?">
                  <Radio value={form.hasPartial ? "YES" : "NO"} onChange={(v) => set("hasPartial", v === "YES")} options={["YES", "NO"]} color={OR} />
                </Fld>
                {!form.hasPartial
                  ? <Fld label="Exit Price"><Inp type="number" value={form.exitPrice} onChange={(v) => set("exitPrice", v)} placeholder="Exit price" mono /></Fld>
                  : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 13 }}>
                      <Fld label="Partial Exit Price"><Inp type="number" value={form.partialExitPrice} onChange={(v) => set("partialExitPrice", v)} placeholder="First exit" mono /></Fld>
                      <Fld label="Partial Size" hint="0.5=50%"><Inp type="number" value={form.partialSize} onChange={(v) => set("partialSize", v)} placeholder="0.5" mono /></Fld>
                      <Fld label="Remaining Exit"><Inp type="number" value={form.remainingExitPrice} onChange={(v) => set("remainingExitPrice", v)} placeholder="Final exit" mono /></Fld>
                    </div>
                  )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
                  <Fld label="Outcome"><Radio value={form.outcome} onChange={(v) => set("outcome", v)} options={OUTCOMES} color={form.outcome === "WIN" ? GR : form.outcome === "LOSS" ? RE : AM} /></Fld>
                  <Fld label="Grade"><Radio value={form.grade} onChange={(v) => set("grade", v)} options={GRADES} color={gcol(form.grade)} /></Fld>
                </div>
                <Fld label="Entry Quality"><Radio value={form.entryQuality} onChange={(v) => set("entryQuality", v)} options={ENTRY_Q} color={CY} /></Fld>
                <Fld label="Exit Quality"><Radio value={form.exitQuality} onChange={(v) => set("exitQuality", v)} options={EXIT_Q} color={PU} /></Fld>
                <Fld label="Psychology Tag">
                  <Tags
                    selected={form.psychologyTag ? [form.psychologyTag] : []}
                    options={PSYCH}
                    onChange={(v) => set("psychologyTag", v[v.length - 1] || "")}
                    color={["Disciplined", "Patient", "Confident", "Process-Focused"].includes(form.psychologyTag) ? GR : RE}
                  />
                </Fld>
                <Fld label={`Execution Score: ${form.executionScore}/10`}><SL value={form.executionScore} onChange={(v) => set("executionScore", v)} /></Fld>
                <Fld label="Trade Notes">
                  <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="ICT-specific observations: model triggered, price action, macro context..."
                    style={{ width: "100%", minHeight: 80, background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "10px 13px", fontSize: 13, color: T1, lineHeight: 1.6, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                  />
                </Fld>
                <Fld label="Lessons Learned">
                  <textarea value={form.lessons} onChange={(e) => set("lessons", e.target.value)} placeholder="What did this trade teach you? What ICT principle was reinforced or violated?"
                    style={{ width: "100%", minHeight: 65, background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "10px 13px", fontSize: 13, color: T1, lineHeight: 1.6, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                  />
                </Fld>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 13 }}>
                  <Fld label="Commission ($)"><Inp type="number" value={form.commission} onChange={(v) => set("commission", v)} placeholder="0" mono /></Fld>
                  <Fld label="Swap / Fees ($)"><Inp type="number" value={form.swapFees} onChange={(v) => set("swapFees", v)} placeholder="0" mono /></Fld>
                  <Fld label="Time Closed (NY)"><Inp type="time" value={form.timeClosed} onChange={(v) => set("timeClosed", v)} /></Fld>
                </div>
                {(form.commission || form.swapFees) && (
                  <div style={{ padding: "8px 12px", background: `${AM}0A`, border: `1px solid ${AM}22`, borderRadius: 8, marginBottom: 11, fontSize: 11.5, color: T2 }}>
                    <span style={{ color: AM, fontWeight: 700 }}>Net of costs: </span>P/L shown for this trade already subtracts ${((+form.commission || 0) + (+form.swapFees || 0)).toLocaleString()} in commission + fees.
                  </div>
                )}
                <Fld label="Emotion After Close"><Inp value={form.emotionAfter} onChange={(v) => set("emotionAfter", v)} placeholder="Satisfied, frustrated, relieved, revenge-tempted..." /></Fld>
                <Fld label="Mistakes Made">
                  <textarea value={form.mistakes} onChange={(e) => set("mistakes", e.target.value)} placeholder="Any execution errors — early entry, moved stop, oversized, chased, hesitated..."
                    style={{ width: "100%", minHeight: 55, background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "10px 13px", fontSize: 13, color: T1, lineHeight: 1.6, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                  />
                </Fld>
              </>
            )}
          </div>
        )}

      </div>

      <div style={{ padding: "13px 22px", borderTop: `1px solid ${BD}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: B1 }}>
        <button onClick={() => (step > 0 ? setStep((s) => s - 1) : onCancel())} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 15px", background: GL, border: `1px solid ${BD}`, borderRadius: 10, color: T2, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          <ChevronLeft size={14} />{step === 0 ? "Cancel" : "Back"}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {step < 2
            ? (
              <button onClick={() => setStep((s) => s + 1)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 20px", background: `linear-gradient(135deg,${CY},${PU})`, border: "none", borderRadius: 10, color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                Next<ChevronRight size={14} />
              </button>
            ) : (
              <button onClick={submit} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 20px", background: `linear-gradient(135deg,${GR},${CY})`, border: "none", borderRadius: 10, color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <CheckCircle size={14} />{editTrade ? "Update" : "Submit Trade"}
              </button>
            )}
        </div>
      </div>
    </div>
  );
}
