// ── "Who I Am" — five-year identity panel ────────────────────────────
// Full-screen, serif, the heaviest and most solemn version of the palette:
// dark brown and gold, a page in a book rather than a screen in an app.
// Defaults to READ mode; writing is a deliberate second action. Autosaves
// as you type, no save button, no character limit. Every edit is kept as a
// dated revision. Nothing here is ever auto-generated or gated.
import { useEffect, useMemo, useRef, useState } from "react";
import { SERIF } from "./designTokens.js";
import { useStorageState } from "./useStorageState.js";
import {
  WHO_KEY, WHO_REVISIONS_KEY, EMBERS, sanitizeWho, sanitizeRevisions,
  pushRevision, hasVision, futureTenseHint,
} from "./whoIAm.js";

// The solemn sub-palette — brown ground, gold ink, warm parchment body.
const BROWN0 = "#140d05", BROWN1 = "#1d1408", BROWN2 = "#271a0b";
const GOLD = "#E7C775", GOLD_DIM = "rgba(231,199,117,0.55)";
const PARCH = "#EBDFC4", PARCH_DIM = "rgba(235,223,196,0.5)";
const LINE = "rgba(231,199,117,0.16)";

const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }); }
  catch { return iso; }
};

export function WhoIAm({ onClose, autoShow = false, todayLine = "" }) {
  const [rawWho, setWho] = useStorageState(WHO_KEY, { text: "", updatedAt: null });
  const [rawRevs, setRevs] = useStorageState(WHO_REVISIONS_KEY, []);
  const who = useMemo(() => sanitizeWho(rawWho), [rawWho]);
  const revisions = useMemo(() => sanitizeRevisions(rawRevs), [rawRevs]);

  const written = hasVision(rawWho);
  const [mode, setMode] = useState(autoShow ? "read" : written ? "read" : "write");
  const [hintDismissed, setHintDismissed] = useState(false);
  const [secs, setSecs] = useState(13);
  const startTextRef = useRef(who.text);
  const taRef = useRef(null);

  // Auto-dismiss countdown for the daily surface (skippable by tap).
  useEffect(() => {
    if (!autoShow || mode !== "read") return;
    if (secs <= 0) { close(); return; }
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [autoShow, mode, secs]);

  useEffect(() => { if (mode === "write") setTimeout(() => taRef.current?.focus(), 60); }, [mode]);

  // Snapshot a revision on the way out if the passage changed this session.
  const snapshot = () => {
    const now = (sanitizeWho(rawWho).text || "").trim();
    if (now && now !== (startTextRef.current || "").trim()) {
      setRevs((prev) => pushRevision(prev, now));
    }
  };
  const close = () => { snapshot(); onClose && onClose(); };

  // Autosave as typed — local-first, instant, no save button.
  const onType = (v) => setWho({ text: v, updatedAt: new Date().toISOString() });

  const showHint = mode === "write" && !hintDismissed && futureTenseHint(who.text);

  const overlay = {
    position: "fixed", inset: 0, zIndex: 4000, background: `radial-gradient(120% 90% at 50% 0%, ${BROWN2} 0%, ${BROWN1} 42%, ${BROWN0} 100%)`,
    display: "flex", flexDirection: "column", fontFamily: SERIF, color: PARCH, overflowY: "auto",
  };
  const sheet = { width: "100%", maxWidth: 720, margin: "0 auto", padding: "clamp(28px,6vw,72px) clamp(22px,6vw,40px) 96px", boxSizing: "border-box", flex: 1 };
  const linkBtn = { background: "none", border: "none", color: GOLD_DIM, fontFamily: SERIF, fontSize: 15, cursor: "pointer", padding: "8px 4px", letterSpacing: 0.3 };

  // ── READ ───────────────────────────────────────────────────────────
  if (mode === "read") {
    return (
      <div style={overlay} onClick={autoShow ? close : undefined}>
        <div style={sheet} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 34 }}>
            <span style={{ fontSize: 13, letterSpacing: 3, textTransform: "uppercase", color: GOLD_DIM }}>Who I Am</span>
            {!autoShow && <button onClick={close} aria-label="Close" style={{ ...linkBtn, fontSize: 22, lineHeight: 1 }}>✕</button>}
          </div>

          {written ? (
            <div style={{ fontSize: "clamp(18px,2.4vw,22px)", lineHeight: 1.95, whiteSpace: "pre-wrap", color: PARCH, fontWeight: 400 }}>
              {who.text}
            </div>
          ) : (
            <div style={{ fontSize: 19, lineHeight: 1.9, color: PARCH_DIM }}>
              Nothing written yet. When you are ready, set down — in the present tense — the man you are five years from now.
              <div style={{ marginTop: 26 }}>
                <button onClick={() => setMode("write")} style={{ ...linkBtn, color: GOLD, fontSize: 18, border: `1px solid ${LINE}`, borderRadius: 4, padding: "10px 20px" }}>Begin</button>
              </div>
            </div>
          )}

          {written && todayLine && (
            <div style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${LINE}`, fontSize: 15.5, lineHeight: 1.7, color: GOLD_DIM, fontStyle: "italic" }}>
              {todayLine}
            </div>
          )}

          {autoShow ? (
            <div style={{ marginTop: 34, fontSize: 13, color: PARCH_DIM, letterSpacing: 0.4 }}>Tap anywhere to continue · {secs}s</div>
          ) : written ? (
            <div style={{ marginTop: 46, display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={() => { startTextRef.current = who.text; setMode("write"); }} style={linkBtn}>revise</button>
              {revisions.length > 0 && <button onClick={() => setMode("revisions")} style={linkBtn}>revisions ({revisions.length})</button>}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // ── REVISIONS (read-only history) ────────────────────────────────────
  if (mode === "revisions") {
    return (
      <div style={overlay}>
        <div style={sheet}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
            <span style={{ fontSize: 13, letterSpacing: 3, textTransform: "uppercase", color: GOLD_DIM }}>Revisions</span>
            <button onClick={() => setMode("read")} style={linkBtn}>done</button>
          </div>
          {revisions.length === 0 ? (
            <div style={{ color: PARCH_DIM, fontSize: 17 }}>No past versions yet.</div>
          ) : revisions.map((r, i) => (
            <div key={r.savedAt || i} style={{ marginBottom: 30, paddingBottom: 24, borderBottom: `1px solid ${LINE}` }}>
              <div style={{ fontSize: 12.5, letterSpacing: 1, color: GOLD_DIM, marginBottom: 10 }}>{fmtDate(r.savedAt)}{i === 0 ? " · latest" : ""}</div>
              <div style={{ fontSize: 16.5, lineHeight: 1.85, whiteSpace: "pre-wrap", color: PARCH_DIM }}>{r.text}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── WRITE ───────────────────────────────────────────────────────────
  return (
    <div style={overlay}>
      <div style={sheet}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <span style={{ fontSize: 13, letterSpacing: 3, textTransform: "uppercase", color: GOLD_DIM }}>{written ? "Revise" : "Who I Am"}</span>
          <button onClick={() => setMode("read")} style={linkBtn}>done</button>
        </div>

        {/* Starting embers — faint scaffolding, gone once you begin. */}
        {!who.text.trim() && (
          <div style={{ marginBottom: 22, display: "flex", flexDirection: "column", gap: 7, opacity: 0.5 }}>
            {EMBERS.map((e) => (
              <div key={e} style={{ fontSize: 15, lineHeight: 1.6, color: GOLD_DIM, fontStyle: "italic" }}>{e}</div>
            ))}
          </div>
        )}

        {showHint && (
          <div style={{ marginBottom: 16, padding: "9px 13px", border: `1px solid ${LINE}`, borderRadius: 4, background: "rgba(231,199,117,0.05)", fontSize: 14, color: GOLD_DIM, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <span style={{ fontStyle: "italic" }}>Write it as already true — “I am,” not “I will be.”</span>
            <button onClick={() => setHintDismissed(true)} style={{ ...linkBtn, fontSize: 13, padding: 2 }}>ok</button>
          </div>
        )}

        <textarea
          ref={taRef}
          value={who.text}
          onChange={(e) => onType(e.target.value)}
          placeholder={written ? "" : "In five years, I am …"}
          style={{
            width: "100%", minHeight: "48vh", background: "transparent", border: "none", outline: "none",
            resize: "none", fontFamily: SERIF, fontSize: "clamp(18px,2.4vw,21px)", lineHeight: 1.95,
            color: PARCH, caretColor: GOLD, boxSizing: "border-box",
          }}
        />
        <div style={{ marginTop: 6, fontSize: 12.5, color: PARCH_DIM, letterSpacing: 0.3 }}>Saved as you write.</div>
      </div>
    </div>
  );
}
