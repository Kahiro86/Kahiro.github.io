// ── Library — the universal template manager ─────────────────────────
// Every configurable list lives here: instruments, sessions, market
// conditions, entry confluences, strategies (with versions), mistakes and
// emotions. Create / rename / duplicate / archive / delete. Editing a library
// never rewrites historical trades — trades store their own snapshotted values.
import { useState } from "react";
import { Plus, Pencil, Archive, ArchiveRestore, Trash2, Copy, Check, GitBranch } from "lucide-react";
import { BD, B2, T1, T2, T3, GL, GR } from "../../../shared/designTokens.js";
import { Card } from "../../../shared/ui.jsx";
import { AK, Lbl, TextArea } from "./fields.jsx";
import { uid } from "./tradingIntel.js";

const inp = { width: "100%", background: GL, border: `1px solid ${BD}`, borderRadius: 8, padding: "7px 10px", fontSize: 12, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const smallBtn = (c = T3) => ({ background: "none", border: "none", color: c, cursor: "pointer", padding: 3, display: "inline-flex" });

// Generic named-list editor (conditions / confluences / mistakes / emotions).
function NamedListEditor({ items, setItems, noun }) {
  const [draft, setDraft] = useState("");
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState("");
  const add = () => { const v = draft.trim(); if (v) { setItems((p) => [...(Array.isArray(p) ? p : []), { id: uid("l"), name: v, archived: false }]); setDraft(""); } };
  const rename = (id) => { const v = editVal.trim(); if (v) setItems((p) => p.map((x) => (x.id === id ? { ...x, name: v } : x))); setEditId(null); };
  const toggle = (id) => setItems((p) => p.map((x) => (x.id === id ? { ...x, archived: !x.archived } : x)));
  const del = (id) => setItems((p) => p.filter((x) => x.id !== id));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ display: "flex", gap: 7 }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={`Add a ${noun}…`} style={inp} />
        <button onClick={add} style={{ padding: "7px 13px", background: `${AK}1A`, border: `1px solid ${AK}55`, borderRadius: 8, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}><Plus size={13} /> Add</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {items.map((it) => (
          <div key={it.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 9, background: it.archived ? "transparent" : GL, border: `1px solid ${it.archived ? BD : BD}`, opacity: it.archived ? 0.5 : 1 }}>
            {editId === it.id ? (
              <>
                <input autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") rename(it.id); if (e.key === "Escape") setEditId(null); }} style={{ width: 110, background: B2, border: `1px solid ${AK}55`, borderRadius: 6, padding: "3px 7px", fontSize: 11.5, color: T1, outline: "none", fontFamily: "inherit" }} />
                <button onClick={() => rename(it.id)} style={smallBtn(GR)}><Check size={12} /></button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 11.5, color: it.archived ? T3 : T1 }}>{it.name}</span>
                <button onClick={() => { setEditId(it.id); setEditVal(it.name); }} style={smallBtn()}><Pencil size={11} /></button>
                <button onClick={() => toggle(it.id)} style={smallBtn()}>{it.archived ? <ArchiveRestore size={11} /> : <Archive size={11} />}</button>
                <button onClick={() => del(it.id)} style={smallBtn()}><Trash2 size={11} /></button>
              </>
            )}
          </div>
        ))}
        {items.length === 0 && <span style={{ fontSize: 11.5, color: T3 }}>None yet — add your first {noun}.</span>}
      </div>
    </div>
  );
}

