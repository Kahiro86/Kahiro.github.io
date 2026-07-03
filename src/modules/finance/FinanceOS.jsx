import { Layers, DollarSign, Shield, BarChart2, AlertTriangle, TrendingUp, Target } from "lucide-react";
import { useState } from "react";
import { B1, BD, T2, T3, GL, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { useStorageState } from "../../shared/useStorageState.js";
import { DEFAULT_FINANCE_STATE } from "./constants.js";
import { calcPAYE, calcNSSF } from "./paye.js";
import { SEED_TRADES } from "../trading/seedTrades.js";
import { getStats } from "../trading/helpers.js";
import { OverviewTab } from "./OverviewTab.jsx";
import { IncomeTab } from "./IncomeTab.jsx";
import { AccountsTab } from "./AccountsTab.jsx";
import { BudgetTab } from "./BudgetTab.jsx";
import { EmergencyFundTab } from "./EmergencyFundTab.jsx";
import { PortfolioTab } from "./PortfolioTab.jsx";
import { GoalsTab } from "./GoalsTab.jsx";

const FIN_TABS = [
  { id: "overview",  l: "Net Worth",   i: Layers        },
  { id: "income",    l: "Income",      i: DollarSign    },
  { id: "accounts",  l: "Accounts",    i: Shield        },
  { id: "budget",    l: "Budget",      i: BarChart2     },
  { id: "emergency", l: "Emergency",   i: AlertTriangle },
  { id: "portfolio", l: "Portfolio",   i: TrendingUp    },
  { id: "goals",     l: "Goals",       i: Target        },
];

export function FinanceOS() {
  const [finTab, setFinTab] = useState("overview");
  const [state, setState] = useStorageState("finance_state", DEFAULT_FINANCE_STATE);
  const {
    currency, xRate, gross, opBal, savBal, efBal, efMMF, personalDebt,
    mmfs, tbills, nseStocks, saccoBal, saccoYield, reitUnits, reitNAV, budgets,
  } = state;

  const patch = (obj) => setState((s) => ({ ...s, ...obj }));
  const setCurrency = (v) => patch({ currency: v });
  const setXRate = (v) => patch({ xRate: v });
  const setGross = (v) => patch({ gross: v });
  const setOpBal = (v) => patch({ opBal: v });
  const setSavBal = (v) => patch({ savBal: v });
  const setEfBal = (v) => patch({ efBal: v });
  const setEfMMF = (v) => patch({ efMMF: v });
  const setPersonalDebt = (v) => patch({ personalDebt: v });
  const setMmfs = (updater) => setState((s) => ({ ...s, mmfs: typeof updater === "function" ? updater(s.mmfs) : updater }));
  const setTbills = (updater) => setState((s) => ({ ...s, tbills: typeof updater === "function" ? updater(s.tbills) : updater }));
  const setNseStocks = (updater) => setState((s) => ({ ...s, nseStocks: typeof updater === "function" ? updater(s.nseStocks) : updater }));
  const setSaccoBal = (v) => patch({ saccoBal: v });
  const setSaccoYield = (v) => patch({ saccoYield: v });
  const setReitUnits = (v) => patch({ reitUnits: v });
  const setReitNAV = (v) => patch({ reitNAV: v });
  const setBudgets = (updater) => setState((s) => ({ ...s, budgets: typeof updater === "function" ? updater(s.budgets) : updater }));

  // Trading account is read-only here — the firewall never gives Finance OS a setter into Trading OS's own storage.
  const [trades] = useStorageState("ict_trades", SEED_TRADES);
  const [bal] = useStorageState("ict_balance", 15000);
  const tradingStats = getStats(trades);
  const tradingBalanceUSD = bal + tradingStats.totalPnl;

  // ── PAYE KENYA 2024/2025 ──────────────────────────────────────────
  const g = +gross || 0;
  const paye = calcPAYE(g);
  const nssf = calcNSSF(g);
  const shif = g > 0 ? Math.round(g * 0.0275) : 0;
  const ahl = g > 0 ? Math.round(g * 0.015) : 0;
  const totalDed = paye + nssf + shif + ahl;
  const netPay = Math.max(0, g - totalDed);

  // ── PORTFOLIO TOTALS ──────────────────────────────────────────────
  const totalMMF = mmfs.reduce((s, m) => s + (+m.balance || 0), 0);
  const totalTbill = tbills.reduce((s, t) => s + (+t.faceValue || 0), 0);
  const totalNSE = nseStocks.reduce((s, st) => s + (+st.shares || 0) * (+st.currentPrice || 0), 0);
  const totalReit = (+reitUnits || 0) * (+reitNAV || 0);
  const totalInvested = totalMMF + totalTbill + totalNSE + (+saccoBal || 0) + totalReit;
  const totalLiquid = (+opBal || 0) + (+savBal || 0) + (+efBal || 0);
  const tradingKES = tradingBalanceUSD * (+xRate || 130);
  const netWorthKES = totalLiquid + totalInvested + tradingKES - (+personalDebt || 0);

  // ── PASSIVE INCOME ────────────────────────────────────────────────
  const monthlyPassive = Math.round(
    mmfs.reduce((s, m) => s + (+m.balance || 0) * ((+m.yield || 0) / 100 / 12), 0) +
    tbills.reduce((s, t) => s + (+t.faceValue || 0) * ((+t.rate || 0) / 100 / 12), 0) +
    (+saccoBal || 0) * ((+saccoYield || 0) / 100 / 12) +
    totalReit * (0.08 / 12)
  );

  // ── BUDGET + EMERGENCY FUND ───────────────────────────────────────
  const totalBudgeted = budgets.reduce((s, b) => s + (+b.budget || 0), 0);
  const totalSpent = budgets.reduce((s, b) => s + (+b.spent || 0), 0);
  const efTarget6 = Math.max(totalBudgeted * 6, 300000);
  const efTarget3 = Math.max(totalBudgeted * 3, 150000);
  const selMMF = mmfs.find((m) => m.name === efMMF) || mmfs[0];
  const efYield = selMMF?.yield || 14.5;
  const efMonthInt = (+efBal || 0) * (efYield / 100 / 12);
  const efContrib = netPay > 0 ? Math.round(netPay * 0.05) : 5000;
  const efRemaining = Math.max(0, efTarget6 - (+efBal || 0));
  const efMonths = efContrib > 0 ? Math.ceil(efRemaining / efContrib) : null;

  const fmtKES = (amount) => {
    const n = Math.round(+amount || 0);
    if (currency === "USD") return `$${Math.round(n / (+xRate || 130)).toLocaleString()}`;
    return `KES ${n.toLocaleString()}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ background: B1, borderBottom: `1px solid ${BD}`, padding: "10px 24px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 3, background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: 3 }}>
          {FIN_TABS.map(({ id, l, i: Icon }) => (
            <button key={id} onClick={() => setFinTab(id)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, border: "none", cursor: "pointer", background: finTab === id ? `linear-gradient(135deg,${CY}22,${PU}22)` : "transparent", color: finTab === id ? CY : T2, fontSize: 11.5, fontWeight: finTab === id ? 600 : 400, fontFamily: "inherit", borderTop: finTab === id ? `1px solid ${CY}44` : "1px solid transparent", whiteSpace: "nowrap" }}>
              <Icon size={11} />{l}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ padding: "5px 13px", background: `${GR}11`, border: `1px solid ${GR}22`, borderRadius: 9, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: T3, letterSpacing: 1 }}>NET WORTH</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: netWorthKES >= 0 ? GR : RE, fontFamily: "monospace" }}>{fmtKES(netWorthKES)}</span>
        </div>
        <div style={{ display: "flex", background: GL, border: `1px solid ${BD}`, borderRadius: 9, overflow: "hidden" }}>
          {["KES", "USD"].map((c) => (
            <button key={c} onClick={() => setCurrency(c)}
              style={{ padding: "6px 13px", border: "none", cursor: "pointer", background: currency === c ? `${CY}22` : "transparent", color: currency === c ? CY : T2, fontSize: 12, fontWeight: currency === c ? 700 : 400, fontFamily: "inherit" }}>
              {c}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", background: GL, border: `1px solid ${BD}`, borderRadius: 9 }}>
          <span style={{ fontSize: 10, color: T3 }}>1 USD =</span>
          <input type="number" value={xRate} onChange={(e) => setXRate(+e.target.value || 130)}
            style={{ width: 52, background: "transparent", border: "none", fontSize: 12, color: AM, fontFamily: "monospace", fontWeight: 700, outline: "none", textAlign: "right" }} />
          <span style={{ fontSize: 10, color: T3 }}>KES</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {finTab === "overview" && (
          <OverviewTab fmtKES={fmtKES} netWorthKES={netWorthKES} totalLiquid={totalLiquid} totalInvested={totalInvested}
            monthlyPassive={monthlyPassive} tradingKES={tradingKES} efBal={efBal} savBal={savBal} opBal={opBal}
            personalDebt={personalDebt} setPersonalDebt={setPersonalDebt} />
        )}
        {finTab === "income" && (
          <IncomeTab gross={gross} setGross={setGross} g={g} paye={paye} nssf={nssf} shif={shif} ahl={ahl} totalDed={totalDed} netPay={netPay} />
        )}
        {finTab === "accounts" && (
          <AccountsTab g={g} netPay={netPay} fmtKES={fmtKES} opBal={opBal} setOpBal={setOpBal} savBal={savBal} setSavBal={setSavBal} />
        )}
        {finTab === "budget" && (
          <BudgetTab netPay={netPay} budgets={budgets} setBudgets={setBudgets} totalBudgeted={totalBudgeted} totalSpent={totalSpent} />
        )}
        {finTab === "emergency" && (
          <EmergencyFundTab efBal={efBal} setEfBal={setEfBal} efTarget3={efTarget3} efTarget6={efTarget6} efMMF={efMMF} setEfMMF={setEfMMF}
            mmfs={mmfs} efYield={efYield} efMonthInt={efMonthInt} efContrib={efContrib} efRemaining={efRemaining} efMonths={efMonths} />
        )}
        {finTab === "portfolio" && (
          <PortfolioTab fmtKES={fmtKES} totalInvested={totalInvested} monthlyPassive={monthlyPassive} totalMMF={totalMMF}
            mmfs={mmfs} setMmfs={setMmfs} tbills={tbills} setTbills={setTbills} totalTbill={totalTbill}
            nseStocks={nseStocks} setNseStocks={setNseStocks} saccoBal={saccoBal} setSaccoBal={setSaccoBal}
            saccoYield={saccoYield} setSaccoYield={setSaccoYield} reitUnits={reitUnits} setReitUnits={setReitUnits}
            reitNAV={reitNAV} setReitNAV={setReitNAV} />
        )}
        {finTab === "goals" && (
          <GoalsTab efTarget6={efTarget6} efBal={efBal} efContrib={efContrib} totalInvested={totalInvested}
            netWorthKES={netWorthKES} monthlyPassive={monthlyPassive} personalDebt={personalDebt} netPay={netPay} />
        )}
      </div>
    </div>
  );
}
