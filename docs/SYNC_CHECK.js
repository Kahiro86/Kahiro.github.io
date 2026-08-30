// ── Kahiro sync check (console version) ──────────────────────────────
// THIS IS THE FALLBACK. The check is now in the app: Settings → Cloud sync →
// "Sync check", which is the only version that can be run on a phone, since
// a phone browser has no console — and "my phone is behind" is exactly the
// case that has to be diagnosed on the phone.
//
// Keep this one for a device running an older build, or for reading the raw
// numbers next to the app's own answer. Paste the whole thing into the
// browser console with the app open.
//
// It is READ-ONLY. It writes nothing, pushes nothing, and prints no keys,
// tokens or personal content — only counts, ids and timestamps, so the output
// is safe to share.
(async () => {
  const P = "architect:";
  const out = (l, v) => console.log(`  ${String(l).padEnd(26)} ${v}`);
  const CHECK = ["ht_habits", "ht_entries", "gym_routines", "gym_sessions", "nutrition_log"];

  console.log("\n═══ KAHIRO SYNC CHECK ═══");
  console.log(`  ${new Date().toISOString()}  ·  ${navigator.userAgent.slice(0, 60)}`);

  // 1. Is sync even switched on for THIS device? The project URL and anon key
  //    live per-device on purpose and are never synced — so a device you never
  //    pasted them into is simply a local-only app, working exactly as built.
  console.log("\n1. Is this device configured at all?");
  let cfg = null;
  try { cfg = JSON.parse(localStorage.getItem("architect_sync")); } catch { /* malformed */ }
  out("sync configured", cfg?.url ? `yes · ${String(cfg.url).replace(/^https?:\/\//, "").slice(0, 28)}` : "NO — this is the answer");
  if (!cfg?.url) {
    console.log("\n  → Settings → Cloud sync: paste the project URL and anon key, then sign in.");
    return;
  }

  // 2. Signed in? Configured but signed out syncs nothing, silently.
  console.log("\n2. Is this device signed in?");
  const authKey = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
  let token = null, user = null;
  try {
    const sess = JSON.parse(localStorage.getItem(authKey));
    token = sess?.access_token; user = sess?.user?.id;
  } catch { /* none */ }
  out("signed in", token ? "yes" : "NO — this is the answer");
  out("user id", user ? `${user.slice(0, 8)}…` : "—");
  if (!token) { console.log("\n  → Settings → Cloud sync → sign in with the same email on both devices."); return; }

  // 3. What is actually on disk here, and when did this device last touch it?
  console.log("\n3. This device");
  let meta = {};
  try { meta = JSON.parse(localStorage.getItem("architect_meta")) || {}; } catch { /* none */ }
  const localCount = (k) => {
    try {
      const v = JSON.parse(localStorage.getItem(P + k));
      return Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : v == null ? "—" : 1;
    } catch { return "corrupt"; }
  };
  for (const k of CHECK) out(k, `${String(localCount(k)).padStart(5)} items   last written ${meta[k] || "never"}`);

  // 4. What the cloud holds. Read straight through PostgREST so the answer
  //    does not depend on the app's own sync code being right.
  console.log("\n4. The cloud");
  const res = await fetch(`${cfg.url.replace(/\/+$/, "")}/rest/v1/kv?select=key,value,updated_at`, {
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    out("read failed", `HTTP ${res.status} — ${(await res.text()).slice(0, 120)}`);
    console.log("\n  → 401/403 means the session expired: sign out and back in.");
    console.log("  → 404 means the kv table is missing: run supabase/migrations/0002_kv.sql.");
    return;
  }
  const rows = await res.json();
  out("rows visible", rows.length);
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  for (const k of CHECK) {
    const r = byKey[k];
    const n = !r ? "—" : Array.isArray(r.value) ? r.value.length : r.value && typeof r.value === "object" ? Object.keys(r.value).length : 1;
    out(k, `${String(n).padStart(5)} items   cloud updated ${r?.updated_at || "never pushed"}`);
  }

  // 5. The verdict per store. "Cloud is behind" on the device that has the
  //    data means this device never pushed; "device is behind" on the other
  //    means it never pulled. Both point at different fixes.
  console.log("\n5. Verdict");
  for (const k of CHECK) {
    const r = byKey[k];
    const lt = Date.parse(meta[k] || "") || 0;
    const rt = Date.parse(r?.updated_at || "") || 0;
    const ln = localCount(k), rn = !r ? "—" : Array.isArray(r.value) ? r.value.length : r.value && typeof r.value === "object" ? Object.keys(r.value).length : 1;
    let verdict;
    if (!r) verdict = "never pushed from any device";
    else if (ln === rn) verdict = "in step";
    else if (lt > rt) verdict = `this device is AHEAD (${ln} here vs ${rn} in the cloud) — it has not pushed`;
    else verdict = `this device is BEHIND (${ln} here vs ${rn} in the cloud) — it has not pulled`;
    out(k, verdict);
  }

  // 6. Anything stuck in the outbound queue is the clearest single signal.
  console.log("\n6. Pending");
  let dirty = [];
  try { dirty = JSON.parse(localStorage.getItem("architect_dirty")) || []; } catch { /* none */ }
  out("waiting to push", dirty.length ? dirty.join(", ") : "nothing");
  if (dirty.length) console.log("\n  → Stuck here means the push is failing. Settings → Cloud sync shows the error.");
  console.log("\n═════════════════════════\n");
})();
