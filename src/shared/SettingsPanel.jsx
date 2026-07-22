import { useEffect, useRef, useState } from "react";
import { X, Check, AlertCircle, Download, Upload, ShieldAlert, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { B0, B1, BD, T1, T2, T3, GL, CY, PU, GR, RE, AM } from "./designTokens.js";
import { getApiKey, setApiKey, callClaude } from "./anthropic.js";
import { storage } from "./storage.js";
import { localDateStr } from "./dates.js";
import { getSyncStatus, onSyncStatus, testConnection, pull, flush, onAuthChanged } from "./sync.js";
import { getSyncConfig, saveSyncConfig, signUp, signIn, signOut, resetPassword, updatePassword, getSession, onAuth } from "./supabase.js";
import { getGcalConfig, setGcalConfig, getToken as getGcalToken } from "./gcal.js";
import { hasLock, setPin, verifyPin, clearLock } from "./lock.js";

const SETUP_SQL = `create table if not exists kv (
  user_id uuid not null default auth.uid(),
  key text not null,
  value jsonb,
  updated_at timestamptz default now(),
  primary key (user_id, key)
);
alter table kv enable row level security;
create policy "own rows only" on kv
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
alter publication supabase_realtime add table kv;`;

export function SettingsPanel({ onClose }) {
  const [key, setKey] = useState(getApiKey());
  const [status, setStatus] = useState(null); // null | "testing" | "ok" | "error"
  const [errorMsg, setErrorMsg] = useState("");
  const [dataMsg, setDataMsg] = useState(null); // { text, tone }
  const [armErase, setArmErase] = useState(false);
  const [armLegacy, setArmLegacy] = useState(false);
  const fileRef = useRef(null);

  // ── Account & Cloud Sync state ─────────────────────────────────────
  const cfg0 = getSyncConfig();
  const [syncUrl, setSyncUrl] = useState(cfg0?.url || "");
  const [syncKey, setSyncKey] = useState(cfg0?.anonKey || "");
  const [connected, setConnected] = useState(!!cfg0);
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPw, setNewPw] = useState("");
  const [recovery, setRecovery] = useState(false); // arrived via password-reset link
  const [syncState, setSyncState] = useState(getSyncStatus());
  const [syncMsg, setSyncMsg] = useState(null); // { text, tone }
  const [showSetup, setShowSetup] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => onSyncStatus(setSyncState), []);
  // Escape closes the panel — keyboard users shouldn't need the mouse.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    getSession().then(setSession);
    return onAuth((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
  }, [connected]);

  const connectSync = async () => {
    const cfg = { url: syncUrl.trim(), anonKey: syncKey.trim() };
    if (!cfg.url || !cfg.anonKey) return;
    setSyncMsg({ text: "Testing connection…", tone: T2 });
    try {
      await testConnection(cfg);
      saveSyncConfig(cfg);
      setConnected(true);
      setSyncMsg({ text: "Project connected. Now sign in (or create your account) below.", tone: GR });
    } catch (err) {
      setSyncMsg({ text: `Connection failed: ${err.message}`, tone: RE });
    }
  };
  const disconnectSync = async () => {
    await signOut().catch(() => {});
    saveSyncConfig(null);
    setConnected(false);
    setSession(null);
    setSyncMsg({ text: "Disconnected. Your data stays on this device; the cloud copy is kept.", tone: T2 });
  };
  const doAuth = async (mode) => {
    setAuthBusy(true);
    setSyncMsg(null);
    try {
      if (mode === "signup") {
        const res = await signUp(email.trim(), password);
        if (res.session) { setSyncMsg({ text: "Account created — syncing this device now…", tone: GR }); await onAuthChanged(true); }
        else setSyncMsg({ text: "Account created. Check your email to confirm, then sign in here.", tone: AM });
      } else {
        await signIn(email.trim(), password);
        setSyncMsg({ text: "Signed in — syncing this device now…", tone: GR });
        await onAuthChanged(true);
        setSyncMsg({ text: "Signed in. This device now syncs automatically.", tone: GR });
      }
      setPassword("");
    } catch (err) {
      setSyncMsg({ text: err.message, tone: RE });
    } finally { setAuthBusy(false); }
  };
  const doReset = async () => {
    if (!email.trim()) { setSyncMsg({ text: "Enter your email first, then tap Forgot password.", tone: AM }); return; }
    try {
      await resetPassword(email.trim());
      setSyncMsg({ text: "Password-reset email sent. Open the link on this device.", tone: GR });
    } catch (err) { setSyncMsg({ text: err.message, tone: RE }); }
  };
  const doUpdatePw = async () => {
    try {
      await updatePassword(newPw);
      setRecovery(false); setNewPw("");
      setSyncMsg({ text: "Password updated — you're signed in.", tone: GR });
      await onAuthChanged(true);
    } catch (err) { setSyncMsg({ text: err.message, tone: RE }); }
  };
  const doSignOut = async () => {
    await signOut();
    await onAuthChanged(false);
    setSyncMsg({ text: "Signed out. Data stays on this device; sync is paused.", tone: T2 });
  };
  const syncNow = async () => { await flush(); await pull(); };

  // ── Google Calendar state ──────────────────────────────────────────
  const [gcalId, setGcalId] = useState(getGcalConfig()?.clientId || "");
  const [gcalMsg, setGcalMsg] = useState(null);
  const [gcalOn, setGcalOn] = useState(!!getGcalConfig());
  const connectGcal = async () => {
    if (!gcalId.trim()) return;
    setGcalConfig({ clientId: gcalId.trim() });
    setGcalMsg({ text: "Opening Google consent…", tone: T2 });
    try {
      await getGcalToken(true); // interactive consent (must come from this click)
      setGcalOn(true);
      setGcalMsg({ text: "Connected — today's events will show on the Command Center.", tone: GR });
    } catch (err) {
      setGcalConfig(null);
      setGcalOn(false);
      setGcalMsg({ text: `Couldn't connect: ${err.message}. Check the Client ID and that this site's URL is an authorised JavaScript origin.`, tone: RE });
    }
  };
  const disconnectGcal = () => { setGcalConfig(null); setGcalOn(false); setGcalMsg({ text: "Calendar disconnected.", tone: T2 }); };

  // ── App Lock state ─────────────────────────────────────────────────
  const [lockOn, setLockOn] = useState(hasLock());
  const [pinA, setPinA] = useState("");
  const [pinB, setPinB] = useState("");
  const [pinCur, setPinCur] = useState("");
  const [lockMsg, setLockMsg] = useState(null);
  const enableLock = async () => {
    if (!/^\d{4,8}$/.test(pinA)) { setLockMsg({ text: "PIN must be 4–8 digits.", tone: AM }); return; }
    if (pinA !== pinB) { setLockMsg({ text: "The two PINs don't match.", tone: RE }); return; }
    await setPin(pinA);
    setLockOn(true); setPinA(""); setPinB("");
    setLockMsg({ text: "App lock enabled — you'll be asked for this PIN when the app opens on this device.", tone: GR });
  };
  const changeLock = async () => {
    if (!(await verifyPin(pinCur))) { setLockMsg({ text: "Current PIN is wrong.", tone: RE }); setPinCur(""); return; }
    if (!/^\d{4,8}$/.test(pinA)) { setLockMsg({ text: "New PIN must be 4–8 digits.", tone: AM }); return; }
    await setPin(pinA);
    setPinA(""); setPinCur("");
    setLockMsg({ text: "PIN changed.", tone: GR });
  };
  const disableLock = async () => {
    if (!(await verifyPin(pinCur))) { setLockMsg({ text: "Current PIN is wrong.", tone: RE }); setPinCur(""); return; }
    clearLock();
    setLockOn(false); setPinCur(""); setPinA("");
    setLockMsg({ text: "App lock disabled on this device.", tone: T2 });
  };

  const syncDot = { live: GR, idle: GR, syncing: CY, error: RE, offline: AM, auth: AM, off: T3 }[syncState.status] || T3;
  const syncLabel = {
    live: `Live sync on${syncState.lastSyncAt ? ` · ${new Date(syncState.lastSyncAt).toLocaleTimeString()}` : ""}`,
    idle: syncState.lastSyncAt ? `Synced · ${new Date(syncState.lastSyncAt).toLocaleTimeString()}` : "Connected",
    syncing: "Syncing…",
    error: `Sync error: ${syncState.lastError}`,
    offline: "Offline — changes queued, will sync when back online",
    auth: "Sign in to sync",
    off: "Not connected",
  }[syncState.status] || "";
  const inputStyle = { width: "100%", background: B0, border: `1px solid ${BD}`, borderRadius: 9, padding: "10px 13px", fontSize: 12.5, color: T1, outline: "none", fontFamily: "'JetBrains Mono',monospace", boxSizing: "border-box", marginBottom: 8 };

  const save = () => {
    setApiKey(key.trim());
    setStatus(null);
  };

  const test = async () => {
    setApiKey(key.trim());
    setStatus("testing");
    setErrorMsg("");
    try {
      await callClaude({ system: "Reply with the single word: OK", messages: [{ role: "user", content: "ping" }], maxTokens: 5 });
      setStatus("ok");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message);
    }
  };

  const clear = () => {
    setApiKey("");
    setKey("");
    setStatus(null);
  };

  // ── Data: everything lives in this browser, so backups matter ──────
  const exportData = async () => {
    const keys = await storage.list();
    const data = { _app: "KAHIRO", _exported: new Date().toISOString(), _version: 1 };
    for (const k of keys) {
      try { data[k] = JSON.parse(await storage.get(k)); } catch { /* skip unparseable */ }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kahiro-backup-${localDateStr()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    // Record the export time device-locally (outside the architect: prefix, so
    // it is never synced or written into the backup itself) — the dashboard's
    // backup reminder reads this to know when a fresh export is overdue.
    try { localStorage.setItem("kahiro_last_export", String(Date.now())); } catch { /* storage best-effort */ }
    setDataMsg({ text: `Backup saved (${keys.length} datasets). Keep it somewhere safe.`, tone: GR });
  };

  const importData = async (file) => {
    try {
      const data = JSON.parse(await file.text());
      if (data._app !== "KAHIRO" && data._app !== "ARCHITECT") throw new Error("Not a KAHIRO backup file.");
      const keys = Object.keys(data).filter((k) => !k.startsWith("_"));
      if (!keys.length) throw new Error("Backup contains no data.");
      for (const k of keys) await storage.set(k, JSON.stringify(data[k]));
      setDataMsg({ text: `Restored ${keys.length} datasets. Reloading…`, tone: GR });
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setDataMsg({ text: `Import failed: ${err.message}`, tone: RE });
    }
  };

  const eraseAll = async () => {
    const keys = await storage.list();
    for (const k of keys) await storage.remove(k);
    window.location.reload();
  };

  // Clear the legacy ICT trade journal (ict_trades / ict_reviews) — the old
  // pre-rebuild data that still feeds the Firm's Doctrine (Fleet) view. Set to
  // empty (rather than removed) so a synced device propagates the clear.
  const clearLegacyTrades = async () => {
    await storage.set("ict_trades", JSON.stringify([]));
    await storage.set("ict_reviews", JSON.stringify([]));
    setArmLegacy(false);
    setDataMsg({ text: "Legacy trade journal cleared. Reloading…", tone: GR });
    setTimeout(() => window.location.reload(), 600);
  };

  const btn = (extra = {}) => ({ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 12px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, color: T2, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", flex: 1, ...extra });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 14 }} onClick={onClose}>
      <div style={{ width: 440, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", background: B1, border: `1px solid ${BD}`, borderRadius: 16, padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T1 }}>Settings</div>
          <button onClick={onClose} aria-label="Close settings" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={16} /></button>
        </div>

        <div style={{ fontSize: 11, color: CY, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Anthropic API Key</div>
        <div style={{ fontSize: 12, color: T3, lineHeight: 1.6, marginBottom: 12 }}>
          Stored only in this browser; calls go directly from your browser to Anthropic. Powers the AI analyst, trade reviews and reports.
        </div>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-ant-..."
          style={{ width: "100%", background: B0, border: `1px solid ${BD}`, borderRadius: 9, padding: "10px 13px", fontSize: 13, color: T1, outline: "none", fontFamily: "'JetBrains Mono',monospace", boxSizing: "border-box", marginBottom: 12 }}
        />
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button onClick={save} style={btn({ background: `linear-gradient(135deg,${CY},${PU})`, border: "none", color: "#000", fontWeight: 700 })}>Save</button>
          <button onClick={test} disabled={!key.trim() || status === "testing"} style={btn({ cursor: key.trim() ? "pointer" : "default" })}>
            {status === "testing" ? "Testing…" : "Test Connection"}
          </button>
          <button onClick={clear} style={btn({ flex: "none", background: "none", border: `1px solid ${RE}44`, color: RE })}>Clear</button>
        </div>
        {status === "ok" && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: GR, marginBottom: 6 }}>
            <Check size={13} />Connection successful.
          </div>
        )}
        {status === "error" && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: RE, marginBottom: 6 }}>
            <AlertCircle size={13} />{errorMsg}
          </div>
        )}

        <div style={{ height: 1, background: BD, margin: "16px 0" }} />

        {/* ── Account & Cloud Sync ──────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: PU, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>Account & Cloud Sync</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: syncDot, boxShadow: `0 0 6px ${syncDot}`, animation: syncState.status === "syncing" ? "pulse 1s infinite" : "none" }} />
            <span style={{ fontSize: 10.5, color: T3 }}>{syncLabel}</span>
          </div>
        </div>

        {!connected && (
          <>
            <div style={{ fontSize: 12, color: T3, lineHeight: 1.6, marginBottom: 12 }}>
              Sign in on every device and your trades, habits, finances and journal stay identical everywhere — updates arrive live, and offline edits upload automatically. One-time setup: create a free <span style={{ color: T2 }}>supabase.com</span> project, run the SQL below, then paste your project URL and anon key.
            </div>
            <input value={syncUrl} onChange={(e) => setSyncUrl(e.target.value)} placeholder="https://your-project.supabase.co" style={inputStyle} />
            <input type="password" value={syncKey} onChange={(e) => setSyncKey(e.target.value)} placeholder="anon key (eyJ…)" style={{ ...inputStyle, marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button onClick={connectSync} disabled={!syncUrl.trim() || !syncKey.trim()}
                style={btn({ background: syncUrl.trim() && syncKey.trim() ? `linear-gradient(135deg,${PU},${CY})` : GL, border: "none", color: syncUrl.trim() && syncKey.trim() ? "#000" : T3, fontWeight: 700 })}>
                <Cloud size={13} />Connect project
              </button>
              <button onClick={() => setShowSetup((s) => !s)} style={btn({ flex: "none" })}>{showSetup ? "Hide setup" : "Setup guide"}</button>
            </div>
            {showSetup && (
              <div style={{ padding: "11px 13px", background: B0, border: `1px solid ${BD}`, borderRadius: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 11.5, color: T2, lineHeight: 1.7, marginBottom: 8 }}>
                  1. Create a project at supabase.com (free).<br />
                  2. Open SQL Editor, paste and run this once:
                </div>
                <pre style={{ fontSize: 10, color: CY, fontFamily: "'JetBrains Mono',monospace", whiteSpace: "pre-wrap", background: GL, padding: "9px 11px", borderRadius: 8, margin: "0 0 8px", lineHeight: 1.6 }}>{SETUP_SQL}</pre>
                <div style={{ fontSize: 11.5, color: T2, lineHeight: 1.7 }}>
                  3. Project Settings → API: copy the <span style={{ color: T1 }}>URL</span> and <span style={{ color: T1 }}>anon public</span> key here.<br />
                  4. On your other devices just connect and sign in — same account, same data.
                </div>
              </div>
            )}
          </>
        )}

        {connected && recovery && (
          <>
            <div style={{ fontSize: 12, color: T2, lineHeight: 1.6, marginBottom: 10 }}>Set your new password:</div>
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="new password (min 6 chars)" style={inputStyle} />
            <button onClick={doUpdatePw} disabled={newPw.length < 6} style={btn({ background: newPw.length >= 6 ? `linear-gradient(135deg,${PU},${CY})` : GL, border: "none", color: newPw.length >= 6 ? "#000" : T3, fontWeight: 700, marginBottom: 10 })}>Update password</button>
          </>
        )}

        {connected && !recovery && !session && (
          <>
            <div style={{ fontSize: 12, color: T3, lineHeight: 1.6, marginBottom: 10 }}>
              Project connected. Sign in — or create your account the first time — and this device joins your synced data.
            </div>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" style={inputStyle} />
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" style={{ ...inputStyle, marginBottom: 10 }}
              onKeyDown={(e) => e.key === "Enter" && email.trim() && password && doAuth("signin")} />
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button onClick={() => doAuth("signin")} disabled={authBusy || !email.trim() || !password}
                style={btn({ background: email.trim() && password ? `linear-gradient(135deg,${PU},${CY})` : GL, border: "none", color: email.trim() && password ? "#000" : T3, fontWeight: 700 })}>
                {authBusy ? "Working…" : "Sign in"}
              </button>
              <button onClick={() => doAuth("signup")} disabled={authBusy || !email.trim() || password.length < 6} style={btn()}>Create account</button>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button onClick={doReset} style={btn({ flex: "none", background: "none", border: "none", color: T3, padding: "4px 2px", fontSize: 11.5 })}>Forgot password?</button>
              <div style={{ flex: 1 }} />
              <button onClick={disconnectSync} style={btn({ flex: "none", background: "none", border: "none", color: T3, padding: "4px 2px", fontSize: 11.5 })}>Disconnect project</button>
            </div>
          </>
        )}

        {connected && !recovery && session && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", background: GL, border: `1px solid ${BD}`, borderRadius: 10, marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg,${PU},${CY})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#000", flexShrink: 0 }}>
                {(session.user?.email || "?")[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: T1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{session.user?.email}</div>
                <div style={{ fontSize: 10.5, color: T3 }}>Signed in · data isolated to your account</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button onClick={syncNow} style={btn({ borderColor: `${CY}44`, color: CY })}><RefreshCw size={13} />Sync now</button>
              <button onClick={doSignOut} style={btn()}>Sign out</button>
              <button onClick={disconnectSync} style={btn({ flex: "none", borderColor: `${RE}44`, color: RE })}><CloudOff size={13} /></button>
            </div>
          </>
        )}
        {syncMsg && <div style={{ fontSize: 12, color: syncMsg.tone, marginBottom: 8, lineHeight: 1.5 }}>{syncMsg.text}</div>}

        <div style={{ height: 1, background: BD, margin: "16px 0" }} />

        {/* ── Google Calendar ───────────────────────────────────────── */}
        <div style={{ fontSize: 11, color: AM, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Google Calendar</div>
        <div style={{ fontSize: 12, color: T3, lineHeight: 1.6, marginBottom: 12 }}>
          Shows today's events on the Command Center (read-only). One-time setup: in Google Cloud Console create an <span style={{ color: T2 }}>OAuth Client ID (Web application)</span>, add this site's URL as an authorised JavaScript origin, and paste the Client ID here.
        </div>
        {gcalOn ? (
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 7, padding: "9px 12px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, fontSize: 12, color: GR }}><Check size={13} />Connected</div>
            <button onClick={disconnectGcal} style={btn({ flex: "none", borderColor: `${RE}44`, color: RE })}>Disconnect</button>
          </div>
        ) : (
          <>
            <input value={gcalId} onChange={(e) => setGcalId(e.target.value)} placeholder="OAuth Client ID (…apps.googleusercontent.com)" style={inputStyle} />
            <button onClick={connectGcal} disabled={!gcalId.trim()}
              style={btn({ width: "100%", flex: "none", background: gcalId.trim() ? `${AM}18` : GL, borderColor: gcalId.trim() ? `${AM}44` : BD, color: gcalId.trim() ? AM : T3, fontWeight: 700, marginBottom: 8 })}>
              Connect Google Calendar
            </button>
          </>
        )}
        {gcalMsg && <div style={{ fontSize: 12, color: gcalMsg.tone, marginBottom: 8, lineHeight: 1.5 }}>{gcalMsg.text}</div>}

        <div style={{ height: 1, background: BD, margin: "16px 0" }} />

        <div style={{ fontSize: 11, color: CY, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>App Lock</div>
        <div style={{ fontSize: 12, color: T3, lineHeight: 1.6, marginBottom: 12 }}>
          Asks for a PIN whenever the app opens (and after 5+ minutes in the background). It's a privacy screen for this device only — a PIN set here never locks your other devices, and only a salted hash is stored, never the PIN.
        </div>
        {!lockOn ? (
          <>
            <input type="password" inputMode="numeric" value={pinA} onChange={(e) => setPinA(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="New PIN (4–8 digits)" aria-label="New PIN" style={inputStyle} />
            <input type="password" inputMode="numeric" value={pinB} onChange={(e) => setPinB(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Confirm PIN" aria-label="Confirm PIN" style={inputStyle} />
            <button onClick={enableLock} disabled={pinA.length < 4}
              style={btn({ width: "100%", flex: "none", background: pinA.length >= 4 ? `${CY}18` : GL, borderColor: pinA.length >= 4 ? `${CY}44` : BD, color: pinA.length >= 4 ? CY : T3, fontWeight: 700, marginBottom: 8 })}>
              Enable App Lock
            </button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: GR }} />
              <span style={{ fontSize: 12, color: T2 }}>App lock is on for this device.</span>
            </div>
            <input type="password" inputMode="numeric" value={pinCur} onChange={(e) => setPinCur(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Current PIN" aria-label="Current PIN" style={inputStyle} />
            <input type="password" inputMode="numeric" value={pinA} onChange={(e) => setPinA(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="New PIN (leave empty to keep)" aria-label="New PIN" style={inputStyle} />
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button onClick={changeLock} disabled={pinCur.length < 4 || pinA.length < 4} style={btn({ color: pinCur.length >= 4 && pinA.length >= 4 ? CY : T3 })}>Change PIN</button>
              <button onClick={disableLock} disabled={pinCur.length < 4} style={btn({ color: pinCur.length >= 4 ? RE : T3 })}>Disable lock</button>
            </div>
          </>
        )}
        {lockMsg && <div style={{ fontSize: 12, color: lockMsg.tone, marginBottom: 8, lineHeight: 1.5 }}>{lockMsg.text}</div>}

        <div style={{ height: 1, background: BD, margin: "16px 0" }} />

        <div style={{ fontSize: 11, color: GR, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Your Data</div>
        <div style={{ fontSize: 12, color: T3, lineHeight: 1.6, marginBottom: 12 }}>
          {getSyncConfig() ? "Synced to your cloud project and stored on this device." : "Everything is stored on this device."} Export a backup regularly — clearing browser data would otherwise erase your trades, workouts, finances and journal.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button onClick={exportData} style={btn({ borderColor: `${GR}44`, color: GR })}><Download size={13} />Export backup</button>
          <button onClick={() => fileRef.current?.click()} style={btn({ borderColor: `${CY}44`, color: CY })}><Upload size={13} />Import backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ""; }} />
        </div>
        {dataMsg && <div style={{ fontSize: 12, color: dataMsg.tone, marginBottom: 8, lineHeight: 1.5 }}>{dataMsg.text}</div>}

        {/* Legacy trade data left over from before the Trading Intelligence
            rebuild. The new journal (The Firm → Trading) starts fresh; these old
            trades only still surface in the Firm's Doctrine → Fleet view. */}
        {!armLegacy ? (
          <button onClick={() => setArmLegacy(true)} style={btn({ width: "100%", flex: "none", borderColor: `${AM}33`, color: AM })}>
            Clear legacy trade journal…
          </button>
        ) : (
          <div style={{ padding: "12px", background: `${AM}0D`, border: `1px solid ${AM}33`, borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: T2, lineHeight: 1.55, marginBottom: 10 }}>
              Removes old trades from the pre-rebuild journal (the ones still showing in the Firm's Doctrine → Fleet view). Your new Trading journal, accounts and everything else are untouched.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={clearLegacyTrades} style={btn({ background: `${AM}22`, borderColor: `${AM}66`, color: AM, fontWeight: 700 })}>Clear legacy trades</button>
              <button onClick={() => setArmLegacy(false)} style={btn({})}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{ height: 1, background: BD, margin: "16px 0" }} />

        <div style={{ fontSize: 11, color: RE, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Danger Zone</div>
        {!armErase ? (
          <button onClick={() => setArmErase(true)} style={btn({ width: "100%", flex: "none", borderColor: `${RE}33`, color: RE })}>
            <ShieldAlert size={13} />Erase all data on this device…
          </button>
        ) : (
          <div style={{ padding: "12px", background: `${RE}0D`, border: `1px solid ${RE}33`, borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: T2, lineHeight: 1.55, marginBottom: 10 }}>
              This permanently deletes every trade, workout, goal and journal entry on this device. Export a backup first.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={eraseAll} style={btn({ background: `${RE}22`, borderColor: `${RE}66`, color: RE, fontWeight: 700 })}>Yes, erase everything</button>
              <button onClick={() => setArmErase(false)} style={btn({})}>Keep my data</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
