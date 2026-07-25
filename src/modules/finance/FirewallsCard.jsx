// ── Trading Firewalls card — the Finance-side view of your accounts ──
// Replaces the old single hardcoded $15k trading account. Lists the real
// accounts from Trading → Accounts, sorted into named firewalls that stay
// walled off from personal net worth. Unfiled accounts sit in their own
// bucket and can optionally be counted toward net worth. Account creation
// stays in Trading; here you only name firewalls and file accounts into them.
import { useState } from "react";
import { Lock, Plus, Pencil, Check, Trash2, ShieldOff, ArrowRightLeft } from "lucide-react";
import { B2, BD, T1, T2, T3, GL, CY, GR, AM } from "../../shared/designTokens.js";
import { Card } from "../../shared/ui.jsx";
import { newFirewall } from "./firewalls.js";

const usd = (n) => `$${Math.round(+n || 0).toLocaleString()}`;
const sel = { background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "5px 9px", fontSize: 11, color: T2, outline: "none", fontFamily: "inherit", cursor: "pointer" };

export function FirewallsCard({ fw, firewalls = [], setFirewalls, accounts = [], unfiledCountsNW, setUnfiledCountsNW, xRate, fmtKES }) {
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [assign, setAssign] = useState(""); // account id being filed

  const groups = fw?.groups || [];
  const unfiled = fw?.unfiled || [];

  const addFirewall = () => setFirewalls((prev) => [...(Array.isArray(prev) ? prev : []), newFirewall(`Firewall ${firewalls.length + 1}`)]);
  const rename = (id) => { const v = editVal.trim(); if (v) setFirewalls((p) => p.map((f) => (f.id === id ? { ...f, name: v } : f))); setEditId(null); };
  const delFirewall = (id) => setFirewalls((p) => p.filter((f) => f.id !== id));
  const fileInto = (accountId, fwId) => setFirewalls((p) => (Array.isArray(p) ? p : []).map((f) => ({
    ...f, accountIds: f.id === fwId ? [...new Set([...(f.accountIds || []), accountId])] : (f.accountIds || []).filter((x) => x !== accountId),
  })));

  const AccountRow = ({ a, fwId }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, color: T1, fontWeight: 600, flex: 1, minWidth: 120 }}>{a.name}</span>
      <span style={{ fontSize: 9, color: T3, padding: "2px 7px", background: B2, borderRadius: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{a.type}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: a.balance >= 0 ? GR : AM, fontFamily: "monospace" }}>{usd(a.balance)}</span>
      <select value={fwId || ""} onChange={(e) => fileInto(a.id, e.target.value)} style={sel} aria-label={`Firewall for ${a.name}`}>
        <option value="">Unfiled</option>
        {firewalls.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
    </div>
  );

  return (
    <Card style={{ padding: "22px", borderColor: `${CY}33`, background: `linear-gradient(180deg,${CY}08,transparent)` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Lock size={14} color={CY} />
          <div style={{ fontSize: 15, fontWeight: 800, color: T1 }}>Trading Firewalls</div>
          <span style={{ fontSize: 9.5, letterSpacing: 0.5, padding: "2px 8px", borderRadius: 8, background: `${CY}18`, color: CY, border: `1px solid ${CY}33` }}>WALLED OFF · USD</span>
        </div>
        <button onClick={addFirewall} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: `${CY}18`, border: `1px solid ${CY}44`, borderRadius: 9, color: CY, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><Plus size={13} /> New firewall</button>
      </div>
      <div style={{ fontSize: 10.5, color: T3, marginBottom: 16 }}>Your own accounts from Trading → Accounts. Firewalled groups are never part of Net Worth.</div>

      {accounts.length === 0 ? (
        <div style={{ padding: "24px", textAlign: "center", border: `1px dashed ${BD}`, borderRadius: 11 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🏦</div>
          <div style={{ fontSize: 13, color: T2, marginBottom: 4 }}>No trading accounts yet</div>
          <div style={{ fontSize: 11.5, color: T3, lineHeight: 1.5 }}>Create your accounts in <b style={{ color: CY }}>Trading → Accounts</b> — they'll appear here, ready to file into firewalls. (The old fixed $15,000 account is gone.)</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {groups.map((g) => (
            <div key={g.id} style={{ border: `1px solid ${BD}`, borderRadius: 12, padding: "13px 15px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <Lock size={12} color={CY} />
                {editId === g.id ? (
                  <>
                    <input autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") rename(g.id); if (e.key === "Escape") setEditId(null); }}
                      style={{ ...sel, flex: 1, minWidth: 120, color: T1 }} />
                    <button onClick={() => rename(g.id)} style={{ background: "none", border: "none", color: GR, cursor: "pointer", display: "flex", padding: 2 }}><Check size={14} /></button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: T1, flex: 1, minWidth: 100 }}>{g.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: GR, fontFamily: "monospace" }}>{usd(g.total)}</span>
                    <button onClick={() => { setEditId(g.id); setEditVal(g.name); }} style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", padding: 2 }}><Pencil size={12} /></button>
                    <button onClick={() => delFirewall(g.id)} style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", padding: 2 }}><Trash2 size={12} /></button>
                  </>
                )}
              </div>
              {g.accounts.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>{g.accounts.map((a) => <AccountRow key={a.id} a={a} fwId={g.id} />)}</div>
              ) : (
                <div style={{ fontSize: 11, color: T3, padding: "6px 2px" }}>Empty — file accounts in using the dropdown on any account below.</div>
              )}
            </div>
          ))}

          {/* Unfiled bucket */}
          <div style={{ border: `1px dashed ${BD}`, borderRadius: 12, padding: "13px 15px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <ShieldOff size={12} color={T3} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T2, flex: 1, minWidth: 100 }}>Unfiled accounts</span>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: unfiledCountsNW ? GR : T2, fontFamily: "monospace" }}>{usd(fw?.unfiledTotal || 0)}</span>
            </div>
            {unfiled.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>{unfiled.map((a) => <AccountRow key={a.id} a={a} fwId="" />)}</div>
            ) : <div style={{ fontSize: 11, color: T3, padding: "4px 2px" }}>Every account is filed into a firewall. 🎉</div>}
            {unfiled.length > 0 && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 11, cursor: "pointer" }}>
                <input type="checkbox" checked={!!unfiledCountsNW} onChange={(e) => setUnfiledCountsNW(e.target.checked)} style={{ accentColor: GR, width: 15, height: 15 }} />
                <span style={{ fontSize: 11.5, color: T2 }}>Count unfiled accounts toward Net Worth (≈ {fmtKES(Math.round((fw?.unfiledTotal || 0) * (+xRate || 130)))})</span>
              </label>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: GL, borderRadius: 10, border: `1px solid ${BD}` }}>
            <span style={{ fontSize: 11, color: T3, display: "flex", alignItems: "center", gap: 6 }}><ArrowRightLeft size={12} /> Total across all accounts</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: T1, fontFamily: "monospace" }}>{usd(fw?.grandTotal || 0)}</span>
          </div>
        </div>
      )}
    </Card>
  );
}
