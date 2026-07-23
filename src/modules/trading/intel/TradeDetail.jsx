// ── Trade detail — the full research record ──────────────────────────
import { ArrowLeft, Pencil, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BD, B2, T1, T2, T3, GL, GR, RE, AM, CY } from "../../../shared/designTokens.js";
import { Card } from "../../../shared/ui.jsx";
import { AK } from "./fields.jsx";
import { PSYCH_BEFORE, REVIEW_FIELDS } from "./defaults.js";
import { tradeInfo, riskAmount, projectedRR, stopDistance, netPnl, grossPnl, tradeResult, actualRR, holdMinutes, fmtMoney, RESULT_COLORS } from "./tradingIntel.js";

const fmtDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const Chips = ({ items, color = T2 }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{items.map((x) => <span key={x} style={{ fontSize: 10.5, color, padding: "2px 9px", background: GL, borderRadius: 8, border: `1px solid ${BD}` }}>{x}</span>)}</div>
);
const Field = ({ label, children }) => (children ? <div><div style={{ fontSize: 9, color: T3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>{label}</div><div style={{ fontSize: 12, color: T1, lineHeight: 1.5 }}>{children}</div></div> : null);
const Block = ({ title, children }) => <Card style={{ padding: "15px 17px" }}><div style={{ fontSize: 12.5, fontWeight: 700, color: T1, marginBottom: 12 }}>{title}</div><div style={{ display: "flex", flexDirection: "column", gap: 11 }}>{children}</div></Card>;

export function TradeDetail({ trade: t, reviewFields = REVIEW_FIELDS, psychFields = PSYCH_BEFORE, onBack, onEdit }) {
  const info = tradeInfo(t.date);
  const r = tradeResult(t);
  const open = t.status !== "CLOSED" || t.exit === "" || t.exit == null;
  const net = netPnl(t);
  const hold = holdMinutes(t);
  // Configured dimensions first, then any extra keys the trade was rated on
  // under a since-changed config — a trade always shows what it actually holds.
  const ratings = (obj, fields) => {
    const extra = obj && typeof obj === "object" ? Object.keys(obj).filter((k) => !fields.includes(k)) : [];
    return [...fields, ...extra].filter((k) => Number.isFinite(+obj?.[k]));
  };
  const stat = (l, v, c = T1) => <div style={{ textAlign: "center", padding: "8px 4px", background: GL, borderRadius: 9 }}><div style={{ fontSize: 8.5, color: T3, letterSpacing: 0.6, textTransform: "uppercase" }}>{l}</div><div style={{ fontSize: 14, fontWeight: 800, color: c, fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>{v}</div></div>;

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "18px 20px 40px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "8px 14px", color: T2, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}><ArrowLeft size={14} /> Back</button>
        <button onClick={() => onEdit(t)} style={{ display: "flex", alignItems: "center", gap: 6, background: `${AK}18`, border: `1px solid ${AK}44`, borderRadius: 9, padding: "8px 14px", color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><Pencil size={13} /> Edit</button>
      </div>

      <Card style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: T1 }}>{t.instrument}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 700, color: t.direction === "Buy" ? GR : RE }}>{t.direction === "Buy" ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{t.direction}</span>
          {open ? <span style={{ fontSize: 11, fontWeight: 700, color: AM, padding: "3px 10px", background: `${AM}14`, borderRadius: 8, border: `1px solid ${AM}33` }}>OPEN</span>
            : <span style={{ fontSize: 11, fontWeight: 700, color: RESULT_COLORS[r], padding: "3px 10px", background: `${RESULT_COLORS[r]}18`, borderRadius: 8, border: `1px solid ${RESULT_COLORS[r]}44` }}>{r}</span>}
          <span style={{ marginLeft: "auto", fontSize: 11.5, color: T3 }}>{fmtDate(t.date)} · {t.time}{t.timeClosed ? `–${t.timeClosed}` : ""}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(88px,1fr))", gap: 7 }}>
          {stat("Net PnL", open ? "—" : fmtMoney(net), net >= 0 ? GR : RE)}
          {stat("R:R", projectedRR(t) ? `${projectedRR(t)}R` : "—")}
          {stat("Actual R", !open && actualRR(t) ? `${actualRR(t)}R` : "—")}
          {stat("Risk", riskAmount(t) ? fmtMoney(riskAmount(t)) : "—", AK)}
          {stat("Lots", t.lots || "—")}
          {hold != null && stat("Hold", `${hold}m`)}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          {[["Day", info.weekday], ["Wk", `W${info.week}`], [info.month, ""], ["Q", info.quarter], [info.year, ""]].filter(([a]) => a).map(([l, v], i) => (
            <span key={i} style={{ fontSize: 10, color: T3, padding: "2px 8px", background: GL, borderRadius: 6 }}>{v !== "" ? `${l}: ${v}` : l}</span>
          ))}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 12 }}>
        <Block title="Setup">
          <Field label="Strategy">{t.strategy ? `${t.strategy}${t.strategyVersion ? ` · v${t.strategyVersion}` : ""}` : null}</Field>
          {t.sessions.length > 0 && <div><div style={{ fontSize: 9, color: T3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Session</div><Chips items={t.sessions} color={CY} /></div>}
          {t.conditions.length > 0 && <div><div style={{ fontSize: 9, color: T3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Conditions</div><Chips items={t.conditions} /></div>}
          {t.confluences.length > 0 && <div><div style={{ fontSize: 9, color: T3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Confluences</div><Chips items={t.confluences} color={AK} /></div>}
          <Field label="Market model">{t.marketModel}</Field>
          {(t.htf || t.mtf || t.ltf) && <Field label="Multi-timeframe">{[t.htf && `HTF ${t.htf}`, t.mtf && `MTF ${t.mtf}`, t.ltf && `LTF ${t.ltf}`].filter(Boolean).join(" · ")}</Field>}
          <Field label="Entry timeframe">{t.entryTf}</Field>
        </Block>

        <Block title="Prices">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            <Field label="Entry">{t.entry}</Field>
            <Field label="Stop">{t.stop}</Field>
            <Field label="Target">{t.target}</Field>
            <Field label="Exit">{t.exit === "" ? "—" : t.exit}</Field>
            <Field label="Stop distance">{stopDistance(t) ? stopDistance(t).toFixed(5) : null}</Field>
            {!open && <Field label="Gross PnL">{fmtMoney(grossPnl(t))}</Field>}
          </div>
          {(t.commission || t.swap) ? <Field label="Costs">{`Commission ${fmtMoney(t.commission)} · Swap ${fmtMoney(t.swap)}`}</Field> : null}
        </Block>
      </div>

      {(ratings(t.psychBefore, psychFields).length > 0 || t.emotions.length > 0 || t.reflectionText) && (
        <Block title="Psychology">
          {ratings(t.psychBefore, psychFields).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ratings(t.psychBefore, psychFields).map((k) => <span key={k} style={{ fontSize: 11, color: T2, padding: "3px 10px", background: GL, borderRadius: 8 }}>{k} <b style={{ color: AK, fontFamily: "monospace" }}>{t.psychBefore[k]}</b></span>)}
            </div>
          )}
          {t.emotions.length > 0 && <div><div style={{ fontSize: 9, color: T3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Emotions</div><Chips items={t.emotions} /></div>}
          {(t.reflectionMood || t.reflectionEnergy) && <Field label="After">{[t.reflectionMood && `Mood: ${t.reflectionMood}`, t.reflectionEnergy && `Energy: ${t.reflectionEnergy}`].filter(Boolean).join(" · ")}</Field>}
          <Field label="Reflection">{t.reflectionText}</Field>
        </Block>
      )}

      {ratings(t.review, reviewFields).length > 0 || t.wentWell || t.lessons || t.improvements || t.journalText ? (
        <Block title="Structured Review">
          {ratings(t.review, reviewFields).length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 7 }}>
              {ratings(t.review, reviewFields).map((k) => <div key={k} style={{ textAlign: "center", padding: "6px 4px", background: GL, borderRadius: 8 }}><div style={{ fontSize: 8, color: T3, textTransform: "uppercase" }}>{k}</div><div style={{ fontSize: 13, fontWeight: 800, color: t.review[k] >= 8 ? GR : t.review[k] >= 5 ? AK : AM, fontFamily: "monospace" }}>{t.review[k]}</div></div>)}
            </div>
          )}
          <Field label="What went well">{t.wentWell}</Field>
          <Field label="Mistakes made">{t.mistakesMade}</Field>
          <Field label="Unexpected">{t.unexpected}</Field>
          <Field label="Lessons">{t.lessons}</Field>
          <Field label="Improvements">{t.improvements}</Field>
          <Field label="Journal">{t.journalText}</Field>
        </Block>
      ) : null}

      {(t.mistakes.length > 0 || t.biggestMistake || t.focusNext || Object.keys(t.reflectionAnswers).length > 0) && (
        <Block title="Action Plan & Reflection">
          {t.mistakes.length > 0 && <div><div style={{ fontSize: 9, color: T3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Mistakes</div><Chips items={t.mistakes} color={RE} /></div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Biggest mistake">{t.biggestMistake}</Field>
            <Field label="Root cause">{t.rootCause}</Field>
            <Field label="Actionable fix">{t.actionableFix}</Field>
            <Field label="Focus next">{t.focusNext}</Field>
            <Field label="Repeat">{t.whatRepeat}</Field>
            <Field label="Stop">{t.whatStop}</Field>
          </div>
          {Object.entries(t.reflectionAnswers).filter(([, v]) => v).map(([q, a]) => <Field key={q} label={q}>{a}</Field>)}
        </Block>
      )}

      {t.media.length > 0 && (
        <Block title="Charts & Media">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10 }}>
            {t.media.map((m) => (
              <a key={m.id} href={m.kind === "url" ? m.value : undefined} target="_blank" rel="noreferrer" style={{ textDecoration: "none", borderRadius: 9, overflow: "hidden", border: `1px solid ${BD}`, display: "block" }}>
                {m.kind === "image" ? <div style={{ height: 92, backgroundImage: `url(${m.value})`, backgroundSize: "cover", backgroundPosition: "center" }} /> : <div style={{ height: 92, display: "flex", alignItems: "center", justifyContent: "center", background: GL, fontSize: 10.5, color: AK, padding: 8, textAlign: "center", wordBreak: "break-all" }}>{m.value.slice(0, 60)}</div>}
                <div style={{ fontSize: 9, color: T3, padding: "3px 7px", background: B2 }}>{m.category}</div>
              </a>
            ))}
          </div>
        </Block>
      )}
    </div>
  );
}
