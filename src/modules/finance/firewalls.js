// ── Trading firewalls — named walls around your own accounts ────────
// Replaces the old single hardcoded trading account. Accounts are the real
// ones created in Trading → Accounts (ti_accounts); here they're sorted into
// named firewalls that stay walled off from personal net worth. Each firewall
// has a colour and its own "count toward net worth" choice; unfiled accounts
// sit in their own bucket with the same choice. Pure: sanitizer + a compute
// that joins accounts to their live balances.
import { accountMetrics } from "../trading/intel/tradingIntel.js";

const uid = (p = "fw") => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// A small distinct palette (independent of the monochrome design tokens, which
// alias to one accent) so firewalls read apart at a glance.
export const FIREWALL_COLORS = ["#78C8FF", "#F0B429", "#3FB950", "#A78BFA", "#EC4899", "#14B8A6", "#F85149", "#4C8DFF"];
const HEX = /^#[0-9a-fA-F]{6}$/;

export function sanitizeFirewalls(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const f of raw) {
    if (!f || typeof f !== "object" || typeof f.name !== "string" || !f.name.trim()) continue;
    out.push({
      id: f.id ? String(f.id) : uid(),
      name: f.name.trim().slice(0, 40),
      color: HEX.test(f.color) ? f.color : FIREWALL_COLORS[out.length % FIREWALL_COLORS.length],
      countsNW: !!f.countsNW,
      accountIds: Array.isArray(f.accountIds) ? [...new Set(f.accountIds.filter((x) => typeof x === "string" && x))].slice(0, 100) : [],
    });
  }
  return out.slice(0, 40);
}

export const newFirewall = (name, i = 0) => ({
  id: uid(), name: String(name || "New firewall").trim().slice(0, 40) || "New firewall",
  color: FIREWALL_COLORS[i % FIREWALL_COLORS.length], countsNW: false, accountIds: [],
});

// Join firewalls to live accounts + their current balances. An account that
// lands in more than one firewall (shouldn't happen, but corrupt data can)
// counts only in the first. `accounts` are sanitized ti_accounts (unarchived
// filtered by the caller); `tiTrades` is the raw ti_trades array.
export function computeFirewalls(firewalls, accounts, tiTrades) {
  const fws = sanitizeFirewalls(firewalls);
  const withBal = (a) => { const m = accountMetrics(a, tiTrades); return { ...a, balance: m.currentBalance, netPnl: m.netPnl }; };
  const byId = new Map(accounts.map((a) => [a.id, withBal(a)]));
  const claimed = new Set();

  const groups = fws.map((f) => {
    const members = [];
    for (const id of f.accountIds) {
      if (claimed.has(id)) continue;
      const acct = byId.get(id);
      if (acct) { members.push(acct); claimed.add(id); }
    }
    return {
      id: f.id, name: f.name, color: f.color, countsNW: f.countsNW, accounts: members,
      total: members.reduce((s, a) => s + a.balance, 0),
      netPnl: members.reduce((s, a) => s + a.netPnl, 0),
      count: members.length,
    };
  });

  const unfiled = accounts.filter((a) => !claimed.has(a.id)).map(withBal);
  const unfiledTotal = unfiled.reduce((s, a) => s + a.balance, 0);
  const unfiledPnl = unfiled.reduce((s, a) => s + a.netPnl, 0);
  const walledTotal = groups.reduce((s, g) => s + g.total, 0);
  // The USD sum that the user has opted to count toward net worth (per-group
  // choice; the unfiled bucket's choice is applied by the caller).
  const countedGroupTotal = groups.filter((g) => g.countsNW).reduce((s, g) => s + g.total, 0);

  return { groups, unfiled, unfiledTotal, unfiledPnl, walledTotal, countedGroupTotal, grandTotal: walledTotal + unfiledTotal };
}
