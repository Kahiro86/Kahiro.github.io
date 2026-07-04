import { useState } from "react";
import { CheckCircle, Lock, Check, Shield, Plus, Trash2, ChevronUp, ChevronDown, Settings2, X } from "lucide-react";
import { B0, B1, BD, BD2, T1, T2, T3, GL, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { newChecklistItem, templateById } from "./checklists.js";

export function PreTradeChecklist({ templates, setTemplates, activeId, setActiveId, allowSkip, setAllowSkip, onComplete, onCancel }) {
  const tpl = templateById(templates, activeId);
  const [checks, setChecks] = useState({}); // id -> bool
  const [manage, setManage] = useState(false);

  const mandatory = tpl.items.filter((i) => i.mandatory);
  const mandatoryDone = mandatory.every((i) => checks[i.id]);
  const doneCount = tpl.items.filter((i) => checks[i.id]).length;
  const canProceed = mandatoryDone || allowSkip;

  const switchTemplate = (id) => { setActiveId(id); setChecks({}); };

  // Edit the active template's items (persisted via setTemplates).
  const updateItems = (fn) => setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? { ...t, items: fn(t.items) } : t)));
  const addItem = () => updateItems((items) => [...items, newChecklistItem("New item")]);
  const delItem = (id) => updateItems((items) => items.filter((i) => i.id !== id));
  const setItemText = (id, text) => updateItems((items) => items.map((i) => (i.id === id ? { ...i, text } : i)));
  const toggleMandatory = (id) => updateItems((items) => items.map((i) => (i.id === id ? { ...i, mandatory: !i.mandatory } : i)));
  const move = (idx, dir) => updateItems((items) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return items;
    const copy = [...items];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    return copy;
  });

  const saveAsTemplate = () => {
    const name = window.prompt("Name this checklist template:", `${tpl.name} copy`);
    if (!name) return;
    const id = `tpl${Date.now().toString(36)}`;
    const copy = { id, name, items: tpl.items.map((i) => ({ ...i, id: `ck${Math.random().toString(36).slice(2, 8)}` })) };
    setTemplates((prev) => [...prev, copy]);
    setActiveId(id);
    setChecks({});
  };

  const proceed = (skip = false) => {
    onComplete({
      items: tpl.items.map((i) => i.text),
      checks: tpl.items.map((i) => !!checks[i.id]),
      score: doneCount,
      total: tpl.items.length,
      template: tpl.name,
      skipped: skip && !mandatoryDone,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: B0 }}>
      <div style={{ padding: "16px 22px", borderBottom: `1px solid ${BD}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: B1 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T1 }}>Pre-Trade Checklist</div>
          <div style={{ fontSize: 11, color: T3, marginTop: 2 }}>Complete this to unlock the trade journal</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setManage((m) => !m)} title="Manage items" style={{ display: "flex", alignItems: "center", gap: 5, background: manage ? `${CY}22` : GL, border: `1px solid ${manage ? CY + "55" : BD}`, borderRadius: 8, padding: "7px 11px", color: manage ? CY : T2, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            <Settings2 size={12} />Customize
          </button>
          <button onClick={onCancel} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 8, padding: "7px 13px", color: T2, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        </div>
      </div>

      {/* Template selector */}
      <div style={{ padding: "12px 22px", borderBottom: `1px solid ${BD}`, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 10.5, color: T3, letterSpacing: 1, textTransform: "uppercase", marginRight: 4 }}>Template</span>
        {templates.map((t) => (
          <button key={t.id} onClick={() => switchTemplate(t.id)} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${activeId === t.id ? CY + "66" : BD}`, background: activeId === t.id ? `${CY}22` : GL, color: activeId === t.id ? CY : T2, fontSize: 11.5, fontWeight: activeId === t.id ? 700 : 400, cursor: "pointer", fontFamily: "inherit" }}>{t.name}</button>
        ))}
        <button onClick={saveAsTemplate} style={{ padding: "5px 10px", borderRadius: 8, border: `1px dashed ${BD2}`, background: "transparent", color: T3, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}><Plus size={11} />Save as…</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 13 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{tpl.name} · {doneCount}/{tpl.items.length}</div>
          {mandatoryDone
            ? <span style={{ display: "flex", alignItems: "center", gap: 5, color: GR, fontSize: 12, fontWeight: 700 }}><CheckCircle size={13} />GATE CLEARED</span>
            : <span style={{ display: "flex", alignItems: "center", gap: 5, color: AM, fontSize: 12, fontWeight: 700 }}><Lock size={12} />{mandatory.filter((i) => !checks[i.id]).length} mandatory left</span>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {tpl.items.map((item, idx) => {
            const on = !!checks[item.id];
            return (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: on ? `${GR}0D` : GL, border: `1px solid ${on ? GR + "44" : BD}`, borderRadius: 10 }}>
                {!manage && (
                  <div onClick={() => setChecks((c) => ({ ...c, [item.id]: !c[item.id] }))} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, cursor: "pointer", userSelect: "none" }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, background: on ? `${GR}33` : GL, border: `2px solid ${on ? GR : BD2}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {on && <Check size={11} color={GR} />}
                    </div>
                    <span style={{ fontSize: 12.5, color: on ? T1 : T2, lineHeight: 1.4 }}>{item.text}</span>
                    {item.mandatory && <span style={{ fontSize: 9, color: RE, marginLeft: "auto", padding: "1px 6px", borderRadius: 8, background: `${RE}18`, border: `1px solid ${RE}33` }}>required</span>}
                  </div>
                )}
                {manage && (
                  <>
                    <button onClick={() => move(idx, -1)} style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", padding: 2 }}><ChevronUp size={14} /></button>
                    <button onClick={() => move(idx, 1)} style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", padding: 2 }}><ChevronDown size={14} /></button>
                    <input value={item.text} onChange={(e) => setItemText(item.id, e.target.value)} style={{ flex: 1, background: B1, border: `1px solid ${BD}`, borderRadius: 7, padding: "7px 9px", fontSize: 12, color: T1, outline: "none", fontFamily: "inherit" }} />
                    <button onClick={() => toggleMandatory(item.id)} title="Toggle required" style={{ background: item.mandatory ? `${RE}18` : GL, border: `1px solid ${item.mandatory ? RE + "44" : BD}`, borderRadius: 7, padding: "5px 9px", color: item.mandatory ? RE : T3, fontSize: 10.5, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{item.mandatory ? "Required" : "Optional"}</button>
                    <button onClick={() => delItem(item.id)} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "6px", color: RE, cursor: "pointer", display: "flex" }}><Trash2 size={12} /></button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {manage && (
          <button onClick={addItem} style={{ marginTop: 10, width: "100%", padding: "10px", background: GL, border: `1px dashed ${BD2}`, borderRadius: 10, color: T2, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Plus size={13} />Add checklist item
          </button>
        )}

        {mandatoryDone && !manage && (
          <div style={{ marginTop: 13, padding: "10px 13px", background: `${GR}12`, border: `1px solid ${GR}33`, borderRadius: 10, display: "flex", gap: 9, alignItems: "center" }}>
            <Shield size={13} color={GR} />
            <span style={{ fontSize: 13, color: T2 }}>Checklist complete. Journal unlocked.</span>
          </div>
        )}
      </div>

      <div style={{ padding: "13px 22px", borderTop: `1px solid ${BD}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: B1, gap: 12, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: T3, cursor: "pointer" }}>
          <input type="checkbox" checked={allowSkip} onChange={(e) => setAllowSkip(e.target.checked)} style={{ accentColor: CY }} />
          Allow skipping the checklist
        </label>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {allowSkip && !mandatoryDone && (
            <button onClick={() => proceed(true)} style={{ padding: "9px 15px", background: GL, border: `1px solid ${BD}`, borderRadius: 10, color: T2, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Skip →</button>
          )}
          <button onClick={() => proceed(false)} disabled={!canProceed} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", background: canProceed ? `linear-gradient(135deg,${GR},${CY})` : GL, border: canProceed ? "none" : `1px solid ${BD}`, borderRadius: 10, color: canProceed ? "#000" : T3, fontSize: 13, fontWeight: 700, cursor: canProceed ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: canProceed ? 1 : 0.6 }}>
            <Lock size={13} />Unlock Journal
          </button>
        </div>
      </div>
    </div>
  );
}
