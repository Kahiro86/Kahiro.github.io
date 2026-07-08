// ── Google Calendar (read-only agenda) ──────────────────────────────
// Pure client-side via Google Identity Services: the user creates an OAuth
// Client ID in their own Google Cloud project (Settings shows how), grants
// calendar.readonly, and the Command Center agenda reads today's events.
// No server, no stored refresh tokens — GIS issues short-lived access
// tokens; we silently re-request while the Google session is alive.
const CFG_KEY = "kahiro_gcal"; // { clientId } — device-local, never synced
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

export function getGcalConfig() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY)) || null; } catch { return null; }
}
export function setGcalConfig(cfg) {
  if (cfg) localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  else localStorage.removeItem(CFG_KEY);
  token = null;
}

let token = null; // { access_token, expiresAt }
let gisReady = null;

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisReady) return gisReady;
  gisReady = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Couldn't load Google sign-in — check your connection."));
    document.head.appendChild(s);
  });
  return gisReady;
}

// interactive=true opens the Google consent popup (call from a click);
// interactive=false tries a silent refresh and fails quietly.
export async function getToken(interactive) {
  const cfg = getGcalConfig();
  if (!cfg?.clientId) throw new Error("no-config");
  if (token && token.expiresAt > Date.now() + 60000) return token.access_token;
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: cfg.clientId,
      scope: SCOPE,
      callback: (res) => {
        if (res.error) return reject(new Error(res.error));
        token = { access_token: res.access_token, expiresAt: Date.now() + (res.expires_in || 3600) * 1000 };
        resolve(token.access_token);
      },
      error_callback: (err) => reject(new Error(err?.type || "consent-needed")),
    });
    client.requestAccessToken({ prompt: interactive ? "consent" : "" });
  });
}

export const isGcalConnected = () => !!getGcalConfig() && !!token;

// Today's events from the primary calendar, soonest first.
export async function todaysEvents(interactive = false) {
  const access = await getToken(interactive);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=${start.toISOString()}&timeMax=${end.toISOString()}&maxResults=8`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${access}` } });
  if (!res.ok) throw new Error(`Calendar request failed (HTTP ${res.status})`);
  const data = await res.json();
  return (data.items || []).map((e) => ({
    id: e.id,
    title: e.summary || "(untitled)",
    allDay: !e.start?.dateTime,
    start: e.start?.dateTime || e.start?.date,
    time: e.start?.dateTime
      ? new Date(e.start.dateTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : "All day",
  }));
}
