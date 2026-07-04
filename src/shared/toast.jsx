// Lightweight toast system with optional action (e.g. Undo). Replaces
// window.alert/confirm: destructive actions apply immediately and offer
// a few seconds to undo — faster and friendlier than a blocking dialog.
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { B2, BD2, T1, CY, GR, RE } from "./designTokens.js";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((msg, { action, onAction, duration = 4500, tone = "info" } = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-2), { id, msg, action, onAction, tone }]);
    timers.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const toneColor = { info: CY, success: GR, danger: RE };

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div style={{ position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)", zIndex: 300, display: "flex", flexDirection: "column", gap: 8, alignItems: "center", pointerEvents: "none", width: "min(440px, calc(100vw - 24px))" }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 12, background: B2, border: `1px solid ${BD2}`, borderLeft: `3px solid ${toneColor[t.tone] || CY}`, borderRadius: 12, padding: "11px 15px", boxShadow: "0 12px 36px rgba(0,0,0,0.5)", animation: "fadeIn 0.22s ease", maxWidth: "100%" }}>
            <span style={{ fontSize: 12.5, color: T1, lineHeight: 1.45 }}>{t.msg}</span>
            {t.action && (
              <button
                onClick={() => { t.onAction?.(); dismiss(t.id); }}
                style={{ background: "none", border: "none", color: toneColor[t.tone] || CY, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", padding: "2px 4px" }}
              >
                {t.action}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// Safe no-op outside the provider so components never crash.
export const useToast = () => useContext(ToastCtx) || (() => {});
