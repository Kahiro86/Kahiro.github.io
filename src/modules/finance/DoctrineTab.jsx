// ── Money Doctrine tab — the identity behind the money ──────────────
// The "who I am" layer of Finance: a personal money creed (the why), the
// principles you spend and save by, and the values the money serves — with
// the Freedom mission sitting above it all so the numbers stay tied to the
// purpose. Editing here never touches balances; it's pure identity.
import { useState } from "react";
import { Compass, Plus, Pencil, Check, Trash2, Archive, ArchiveRestore, Quote, Heart, Scale } from "lucide-react";
import { B2, BD, T1, T2, T3, GL, GR, AM, CY, PU } from "../../shared/designTokens.js";
import { Card, SH } from "../../shared/ui.jsx";
import { Ring } from "../../shared/charts.jsx";
import { MotivePush } from "../../shared/MotivePush.jsx";
import { sanitizeDoctrine, newPrinciple, SUGGESTED_PRINCIPLES, SUGGESTED_VALUES } from "./doctrine.js";

const inp = { width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "10px 12px", fontSize: 13, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.6 };
const smallBtn = (c = T3) => ({ background: "none", border: "none", color: c, cursor: "pointer", padding: 3, display: "inline-flex" });

export function DoctrineTab({ doctrine, setDoctrine, freedom, fmtKES }) {
  const d = sanitizeDoctrine(doctrine);
  const [why, setWhy] = useState(d.why);
  const [draft, setDraft] = useState("");
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState("");

  const commit = (next) => setDoctrine({ ...sanitizeDoctrine(doctrine), ...next, updatedAt: new Date().toISOString() });
  const saveWhy = () => { if (why !== d.why) commit({ why }); };

  const addPrinciple = (text) => { const t = (text || "").trim(); if (!t) return; commit({ principles: [...d.principles, newPrinciple(t)] }); };
  const renamePrinciple = (id) => { const t = editVal.trim(); if (t) commit({ principles: d.principles.map((p) => (p.id === id ? { ...p, text: t } : p)) }); setEditId(null); };
  const togglePrinciple = (id) => commit({ principles: d.principles.map((p) => (p.id === id ? { ...p, archived: !p.archived } : p)) });
  const delPrinciple = (id) => commit({ principles: d.principles.filter((p) => p.id !== id) });
  const movePrinciple = (i, dir) => { const j = i + dir; if (j < 0 || j >= d.principles.length) return; const a = [...d.principles]; [a[i], a[j]] = [a[j], a[i]]; commit({ principles: a }); };

  const toggleValue = (v) => commit({ values: d.values.includes(v) ? d.values.filter((x) => x !== v) : [...d.values, v] });
  const [valDraft, setValDraft] = useState("");
  const addValue = () => { const v = valDraft.trim(); if (v && !d.values.includes(v)) commit({ values: [...d.values, v] }); setValDraft(""); };

  const unusedSuggestions = SUGGESTED_PRINCIPLES.filter((s) => !d.principles.some((p) => p.text === s));

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18, maxWidth: 860 }}>
      <MotivePush context={["wealth", "savings", "general"]} accent={AM} />

      {/* ── THE MISSION — money exists to buy freedom ── */}
      {freedom && (
        <Card style={{ padding: "20px 22px", background: `linear-gradient(110deg,${AM}0E,transparent)`, borderColor: `${AM}33`, display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
          <Ring pct={freedom.freedomPct} size={92} stroke={8} color={AM}>
            <div style={{ fontSize: 18, fontWeight: 900, color: AM, fontFamily: "monospace" }}>{freedom.freedomPct}%</div>
            <div style={{ fontSize: 7.5, color: T3, letterSpacing: 1, marginTop: 2 }}>FREEDOM</div>
          </Ring>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: AM, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Compass size={12} /> The Mission · Freedom</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: T1, marginTop: 3 }}>
              {freedom.yearsOut === 0 ? "The line is crossed." : freedom.yearsOut == null ? "Build the engines." : `≈ ${freedom.yearsOut} years to freedom`}
            </div>
            <div style={{ fontSize: 11.5, color: T3, marginTop: 6, lineHeight: 1.5 }}>{fmtKES(freedom.passiveMonthly)}/mo passive · goal {fmtKES(freedom.freedomNumber)} · this is what the money is for.</div>
          </div>
        </Card>
      )}

      {/* ── THE WHY — a personal money creed ── */}
      <Card style={{ padding: "20px 22px" }}>
        <SH title="Your Why" sub="The freedom you're building toward — in your own words" action={<Quote size={14} color={AM} />} />
        <textarea value={why} onChange={(e) => setWhy(e.target.value)} onBlur={saveWhy}
          placeholder="Why does money matter to you? What does financial freedom actually buy — more time with family, the freedom to walk away, the room to be generous? Write the truth you'll want to re-read on a hard month."
          style={{ ...inp, minHeight: 120, resize: "vertical" }} />
        {why !== d.why && <div style={{ marginTop: 8 }}><button onClick={saveWhy} style={{ padding: "8px 16px", background: `${AM}18`, border: `1px solid ${AM}44`, borderRadius: 9, color: AM, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Save your why</button></div>}
        {d.updatedAt && why === d.why && <div style={{ fontSize: 10, color: T3, marginTop: 8 }}>Last updated {new Date(d.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>}
      </Card>

      {/* ── PRINCIPLES — the rules you live by ── */}
      <Card style={{ padding: "20px 22px" }}>
        <SH title="Money Principles" sub="The rules you actually live by — reorder by what matters most" action={<Scale size={14} color={CY} />} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          {d.principles.map((p, i) => (
            <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", opacity: p.archived ? 0.5 : 1 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <button onClick={() => movePrinciple(i, -1)} disabled={i === 0} style={{ ...smallBtn(i === 0 ? BD : T3), padding: 0, fontSize: 9, lineHeight: 1 }}>▲</button>
                <button onClick={() => movePrinciple(i, 1)} disabled={i === d.principles.length - 1} style={{ ...smallBtn(i === d.principles.length - 1 ? BD : T3), padding: 0, fontSize: 9, lineHeight: 1 }}>▼</button>
              </div>
              <span style={{ width: 22, fontSize: 12, fontWeight: 800, color: CY, fontFamily: "monospace", flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
              {editId === p.id ? (
                <>
                  <input autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") renamePrinciple(p.id); if (e.key === "Escape") setEditId(null); }} style={{ ...inp, flex: 1, padding: "7px 10px" }} />
                  <button onClick={() => renamePrinciple(p.id)} style={smallBtn(GR)}><Check size={14} /></button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 12.5, color: p.archived ? T3 : T1, lineHeight: 1.5 }}>{p.text}</span>
                  <button onClick={() => { setEditId(p.id); setEditVal(p.text); }} style={smallBtn()}><Pencil size={12} /></button>
                  <button onClick={() => togglePrinciple(p.id)} style={smallBtn()}>{p.archived ? <ArchiveRestore size={12} /> : <Archive size={12} />}</button>
                  <button onClick={() => delPrinciple(p.id)} style={smallBtn()}><Trash2 size={12} /></button>
                </>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 7, marginTop: d.principles.length ? 12 : 4 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { addPrinciple(draft); setDraft(""); } }} placeholder="Add a principle you hold…" style={inp} />
          <button onClick={() => { addPrinciple(draft); setDraft(""); }} style={{ padding: "8px 14px", background: `${CY}1A`, border: `1px solid ${CY}55`, borderRadius: 9, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}><Plus size={13} /> Add</button>
        </div>
        {unusedSuggestions.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 9.5, color: T3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 7 }}>Suggestions — tap to adopt</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {unusedSuggestions.slice(0, 6).map((s) => (
                <button key={s} onClick={() => addPrinciple(s)} style={{ padding: "5px 11px", borderRadius: 16, border: `1px dashed ${BD}`, background: GL, color: T2, fontSize: 11, cursor: "pointer", fontFamily: "inherit", textAlign: "left", lineHeight: 1.4 }}>+ {s}</button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ── VALUES — what the money serves ── */}
      <Card style={{ padding: "20px 22px" }}>
        <SH title="Core Values" sub="What every shilling is ultimately in service of" action={<Heart size={14} color={PU} />} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 4 }}>
          {[...new Set([...d.values, ...SUGGESTED_VALUES])].map((v) => {
            const on = d.values.includes(v);
            return (
              <button key={v} onClick={() => toggleValue(v)} style={{ padding: "6px 13px", borderRadius: 18, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: on ? 700 : 500, background: on ? `${PU}22` : GL, border: `1px solid ${on ? PU + "66" : BD}`, color: on ? "#FFFFFF" : T2 }}>
                {on ? "✓ " : ""}{v}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 7, marginTop: 12 }}>
          <input value={valDraft} onChange={(e) => setValDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addValue()} placeholder="Add your own value…" style={inp} />
          <button onClick={addValue} style={{ padding: "8px 14px", background: `${PU}1A`, border: `1px solid ${PU}55`, borderRadius: 9, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}><Plus size={13} /> Add</button>
        </div>
      </Card>
    </div>
  );
}
