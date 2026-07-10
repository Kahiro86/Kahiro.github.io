import { T3 } from "../../shared/designTokens.js";
import { SESSION_CONFIG } from "./constants.js";

function getNYMinutes() {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric", minute: "numeric", hour12: false,
    }).formatToParts(now);
    const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    return h * 60 + m;
  } catch {
    return new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
  }
}

export function getEATTimeStr() {
  try {
    return new Date().toLocaleTimeString("en-US", {
      timeZone: "Africa/Nairobi", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return new Date().toLocaleTimeString();
  }
}

export function getActiveKillzone() {
  const nyMins = getNYMinutes();
  const active = SESSION_CONFIG.find((s) => nyMins >= s.nyStart && nyMins < s.nyEnd);
  if (active) return { label: active.label, color: active.color, active: true };
  return { label: "No Active Killzone", color: T3, active: false };
}