function InstrumentEditor({ items, setItems }) {
  const blank = { symbol: "", pipSize: "0.0001", valuePerPipPerLot: "10", decimals: "5" };
  const [draft, setDraft] = useState(blank);
  const add = () => { if (!draft.symbol.trim()) return; setItems((p) => [...(Array.isArray(p) ? p : []), { id: uid("i"), symbol: draft.symbol.trim(), pipSize: +draft.pipSize || 0.0001, valuePerPipPerLot: +draft.valuePerPipPerLot || 10, decimals: +draft.decimals || 5, archived: false }]); setDraft(blank); };
  const patch = (id, k, v) => setItems((p) => p.map((x) => (x.id === id ? { ...x, [k]: v } : x)));
  const del = (id) => setItems((p) => p.filter((x) => x.id !== id));
  const toggle = (id) => setItems((p) => p.map((x) => (x.id === id ? { ...x, archived: !x.archived } : x)));
  const cell = { background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "6px 8px", fontSize: 11.5, color: T1, outline: "none", fontFamily: "'JetBrains Mono',monospace", width: "100%", boxSizing: "border-box" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ fontSize: 10.5, color: T3, lineHeight: 1.5 }}>Each instrument stores value-per-pip per lot, so risk, RR and PnL work for forex, metals, indices or futures. Adjust to match your broker.</div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 520 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.2fr 0.8fr 70px", gap: 7, fontSize: 9, color: T3, letterSpacing: 0.8, textTransform: "uppercase", padding: "0 2px 5px" }}>
            <span>Symbol</span><span>Pip size</span><span>Value / pip / lot</span><span>Decimals</span><span></span>
          </div>
          {items.map((it) => (
            <div key={it.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.2fr 0.8fr 70px", gap: 7, marginBottom: 6, alignItems: "center", opacity: it.archived ? 0.5 : 1 }}>
              <input value={it.symbol} onChange={(e) => patch(it.id, "symbol", e.target.value)} style={cell} />
              <input value={it.pipSize} onChange={(e) => patch(it.id, "pipSize", +e.target.value || 0)} style={cell} />
              <input value={it.valuePerPipPerLot} onChange={(e) => patch(it.id, "valuePerPipPerLot", +e.target.value || 0)} style={cell} />
              <input value={it.decimals} onChange={(e) => patch(it.id, "decimals", +e.target.value || 0)} style={cell} />
              <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                <button onClick={() => toggle(it.id)} style={smallBtn()}>{it.archived ? <ArchiveRestore size={12} /> : <Archive size={12} />}</button>
                <button onClick={() => del(it.id)} style={smallBtn()}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.2fr 0.8fr auto", gap: 7, alignItems: "center", paddingTop: 8, borderTop: `1px solid ${BD}` }}>
        <input value={draft.symbol} onChange={(e) => setDraft({ ...draft, symbol: e.target.value })} placeholder="SYMBOL" style={cell} />
        <input value={draft.pipSize} onChange={(e) => setDraft({ ...draft, pipSize: e.target.value })} style={cell} />
        <input value={draft.valuePerPipPerLot} onChange={(e) => setDraft({ ...draft, valuePerPipPerLot: e.target.value })} style={cell} />
        <input value={draft.decimals} onChange={(e) => setDraft({ ...draft, decimals: e.target.value })} style={cell} />
        <button onClick={add} style={{ padding: "7px 12px", background: `${AK}1A`, border: `1px solid ${AK}55`, borderRadius: 8, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}><Plus size={13} /></button>
      </div>
    </div>
  );
}

function SessionEditor({ items, setItems }) {
  const [draft, setDraft] = useState({ name: "", start: "08:00", end: "17:00" });
  const add = () => { if (!draft.name.trim()) return; setItems((p) => [...(Array.isArray(p) ? p : []), { id: uid("s"), name: draft.name.trim(), start: draft.start, end: draft.end, archived: false }]); setDraft({ name: "", start: "08:00", end: "17:00" }); };
  const patch = (id, k, v) => setItems((p) => p.map((x) => (x.id === id ? { ...x, [k]: v } : x)));
  const del = (id) => setItems((p) => p.filter((x) => x.id !== id));
  const cell = { background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "6px 9px", fontSize: 11.5, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 10.5, color: T3 }}>Trade times auto-match these windows to tag the session(s), with overlap detection.</div>
      {items.map((it) => (
        <div key={it.id} style={{ display: "flex", gap: 7, alignItems: "center", opacity: it.archived ? 0.5 : 1 }}>
          <input value={it.name} onChange={(e) => patch(it.id, "name", e.target.value)} style={{ ...cell, flex: 1 }} />
          <input type="time" value={it.start} onChange={(e) => patch(it.id, "start", e.target.value)} style={{ ...cell, colorScheme: "dark" }} />
          <span style={{ color: T3, fontSize: 11 }}>–</span>
          <input type="time" value={it.end} onChange={(e) => patch(it.id, "end", e.target.value)} style={{ ...cell, colorScheme: "dark" }} />
          <button onClick={() => patch(it.id, "archived", !it.archived)} style={smallBtn()}>{it.archived ? <ArchiveRestore size={12} /> : <Archive size={12} />}</button>
          <button onClick={() => del(it.id)} style={smallBtn()}><Trash2 size={12} /></button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 7, alignItems: "center", paddingTop: 8, borderTop: `1px solid ${BD}` }}>
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Session name" style={{ ...cell, flex: 1 }} />
        <input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} style={{ ...cell, colorScheme: "dark" }} />
        <span style={{ color: T3, fontSize: 11 }}>–</span>
        <input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} style={{ ...cell, colorScheme: "dark" }} />
        <button onClick={add} style={{ padding: "7px 12px", background: `${AK}1A`, border: `1px solid ${AK}55`, borderRadius: 8, color: "#FFFFFF", cursor: "pointer", display: "flex" }}><Plus size={13} /></button>
      </div>
    </div>
  );
}

