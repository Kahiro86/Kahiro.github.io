// ── Log a trade ──────────────────────────────────────────────────────
// PRESS 'N' PLAY's own entry form. Deliberately narrower than the OS
// app's eight-section research form: this one asks for the trade, and for
// the fields the 34 charts read. Nothing else.
//
// Everything derived — risk, R:R, net R, the outcome — is computed live
// from what you type and shown as you type it, so the numbers are never a
// surprise after saving. The session phase assigns itself from the entry
// time.
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { BD, T1, T2, T3, AC, AC2, GR, RE, AM, MONO } from "../../shared/designTokens.js";
import { Card } from "../../shared/ui.jsx";
import { localDateStr } from "../../shared/dates.js";
import { Lbl, Section, Seg, ChipMulti, Rating, NumInp, TextArea, AutoCalc } from "../trading/intel/fields.jsx";
import {
  uid, sanitizeTrades, riskAmount, projectedRR, grossPnl, netPnl, tradeResult,
  stopDistance, RESULT_COLORS, fmtMoney,
} from "../trading/intel/tradingIntel.js";
import { DEFAULT_INSTRUMENTS } from "../trading/intel/defaults.js";
import * as PNP from "./engine/constants.js";
import { netR } from "./engine/metrics.js";
import { phaseForTime, phaseWindowLabel } from "./engine/phases.js";

const AK = AC2;

const blank = (accountId) => ({
  id: uid("t"),
  accountId: accountId || "",
  date: localDateStr(),
  time: "",
  timeClosed: "",
  instrument: "",
  pipSize: 0.0001,
  valuePerPipPerLot: 10,
  direction: "Buy",
  entry: "", stop: "", target: "", exit: "",
  lots: "", riskPct: "", commission: "", swap: "",
  status: "OPEN",
  setupGrade: "", executionRating: "", managementStyle: "",
  ruleChecklist: [], preTradeFlags: [],
  mfePrice: "", maePrice: "", missedRReason: "",
  wickedOut: "", wickOutClass: "",
  reachedTp1AfterSl: "", reachedOriginalTpAfterSl: "",
  highImpactNews: "", lossCausedBy: "",
  phaseId: "", lessons: "",
  createdAt: new Date().toISOString(),
});

