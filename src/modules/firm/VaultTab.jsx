// ── Vault — the one-way door + the Fleet Formula ─────────────────────
// The Vault is the sum of every money-market fund (finance_state.mmfs) — the
// only capital nobody can revoke. It never spends; it only receives. Every
// prop withdrawal is split on the way in by the Fleet Formula (40/30/20/10 by
// default, editable here), and each recorded withdrawal is what the scaling
// gate reads to prove a clean month.
import { useMemo, useState } from "react";
import { Vault as VaultIcon, Plus, ArrowRight } from "lucide-react";
import { BD, T1, T2, T3, GL, B2, AC, GR, AM } from "../../shared/designTokens.js";
import { Card } from "../../shared/ui.jsx";
import { MoneyInp } from "../../shared/ui.jsx";
import { useToast } from "../../shared/toast.jsx";
import {
  vaultBalance, sanitizeFirmConfig, sanitizeFormula, fleetFormulaSplit,
  newWithdrawal, sanitizeWithdrawals,
} from "../../shared/firm.js";

const big = { fontFamily: "'JetBrains Mono',monospace", fontWeight: 900, color: T1, lineHeight: 1 };
const kes = (n) => Math.round(+n || 0).toLocaleString();
const FORMULA_ROWS = [
  { key: "fleet", label: "Fleet reinvestment", color: AC, hint: "Buys the next challenge" },
  { key: "vault", label: "The Vault (MMF)", color: GR, hint: "One-way, compounding" },
  { key: "book", label: "Personal book", color: "#6C8EB5", hint: "Sovereign capital" },
  { key: "life", label: "The life", color: AM, hint: "Earned enjoyment" },
];

const Label = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 700, color: T3, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>{children}</div>
);

export function VaultTab({ finance, config, setConfig, withdrawals, setWithdrawals }) {
  const toast = useToast();
  const cfg = useMemo(() => sanitizeFirmConfig(config), [config]);
  const balance = useMemo(() => vaultBalance(finance), [finance]);
  const target = cfg.vaultTargetKsh;
  const pct = target > 0 ? Math.round((balance / target) * 100) : 0;
  const formula = cfg.fleetFormula;
  const formulaSum = FORMULA_ROWS.reduce((s, r) => s + (+formula[r.key] || 0), 0);

  const [amount, setAmount] = useState("");
  const preview = useMemo(() => fleetFormulaSplit(+amount || 0, formula), [amount, formula]);

  const setPct = (key, val) => {
    const next = sanitizeFormula({ ...formula, [key]: val === "" ? 0 : Math.max(0, Math.min(100, +val)) });
    setConfig(sanitizeFirmConfig({ ...cfg, fleetFormula: next }));
  };

  const record = () => {
    const amt = +amount || 0;
    if (amt <= 0) return;
    const wd = newWithdrawal(amt, fleetFormulaSplit(amt, formula));
    setWithdrawals((prev) => [wd, ...sanitizeWithdrawals(prev)]);
    setAmount("");
    toast(`Withdrawal recorded — split ${formula.fleet}/${formula.vault}/${formula.book}/${formula.life}`, {
      tone: "success",
      action: "Undo",
      onAction: () => setWithdrawals((prev) => sanitizeWithdrawals(prev).filter((w) => w.id !== wd.id)),
    });
  };

  const recent = sanitizeWithdrawals(withdrawals).slice(0, 5);

  return (
    <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 980 }}>
      {/* Balance */}
      <Card style={{ padding: "18px 20px" }}>
        <Label>Vault Balance</Label>
        <div style={{ ...big, fontSize: 30 }}>KSh {kes(balance)}</div>
        <div style={{ fontSize: 11.5, color: T2, marginTop: 4 }}>
          vs the KSh {kes(target)} freedom line · <span style={{ color: pct >= 90 ? GR : AC }}>{pct}%</span>
        </div>
        <div style={{ height: 8, background: GL, borderRadius: 4, overflow: "hidden", marginTop: 11 }}>
          <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: `linear-gradient(90deg,${AC}88,${AC})`, borderRadius: 4 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, color: T3, fontSize: 10.5, fontStyle: "italic" }}>
          <VaultIcon size={13} /> One-way door. Nothing leaves until freedom.
        </div>
      </Card>

      {/* Fleet Formula */}
      <Card style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Label>The Fleet Formula</Label>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: formulaSum === 100 ? T3 : AM }}>{formulaSum}%{formulaSum !== 100 ? " ⚠" : ""}</span>
        </div>
        {FORMULA_ROWS.map((r) => (
          <div key={r.key} style={{ marginBottom: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: T1 }}>{r.label} <span style={{ color: T3, fontSize: 10.5 }}>· {r.hint}</span></span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input value={formula[r.key]} onChange={(e) => setPct(r.key, e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric" aria-label={`${r.label} percent`}
                  style={{ width: 46, background: B2, border: `1px solid ${BD}`, borderRadius: 7, padding: "5px 7px", fontSize: 12, color: r.color, textAlign: "right", fontFamily: "monospace", outline: "none" }} />
                <span style={{ fontSize: 11, color: T3 }}>%</span>
              </div>
            </div>
            <div style={{ height: 5, background: GL, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, +formula[r.key] || 0)}%`, background: r.color, borderRadius: 3 }} />
            </div>
          </div>
        ))}
        {formulaSum !== 100 && <div style={{ fontSize: 10, color: AM, marginTop: 2 }}>Splits should sum to 100%. They'll still be applied proportionally.</div>}
      </Card>

      {/* Record a withdrawal */}
      <Card style={{ padding: "16px 18px" }}>
        <Label>Record a Withdrawal</Label>
        <MoneyInp value={amount} onChange={setAmount} placeholder="Amount withdrawn ($)" />
        {(+amount || 0) > 0 && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {FORMULA_ROWS.map((r) => (
              <div key={r.key} style={{ flex: "1 1 90px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 10px" }}>
                <div style={{ fontSize: 9, color: T3, letterSpacing: 0.5, textTransform: "uppercase" }}>{r.key}</div>
                <div style={{ ...big, fontSize: 14, color: r.color, marginTop: 3 }}>${preview[r.key].toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
        <button onClick={record} disabled={(+amount || 0) <= 0}
          style={{ marginTop: 13, width: "100%", background: (+amount || 0) > 0 ? AC : GL, border: "none", borderRadius: 10, padding: "11px 0", color: (+amount || 0) > 0 ? "#fff" : T3, fontWeight: 700, fontSize: 13, cursor: (+amount || 0) > 0 ? "pointer" : "not-allowed", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Plus size={14} /> Record & split
        </button>
      </Card>

      {/* Recent withdrawals */}
      {recent.length > 0 && (
        <Card style={{ padding: "16px 18px" }}>
          <Label>Recent Withdrawals</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {recent.map((w) => (
              <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                <span style={{ fontFamily: "monospace", color: T3, width: 78, flexShrink: 0 }}>{w.date}</span>
                <span style={{ ...big, fontSize: 13, width: 70 }}>${w.amount.toLocaleString()}</span>
                <ArrowRight size={12} color={T3} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: T2, fontFamily: "monospace" }}>
                  <span style={{ color: GR }}>{w.split.vault.toLocaleString()}</span> → vault
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
