// ── Sync and backup ──────────────────────────────────────────────────
// Everything to do with getting this app's data off this device: an
// optional Supabase connection, and a plain JSON export for when you
// would rather not have one.
//
// Sync is off until a project is pasted in here, and the app is fully
// usable that way — this panel is the only thing in the build that knows
// the cloud exists.
import { useEffect, useRef, useState } from "react";
import { Cloud, CloudOff, Check, X, Download, Upload, RefreshCw, LogOut } from "lucide-react";
import { B1, B2, BD, T1, T2, T3, AC, AC2, GR, AM, RE, SANS, MONO } from "../ui/tokens.js";
import { Fld, Inp } from "../ui/primitives.jsx";
import { exportAll, importAll } from "../ui/useStore.js";
import {
  getSyncConfig, saveSyncConfig, testConnection, signIn, signUp, signOut,
  resetPassword, getSession,
} from "../sync/supabase.js";
import { getSyncStatus, onSyncStatus, onAuthChanged, pull, flush, disconnect } from "../sync/sync.js";

const TONE = {
  live: GR, idle: GR, syncing: AM, auth: AM, offline: AM, error: RE, off: T3,
};
const WORDS = {
  live: "Live — changes appear on your other devices within a second or two.",
  idle: "Synced. The live connection is down, so it is polling instead.",
  syncing: "Syncing…",
  auth: "Connected to the project. Sign in to start syncing.",
  offline: "Offline. Everything still works; changes go up when you reconnect.",
  error: "Sync error.",
  off: "Sync is off. Everything is stored on this device only.",
};

export const SQL = `-- Run once in your Supabase project: SQL Editor -> New query.
create table if not exists public.pnp_kv (
  user_id    uuid        not null references auth.users on delete cascade,
  key        text        not null,
  value      jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.pnp_kv enable row level security;

-- Each signed-in user reaches their own rows and no one else's. This is
-- what makes it safe for the anon key to be public in the page source.
create policy "own rows" on public.pnp_kv
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Optional: lets other devices update within a second instead of waiting
-- for the next poll.
alter publication supabase_realtime add table public.pnp_kv;`;

const box = { background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: 12 };
const btn = (extra = {}) => ({
  display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px",
  background: B2, border: `1px solid ${BD}`, borderRadius: 6, color: T1,
  font: `600 11.5px ${SANS}`, cursor: "pointer", ...extra,
});

