// ── Motive Push card — the calm mentor, one line at a time ───────────
// A minimal, never-interrupting card that surfaces a single contextual
// motivational line. Fade/slide in (reused global `fadeIn` keyframe, re-keyed
// on the line's id so it replays on refresh), a refresh button for another
// push, a favourite toggle, and a small history peek. Storage (favourites /
// recent / history) lives here via useStorageState so it syncs like the rest
// of the app; the library and selection logic live in motivePush.js.
import { useEffect, useRef, useState } from "react";
import { Sparkles, RefreshCw, Star, Clock } from "lucide-react";
import { AC, AC2, T1, T2, T3, BD, GL } from "./designTokens.js";
import { useStorageState } from "./useStorageState.js";
import { pickPush, pushRecent, pushById } from "./motivePush.js";

export function MotivePush({ context = "general", state, accent = AC, compact = false, style }) {
  const [favs, setFavs, favLoaded] = useStorageState("motive_favs", []);
  const [recent, setRecent, recLoaded] = useStorageState("motive_recent", []);
  const [history, setHistory, histLoaded] = useStorageState("motive_history", []);
  const loaded = favLoaded && recLoaded && histLoaded;
  const [push, setPush] = useState(null);
  const [showHist, setShowHist] = useState(false);

  const recentRef = useRef(recent); recentRef.current = Array.isArray(recent) ? recent : [];
  const favsRef = useRef(favs); favsRef.current = Array.isArray(favs) ? favs : [];

  const ctxKey = Array.isArray(context) ? context.join(",") : String(context);
  const stateSig = state ? JSON.stringify(state) : "";

  const emit = (avoid = []) => {
    const p = pickPush(context, { state: state || {}, recent: recentRef.current, favs: favsRef.current, avoid });
    if (!p) return;
    setPush(p);
    setRecent((r) => pushRecent(r, p.id));
    setHistory((h) => [{ id: p.id, at: Date.now() }, ...(Array.isArray(h) ? h : []).filter((x) => x && x.id !== p.id)].slice(0, 50));
  };

  // Pick on load, and re-pick when the surface's context or state signature
  // changes (navigating modules, crossing a streak milestone, etc.).
  useEffect(() => { if (loaded) emit(); }, [loaded, ctxKey, stateSig]); // eslint-disable-line

  if (!push) return null;
  const isFav = favsRef.current.includes(push.id);
  const toggleFav = () => setFavs((f) => { const a = Array.isArray(f) ? f : []; return a.includes(push.id) ? a.filter((x) => x !== push.id) : [push.id, ...a]; });
  const favTexts = favsRef.current.map(pushById).filter(Boolean).slice(0, 12);
  const histTexts = (Array.isArray(history) ? history : []).map((h) => pushById(h?.id)).filter(Boolean).slice(0, 10);

  const iconBtn = { display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 8, border: `1px solid ${BD}`, background: GL, cursor: "pointer", flexShrink: 0 };

  return (
    <div style={{ position: "relative", borderRadius: 13, border: `1px solid ${accent}2E`, background: `linear-gradient(135deg, ${accent}12, ${accent}05)`, padding: compact ? "12px 14px" : "15px 17px", overflow: "hidden", ...style }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accent, opacity: 0.7 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
        <Sparkles size={12} color={accent} />
        <span style={{ fontSize: 8.5, letterSpacing: 1.6, textTransform: "uppercase", color: accent, fontWeight: 700 }}>Motive Push</span>
        <span style={{ fontSize: 8.5, letterSpacing: 0.6, textTransform: "uppercase", color: T3 }}>· {push.cat}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowHist((s) => !s)} aria-label="History" title="Recent & favourites" style={{ ...iconBtn, color: showHist ? accent : T3 }}><Clock size={13} /></button>
        <button onClick={toggleFav} aria-label={isFav ? "Unfavourite" : "Favourite"} title="Favourite" style={{ ...iconBtn, color: isFav ? AC2 : T3 }}><Star size={13} fill={isFav ? "currentColor" : "none"} /></button>
        <button onClick={() => emit([push.id])} aria-label="Another push" title="Another push" style={{ ...iconBtn, color: T2 }}><RefreshCw size={13} /></button>
      </div>
      <div key={push.id} style={{ fontSize: compact ? 13 : 14.5, lineHeight: 1.5, color: T1, fontWeight: 600, animation: "fadeIn 0.4s ease" }}>
        {push.text}
      </div>

      {showHist && (histTexts.length > 0 || favTexts.length > 0) && (
        <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${BD}`, display: "flex", flexDirection: "column", gap: 10 }}>
          {favTexts.length > 0 && (
            <div>
              <div style={{ fontSize: 8.5, letterSpacing: 1, textTransform: "uppercase", color: T3, marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}><Star size={9} /> Favourites</div>
              {favTexts.map((p) => <div key={p.id} style={{ fontSize: 11.5, color: T2, lineHeight: 1.5, padding: "2px 0" }}>{p.text}</div>)}
            </div>
          )}
          {histTexts.length > 0 && (
            <div>
              <div style={{ fontSize: 8.5, letterSpacing: 1, textTransform: "uppercase", color: T3, marginBottom: 5 }}>Recently shown</div>
              {histTexts.map((p, i) => <div key={`${p.id}-${i}`} style={{ fontSize: 11.5, color: T3, lineHeight: 1.5, padding: "2px 0" }}>{p.text}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
