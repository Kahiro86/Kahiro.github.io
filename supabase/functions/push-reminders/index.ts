// ── push-reminders — Supabase Edge Function ──────────────────────────
// Delivers Kahiro reminders to closed apps. Runs on a schedule (pg_cron,
// every minute). For each stored push subscription it reads that user's
// synced `push_queue` (the client precomputes upcoming reminder
// occurrences), sends any that just came due via Web Push, and records
// what was sent so nothing fires twice. Expired subscriptions are pruned.
//
// Deploy + schedule instructions: see docs/PUSH.md.
//
// Required function secrets (supabase secrets set …):
//   VAPID_PUBLIC   — your VAPID public key
//   VAPID_PRIVATE  — your VAPID private key
//   VAPID_SUBJECT  — a contact URL or "mailto:you@example.com"
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const WINDOW_MS = 6 * 60 * 1000; // deliver occurrences due within the last 6 min

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const vapidPublic = Deno.env.get("VAPID_PUBLIC");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
  if (!vapidPublic || !vapidPrivate) {
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), { status: 500 });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const db = createClient(url, serviceKey);
  const now = Date.now();
  let sent = 0, pruned = 0;

  const { data: subs, error: subErr } = await db.from("push_subscriptions").select("user_id, endpoint, subscription");
  if (subErr) return new Response(JSON.stringify({ error: subErr.message }), { status: 500 });

  // Group subscriptions by user so each user's queue is read once.
  const byUser = new Map<string, { endpoint: string; subscription: unknown }[]>();
  for (const s of subs ?? []) {
    const list = byUser.get(s.user_id) ?? [];
    list.push({ endpoint: s.endpoint, subscription: s.subscription });
    byUser.set(s.user_id, list);
  }

  for (const [userId, userSubs] of byUser) {
    const { data: kvRow } = await db.from("kv").select("value").eq("user_id", userId).eq("key", "architect:push_queue").maybeSingle();
    const queue = Array.isArray(kvRow?.value) ? kvRow!.value : [];
    const due = queue.filter((q: { at?: number }) => typeof q?.at === "number" && q.at <= now && q.at > now - WINDOW_MS);
    if (!due.length) continue;

    for (const item of due) {
      const occKey = String(item.occKey ?? `${item.at}`);
      // Skip if already delivered to this user (any device).
      const { data: already } = await db.from("push_sent").select("occ_key").eq("user_id", userId).eq("occ_key", occKey).maybeSingle();
      if (already) continue;

      const payload = JSON.stringify({ title: item.title || "Kahiro", body: item.body || "", url: item.url || "./", tag: occKey });
      let delivered = false;
      for (const s of userSubs) {
        try {
          await webpush.sendNotification(s.subscription as webpush.PushSubscription, payload);
          delivered = true;
        } catch (err) {
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) { await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint); pruned++; }
        }
      }
      if (delivered) { await db.from("push_sent").insert({ user_id: userId, occ_key: occKey }); sent++; }
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, pruned }), { headers: { "content-type": "application/json" } });
});
