// ── Notification ticker ──────────────────────────────────────────────
// Always mounted; checks every 30s (and on tab-return, which also covers
// waking after the device slept or the app was offline) for reminder
// occurrences that should fire. Firing = append to the synced log (the
// occurrence key makes this idempotent across devices), toast in-app, and
// — when enabled and permitted — a browser Notification. Escalation
// re-alerts unhandled entries at 30/60/120 minutes.
import { useEffect, useRef } from "react";
import { useStorageState } from "./useStorageState.js";
import { useToast } from "./toast.jsx";
import {
  sanitizeReminders, sanitizeNotifLog, sanitizePrefs, dueToFire,
  newLogEntry, systemLogEntry, escalationDue, catEnabled,
} from "./notify.js";
import { ACHIEVEMENTS, sanitizeUnlocked } from "./xpEngine.js";

const browserNotify = (title, body) => {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, icon: "icon-192.png", tag: title });
    }
  } catch { /* notifications are best-effort */ }
};

export function NotifTicker() {
  const [rawRems] = useStorageState("notif_reminders", []);
  const [rawLog, setLog, logLoaded] = useStorageState("notif_log", []);
  const [rawPrefs] = useStorageState("notif_prefs", null);
  const [rawUnlocked] = useStorageState("xp_achievements", {});
  const toast = useToast();
  const busy = useRef(false);

  useEffect(() => {
    if (!logLoaded) return;
    const tick = () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const rems = sanitizeReminders(rawRems);
        const log = sanitizeNotifLog(rawLog);
        const prefs = sanitizePrefs(rawPrefs);
        const now = Date.now();
        const additions = [];

        // 1. Reminder occurrences due to fire (idempotent by occKey).
        for (const { rem, occKey } of dueToFire(rems, log, prefs)) {
          additions.push(newLogEntry(rem, occKey, now));
          if (rem.priority !== "silent") {
            toast(`${rem.icon} ${rem.title}`, { tone: rem.priority === "critical" ? "danger" : rem.priority === "high" ? "info" : "success", duration: 6000 });
            if (prefs.browser) browserNotify(rem.title, rem.desc || "Reminder");
          }
        }

        // 2. Achievement unlocks → history entries (celebration toast is
        //    XPCelebration's job; this is the permanent record).
        const unlocked = sanitizeUnlocked(rawUnlocked);
        const logged = new Set(log.map((e) => e.occKey).filter(Boolean));
        for (const [id, date] of Object.entries(unlocked)) {
          const key = `ach@${id}`;
          if (logged.has(key)) continue;
          const a = ACHIEVEMENTS.find((x) => x.id === id);
          if (a && catEnabled(prefs, "achievements")) {
            additions.push({ ...systemLogEntry({ title: `Achievement unlocked: ${a.name}`, cat: "achievements", icon: a.icon, priority: "low", occKey: key }), firedAt: now, state: "read", doneAt: null });
          }
        }

        // 3. Escalation: bump unhandled entries at 30/60/120 min and re-alert.
        // Toasts fire from this snapshot; the store write recomputes from
        // prev so a concurrent update can never be clobbered.
        let anyEscalation = false;
        if (prefs.escalation) {
          for (const e of log) {
            const due = escalationDue(e, now);
            if (e.remId && due > e.esc && e.state !== "done" && e.state !== "dismissed") {
              anyEscalation = true;
              if (e.priority !== "silent") {
                toast(`${e.icon} Still open: ${e.title}${due >= 3 ? " — now overdue" : ""}`, { tone: due >= 3 ? "danger" : "info", duration: 6000 });
                if (prefs.browser) browserNotify(`Still open: ${e.title}`, due >= 3 ? "Marked overdue" : "Reminder");
              }
            }
          }
        }

        if (additions.length || anyEscalation) {
          setLog((prev) => {
            let clean = sanitizeNotifLog(prev);
            if (prefs.escalation) {
              clean = clean.map((e) => {
                const due = escalationDue(e, now);
                return e.remId && due > e.esc && e.state !== "done" && e.state !== "dismissed" ? { ...e, esc: due } : e;
              });
            }
            return sanitizeNotifLog([...additions, ...clean]);
          });
        }
      } finally { busy.current = false; }
    };

    tick();
    const iv = setInterval(tick, 30000);
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [rawRems, rawLog, rawPrefs, rawUnlocked, logLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
