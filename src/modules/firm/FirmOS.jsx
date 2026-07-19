// ── The Firm — Trading + Wealth + Doctrine, one roof ──────────────────
// The Firm's own doctrine already frames Trading OS as "the Fleet" and
// Finance OS as "the Vault" — this shell makes that literal: one nav entry,
// three whole-module groups underneath. Each absorbed module stays 100%
// self-contained (own storage, own internal tabs); this shell only decides
// which one is on screen. `navHint` (from App.jsx's compound "firm:group"
// nav ids) lets a deep link — e.g. the Bills concern — land on the right
// group instead of always this shell's own default.
import { useEffect, useState } from "react";
import { TrendingUp, DollarSign, Building2 } from "lucide-react";
import { ModuleTabs } from "../../shared/ModuleTabs.jsx";
import { TradingModule } from "../trading/TradingModule.jsx";
import { FinanceOS } from "../finance/FinanceOS.jsx";
import { FirmDoctrine } from "./FirmDoctrine.jsx";

const GROUPS = [
  { id: "trading", l: "Trading", i: TrendingUp },
  { id: "wealth", l: "Wealth", i: DollarSign },
  { id: "doctrine", l: "Doctrine", i: Building2 },
];

export function FirmOS({ navHint } = {}) {
  const [group, setGroup] = useState("trading");

  useEffect(() => {
    if (navHint?.group) setGroup(navHint.group);
  }, [navHint?.nonce]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ModuleTabs tint="rgba(6,6,6,0.75)" activeBg="rgba(255,255,255,0.1)" activeColor="#FFFFFF"
        pad="4px 10px" fontSize={11} gap={8}
        tabs={GROUPS} active={group} onSelect={setGroup} />

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {group === "trading" && <TradingModule />}
        {group === "wealth" && <FinanceOS />}
        {group === "doctrine" && <FirmDoctrine />}
      </div>
    </div>
  );
}
