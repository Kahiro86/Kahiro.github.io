// ── Overhead & Runway — the monthly cost of running your life ────────
// List every recurring cost (bills + subscriptions), see the true monthly and
// yearly burn, and how many months your savings buy. Own store; the Finance
// module is untouched. Opened from the palette. Lazy.
import { useMemo, useState } from "react";
import { X, Wallet, Trash2, Plus } from "lucide-react";
import { B1, B2, BD, BD2, T1, T2, T3, GL, AC2, GR, AM, RE } from "./designTokens.js";
import { useStorageState } from "./useStorageState.js";
import { OVERHEAD_KEY, CADENCES, KINDS, sanitizeOverhead, monthlyOf, monthlyTotal, yearlyTotal, kindTotals, runwayMonths, addItem, removeItem } from "./overhead.js";

const kes = (v) => Math.round(+v || 0).toLocaleString();

export function OverheadLedger({ onClose }) {
  const [raw, setRaw] = useStorageState(OVERHEAD_KEY, { items: [], savings: 0 });
  const data = useMemo(() => sanitizeOverhead(raw), [raw]);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cadence, setCadence] = useState("mo");
  const [kind, setKind] = useState("bill");

  const monthly = useMemo(() => monthlyTotal(data), [data]);
  const yearly = useMemo(() => yearlyTotal(data), [data]);
  const byKind = useMemo(() => kindTotals(data), [data]);
  const runway = useMemo(() => runwayMonths(data), [data]);

  const add = () => {
    if (!(+amount > 0)) return;
    setRaw((prev) => addItem(prev, { name, amount, cadence, kind }));
    setName(""); setAmount("");
  };
  const del = (id) => setRaw((prev) => removeItem(prev, id));
  const setSavings = (v) => setRaw((prev) => ({ ...sanitizeOverhead(prev), savings: Math.max(0, +v || 0) }));

  const field = { background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const label = { fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, color: T3, marginBottom: 5 };
  const Stat = ({ k, v, c = T1, sub }) => (
    <div style={{ flex: 1, background: B2, border: `1px solid ${BD}`, borderRadius: 10, padding: "11px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: c, fontFamily: "monospace", lineHeight: 1 }}>{v}</div>
      <div style={{ fontSize: 9.5, color: T3, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.6 }}>{k}</div>
      {sub && <div style={{ fontSize: 10, color: T3, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 4200, background: "rgba(0,0,0,0.66)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "7vh 16px 24px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, background: B1, border: `1px solid ${BD2}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: `1px solid ${BD}` }}>
          <Wallet size={18} color={AC2} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T1 }}>Overhead & Runway</div>
            <div style={{ fontSize: 11, color: T3 }}>What the machine costs to run</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={17} /></button>
        </div>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Stat k="Monthly burn" v={kes(monthly)} c={RE} />
            <Stat k="Yearly" v={kes(yearly)} c={AM} />
            <Stat k="Runway" v={runway == null ? "—" : `${runway.toFixed(1)}mo`} c={runway == null ? T3 : runway >= 6 ? GR : runway >= 3 ? AM : RE} />
          </div>

          <div>
            <div style={label}>Liquid savings (for runway)</div>
            <input value={data.savings || ""} onChange={(e) => setSavings(e.target.value)} inputMode="decimal" placeholder="0" style={{ ...field, width: "100%" }} />
          </div>

          {(byKind.bill > 0 || byKind.sub > 0) && (
            <div style={{ fontSize: 11, color: T3 }}>Bills <span style={{ color: T2, fontWeight: 700 }}>{kes(byKind.bill)}</span>/mo · Subscriptions <span style={{ color: T2, fontWeight: 700 }}>{kes(byKind.sub)}</span>/mo</div>
          )}

          {/* Add row */}
          <div style={{ display: "flex", flexDirection: "column", gap: 7, background: B2, border: `1px solid ${BD}`, borderRadius: 11, padding: 11 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (Rent, Netflix…)" style={{ ...field, width: "100%" }} />
            <div style={{ display: "flex", gap: 7 }}>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} inputMode="decimal" placeholder="Amount" style={{ ...field, flex: 1 }} />
              <select value={cadence} onChange={(e) => setCadence(e.target.value)} style={field}>{CADENCES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
              <select value={kind} onChange={(e) => setKind(e.target.value)} style={field}>{KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select>
              <button onClick={add} disabled={!(+amount > 0)} aria-label="Add" style={{ padding: "0 12px", borderRadius: 8, border: "none", background: +amount > 0 ? `linear-gradient(135deg,${AC2},${AM})` : GL, color: +amount > 0 ? "#000" : T3, cursor: "pointer", display: "flex", alignItems: "center" }}><Plus size={16} /></button>
            </div>
          </div>

          {/* Items */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.items.length === 0 && <div style={{ padding: "18px 8px", textAlign: "center", color: T3, fontSize: 12.5 }}>Add your recurring costs to see the real monthly burn.</div>}
            {data.items.map((it) => (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", background: B2, border: `1px solid ${BD}`, borderRadius: 9 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: it.kind === "sub" ? AC2 : T3, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12.5, color: T1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name || "(unnamed)"}</span>
                <span style={{ fontSize: 11.5, color: T3, fontFamily: "monospace" }}>{kes(it.amount)}{CADENCES.find((c) => c.id === it.cadence)?.label}</span>
                <span style={{ fontSize: 11.5, color: T2, fontFamily: "monospace", minWidth: 62, textAlign: "right" }}>{kes(monthlyOf(it))}/mo</span>
                <button onClick={() => del(it.id)} aria-label="Remove" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
