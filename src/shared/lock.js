// ── App lock — a PIN privacy screen, honestly framed ─────────────────
// This gates the UI; it is NOT encryption. Data in localStorage stays
// readable to anyone with full device access, so the lock's job is to
// stop casual eyes when the phone is handed over — nothing more.
// Design rules:
//   · only a salted SHA-256 hash of the PIN is stored, never the PIN
//   · config is device-local (kahiro_lock, outside the synced prefix) —
//     a PIN set on the phone never locks the desktop
//   · corrupt/invalid config FAILS OPEN: a broken record must never be
//     able to lock the user away from their own data
const KEY = "kahiro_lock";

export function getLock() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY));
    return c && typeof c === "object" && !Array.isArray(c)
      && typeof c.hash === "string" && c.hash.length === 64
      && typeof c.salt === "string" && Number.isInteger(c.len) && c.len >= 4 && c.len <= 8
      ? c : null;
  } catch { return null; }
}
export const hasLock = () => !!getLock();
export const clearLock = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

async function digest(salt, pin) {
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${pin}`));
    return hex(new Uint8Array(buf));
  }
  // Insecure-context fallback (plain http): FNV-1a repeated — still never
  // stores the PIN itself, but weaker than SHA-256. GH Pages is https, so
  // this path only exists to avoid a crash in odd embeddings.
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  const s = `${salt}:${pin}`;
  for (let r = 0; r < 64; r++) for (let i = 0; i < s.length; i++) {
    h1 = ((h1 ^ s.charCodeAt(i)) * 0x01000193) >>> 0;
    h2 = ((h2 ^ h1) * 0x01000193) >>> 0;
  }
  return (hex(new Uint8Array(new Uint32Array([h1, h2]).buffer)).repeat(8)).slice(0, 64);
}

export async function setPin(pin) {
  if (!/^\d{4,8}$/.test(pin)) throw new Error("PIN must be 4–8 digits.");
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  localStorage.setItem(KEY, JSON.stringify({ salt, hash: await digest(salt, pin), len: pin.length }));
}

export async function verifyPin(pin) {
  const c = getLock();
  if (!c) return true; // no (or corrupt) lock — fail open
  return (await digest(c.salt, pin)) === c.hash;
}
