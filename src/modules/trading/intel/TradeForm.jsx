// ── Trade entry — the modular research form ──────────────────────────
// Organized into the spec's sections, driven by field-type primitives and
// the user's own libraries. Fast to log, everything editable, nothing
// methodology-specific. Auto-derives trade info, session, risk, RR, result.
import { useMemo, useRef, useState } from "react";
import { X, Image as ImageIcon, Link2, Wand2, Lightbulb, Check } from "lucide-react";
import { BD, B2, T1, T2, T3, GL, GR, RE, AM } from "../../../shared/designTokens.js";
import { MoneyInp } from "../../../shared/ui.jsx";
import { DatePicker } from "../../../shared/DatePicker.jsx";
import { localDateStr } from "../../../shared/dates.js";
import { AK, Lbl, Section, Seg, ChipMulti, Rating, TextArea, NumInp, AutoCalc } from "./fields.jsx";
import { PSYCH_BEFORE, REVIEW_FIELDS, DEFAULT_TIMEFRAMES, MEDIA_CATEGORIES } from "./defaults.js";
import {
  uid, sanitizeTrades, tradeInfo, detectSessions, recommendLessons,
  riskAmount, stopDistance, projectedRR, netPnl, grossPnl, tradeResult, actualRR, fmtMoney, RESULT_COLORS,
} from "./tradingIntel.js";

const nowHHMM = () => new Date().toTimeString().slice(0, 5);
const names = (lib) => (lib || []).filter((x) => !x.archived).map((x) => x.name);

function downscale(file, cb) {
  const r = new FileReader();
  r.onload = () => { const img = new Image(); img.onload = () => { const max = 900, sc = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); cb(c.toDataURL("image/jpeg", 0.72)); }; img.onerror = () => cb(""); img.src = r.result; };
  r.onerror = () => cb(""); r.readAsDataURL(file);
}

function seed(initial, accounts, activeId) {
  const s = (v) => (v == null || v === "" ? "" : String(v));
  if (initial) return {
    ...initial,
    riskPct: s(initial.riskPct), lots: s(initial.lots), entry: s(initial.entry), stop: s(initial.stop),
    target: s(initial.target), exit: initial.exit === "" || initial.exit == null ? "" : s(initial.exit),
    commission: s(initial.commission), swap: s(initial.swap),
  };
  return {
    id: uid("t"), accountId: activeId || accounts[0]?.id || "",
    date: localDateStr(), time: nowHHMM(), timeClosed: "",
    instrument: "", pipSize: 0.0001, valuePerPipPerLot: 10,
    direction: "Buy", sessions: [], sessionAuto: false, conditions: [],
    strategyId: "", strategy: "", strategyVersion: 1, marketModel: "",
    confluences: [], htf: "", mtf: "", ltf: "", entryTf: "",
    riskPct: "", lots: "", entry: "", stop: "", target: "", exit: "",
    commission: "", swap: "", status: "OPEN",
    psychBefore: {}, emotions: [], reflectionMood: "", reflectionEnergy: "", reflectionText: "",
    checklist: [], media: [], review: {},
    wentWell: "", mistakesMade: "", unexpected: "", lessons: "", improvements: "", journalText: "",
    biggestMistake: "", rootCause: "", actionableFix: "", whatRepeat: "", whatStop: "", focusNext: "",
    reflectionAnswers: {}, mistakes: [], createdAt: new Date().toISOString(),
  };
}