export function SyncPanel({ onClose }) {
  const [cfg, setCfg] = useState(() => getSyncConfig());
  const [url, setUrl] = useState(cfg?.url || "");
  const [key, setKey] = useState(cfg?.anonKey || "");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [session, setSession] = useState(null);
  const [st, setSt] = useState(getSyncStatus());
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => onSyncStatus(setSt), []);
  useEffect(() => { if (cfg) getSession().then(setSession).catch(() => setSession(null)); }, [cfg]);

  const say = (text, tone = T2) => setMsg({ text, tone });
  const run = async (fn) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) { say(e?.message || String(e), RE); } finally { setBusy(false); }
  };

  const saveProject = () => run(async () => {
    const next = { url: url.trim().replace(/\/+$/, ""), anonKey: key.trim() };
    if (!next.url || !next.anonKey) throw new Error("Both the project URL and the anon key are needed.");
    await testConnection(next);
    saveSyncConfig(next);
    setCfg(next);
    say("Project connected. Sign in next.", GR);
  });

  const doSignIn = () => run(async () => {
    await signIn(email.trim(), pw);
    setSession(await getSession());
    setPw("");
    await onAuthChanged(true);
    say("Signed in. Your trades are syncing.", GR);
  });

  const doSignUp = () => run(async () => {
    const { session: s } = await signUp(email.trim(), pw);
    setPw("");
    if (!s) return say("Account created. Confirm the email Supabase just sent, then sign in.", AM);
    setSession(await getSession());
    await onAuthChanged(true);
    say("Account created and signed in.", GR);
  });

  const doSignOut = () => run(async () => {
    await signOut();
    setSession(null);
    await onAuthChanged(false);
    say("Signed out. Your data is still here on this device.", T2);
  });

  const doForget = () => run(async () => {
    await signOut().catch(() => {});
    disconnect();
    saveSyncConfig(null);
    setCfg(null); setSession(null); setUrl(""); setKey("");
    say("Disconnected. Nothing was deleted — this device just stopped syncing.", T2);
  });

  const doExport = () => {
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `press-n-play-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const doImport = (file) => run(async () => {
    const written = importAll(JSON.parse(await file.text()));
    say(`Restored ${written.length} record set${written.length === 1 ? "" : "s"}. Reloading…`, GR);
    setTimeout(() => window.location.reload(), 700);
  });

  const tone = TONE[st.status] || T3;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.62)",
        display: "flex", justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-label="Sync and backup"
        style={{
          width: "min(440px, 100%)", height: "100%", overflowY: "auto",
          background: B1, borderLeft: `1px solid ${BD}`, padding: "18px 20px 40px",
          display: "flex", flexDirection: "column", gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 800, letterSpacing: 1.2, color: AC2 }}>
            SYNC &amp; BACKUP
          </span>
          <button onClick={onClose} aria-label="Close" style={btn({ marginLeft: "auto", padding: 6 })}>
            <X size={14} />
          </button>
        </div>

        <div style={{ ...box, display: "flex", gap: 9, alignItems: "flex-start" }}>
          <span style={{ width: 8, height: 8, borderRadius: 8, background: tone, marginTop: 4, flexShrink: 0 }} />
          <div style={{ fontSize: 11.5, color: T2, lineHeight: 1.55 }}>
            {WORDS[st.status] || st.status}
            {st.status === "error" && st.lastError && (
              <div style={{ color: RE, marginTop: 4 }}>{st.lastError}</div>
            )}
            {st.lastSyncAt && (
              <div style={{ color: T3, marginTop: 4, fontFamily: MONO, fontSize: 10.5 }}>
                last sync {new Date(st.lastSyncAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {!cfg && (
          <div style={{ ...box, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 11.5, color: T2, lineHeight: 1.6 }}>
              Sync needs a Supabase project of your own — the free tier is far
              more than this app will ever use. Create one, run the SQL below in
              its SQL editor, then paste the project URL and the <em>anon public</em> key
              from Settings → API.
            </div>
            <Fld label="Project URL">
              <Inp value={url} onChange={setUrl} placeholder="https://xxxx.supabase.co" mono />
            </Fld>
            <Fld label="Anon public key">
              <Inp value={key} onChange={setKey} placeholder="eyJhbGciOi…" mono />
            </Fld>
            <div style={{ fontSize: 10.5, color: T3, lineHeight: 1.55, marginTop: -8 }}>
              The anon key is meant to be public and is safe to paste here. It
              grants nothing without a signed-in session — the row-level policy
              in the SQL is what keeps your trades yours.
            </div>
            <button onClick={saveProject} disabled={busy} style={btn({ borderColor: AC, color: AC, alignSelf: "flex-start" })}>
              <Cloud size={13} /> Test and connect
            </button>
            <details>
              <summary style={{ fontSize: 11, color: T3, cursor: "pointer" }}>The SQL to run first</summary>
              <pre style={{
                marginTop: 8, padding: 10, background: "#000", border: `1px solid ${BD}`,
                borderRadius: 6, fontSize: 10, lineHeight: 1.5, color: T2,
                fontFamily: MONO, overflowX: "auto", whiteSpace: "pre",
              }}>{SQL}</pre>
            </details>
          </div>
        )}

        {cfg && !session && (
          <div style={{ ...box, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 11, color: T3, fontFamily: MONO, wordBreak: "break-all" }}>{cfg.url}</div>
            <Fld label="Email"><Inp value={email} onChange={setEmail} placeholder="you@example.com" /></Fld>
            <Fld label="Password"><Inp value={pw} onChange={setPw} type="password" placeholder="••••••••" /></Fld>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={doSignIn} disabled={busy} style={btn({ borderColor: AC, color: AC })}>Sign in</button>
              <button onClick={doSignUp} disabled={busy} style={btn()}>Create account</button>
              <button onClick={() => run(() => resetPassword(email.trim()).then(() => say("Reset email sent.", GR)))}
                disabled={busy} style={btn({ color: T3 })}>Reset password</button>
            </div>
            <button onClick={doForget} disabled={busy} style={btn({ color: T3, alignSelf: "flex-start" })}>
              <CloudOff size={13} /> Forget this project
            </button>
          </div>
        )}

        {cfg && session && (
          <div style={{ ...box, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 11.5, color: T2, display: "flex", alignItems: "center", gap: 6 }}>
              <Check size={13} color={GR} /> {session.user?.email}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => run(async () => { await pull(); await flush(); say("Synced.", GR); })}
                disabled={busy} style={btn({ borderColor: AC, color: AC })}>
                <RefreshCw size={13} /> Sync now
              </button>
              <button onClick={doSignOut} disabled={busy} style={btn()}><LogOut size={13} /> Sign out</button>
              <button onClick={doForget} disabled={busy} style={btn({ color: T3 })}>
                <CloudOff size={13} /> Disconnect
              </button>
            </div>
          </div>
        )}

        <div style={{ ...box, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11.5, color: T2, lineHeight: 1.55 }}>
            A backup file works with sync off, and is the only copy that does
            not depend on anyone else's servers staying up.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={doExport} style={btn()}><Download size={13} /> Export a backup</button>
            <button onClick={() => fileRef.current?.click()} style={btn()}><Upload size={13} /> Restore from file</button>
            <input
              ref={fileRef} type="file" accept="application/json,.json" hidden
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) doImport(f); }}
            />
          </div>
          <div style={{ fontSize: 10.5, color: T3, lineHeight: 1.5 }}>
            Restoring replaces what is on this device with the file's contents.
          </div>
        </div>

        {msg && (
          <div style={{ fontSize: 11.5, color: msg.tone, lineHeight: 1.55 }}>{msg.text}</div>
        )}
      </div>
    </div>
  );
}
