// ── Help Centre — the searchable manual ──────────────────────────────
// A modal library: search everything, browse by category, read an article.
// Also the home for replaying the app tour and toggling Help Mode.
import { useState, useEffect, useMemo } from "react";
import { X, Search, ChevronRight, PlayCircle, HelpCircle, ArrowLeft, Check } from "lucide-react";
import { B0, B1, BD, T1, T2, T3, GL, CY, PU, GR } from "./designTokens.js";
import { HELP_CATEGORIES, HELP_ARTICLES, searchHelp } from "./help.js";

function ArticleBody({ blocks }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {blocks.map((b, i) => {
        if (b.h) return <div key={i} style={{ fontSize: 12.5, fontWeight: 700, color: CY, marginTop: 4 }}>{b.h}</div>;
        if (b.list) return (
          <ul key={i} style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
            {b.list.map((li, j) => <li key={j} style={{ fontSize: 12.5, color: T2, lineHeight: 1.5 }}>{li}</li>)}
          </ul>
        );
        return <div key={i} style={{ fontSize: 12.5, color: T2, lineHeight: 1.6 }}>{b.p}</div>;
      })}
    </div>
  );
}

export function HelpCenter({ onClose, onStartTour, helpMode, setHelpMode, checklist }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("start");
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { openId ? setOpenId(null) : onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, openId]);

  const results = useMemo(() => searchHelp(q), [q]);
  const searching = q.trim().length > 0;
  const listed = searching ? results : HELP_ARTICLES.filter((a) => a.cat === cat);
  const openArticle = openId ? HELP_ARTICLES.find((a) => a.id === openId) : null;

  const pill = (on) => ({ padding: "6px 12px", borderRadius: 999, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
    border: `1px solid ${on ? CY + "66" : BD}`, background: on ? `${CY}18` : GL, color: on ? CY : T3, fontWeight: on ? 700 : 500 });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.62)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Help Centre"
        style={{ width: 560, maxWidth: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", background: B1, border: `1px solid ${BD}`, borderRadius: 18, overflow: "hidden", animation: "reviewRise .3s cubic-bezier(0.16,1,0.3,1) both" }}>

        {/* Header */}
        <div style={{ padding: "16px 18px", borderBottom: `1px solid ${BD}`, display: "flex", alignItems: "center", gap: 10 }}>
          <HelpCircle size={18} color={CY} />
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800, color: T1 }}>Help Centre</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={18} /></button>
        </div>

        {openArticle ? (
          <div style={{ padding: "16px 18px", overflowY: "auto" }}>
            <button onClick={() => setOpenId(null)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: T3, fontSize: 12, cursor: "pointer", fontFamily: "inherit", marginBottom: 12, padding: 0 }}><ArrowLeft size={14} />Back</button>
            <div style={{ fontSize: 17, fontWeight: 800, color: T1, marginBottom: 12 }}>{openArticle.title}</div>
            <ArticleBody blocks={openArticle.body} />
          </div>
        ) : (
          <>
            {/* Search + quick actions */}
            <div style={{ padding: "14px 18px 10px", display: "flex", flexDirection: "column", gap: 11 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: B0, border: `1px solid ${BD}`, borderRadius: 10, padding: "9px 12px" }}>
                <Search size={15} color={T3} />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search help — e.g. rest day, sync, streak…"
                  style={{ flex: 1, background: "none", border: "none", outline: "none", color: T1, fontSize: 13, fontFamily: "inherit" }} />
                {q && <button onClick={() => setQ("")} style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={14} /></button>}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={onStartTour} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", background: `linear-gradient(135deg,${CY},${PU})`, border: "none", borderRadius: 10, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><PlayCircle size={14} />Replay app tour</button>
                <button onClick={() => setHelpMode(!helpMode)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", background: helpMode ? `${GR}18` : GL, border: `1px solid ${helpMode ? GR + "55" : BD}`, borderRadius: 10, color: helpMode ? GR : T2, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><HelpCircle size={14} />Help Mode: {helpMode ? "On" : "Off"}</button>
              </div>
            </div>

            {/* Getting-started checklist */}
            {checklist && !searching && (
              <div style={{ margin: "0 18px 12px", padding: "13px 15px", background: B0, border: `1px solid ${checklist.allDone ? GR + "55" : BD}`, borderRadius: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: T1, flex: 1 }}>{checklist.allDone ? "🎉 Setup complete — welcome aboard!" : "Getting started"}</div>
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: checklist.allDone ? GR : CY, fontWeight: 700 }}>{checklist.pct}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: GL, overflow: "hidden", marginBottom: 11 }}>
                  <div style={{ width: `${checklist.pct}%`, height: "100%", background: checklist.allDone ? GR : `linear-gradient(90deg,${CY},${PU})`, transition: "width 0.4s" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {checklist.items.map((it) => (
                    <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ width: 17, height: 17, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: it.done ? GR : "transparent", border: `1.5px solid ${it.done ? GR : BD}` }}>{it.done && <Check size={11} color="#000" />}</span>
                      <span style={{ fontSize: 12, color: it.done ? T3 : T1, textDecoration: it.done ? "line-through" : "none", flex: 1 }}>{it.label}</span>
                      {!it.done && <span style={{ fontSize: 10, color: T3 }}>{it.hint}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Category pills */}
            {!searching && (
              <div style={{ padding: "0 18px 10px", display: "flex", gap: 7, overflowX: "auto" }}>
                {HELP_CATEGORIES.map((c) => (
                  <button key={c.id} onClick={() => setCat(c.id)} style={pill(cat === c.id)}>{c.label}</button>
                ))}
              </div>
            )}

            {/* Article list */}
            <div style={{ padding: "4px 12px 16px", overflowY: "auto", flex: 1 }}>
              {searching && <div style={{ fontSize: 11, color: T3, padding: "4px 6px 8px" }}>{listed.length} result{listed.length === 1 ? "" : "s"} for “{q}”</div>}
              {listed.length === 0 && (
                <div style={{ padding: "26px", textAlign: "center", color: T3, fontSize: 13 }}>No articles found. Try a different word, or replay the app tour.</div>
              )}
              {listed.map((a) => (
                <button key={a.id} onClick={() => setOpenId(a.id)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "11px 12px", background: "transparent", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = GL; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T1 }}>{a.title}</div>
                    {searching && <div style={{ fontSize: 10.5, color: T3, marginTop: 2 }}>{HELP_CATEGORIES.find((c) => c.id === a.cat)?.label}</div>}
                  </div>
                  <ChevronRight size={15} color={T3} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