export function TradeForm({ initial, libs, accounts, activeId, reflectionQs, lessons = [], onReinforceLesson, onSave, onCancel }) {
  const [f, setF] = useState(() => seed(initial, accounts, activeId));
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const fileRef = useRef(null);
  const [mediaCat, setMediaCat] = useState(MEDIA_CATEGORIES[0]);
  const [reinforced, setReinforced] = useState([]);
  const recs = useMemo(() => recommendLessons(lessons, { strategy: f.strategy, instrument: f.instrument, conditions: f.conditions }), [lessons, f.strategy, f.instrument, f.conditions]);

  const instOpts = (libs.instruments || []).filter((i) => !i.archived);
  const strat = (libs.strategies || []).find((s) => s.id === f.strategyId);

  // live calc preview from the current form
  const preview = useMemo(() => sanitizeTrades([{ ...f, status: f.exit !== "" ? "CLOSED" : f.status }])[0], [f]);
  const info = tradeInfo(f.date);
  const risk = riskAmount(preview), rr = projectedRR(preview), sd = stopDistance(preview);
  const acct = accounts.find((a) => a.id === f.accountId);
  const riskPctCalc = acct && acct.startBalance > 0 ? +((risk / acct.startBalance) * 100).toFixed(2) : 0;
  const overRisk = acct && f.riskPct && riskPctCalc > +f.riskPct + 0.01;

  const pickInstrument = (sym) => {
    const inst = instOpts.find((i) => i.symbol === sym);
    setF((p) => ({ ...p, instrument: sym, ...(inst ? { pipSize: inst.pipSize, valuePerPipPerLot: inst.valuePerPipPerLot } : {}) }));
  };
  const pickStrategy = (id) => {
    const s = (libs.strategies || []).find((x) => x.id === id);
    if (!s) { setF((p) => ({ ...p, strategyId: "", strategy: "", strategyVersion: 1 })); return; }
    const v = s.versions.find((x) => x.version === s.activeVersion) || s.versions[s.versions.length - 1];
    setF((p) => ({
      ...p, strategyId: s.id, strategy: s.name, strategyVersion: v.version,
      confluences: p.confluences.length ? p.confluences : [...(v.confluences || [])],
      checklist: p.checklist.length ? p.checklist : (v.checklist || []).map((text) => ({ text, done: false })),
    }));
  };
  const autoSession = () => setF((p) => ({ ...p, sessions: detectSessions(libs.sessions, p.time), sessionAuto: true }));

  const addMediaUrl = () => { const url = prompt("Paste a TradingView or image URL"); if (url && url.trim()) setF((p) => ({ ...p, media: [...p.media, { id: uid("m"), category: mediaCat, kind: "url", value: url.trim(), label: "" }] })); };
  const addMediaFile = (file) => downscale(file, (data) => { if (data) setF((p) => ({ ...p, media: [...p.media, { id: uid("m"), category: mediaCat, kind: "image", value: data, label: "" }] })); });
  const rmMedia = (id) => setF((p) => ({ ...p, media: p.media.filter((m) => m.id !== id) }));

  const save = () => {
    const raw = { ...f, status: f.exit !== "" ? "CLOSED" : f.status, editedAt: initial ? new Date().toISOString() : null };
    onSave(sanitizeTrades([raw])[0]);
  };

  const inp = { width: "100%", background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 12px", fontSize: 12.5, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const result = tradeResult(preview);
  const canSave = f.accountId && f.instrument && f.lots && f.entry;

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "18px 20px 40px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 5, background: "rgba(8,8,8,0.85)", backdropFilter: "blur(8px)", padding: "6px 0 10px", marginBottom: -2 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: T1 }}>{initial ? "Edit trade" : "New trade"}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onCancel} style={{ padding: "8px 15px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, color: T2, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button onClick={save} disabled={!canSave} style={{ padding: "8px 18px", background: canSave ? `${AK}1E` : GL, border: `1px solid ${canSave ? AK + "55" : BD}`, borderRadius: 9, color: canSave ? "#FFFFFF" : T3, fontSize: 12, fontWeight: 700, cursor: canSave ? "pointer" : "default", fontFamily: "inherit" }}>Save trade</button>
          </div>
        </div>

        {/* strategy reminder */}
        {strat && (() => { const v = strat.versions.find((x) => x.version === f.strategyVersion); return v?.rules ? (
          <div style={{ display: "flex", gap: 8, padding: "10px 13px", background: `${AK}0E`, border: `1px solid ${AK}33`, borderRadius: 10, fontSize: 11.5, color: T2, lineHeight: 1.5 }}>
            <Wand2 size={13} color={AK} style={{ flexShrink: 0, marginTop: 1 }} /><div><b style={{ color: T1 }}>{strat.name} v{v.version}</b> — {v.rules}</div>
          </div>
        ) : null; })()}

        {/* relevant lessons from past trades in this context */}
        {recs.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "11px 13px", background: "rgba(240,180,41,0.07)", border: `1px solid ${AM}33`, borderRadius: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: AM, letterSpacing: 0.5, textTransform: "uppercase" }}><Lightbulb size={12} /> Lessons for this setup</div>
            {recs.map((l) => {
              const done = reinforced.includes(l.id);
              return (
                <div key={l.id} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T1 }}>{l.title}{l.reinforcementCount > 0 && <span style={{ color: T3, fontWeight: 400 }}> · reinforced {l.reinforcementCount}×</span>}</div>
                    {l.description && <div style={{ fontSize: 11, color: T2, lineHeight: 1.45, marginTop: 2 }}>{l.description}</div>}
                  </div>
                  {onReinforceLesson && (
                    <button onClick={() => { if (!done) { onReinforceLesson(l.id, f.id); setReinforced((p) => [...p, l.id]); } }} disabled={done}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: done ? `${GR}18` : GL, border: `1px solid ${done ? GR + "44" : BD}`, borderRadius: 8, color: done ? GR : T2, fontSize: 10.5, fontWeight: 600, cursor: done ? "default" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                      {done ? <><Check size={11} /> Applied</> : "Reinforce"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Section title="Trade Info" sub="Date, time and account — the rest is auto">
          <div><Lbl>Account</Lbl>
            {accounts.length ? <Seg options={accounts.map((a) => ({ v: a.id, l: `${a.name} · ${a.type}` }))} value={f.accountId} onChange={(v) => { const a = accounts.find((x) => x.id === v); set("accountId", v); if (a && !f.riskPct) set("riskPct", String(a.riskPct)); }} />
              : <div style={{ fontSize: 11.5, color: AM }}>No accounts yet — create one in the Accounts tab first.</div>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px", gap: 10 }}>
            <div><Lbl>Date</Lbl><DatePicker value={f.date} onChange={(v) => set("date", v)} /></div>
            <div><Lbl>Time in</Lbl><input type="time" value={f.time} onChange={(e) => set("time", e.target.value)} style={{ ...inp, colorScheme: "dark" }} /></div>
            <div><Lbl>Time out</Lbl><input type="time" value={f.timeClosed} onChange={(e) => set("timeClosed", e.target.value)} style={{ ...inp, colorScheme: "dark" }} /></div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[["Day", info.weekday], ["Week", `W${info.week}`], ["Month", info.month], ["Quarter", `Q${info.quarter}`], ["Year", info.year], ["Day #", info.dayOfYear]].map(([l, v]) => (
              <span key={l} style={{ fontSize: 10.5, color: T3, padding: "3px 9px", background: GL, borderRadius: 7, border: `1px solid ${BD}` }}>{l}: <b style={{ color: T2 }}>{v}</b></span>
            ))}
          </div>
        </Section>

        <Section title="Setup" sub="Instrument, direction, session, strategy, confluences">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><Lbl>Instrument</Lbl>{instOpts.length ? <Seg options={instOpts.map((i) => i.symbol)} value={f.instrument} onChange={pickInstrument} /> : <span style={{ fontSize: 11, color: AM }}>Add instruments in Library.</span>}</div>
            <div><Lbl>Direction</Lbl>
              <div style={{ display: "flex", gap: 6 }}>
                {["Buy", "Sell"].map((d) => <button key={d} onClick={() => set("direction", d)} style={{ flex: 1, padding: "9px", borderRadius: 9, border: `1px solid ${f.direction === d ? (d === "Buy" ? GR : RE) + "88" : BD}`, background: f.direction === d ? (d === "Buy" ? GR : RE) + "22" : GL, color: f.direction === d ? (d === "Buy" ? GR : RE) : T2, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{d}</button>)}
              </div>
            </div>
          </div>
          <div><Lbl hint="auto-detected from time">Session</Lbl>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}><ChipMulti options={names(libs.sessions)} selected={f.sessions} onChange={(v) => set("sessions", v)} allowAdd={false} /></div>
              <button onClick={autoSession} style={{ padding: "6px 11px", background: `${AK}12`, border: `1px solid ${AK}44`, borderRadius: 8, color: AK, fontSize: 11, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}><Wand2 size={12} /> Auto</button>
            </div>
          </div>
          <div><Lbl>Market conditions</Lbl><ChipMulti options={names(libs.conditions)} selected={f.conditions} onChange={(v) => set("conditions", v)} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
            <div><Lbl>Strategy</Lbl>{(libs.strategies || []).filter((s) => !s.archived).length ? <Seg options={(libs.strategies || []).filter((s) => !s.archived).map((s) => ({ v: s.id, l: s.name }))} value={f.strategyId} onChange={pickStrategy} /> : <span style={{ fontSize: 11, color: AM }}>Add a strategy in Library.</span>}</div>
            {strat && strat.versions.length > 1 && <div><Lbl>Version</Lbl><Seg options={strat.versions.map((v) => ({ v: v.version, l: `v${v.version}` }))} value={f.strategyVersion} onChange={(v) => set("strategyVersion", v)} /></div>}
          </div>
          <div><Lbl>Market maker model</Lbl><input value={f.marketModel} onChange={(e) => set("marketModel", e.target.value)} placeholder="Your own market model — define it however you like" style={inp} /></div>
          <div><Lbl>Entry confluences</Lbl><ChipMulti options={names(libs.confluences)} selected={f.confluences} onChange={(v) => set("confluences", v)} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div><Lbl>HTF</Lbl><input value={f.htf} onChange={(e) => set("htf", e.target.value)} placeholder="4H Bullish" style={inp} /></div>
            <div><Lbl>MTF</Lbl><input value={f.mtf} onChange={(e) => set("mtf", e.target.value)} placeholder="15M Pullback" style={inp} /></div>
            <div><Lbl>LTF</Lbl><input value={f.ltf} onChange={(e) => set("ltf", e.target.value)} placeholder="1M Confirmation" style={inp} /></div>
          </div>
          <div><Lbl>Entry timeframe</Lbl><Seg options={DEFAULT_TIMEFRAMES} value={f.entryTf} onChange={(v) => set("entryTf", v)} /></div>
        </Section>

        <Section title="Risk & Position" sub="Lots-based — RR, stop distance and risk auto-calculate">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            <div><Lbl>Risk %</Lbl><NumInp value={f.riskPct} onChange={(v) => set("riskPct", v)} placeholder="1" /></div>
            <div><Lbl>Lots</Lbl><NumInp value={f.lots} onChange={(v) => set("lots", v)} placeholder="1.0" /></div>
            <div><Lbl>Entry</Lbl><NumInp value={f.entry} onChange={(v) => set("entry", v)} placeholder="0" /></div>
            <div><Lbl>Stop loss</Lbl><NumInp value={f.stop} onChange={(v) => set("stop", v)} placeholder="0" /></div>
            <div><Lbl>Take profit</Lbl><NumInp value={f.target} onChange={(v) => set("target", v)} placeholder="0" /></div>
            <div><Lbl>Exit</Lbl><NumInp value={f.exit} onChange={(v) => set("exit", v)} placeholder="blank = open" /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8 }}>
            <AutoCalc label="Stop dist." value={sd ? sd.toFixed(Math.max(2, (instOpts.find((i) => i.symbol === f.instrument)?.decimals || 2))) : "—"} />
            <AutoCalc label="Risk : Reward" value={rr ? `${rr}R` : "—"} color={rr >= 2 ? GR : rr >= 1 ? AM : T2} />
            <AutoCalc label="Risk amount" value={risk ? fmtMoney(risk) : "—"} color={overRisk ? RE : AK} />
            <AutoCalc label="Actual risk %" value={riskPctCalc ? `${riskPctCalc}%` : "—"} color={overRisk ? RE : GR} />
          </div>
          {overRisk && <div style={{ fontSize: 11, color: RE }}>⚠ Position risks {riskPctCalc}% — above your {f.riskPct}% plan. Reduce lots or widen the account.</div>}
        </Section>

        <Section title="Result & Profit" sub="Result is determined automatically from your exit" defaultOpen={!!initial}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><Lbl>Commission</Lbl><MoneyInp value={f.commission} onChange={(v) => set("commission", v)} placeholder="0" allowNegative /></div>
            <div><Lbl>Swap / fees</Lbl><MoneyInp value={f.swap} onChange={(v) => set("swap", v)} placeholder="0" allowNegative /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8 }}>
            <AutoCalc label="Gross PnL" value={f.exit !== "" ? fmtMoney(grossPnl(preview)) : "—"} color={grossPnl(preview) >= 0 ? GR : RE} />
            <AutoCalc label="Net PnL" value={f.exit !== "" ? fmtMoney(netPnl(preview)) : "—"} color={netPnl(preview) >= 0 ? GR : RE} />
            <AutoCalc label="Actual RR" value={f.exit !== "" && actualRR(preview) ? `${actualRR(preview)}R` : "—"} />
            <AutoCalc label="Result" value={result || "Open"} color={result ? RESULT_COLORS[result] : T3} />
          </div>
        </Section>

        <Section title="Psychology" sub="Before, during and after — the edge that isn't on the chart" defaultOpen={false}>
          <div><Lbl>Before the trade (1–10)</Lbl>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 9 }}>
              {PSYCH_BEFORE.map((d) => (
                <div key={d} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: T2, width: 76 }}>{d}</span>
                  <div style={{ flex: 1 }}><Rating value={f.psychBefore[d] || 0} onChange={(v) => set("psychBefore", { ...f.psychBefore, [d]: v })} /></div>
                </div>
              ))}
            </div>
          </div>
          <div><Lbl>During — emotions felt</Lbl><ChipMulti options={names(libs.emotions)} selected={f.emotions} onChange={(v) => set("emotions", v)} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><Lbl>After — mood</Lbl><input value={f.reflectionMood} onChange={(e) => set("reflectionMood", e.target.value)} placeholder="Calm / rattled…" style={inp} /></div>
            <div><Lbl>After — energy</Lbl><input value={f.reflectionEnergy} onChange={(e) => set("reflectionEnergy", e.target.value)} placeholder="Drained / sharp…" style={inp} /></div>
          </div>
          <div><Lbl>After — reflection</Lbl><TextArea value={f.reflectionText} onChange={(v) => set("reflectionText", v)} placeholder="How did you feel after closing?" /></div>
        </Section>

        <Section title="Checklist" sub="Tick what you actually did" defaultOpen={false}>
          {f.checklist.length ? f.checklist.map((c, i) => (
            <label key={i} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
              <input type="checkbox" checked={c.done} onChange={() => set("checklist", f.checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} style={{ accentColor: AK, width: 15, height: 15 }} />
              <span style={{ fontSize: 12, color: c.done ? T1 : T2, textDecoration: c.done ? "none" : "none" }}>{c.text}</span>
            </label>
          )) : <div style={{ fontSize: 11.5, color: T3 }}>No checklist — pick a strategy with one, or add items in Library.</div>}
        </Section>

        <Section title="Charts & Media" sub="Categorized chart uploads and links" defaultOpen={false}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select value={mediaCat} onChange={(e) => setMediaCat(e.target.value)} style={{ background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "7px 10px", fontSize: 11.5, color: T2, outline: "none", fontFamily: "inherit", cursor: "pointer" }}>
              {MEDIA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={() => fileRef.current?.click()} style={{ padding: "7px 12px", background: GL, border: `1px solid ${BD}`, borderRadius: 8, color: T2, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}><ImageIcon size={12} /> Upload</button>
            <button onClick={addMediaUrl} style={{ padding: "7px 12px", background: GL, border: `1px solid ${BD}`, borderRadius: 8, color: T2, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}><Link2 size={12} /> Add URL</button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) addMediaFile(file); e.target.value = ""; }} />
          </div>
          {f.media.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 9 }}>
              {f.media.map((m) => (
                <div key={m.id} style={{ position: "relative", borderRadius: 9, overflow: "hidden", border: `1px solid ${BD}` }}>
                  {m.kind === "image"
                    ? <div style={{ height: 78, backgroundImage: `url(${m.value})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                    : <div style={{ height: 78, display: "flex", alignItems: "center", justifyContent: "center", background: GL, padding: 6 }}><Link2 size={16} color={AK} /></div>}
                  <div style={{ fontSize: 8.5, color: T3, padding: "3px 6px", background: B2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.category}</div>
                  <button onClick={() => rmMedia(m.id)} style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.65)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={11} /></button>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Structured Review" sub="Rate the execution — 1 to 10" defaultOpen={false}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 9 }}>
            {REVIEW_FIELDS.map((d) => (
              <div key={d} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, color: T2, width: 96 }}>{d}</span>
                <div style={{ flex: 1 }}><Rating value={f.review[d] || 0} onChange={(v) => set("review", { ...f.review, [d]: v })} /></div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><Lbl>What went well</Lbl><TextArea value={f.wentWell} onChange={(v) => set("wentWell", v)} /></div>
            <div><Lbl>Mistakes made</Lbl><TextArea value={f.mistakesMade} onChange={(v) => set("mistakesMade", v)} /></div>
            <div><Lbl>Unexpected events</Lbl><TextArea value={f.unexpected} onChange={(v) => set("unexpected", v)} /></div>
            <div><Lbl>Lessons learned</Lbl><TextArea value={f.lessons} onChange={(v) => set("lessons", v)} /></div>
          </div>
          <div><Lbl>Actionable improvements</Lbl><TextArea value={f.improvements} onChange={(v) => set("improvements", v)} /></div>
          <div><Lbl>Free journal</Lbl><TextArea value={f.journalText} onChange={(v) => set("journalText", v)} rows={3} /></div>
        </Section>

        <Section title="Action Plan & Reflection" sub="Turn the trade into feedback" defaultOpen={false}>
          <div><Lbl>Mistakes (tag for analytics)</Lbl><ChipMulti options={names(libs.mistakes)} selected={f.mistakes} onChange={(v) => set("mistakes", v)} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><Lbl>Biggest mistake</Lbl><input value={f.biggestMistake} onChange={(e) => set("biggestMistake", e.target.value)} style={inp} /></div>
            <div><Lbl>Root cause</Lbl><input value={f.rootCause} onChange={(e) => set("rootCause", e.target.value)} style={inp} /></div>
            <div><Lbl>Actionable fix</Lbl><input value={f.actionableFix} onChange={(e) => set("actionableFix", e.target.value)} style={inp} /></div>
            <div><Lbl>Focus for next trade</Lbl><input value={f.focusNext} onChange={(e) => set("focusNext", e.target.value)} style={inp} /></div>
            <div><Lbl>What to repeat</Lbl><input value={f.whatRepeat} onChange={(e) => set("whatRepeat", e.target.value)} style={inp} /></div>
            <div><Lbl>What to stop</Lbl><input value={f.whatStop} onChange={(e) => set("whatStop", e.target.value)} style={inp} /></div>
          </div>
          <div><Lbl>Reflection</Lbl>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {reflectionQs.map((q) => (
                <div key={q}>
                  <div style={{ fontSize: 11, color: T2, marginBottom: 4 }}>{q}</div>
                  <input value={f.reflectionAnswers[q] || ""} onChange={(e) => set("reflectionAnswers", { ...f.reflectionAnswers, [q]: e.target.value })} style={inp} />
                </div>
              ))}
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