function StrategyEditor({ items, setItems }) {
  const [open, setOpen] = useState(null);
  const addStrategy = () => { const s = { id: uid("st"), name: "New strategy", archived: false, activeVersion: 1, versions: [{ version: 1, notes: "", rules: "", confluences: [], checklist: [], createdAt: new Date().toISOString().slice(0, 10) }] }; setItems((p) => [...(Array.isArray(p) ? p : []), s]); setOpen(s.id); };
  const patch = (id, fn) => setItems((p) => p.map((s) => (s.id === id ? fn(s) : s)));
  const rename = (id, name) => patch(id, (s) => ({ ...s, name }));
  const addVersion = (id) => patch(id, (s) => { const v = Math.max(...s.versions.map((x) => x.version)) + 1; const last = s.versions[s.versions.length - 1]; return { ...s, activeVersion: v, versions: [...s.versions, { version: v, notes: "", rules: last?.rules || "", confluences: last?.confluences || [], checklist: last?.checklist || [], createdAt: new Date().toISOString().slice(0, 10) }] }; });
  const patchVersion = (id, ver, k, val) => patch(id, (s) => ({ ...s, versions: s.versions.map((v) => (v.version === ver ? { ...v, [k]: val } : v)) }));
  const dup = (s) => setItems((p) => [...p, { ...s, id: uid("st"), name: `${s.name} (copy)` }]);
  const toggle = (id) => patch(id, (s) => ({ ...s, archived: !s.archived }));
  const del = (id) => setItems((p) => p.filter((s) => s.id !== id));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <button onClick={addStrategy} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: `${AK}1A`, border: `1px solid ${AK}55`, borderRadius: 9, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><Plus size={13} /> New strategy</button>
      {items.map((s) => {
        const active = s.versions.find((v) => v.version === s.activeVersion) || s.versions[s.versions.length - 1];
        const isOpen = open === s.id;
        return (
          <div key={s.id} style={{ border: `1px solid ${isOpen ? AK + "44" : BD}`, borderRadius: 10, background: GL, opacity: s.archived ? 0.55 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 13px" }}>
              <input value={s.name} onChange={(e) => rename(s.id, e.target.value)} style={{ flex: 1, background: "transparent", border: "none", fontSize: 13, fontWeight: 700, color: T1, outline: "none", fontFamily: "inherit" }} />
              <span style={{ fontSize: 10, color: T3, display: "inline-flex", alignItems: "center", gap: 4 }}><GitBranch size={11} /> v{s.activeVersion} of {s.versions.length}</span>
              <button onClick={() => setOpen(isOpen ? null : s.id)} style={{ fontSize: 11, color: AK, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>{isOpen ? "Close" : "Edit"}</button>
              <button onClick={() => dup(s)} style={smallBtn()}><Copy size={12} /></button>
              <button onClick={() => toggle(s.id)} style={smallBtn()}>{s.archived ? <ArchiveRestore size={12} /> : <Archive size={12} />}</button>
              <button onClick={() => del(s.id)} style={smallBtn()}><Trash2 size={12} /></button>
            </div>
            {isOpen && (
              <div style={{ padding: "0 13px 13px", display: "flex", flexDirection: "column", gap: 11 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, color: T3, letterSpacing: 1, textTransform: "uppercase" }}>Version</span>
                  {s.versions.map((v) => (
                    <button key={v.version} onClick={() => patch(s.id, (x) => ({ ...x, activeVersion: v.version }))} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: s.activeVersion === v.version ? 700 : 400, background: s.activeVersion === v.version ? `${AK}22` : "transparent", border: `1px solid ${s.activeVersion === v.version ? AK + "66" : BD}`, color: s.activeVersion === v.version ? "#FFFFFF" : T2 }}>v{v.version}</button>
                  ))}
                  <button onClick={() => addVersion(s.id)} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontFamily: "inherit", background: "none", border: `1px dashed ${BD}`, color: T3, display: "inline-flex", alignItems: "center", gap: 3 }}><Plus size={11} /> version</button>
                </div>
                <div><Lbl>Rules — v{active.version}</Lbl><TextArea value={active.rules} onChange={(v) => patchVersion(s.id, active.version, "rules", v)} placeholder="Define this strategy in your own words — entry model, conditions, invalidation…" rows={4} /></div>
                <div><Lbl>Version notes</Lbl><input value={active.notes} onChange={(e) => patchVersion(s.id, active.version, "notes", e.target.value)} placeholder="What changed in this version?" style={inp} /></div>
              </div>
            )}
          </div>
        );
      })}
      {items.length === 0 && <span style={{ fontSize: 11.5, color: T3 }}>No strategies — add your first. It has no predefined methodology; you define it.</span>}
    </div>
  );
}

