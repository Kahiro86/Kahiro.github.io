// ── Web Push — closed-app notifications ──────────────────────────────
// The service worker (public/sw.js) shows notifications the server sends
// even when the app is fully closed. This module is the client half:
//   · subscribe/unsubscribe the browser to push, storing the subscription
//     in the user's own Supabase (push_subscriptions), and
//   · keep a synced `push_queue` of upcoming reminder occurrences the
//     Supabase Edge Function delivers when they come due.
// The VAPID public key is the user's (generated during setup) and pasted in
// Settings — kept device-local like the sync config, never synced/exported.
import { useEffect, useRef } from "react";
import { useStorageState } from "./useStorageState.js";
import { sanitizeReminders, sanitizePrefs, buildPushQueue } from "./notify.js";
import { supabase, getSession } from "./supabase.js";

const VAPID_KEY = "architect_push_vapid"; // outside the synced PREFIX

export const getPushVapid = () => { try { return localStorage.getItem(VAPID_KEY) || ""; } catch { return ""; } };
export const setPushVapid = (k) => { try { const v = (k || "").trim(); v ? localStorage.setItem(VAPID_KEY, v) : localStorage.removeItem(VAPID_KEY); } catch { /* quota */ } };

export const pushSupported = () =>
  typeof navigator !== "undefined" && "serviceWorker" in navigator &&
  typeof window !== "undefined" && "PushManager" in window && typeof Notification !== "undefined";

function urlB64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const norm = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(norm);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function pushStatus() {
  if (!pushSupported()) return { supported: false, permission: "unsupported", subscribed: false };
  let subscribed = false;
  try { const reg = await navigator.serviceWorker.ready; subscribed = !!(await reg.pushManager.getSubscription()); } catch { /* not ready */ }
  return { supported: true, permission: Notification.permission, subscribed };
}

export async function subscribeToPush() {
  if (!pushSupported()) throw new Error("This browser doesn't support push notifications.");
  const vapid = getPushVapid();
  if (!vapid) throw new Error("Add your VAPID public key first — see the setup guide.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notifications are blocked. Allow them for this site in your browser, then try again.");
  const client = supabase();
  const session = await getSession();
  if (!client || !session?.user) throw new Error("Turn on cloud sync and sign in first — the server needs somewhere to send.");
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(vapid) });
  const { error } = await client.from("push_subscriptions").upsert(
    { user_id: session.user.id, endpoint: sub.endpoint, subscription: sub.toJSON(), updated_at: new Date().toISOString() },
    { onConflict: "user_id,endpoint" },
  );
  if (error) throw new Error(`Couldn't save the subscription: ${error.message}`);
  return true;
}

export async function unsubscribeFromPush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  try { await sub.unsubscribe(); } catch { /* best effort */ }
  const client = supabase();
  const session = await getSession();
  if (client && session?.user) await client.from("push_subscriptions").delete().eq("user_id", session.user.id).eq("endpoint", endpoint);
}

// A device-local test that the SW + permission work end-to-end on this
// device (does not exercise the server path — that's covered by the guide).
export async function sendLocalTestNotification() {
  if (!pushSupported() || Notification.permission !== "granted") throw new Error("Enable notifications first.");
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification("Kahiro", { body: "Test notification — this device is set up correctly.", icon: "icon-192.png", tag: "kahiro-test" });
}

// Keep `push_queue` fresh whenever the app is open, but only once the user
// has actually set push up (a VAPID key present) — no point syncing an extra
// key for everyone else. Regenerates on reminder/pref changes and hourly so
// the rolling 7-day horizon stays ahead of the server.
export function usePushQueueSync() {
  const [rawRems, , l1] = useStorageState("notif_reminders", []);
  const [rawPrefs] = useStorageState("notif_prefs", null);
  const [, setQueue, l2] = useStorageState("push_queue", []);
  const last = useRef(null);

  useEffect(() => {
    if (!l1 || !l2 || !getPushVapid()) return;
    const regen = () => {
      const q = buildPushQueue(sanitizeReminders(rawRems), sanitizePrefs(rawPrefs), new Date());
      const sig = JSON.stringify(q);
      if (sig !== last.current) { last.current = sig; setQueue(q); }
    };
    regen();
    const t = setInterval(regen, 3600000);
    return () => clearInterval(t);
  }, [rawRems, rawPrefs, l1, l2, setQueue]);
}
