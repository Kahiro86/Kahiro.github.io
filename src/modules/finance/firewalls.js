// ── Trading firewalls — named walls around your own accounts ────────
// Replaces the old single hardcoded trading account. Accounts are the real
// ones created in Trading → Accounts (ti_accounts); here they're sorted into
// named firewalls that stay walled off from personal net worth. Unfiled
// accounts sit in their own bucket and can optionally count toward net worth.
// Pure: sanitizer + a compute that joins accounts to their live balances.
import { accountMetrics } from "../trading/intel/tradingIntel.js";

const uid = (p = "fw") => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function sanitizeFirewalls(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const f of raw) {
    if (!f || typeof f !== "object" || typeof f.name !== "string" || !f.name.trim()) continue;
    out.push({
      id: f.id ? String(f.id) : uid(),
      name: f.name.trim().slice(0, 40),
      accountIds: Array.isArray(f.accountIds) ? [...new Set(f.accountIds.filter((x) => typeof x === "string" && x))].slice(0, 100) : [],
    });
  }
  return out.slice(0, 40);
}

export const newFirewall = (name) => ({ id: uid(), name: String(name || "New firewall").trim().slice(0, 40) || "New firewall", accountIds: [] });

// Join firewalls to live accounts + their current balances. An account that
// lands in more than one firewall (shouldn't happen, but corrupt data can)
// counts only in the first. `accounts` are sanitized ti_accounts (unarchived
// filtered by the caller); `tiTrades` is the raw ti_trades array.
export function computeFirewalls(firewalls, accounts, tiTrades) {
  const fws = sanitizeFirewalls(firewalls);
  const withBal = (a) => ({ ...a, balance: accountMetrics(a, tiTrades).currentBalance, netPnl: accountMetrics(a, tiTrades).netPnl });
  const byId = new Map(accounts.map((a) => [a.id, withBal(a)]));
  const claimed = new Set();

  const groups = fws.map((f) => {
    const members = [];
    for (const id of f.accountIds) {
      if (claimed.has(id)) continue;
      const acct = byId.get(id);
      if (acct) { members.push(acct); claimed.add(id); }
    }
    return { id: f.id, name: f.name, accounts: members, total: members.reduce((s, a) => s + a.balance, 0) };
  });

  const unfiled = accounts.filter((a) => !claimed.has(a.id)).map(withBal);
  const unfiledTotal = unfiled.reduce((s, a) => s + a.balance, 0);
  const walledTotal = groups.reduce((s, g) => s + g.total, 0);

  return { groups, unfiled, unfiledTotal, walledTotal, grandTotal: walledTotal + unfiledTotal };
}