const SUB = [
  { id: "strategies", l: "Strategies" }, { id: "instruments", l: "Instruments" },
  { id: "sessions", l: "Sessions" }, { id: "conditions", l: "Market Conditions" },
  { id: "confluences", l: "Confluences" }, { id: "mistakes", l: "Mistakes" }, { id: "emotions", l: "Emotions" },
];

export function LibraryTab({ libs, set }) {
  const [sub, setSub] = useState("strategies");
  return (
    <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 15, maxWidth: 900 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: T1 }}>Library</div>
        <div style={{ fontSize: 12, color: T3, marginTop: 2 }}>Your building blocks. Editing anything here never changes past trades.</div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {SUB.map((s) => (
          <button key={s.id} onClick={() => setSub(s.id)} style={{ padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: sub === s.id ? 700 : 500, background: sub === s.id ? `${AK}22` : GL, border: `1px solid ${sub === s.id ? AK + "66" : BD}`, color: sub === s.id ? "#FFFFFF" : T2 }}>{s.l}</button>
        ))}
      </div>
      <Card style={{ padding: "16px 18px" }}>
        {sub === "strategies" && <StrategyEditor items={libs.strategies} setItems={set.strategies} />}
        {sub === "instruments" && <InstrumentEditor items={libs.instruments} setItems={set.instruments} />}
        {sub === "sessions" && <SessionEditor items={libs.sessions} setItems={set.sessions} />}
        {sub === "conditions" && <NamedListEditor items={libs.conditions} setItems={set.conditions} noun="condition" />}
        {sub === "confluences" && <NamedListEditor items={libs.confluences} setItems={set.confluences} noun="confluence" />}
        {sub === "mistakes" && <NamedListEditor items={libs.mistakes} setItems={set.mistakes} noun="mistake" />}
        {sub === "emotions" && <NamedListEditor items={libs.emotions} setItems={set.emotions} noun="emotion" />}
      </Card>
    </div>
  );
}