export function TradeEditor({ initial, accounts, accountId, phases, instruments, onSave, onCancel }) {
  const [f, setF] = useState(() => (initial ? { ...blank(accountId), ...initial } : blank(accountId)));
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const insts = instruments?.length ? instruments : DEFAULT_INSTRUMENTS;

  // A closed trade is one with an exit price. Nothing else decides it.
  const preview = useMemo(
    () => sanitizeTrades([{ ...f, status: f.exit !== "" && f.exit != null ? "CLOSED" : "OPEN" }])[0],
    [f],
  );
  const result = tradeResult(preview);
  const closed = preview.status === "CLOSED";

  // The phase follows the entry time, so it is never a thing to remember.
  const autoPhase = useMemo(
    () => (f.time ? phaseForTime(phases, f.time, f.date) : null),
    [f.time, f.date, phases],
  );
  const phase = phases.find((p) => p.id === (f.phaseId || autoPhase));

  const pickInstrument = (symbol) => {
    const i = insts.find((x) => x.symbol === symbol);
    setF((p) => ({
      ...p, instrument: symbol,
      pipSize: i?.pipSize ?? p.pipSize,
      valuePerPipPerLot: i?.valuePerPipPerLot ?? p.valuePerPipPerLot,
    }));
  };

  const problems = [];
  if (!f.instrument) problems.push("instrument");
  if (!(+f.entry)) problems.push("entry");
  if (!(+f.stop)) problems.push("stop");
  if (!(+f.lots)) problems.push("lots");
  if (+f.entry && +f.stop && +f.entry === +f.stop) problems.push("stop cannot equal entry");

  const save = () => {
    if (problems.length) return;
    onSave(sanitizeTrades([{
      ...f,
      status: closed ? "CLOSED" : "OPEN",
      phaseId: f.phaseId || autoPhase || "",
      editedAt: initial ? new Date().toISOString() : null,
    }])[0]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card style={{
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
        position: "sticky", top: 0, zIndex: 5,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T1, flex: 1 }}>
          {initial ? "Edit trade" : "New trade"}
        </span>
        {problems.length > 0 && (
          <span style={{ fontSize: 10.5, color: AM }}>Needs {problems.join(", ")}</span>
        )}
        <button type="button" onClick={onCancel} style={{
          padding: "7px 13px", borderRadius: 8, fontSize: 11.5, fontFamily: "inherit",
          cursor: "pointer", background: "transparent", color: T2, border: `1px solid ${BD}`,
        }}>Cancel</button>
        <button type="button" onClick={save} disabled={problems.length > 0} style={{
          padding: "7px 15px", borderRadius: 8, fontSize: 11.5, fontWeight: 700,
          fontFamily: "inherit", cursor: problems.length ? "default" : "pointer",
          background: problems.length ? "transparent" : AK,
          color: problems.length ? T3 : "#000",
          border: `1px solid ${problems.length ? BD : AK}`,
          opacity: problems.length ? 0.5 : 1,
        }}>Save trade</button>
      </Card>

      <Section title="The trade" sub="Instrument, direction, prices and size" accent={AK}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
          <div><Lbl>Date</Lbl>
            <input type="date" value={f.date} onChange={(e) => set("date", e.target.value)}
              style={{ background: "transparent", border: `1px solid ${BD}`, borderRadius: 8, color: T1, padding: "7px 9px", fontSize: 12, fontFamily: MONO, colorScheme: "dark", width: "100%" }} /></div>
          <div><Lbl hint="Sets the session phase">Entry time</Lbl>
            <input type="time" value={f.time} onChange={(e) => set("time", e.target.value)}
              style={{ background: "transparent", border: `1px solid ${BD}`, borderRadius: 8, color: T1, padding: "7px 9px", fontSize: 12, fontFamily: MONO, colorScheme: "dark", width: "100%" }} /></div>
          <div><Lbl>Exit time</Lbl>
            <input type="time" value={f.timeClosed} onChange={(e) => set("timeClosed", e.target.value)}
              style={{ background: "transparent", border: `1px solid ${BD}`, borderRadius: 8, color: T1, padding: "7px 9px", fontSize: 12, fontFamily: MONO, colorScheme: "dark", width: "100%" }} /></div>
        </div>
        {phase && (
          <div style={{ fontSize: 10.5, color: T3 }}>
            Session phase: <span style={{ color: AC, fontWeight: 600 }}>{phase.phase}</span>{" "}
            <span style={{ fontFamily: MONO }}>{phaseWindowLabel(phase, f.date)}</span>
            {phase.tradeable !== "Yes" && (
              <span style={{ color: phase.tradeable === "Avoid" ? RE : AM, marginLeft: 6 }}>
                · {phase.tradeable}
              </span>
            )}
          </div>
        )}
        {accounts.length > 1 && (
          <div><Lbl>Account</Lbl>
            <Seg options={accounts.map((a) => ({ v: a.id, l: a.name }))} value={f.accountId} onChange={(v) => set("accountId", v)} accent={AK} /></div>
        )}
        <div><Lbl>Instrument</Lbl>
          <Seg options={insts.map((i) => i.symbol)} value={f.instrument} onChange={pickInstrument} accent={AK} /></div>
        <div><Lbl>Direction</Lbl>
          <Seg options={["Buy", "Sell"]} value={f.direction} onChange={(v) => set("direction", v)} accent={AK} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
          <div><Lbl>Entry</Lbl><NumInp value={f.entry} onChange={(v) => set("entry", v)} placeholder="0" /></div>
          <div><Lbl>Stop</Lbl><NumInp value={f.stop} onChange={(v) => set("stop", v)} placeholder="0" /></div>
          <div><Lbl>Target</Lbl><NumInp value={f.target} onChange={(v) => set("target", v)} placeholder="0" /></div>
          <div><Lbl hint="Blank while the trade is open">Exit</Lbl><NumInp value={f.exit} onChange={(v) => set("exit", v)} placeholder="open" /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
          <div><Lbl>Lots</Lbl><NumInp value={f.lots} onChange={(v) => set("lots", v)} placeholder="1.0" /></div>
          <div><Lbl>Commission</Lbl><NumInp value={f.commission} onChange={(v) => set("commission", v)} placeholder="0" /></div>
          <div><Lbl>Swap / fees</Lbl><NumInp value={f.swap} onChange={(v) => set("swap", v)} placeholder="0" /></div>
        </div>
        {/* Live, so the numbers are never a surprise after saving. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(104px,1fr))", gap: 8 }}>
          <AutoCalc label="Stop dist." value={stopDistance(preview) ? stopDistance(preview).toFixed(5) : "—"} />
          <AutoCalc label="Risk" value={riskAmount(preview) ? fmtMoney(riskAmount(preview)) : "—"} />
          <AutoCalc label="Planned R:R" value={projectedRR(preview) ? `${projectedRR(preview)}R` : "—"} />
          <AutoCalc label="Net P&L" value={closed ? fmtMoney(netPnl(preview)) : "—"} color={netPnl(preview) >= 0 ? GR : RE} />
          <AutoCalc label="Net R" value={closed ? `${netR(preview)}R` : "—"} color={netR(preview) >= 0 ? GR : RE} />
          <AutoCalc label="Result" value={result || "Open"} color={result ? RESULT_COLORS[result] : T3} />
        </div>
      </Section>

      <Section title="Grading & discipline" sub="What the dashboard reads" accent={AK} defaultOpen={!!initial}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
          <div><Lbl hint="A+ should outperform B. If it does not, the grading is wrong.">Setup grade</Lbl>
            <Seg options={PNP.SETUP_GRADES} value={f.setupGrade} onChange={(v) => set("setupGrade", v)} accent={AK} /></div>
          <div><Lbl>Management style</Lbl>
            <Seg options={PNP.MANAGEMENT_STYLES} value={f.managementStyle} onChange={(v) => set("managementStyle", v)} accent={AK} /></div>
        </div>
        <div><Lbl hint="How well you executed the plan, not how the trade went">Execution rating</Lbl>
          <Rating value={f.executionRating} onChange={(v) => set("executionRating", v)} accent={AK} /></div>
        <div><Lbl hint="Ticked ÷ 13 is your rule adherence">Rule checklist</Lbl>
          <ChipMulti options={PNP.RULE_CHECKLIST} selected={f.ruleChecklist || []} onChange={(v) => set("ruleChecklist", v)} allowAdd={false} /></div>
        <div><Lbl hint="The state you entered in. Revenge and FOMO are the two to watch.">Pre-trade flags</Lbl>
          <ChipMulti options={PNP.PRE_TRADE_FLAGS} selected={f.preTradeFlags || []} onChange={(v) => set("preTradeFlags", v)} allowAdd={false} /></div>
      </Section>

      <Section title="Forensics" sub="Excursion, wick-outs, news — fill in after the trade" accent={AK} defaultOpen={false}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
          <div><Lbl hint="Best price reached — becomes MFE in R">MFE price</Lbl>
            <NumInp value={f.mfePrice} onChange={(v) => set("mfePrice", v)} placeholder="—" /></div>
          <div><Lbl hint="Worst price reached — becomes heat taken, in R">MAE price</Lbl>
            <NumInp value={f.maePrice} onChange={(v) => set("maePrice", v)} placeholder="—" /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
          <div><Lbl>High-impact news?</Lbl>
            <Seg options={PNP.YES_NO} value={f.highImpactNews} onChange={(v) => set("highImpactNews", v)} accent={AK} /></div>
          <div><Lbl hint="Psychology and Execution are the ones that end accounts">Loss caused by</Lbl>
            <Seg options={PNP.LOSS_CAUSES} value={f.lossCausedBy} onChange={(v) => set("lossCausedBy", v)} accent={AK} /></div>
        </div>
        <div><Lbl>Wicked out?</Lbl>
          <Seg options={PNP.YES_NO} value={f.wickedOut} onChange={(v) => set("wickedOut", v)} accent={AK} /></div>
        {f.wickedOut === "Yes" && (
          <>
            <div><Lbl hint="SL Too Tight and Poor SL Placement are fixable. Correct Invalidation is the system working.">Why</Lbl>
              <Seg options={PNP.WICK_OUT_CLASSES} value={f.wickOutClass} onChange={(v) => set("wickOutClass", v)} accent={AK} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
              <div><Lbl>Reached TP1 after SL?</Lbl>
                <Seg options={PNP.YES_NO_NA} value={f.reachedTp1AfterSl} onChange={(v) => set("reachedTp1AfterSl", v)} accent={AK} /></div>
              <div><Lbl>Reached original TP after SL?</Lbl>
                <Seg options={PNP.YES_NO_NA} value={f.reachedOriginalTpAfterSl} onChange={(v) => set("reachedOriginalTpAfterSl", v)} accent={AK} /></div>
            </div>
          </>
        )}
        <div><Lbl>If R was left behind, why</Lbl>
          <Seg options={PNP.MISSED_R_REASONS} value={f.missedRReason} onChange={(v) => set("missedRReason", v)} accent={AK} /></div>
        <div><Lbl>Lesson</Lbl>
          <TextArea value={f.lessons} onChange={(v) => set("lessons", v)} rows={3} placeholder="Written as an instruction to yourself, not an observation." /></div>
      </Section>
    </div>
  );
}
