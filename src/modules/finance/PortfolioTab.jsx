import { Plus, Trash2 } from "lucide-react";
import { localDateStr } from "../../shared/dates.js";
import { B2, BD, GL, T1, T2, T3, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, SH, Chip, Fld } from "../../shared/ui.jsx";
import { TBILL_TYPES } from "./constants.js";

export function PortfolioTab({
  fmtKES, totalInvested, monthlyPassive, totalMMF,
  mmfs, setMmfs, tbills, setTbills, totalTbill,
  nseStocks, setNseStocks, saccoBal, setSaccoBal, saccoYield, setSaccoYield,
  reitUnits, setReitUnits, reitNAV, setReitNAV,
}) {
  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: T1 }}>Kenya Investment Portfolio</div>
        <div style={{ fontSize: 13, color: T3, marginTop: 3 }}>MMF · Treasury Bills & Bonds (DhowCSD) · NSE Equities · SACCO · ILAM Fahari REIT</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Chip label="Total Invested"  value={fmtKES(totalInvested)}  color={PU} />
        <Chip label="Monthly Passive" value={fmtKES(monthlyPassive)} color={GR} />
        <Chip label="Blended Yield"   value={totalInvested > 0 ? `${((monthlyPassive * 12 / totalInvested) * 100).toFixed(1)}% p.a.` : "—"} color={AM} />
        <Chip label="Annual Passive"  value={fmtKES(monthlyPassive * 12)} color={CY} />
      </div>

      <Card style={{ padding: "22px" }}>
        <SH title="Money Market Funds" sub="Liquid · daily interest · no lock-in · instant withdrawal" action={
          <span style={{ fontSize: 12, color: T3 }}>Total: <strong style={{ color: CY, fontFamily: "monospace" }}>{fmtKES(totalMMF)}</strong></span>
        } />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {mmfs.map((m, i) => {
            const mi = (+m.balance || 0) * ((+m.yield || 0) / 100 / 12);
            return (
              <div key={m.id} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 12, padding: "16px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T1, marginBottom: 3 }}>{m.name}</div>
                <div style={{ fontSize: 20, color: GR, fontWeight: 700, fontFamily: "monospace" }}>{m.yield}%</div>
                <div style={{ fontSize: 10, color: T3, marginBottom: 12 }}>p.a. current</div>
                <div style={{ fontSize: 10, color: T3, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Balance (KES)</div>
                <input type="number" value={m.balance || ""} onChange={(e) => setMmfs((prev) => prev.map((x, j) => (j === i ? { ...x, balance: +e.target.value || 0 } : x)))} placeholder="0"
                  style={{ width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 7, padding: "7px 9px", fontSize: 13, color: T1, outline: "none", fontFamily: "monospace", boxSizing: "border-box", marginBottom: 6 }} />
                <div style={{ fontSize: 10, color: T3, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Yield (%)</div>
                <input type="number" value={m.yield || ""} onChange={(e) => setMmfs((prev) => prev.map((x, j) => (j === i ? { ...x, yield: +e.target.value || 0 } : x)))}
                  style={{ width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 7, padding: "6px 9px", fontSize: 12, color: GR, outline: "none", fontFamily: "monospace", boxSizing: "border-box", marginBottom: 8 }} />
                {mi > 0 && <div style={{ fontSize: 11, color: GR, fontFamily: "monospace" }}>+KES {Math.round(mi).toLocaleString()}/mo</div>}
              </div>
            );
          })}
        </div>
      </Card>

      <Card style={{ padding: "22px" }}>
        <SH title="Treasury Bills & Bonds — CBK DhowCSD" sub="Government securities · fixed income · current market: 91d ~15.2% · 182d ~15.8% · 364d ~16.2%" action={
          <button onClick={() => setTbills((prev) => [...prev, { id: `tb${Date.now()}`, type: "364-Day T-Bill", faceValue: 0, rate: 16.2, purchaseDate: localDateStr(), maturityDate: "" }])}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 13px", background: `${CY}22`, border: `1px solid ${CY}44`, borderRadius: 8, color: CY, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <Plus size={13} />Add Holding
          </button>
        } />
        {tbills.length === 0 ? (
          <div style={{ padding: "16px 0", textAlign: "center", color: T3, fontSize: 12 }}>
            No holdings yet. Click "Add Holding" to log a T-bill or bond from your CBK DhowCSD account.
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 70px 100px 110px 110px 36px", gap: 9, padding: "6px 0 10px", marginBottom: 6, borderBottom: `1px solid ${BD}` }}>
              {["Type", "Face Value (KES)", "Rate %", "Purchase", "Maturity", "Monthly Int.", ""].map((h) => (
                <div key={h} style={{ fontSize: 9.5, color: T3, letterSpacing: 1, textTransform: "uppercase" }}>{h}</div>
              ))}
            </div>
            {tbills.map((t, i) => (
              <div key={t.id} style={{ display: "grid", gridTemplateColumns: "160px 1fr 70px 100px 110px 110px 36px", gap: 9, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${BD}` }}>
                <select value={t.type} onChange={(e) => setTbills((prev) => prev.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}
                  style={{ background: B2, border: `1px solid ${BD}`, borderRadius: 7, padding: "6px 8px", fontSize: 11, color: T1, outline: "none", fontFamily: "inherit", appearance: "none", cursor: "pointer", width: "100%" }}>
                  {TBILL_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <input type="number" value={t.faceValue || ""} onChange={(e) => setTbills((prev) => prev.map((x, j) => (j === i ? { ...x, faceValue: +e.target.value || 0 } : x)))} placeholder="100000"
                  style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "6px 8px", fontSize: 12, color: T1, outline: "none", fontFamily: "monospace", width: "100%", boxSizing: "border-box" }} />
                <input type="number" value={t.rate || ""} onChange={(e) => setTbills((prev) => prev.map((x, j) => (j === i ? { ...x, rate: +e.target.value || 0 } : x)))}
                  style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "6px 8px", fontSize: 12, color: GR, outline: "none", fontFamily: "monospace", width: "100%", boxSizing: "border-box" }} />
                <input type="date" value={t.purchaseDate || ""} onChange={(e) => setTbills((prev) => prev.map((x, j) => (j === i ? { ...x, purchaseDate: e.target.value } : x)))}
                  style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "6px 7px", fontSize: 11, color: T2, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }} />
                <input type="date" value={t.maturityDate || ""} onChange={(e) => setTbills((prev) => prev.map((x, j) => (j === i ? { ...x, maturityDate: e.target.value } : x)))}
                  style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "6px 7px", fontSize: 11, color: T2, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }} />
                <div style={{ fontSize: 12, color: GR, fontFamily: "monospace" }}>
                  KES {Math.round((+t.faceValue || 0) * ((+t.rate || 0) / 100 / 12)).toLocaleString()}
                </div>
                <button onClick={() => setTbills((prev) => prev.filter((_, j) => j !== i))}
                  style={{ background: "none", border: `1px solid ${RE}33`, borderRadius: 6, padding: "4px 6px", cursor: "pointer", color: RE, display: "flex", alignItems: "center" }}>
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            <div style={{ padding: "10px 0 0", textAlign: "right", fontSize: 12, color: T2 }}>
              Total: <strong style={{ color: PU, fontFamily: "monospace" }}>KES {totalTbill.toLocaleString()}</strong>
            </div>
          </>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>
        <Card style={{ padding: "20px" }}>
          <SH title="NSE Equities" sub="Nairobi Securities Exchange holdings" action={
            <button onClick={() => setNseStocks((prev) => [...prev, { id: `nse${Date.now()}`, ticker: "", name: "", shares: 0, avgBuy: 0, currentPrice: 0 }])}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", background: `${CY}22`, border: `1px solid ${CY}44`, borderRadius: 8, color: CY, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              <Plus size={12} />Add Stock
            </button>
          } />
          {nseStocks.length === 0 ? (
            <div style={{ fontSize: 12, color: T3, padding: "14px 0" }}>
              No NSE holdings. Add stocks to track your equity portfolio.
            </div>
          ) : nseStocks.map((st, i) => {
            const val = (+st.shares || 0) * (+st.currentPrice || 0);
            const cost = (+st.shares || 0) * (+st.avgBuy || 0);
            const pl = val - cost;
            const plP = cost > 0 ? ((pl / cost) * 100).toFixed(1) : "0.0";
            return (
              <div key={st.id} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "12px", marginBottom: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "65px 1fr 70px 36px", gap: 8, alignItems: "center", marginBottom: 10 }}>
                  <input value={st.ticker} onChange={(e) => setNseStocks((prev) => prev.map((x, j) => (j === i ? { ...x, ticker: e.target.value.toUpperCase() } : x)))} placeholder="SCOM"
                    style={{ background: B2, border: `1px solid ${BD}`, borderRadius: 6, padding: "6px 8px", fontSize: 13, color: CY, outline: "none", fontFamily: "monospace", fontWeight: 700 }} />
                  <input value={st.name} onChange={(e) => setNseStocks((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Company name"
                    style={{ background: B2, border: `1px solid ${BD}`, borderRadius: 6, padding: "6px 8px", fontSize: 12, color: T1, outline: "none", fontFamily: "inherit" }} />
                  <input type="number" value={st.shares || ""} onChange={(e) => setNseStocks((prev) => prev.map((x, j) => (j === i ? { ...x, shares: +e.target.value || 0 } : x)))} placeholder="Shares"
                    style={{ background: B2, border: `1px solid ${BD}`, borderRadius: 6, padding: "6px 8px", fontSize: 12, color: T1, outline: "none", fontFamily: "monospace" }} />
                  <button onClick={() => setNseStocks((prev) => prev.filter((_, j) => j !== i))}
                    style={{ background: "none", border: `1px solid ${RE}33`, borderRadius: 6, padding: "5px", cursor: "pointer", color: RE, display: "flex", alignItems: "center" }}>
                    <Trash2 size={11} />
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { l: "Avg Buy",   isInp: true,  k: "avgBuy",       c: T1 },
                    { l: "Current",   isInp: true,  k: "currentPrice", c: T1 },
                    { l: "Value",     isInp: false, v: `KES ${Math.round(val).toLocaleString()}`, c: CY },
                    { l: "P&L",       isInp: false, v: `${pl >= 0 ? "+" : ""}${plP}%`, c: pl >= 0 ? GR : RE },
                  ].map((x) => (
                    <div key={x.l}>
                      <div style={{ fontSize: 9.5, color: T3, letterSpacing: 1, marginBottom: 3, textTransform: "uppercase" }}>{x.l}</div>
                      {x.isInp
                        ? <input type="number" value={st[x.k] || ""} onChange={(e) => setNseStocks((prev) => prev.map((xx, j) => (j === i ? { ...xx, [x.k]: +e.target.value || 0 } : xx)))} placeholder="0"
                            style={{ width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 6, padding: "5px 8px", fontSize: 12, color: T1, outline: "none", fontFamily: "monospace", boxSizing: "border-box" }} />
                        : <div style={{ fontSize: 14, fontWeight: 700, color: x.c, fontFamily: "monospace" }}>{x.v}</div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card style={{ padding: "20px" }}>
            <SH title="SACCO" sub="Cooperative savings + share capital" />
            <Fld label="SACCO Balance (KES)">
              <input type="number" value={saccoBal || ""} onChange={(e) => setSaccoBal(+e.target.value || 0)} placeholder="0"
                style={{ width: "100%", background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 12px", fontSize: 14, color: T1, outline: "none", fontFamily: "monospace", boxSizing: "border-box" }} />
            </Fld>
            <Fld label="Dividend Yield (% p.a.)">
              <input type="number" value={saccoYield || ""} onChange={(e) => setSaccoYield(+e.target.value || 0)} placeholder="12"
                style={{ width: "100%", background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 12px", fontSize: 14, color: GR, outline: "none", fontFamily: "monospace", boxSizing: "border-box" }} />
            </Fld>
            {saccoBal > 0 && (
              <div style={{ fontSize: 12, color: GR, fontFamily: "monospace" }}>
                Monthly est: KES {Math.round(saccoBal * (saccoYield / 100 / 12)).toLocaleString()}
              </div>
            )}
          </Card>

          <Card style={{ padding: "20px" }}>
            <SH title="ILAM Fahari I-REIT" sub="Real Estate Investment Trust — NSE listed" />
            <Fld label="Units Held">
              <input type="number" value={reitUnits || ""} onChange={(e) => setReitUnits(+e.target.value || 0)} placeholder="0"
                style={{ width: "100%", background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 12px", fontSize: 14, color: T1, outline: "none", fontFamily: "monospace", boxSizing: "border-box" }} />
            </Fld>
            <Fld label="NAV per Unit (KES)">
              <input type="number" value={reitNAV || ""} onChange={(e) => setReitNAV(+e.target.value || 7.5)} placeholder="7.50"
                style={{ width: "100%", background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 12px", fontSize: 14, color: T1, outline: "none", fontFamily: "monospace", boxSizing: "border-box" }} />
            </Fld>
            {reitUnits > 0 && (
              <>
                <div style={{ fontSize: 12, color: CY, fontFamily: "monospace" }}>Value: KES {Math.round(reitUnits * reitNAV).toLocaleString()}</div>
                <div style={{ fontSize: 12, color: GR, fontFamily: "monospace", marginTop: 4 }}>
                  Monthly dist: KES {Math.round((reitUnits * reitNAV * 0.08) / 12).toLocaleString()} (~8% yield)
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
