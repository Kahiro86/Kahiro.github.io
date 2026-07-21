// ── Want List — the personal dream vault ─────────────────────────────
// A long-term list of meaningful things worth saving for. Every interaction
// is built to reward patient, deliberate saving over impulse spending: the
// language encourages, milestones celebrate, and the numbers all derive from
// an immutable contribution log (see shared/wants.js) so nothing can drift.
import { useMemo, useState, useRef, useEffect } from "react";
import {
  Plus, Search, Pencil, Archive, ArchiveRestore, Check, X,
  Gift, User, Image as ImageIcon, Sparkles, Wallet, TrendingUp, ChevronDown,
} from "lucide-react";
import { BD, T1, T2, T3, GL, B2, GR, AM, CY, AC2 } from "../../shared/designTokens.js";
import { Card, SH, Chip, Empty, MoneyInp, Inp } from "../../shared/ui.jsx";
import { Collapse } from "../../shared/Collapse.jsx";
import { DatePicker } from "../../shared/DatePicker.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { useToast } from "../../shared/toast.jsx";
import {
  WANT_CATEGORIES, CATEGORY_ICON, iconFor, PRIORITIES, PRIORITY_LABEL, PRIORITY_COLOR,
  FUNDING_SOURCES, STATUS_LABEL, progressColor, fmtKsh,
  sanitizeWants, newWant, savedOf, remainingOf, pctOf, statusOf, isComplete,
  timelineOf, highestMilestone, addContribution, markPurchased, updateWant, archiveWant,
  wantsAnalytics, suggestionsFor, wantAchievements, committedSavings,
} from "../../shared/wants.js";
import { localDateStr } from "../../shared/dates.js";

const AK = CY; // module accent (Nocturne cyan)
const fmtDate = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

// Downscale an uploaded image to a synced-storage-friendly size (max 720px,
// JPEG q0.72) so a phone photo never bloats localStorage or the sync payload.
function fileToImage(file, cb) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 720;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => cb("");
    img.src = reader.result;
  };
  reader.onerror = () => cb("");
  reader.readAsDataURL(file);
}

// ── Milestone confetti — a brief, subtle celebration on crossing a mark ─
function Confetti() {
  const dots = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    id: i,
    left: 50 + (Math.random() * 60 - 30),
    color: [GR, AC2, CY, "#9B7CE0", "#4C8DFF"][i % 5],
    cx: `${Math.random() * 120 - 60}px`,
    cy: `${60 + Math.random() * 80}px`,
    cr: `${Math.random() * 360}deg`,
    delay: Math.random() * 0.15,
    size: 5 + Math.round(Math.random() * 4),
  })), []);
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", borderRadius: 16 }}>
      {dots.map((d) => (
        <span key={d.id} style={{
          position: "absolute", top: 8, left: `${d.left}%`, width: d.size, height: d.size, borderRadius: 2,
          background: d.color, "--cx": d.cx, "--cy": d.cy, "--cr": d.cr,
          animation: `confettiPop 1.1s ease-out ${d.delay}s forwards`,
        }} />
      ))}
    </div>
  );
}

// ── Ramp progress bar with a moving sheen ────────────────────────────
function WantBar({ pct }) {
  const c = progressColor(pct);
  return (
    <div style={{ position: "relative", height: 9, background: BD, borderRadius: 5, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: `linear-gradient(90deg, ${c}CC, ${c})`, borderRadius: 5, transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)", boxShadow: `0 0 10px ${c}66`, position: "relative", overflow: "hidden" }}>
        {pct > 0 && pct < 100 && (
          <span style={{ position: "absolute", top: 0, left: 0, width: "40%", height: "100%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)", animation: "barShimmer 2.4s ease-in-out infinite" }} />
        )}
      </div>
    </div>
  );
}

const PriorityDot = ({ p }) => (
  <span title={`${PRIORITY_LABEL[p]} priority`} style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITY_COLOR[p], boxShadow: `0 0 6px ${PRIORITY_COLOR[p]}88`, flexShrink: 0 }} />
);

// ── Premium placeholder when a want has no photo ─────────────────────
const Placeholder = ({ cat, height = 128 }) => (
  <div style={{ height, borderRadius: 12, background: `radial-gradient(120% 100% at 30% 0%, ${AK}18, transparent 60%), linear-gradient(135deg, ${B2}, #0A0A0A)`, border: `1px solid ${BD}`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
    <span style={{ fontSize: height > 100 ? 40 : 26, opacity: 0.85, filter: "grayscale(0.2)" }}>{iconFor(cat)}</span>
    <div style={{ position: "absolute", inset: 0, background: `repeating-linear-gradient(115deg, transparent 0 22px, ${AK}06 22px 24px)` }} />
  </div>
);

// ── One want card ────────────────────────────────────────────────────
function WantCard({ w, onAdd, onPurchase, onEdit, onArchive, celebrate }) {
  const [open, setOpen] = useState(false);
  const saved = savedOf(w), remaining = remainingOf(w), pct = pctOf(w);
  const status = statusOf(w);
  const t = timelineOf(w);
  const done = isComplete(w);
  const suggestions = suggestionsFor(w);
  const c = progressColor(pct);
  const statusColor = { ready: GR, purchased: GR, gifted: "#9B7CE0", saving: AK, dreaming: T3, archived: T3 }[status] || T3;

  return (
    <Card style={{ padding: 0, overflow: "hidden", borderColor: done ? `${GR}44` : pct >= 75 ? `${c}44` : BD, position: "relative", animation: celebrate ? "wantGlow 1.6s ease-out" : undefined }}>
      {celebrate && <Confetti />}

      {/* Image / placeholder */}
      <div style={{ padding: 12, paddingBottom: 0 }}>
        {w.image
          ? <div style={{ height: 128, borderRadius: 12, backgroundImage: `url(${w.image})`, backgroundSize: "cover", backgroundPosition: "center", border: `1px solid ${BD}`, filter: done ? "none" : "saturate(1.05)" }} />
          : <Placeholder cat={w.category} />}
      </div>

      <div style={{ padding: "12px 15px 15px" }}>
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 9 }}>
          <PriorityDot p={w.priority} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: T1, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: T3 }}>{iconFor(w.category)} {w.category}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, color: w.forWhom === "gift" ? "#9B7CE0" : T3 }}>
                {w.forWhom === "gift" ? <><Gift size={10} /> {w.recipient || "Gift"}</> : <><User size={10} /> For me</>}
              </span>
            </div>
          </div>
          <span style={{ padding: "3px 9px", borderRadius: 9, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, background: `${statusColor}18`, border: `1px solid ${statusColor}44`, color: statusColor, whiteSpace: "nowrap" }}>
            {STATUS_LABEL[status]}
          </span>
        </div>

        {/* Progress */}
        <WantBar pct={pct} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8 }}>
          <span style={{ fontSize: 11.5, color: T2, fontFamily: "'JetBrains Mono',monospace" }}>
            {fmtKsh(saved)} <span style={{ color: T3 }}>/ {fmtKsh(w.target)}</span>
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: c, fontFamily: "'JetBrains Mono',monospace" }}>{pct % 1 === 0 ? pct : pct.toFixed(1)}%</span>
        </div>
        {!done && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 10.5, color: T3 }}>{remaining > 0 ? `${fmtKsh(remaining)} to go` : "Fully funded 🎉"}</span>
            {t.etaDate && remaining > 0 && <span style={{ fontSize: 10, color: T3 }}>≈ {fmtDate(t.etaDate)}</span>}
          </div>
        )}
        {done && (
          <div style={{ fontSize: 10.5, color: GR, marginTop: 5 }}>
            {STATUS_LABEL[status]} {fmtDate(w.purchasedAt)} · {fmtKsh(w.finalCost ?? saved)}{t.durationDays != null ? ` · saved over ${t.durationDays}d` : ""}
          </div>
        )}

        {/* Primary actions */}
        {!done && (
          <div style={{ display: "flex", gap: 7, marginTop: 12 }}>
            {pct >= 100 ? (
              <button onClick={() => onPurchase(w)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", background: `${GR}1E`, border: `1px solid ${GR}66`, borderRadius: 10, color: GR, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <Check size={14} /> {w.forWhom === "gift" ? "Mark Gifted" : "Purchase Item"}
              </button>
            ) : (
              <button onClick={() => onAdd(w)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", background: `${AK}1A`, border: `1px solid ${AK}55`, borderRadius: 10, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <Plus size={14} /> Add Money
              </button>
            )}
            <button onClick={() => setOpen((o) => !o)} aria-label="Details" style={{ padding: "9px 12px", background: GL, border: `1px solid ${BD}`, borderRadius: 10, color: T2, cursor: "pointer", display: "flex", alignItems: "center" }}>
              <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>
          </div>
        )}
        {done && (
          <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", marginTop: 11, padding: "7px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, color: T3, fontSize: 11, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} /> Details
          </button>
        )}

        {/* Expanded detail */}
        {open && (
          <div style={{ marginTop: 13, paddingTop: 13, borderTop: `1px solid ${BD}`, display: "flex", flexDirection: "column", gap: 11 }}>
            {suggestions.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {suggestions.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11, color: T2, lineHeight: 1.45 }}>
                    <Sparkles size={11} color={AC2} style={{ flexShrink: 0, marginTop: 1 }} /> {s}
                  </div>
                ))}
              </div>
            )}

            {/* Timeline facts */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              {[
                ["Created", fmtDate(w.createdAt)],
                ["First saved", t.first ? fmtDate(t.first) : "—"],
                ["Last saved", t.last ? fmtDate(t.last) : "—"],
                ["Avg / week", t.perWeek ? fmtKsh(t.perWeek) : "—"],
              ].map(([l, v]) => (
                <div key={l} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "7px 10px" }}>
                  <div style={{ fontSize: 8.5, color: T3, letterSpacing: 1, textTransform: "uppercase" }}>{l}</div>
                  <div style={{ fontSize: 11.5, color: T1, fontWeight: 600, marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>

            {w.note && <div style={{ fontSize: 11.5, color: T2, lineHeight: 1.55, whiteSpace: "pre-wrap", background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "8px 11px" }}>{w.note}</div>}
            {w.forWhom === "gift" && (w.occasion || w.giftDate) && (
              <div style={{ fontSize: 10.5, color: "#9B7CE0" }}>🎁 {w.occasion}{w.occasion && w.giftDate ? " · " : ""}{w.giftDate ? fmtDate(w.giftDate) : ""}</div>
            )}

            {/* Recent contributions */}
            {w.contributions.length > 0 && (
              <div>
                <div style={{ fontSize: 9, color: T3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Contributions</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 132, overflowY: "auto" }}>
                  {[...w.contributions].reverse().slice(0, 8).map((c2) => (
                    <div key={c2.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: T2, padding: "4px 8px", background: GL, borderRadius: 7 }}>
                      <span>{fmtDate(c2.date)} · <span style={{ color: T3 }}>{(FUNDING_SOURCES.find((s) => s.id === c2.source) || {}).label || "Manual"}</span></span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", color: GR }}>+{fmtKsh(c2.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Secondary actions */}
            <div style={{ display: "flex", gap: 7 }}>
              {!done && <button onClick={() => onEdit(w)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, color: T2, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}><Pencil size={12} /> Edit</button>}
              <button onClick={() => onArchive(w)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, color: T3, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                {w.archived ? <><ArchiveRestore size={12} /> Restore</> : <><Archive size={12} /> Archive</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Add-money modal ──────────────────────────────────────────────────
function AddMoneyModal({ w, onSave, onClose }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(localDateStr());
  const [source, setSource] = useState("salary");
  const [note, setNote] = useState("");
  const remaining = remainingOf(w);
  const can = +amount > 0;
  return (
    <Overlay onClose={onClose}>
      <SH title={`Add to ${w.name}`} sub={remaining > 0 ? `${fmtKsh(remaining)} left to reach ${fmtKsh(w.target)}` : "Already funded — extra is welcome"} />
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        <div>
          <Lbl>Amount</Lbl>
          <MoneyInp value={amount} onChange={setAmount} placeholder="0" />
          <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
            {[1000, 5000, 10000, remaining].filter((v, i, a) => v > 0 && a.indexOf(v) === i).slice(0, 4).map((v) => (
              <button key={v} onClick={() => setAmount(String(v))} style={{ padding: "4px 10px", borderRadius: 16, border: `1px solid ${BD}`, background: GL, color: T2, fontSize: 10.5, cursor: "pointer", fontFamily: "inherit" }}>
                {v === remaining ? "All of it" : `+${(v / 1000)}k`}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Lbl>Date</Lbl>
          <DatePicker value={date} onChange={setDate} />
        </div>
        <div>
          <Lbl>Source</Lbl>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {FUNDING_SOURCES.map((s) => (
              <button key={s.id} onClick={() => setSource(s.id)} style={{ padding: "6px 11px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: source === s.id ? 700 : 400, background: source === s.id ? `${AK}22` : GL, border: `1px solid ${source === s.id ? AK + "66" : BD}`, color: source === s.id ? "#FFFFFF" : T3 }}>
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Lbl>Note (optional)</Lbl>
          <Inp value={note} onChange={setNote} placeholder="Birthday money, trading payout…" />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={() => can && onSave({ amount: +amount, date, source, note })} disabled={!can}
          style={{ flex: 1, padding: "10px", background: can ? `${GR}1E` : GL, border: `1px solid ${can ? GR + "66" : BD}`, borderRadius: 10, color: can ? GR : T3, fontSize: 12.5, fontWeight: 700, cursor: can ? "pointer" : "default", fontFamily: "inherit" }}>
          One step closer
        </button>
        <button onClick={onClose} style={{ padding: "10px 16px", background: GL, border: `1px solid ${BD}`, borderRadius: 10, color: T3, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
      </div>
    </Overlay>
  );
}

// ── New / edit want modal ────────────────────────────────────────────
function WantForm({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || "");
  const [category, setCategory] = useState(initial?.category || "Technology");
  const [forWhom, setForWhom] = useState(initial?.forWhom || "me");
  const [recipient, setRecipient] = useState(initial?.recipient || "");
  const [occasion, setOccasion] = useState(initial?.occasion || "");
  const [giftDate, setGiftDate] = useState(initial?.giftDate || "");
  const [priority, setPriority] = useState(initial?.priority || "medium");
  const [target, setTarget] = useState(initial ? String(initial.target) : "");
  const [image, setImage] = useState(initial?.image || "");
  const [note, setNote] = useState(initial?.note || "");
  const fileRef = useRef(null);
  const can = name.trim() && +target > 0;
  const save = () => {
    if (!can) return;
    onSave({ name, category, forWhom, recipient, occasion, giftDate: giftDate || null, priority, target: +target, image, note });
  };
  return (
    <Overlay onClose={onClose} wide>
      <SH title={initial ? "Edit want" : "New want"} sub="Something meaningful, worth saving for" />
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        <div>
          <Lbl>What is it?</Lbl>
          <Inp value={name} onChange={setName} placeholder="e.g. Sony A7 IV camera" />
        </div>

        {/* Image */}
        <div>
          <Lbl>Image (optional)</Lbl>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {image
              ? <div style={{ width: 72, height: 72, borderRadius: 10, backgroundImage: `url(${image})`, backgroundSize: "cover", backgroundPosition: "center", border: `1px solid ${BD}`, flexShrink: 0 }} />
              : <div style={{ width: 72, height: 72, flexShrink: 0 }}><Placeholder cat={category} height={72} /></div>}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <input value={image.startsWith("data:") ? "" : image} onChange={(e) => setImage(e.target.value)} placeholder="Paste an image URL…"
                style={{ width: "100%", background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "8px 11px", fontSize: 12, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => fileRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", background: GL, border: `1px solid ${BD}`, borderRadius: 8, color: T2, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                  <ImageIcon size={12} /> Upload / photo
                </button>
                {image && <button onClick={() => setImage("")} style={{ padding: "6px 11px", background: GL, border: `1px solid ${BD}`, borderRadius: 8, color: T3, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Clear</button>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) fileToImage(f, setImage); }} />
            </div>
          </div>
        </div>

        {/* Category */}
        <div>
          <Lbl>Category</Lbl>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxHeight: 96, overflowY: "auto" }}>
            {WANT_CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => setCategory(cat)} style={{ padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: category === cat ? 700 : 400, background: category === cat ? `${AK}22` : GL, border: `1px solid ${category === cat ? AK + "66" : BD}`, color: category === cat ? "#FFFFFF" : T3 }}>
                {CATEGORY_ICON[cat]} {cat}
              </button>
            ))}
          </div>
          <input value={WANT_CATEGORIES.includes(category) ? "" : category} onChange={(e) => setCategory(e.target.value)} placeholder="…or type a custom category"
            style={{ width: "100%", marginTop: 7, background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "7px 11px", fontSize: 11.5, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>

        {/* Target + priority */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <Lbl>Target price</Lbl>
            <MoneyInp value={target} onChange={setTarget} placeholder="120000" />
          </div>
          <div>
            <Lbl>Priority</Lbl>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {PRIORITIES.map((p) => (
                <button key={p} onClick={() => setPriority(p)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 10.5, fontWeight: priority === p ? 700 : 400, background: priority === p ? `${PRIORITY_COLOR[p]}22` : GL, border: `1px solid ${priority === p ? PRIORITY_COLOR[p] + "88" : BD}`, color: priority === p ? T1 : T3 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: PRIORITY_COLOR[p] }} />{PRIORITY_LABEL[p]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ownership */}
        <div>
          <Lbl>Who is it for?</Lbl>
          <div style={{ display: "flex", gap: 7 }}>
            {[["me", "For me", <User size={13} key="u" />], ["gift", "A gift", <Gift size={13} key="g" />]].map(([v, l, ic]) => (
              <button key={v} onClick={() => setForWhom(v)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: forWhom === v ? 700 : 500, background: forWhom === v ? (v === "gift" ? "#9B7CE022" : `${AK}22`) : GL, border: `1px solid ${forWhom === v ? (v === "gift" ? "#9B7CE066" : AK + "66") : BD}`, color: forWhom === v ? T1 : T3 }}>
                {ic} {l}
              </button>
            ))}
          </div>
          {forWhom === "gift" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 9 }}>
              <Inp value={recipient} onChange={setRecipient} placeholder="Recipient" />
              <Inp value={occasion} onChange={setOccasion} placeholder="Occasion" />
              <div style={{ gridColumn: "1 / -1" }}>
                <Lbl>Gift date (optional)</Lbl>
                <DatePicker value={giftDate || localDateStr()} onChange={setGiftDate} max={null} />
              </div>
            </div>
          )}
        </div>

        <div>
          <Lbl>Notes (optional)</Lbl>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Buy during Black Friday. Need it before December."
            style={{ width: "100%", minHeight: 60, background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 11px", fontSize: 12, color: T1, lineHeight: 1.5, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={save} disabled={!can} style={{ flex: 1, padding: "10px", background: can ? `${AK}1E` : GL, border: `1px solid ${can ? AK + "55" : BD}`, borderRadius: 10, color: can ? "#FFFFFF" : T3, fontSize: 12.5, fontWeight: 700, cursor: can ? "pointer" : "default", fontFamily: "inherit" }}>
          {initial ? "Save changes" : "Add to vault"}
        </button>
        <button onClick={onClose} style={{ padding: "10px 16px", background: GL, border: `1px solid ${BD}`, borderRadius: 10, color: T3, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
      </div>
    </Overlay>
  );
}

// ── Purchase confirmation ────────────────────────────────────────────
function PurchaseModal({ w, onConfirm, onClose }) {
  const [date, setDate] = useState(localDateStr());
  const [finalCost, setFinalCost] = useState(String(savedOf(w)));
  return (
    <Overlay onClose={onClose}>
      <SH title={w.forWhom === "gift" ? "Mark as gifted" : "Complete purchase"} sub={`${w.name} moves to your Completed Collection — kept forever.`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        <div><Lbl>{w.forWhom === "gift" ? "Gifted on" : "Purchased on"}</Lbl><DatePicker value={date} onChange={setDate} /></div>
        <div><Lbl>Final cost</Lbl><MoneyInp value={finalCost} onChange={setFinalCost} placeholder="0" /></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={() => onConfirm({ date, finalCost: +finalCost })} style={{ flex: 1, padding: "10px", background: `${GR}1E`, border: `1px solid ${GR}66`, borderRadius: 10, color: GR, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          {w.forWhom === "gift" ? "It's given 🎁" : "It's yours 🎉"}
        </button>
        <button onClick={onClose} style={{ padding: "10px 16px", background: GL, border: `1px solid ${BD}`, borderRadius: 10, color: T3, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
      </div>
    </Overlay>
  );
}

// ── Small shared bits ────────────────────────────────────────────────
const Lbl = ({ children }) => <div style={{ fontSize: 10, color: T3, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 6 }}>{children}</div>;
function Overlay({ children, onClose, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px 16px", overflowY: "auto" }}>
      <Card onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: wide ? 520 : 420, padding: "20px 22px", animation: "reviewRise 0.3s ease" }}>
        {children}
      </Card>
    </div>
  );
}

// ── Module ───────────────────────────────────────────────────────────
export function WantListModule() {
  const [rawWants, setWants] = useStorageState("wants", []);
  const [finance] = useStorageState("finance_state", null);
  const toast = useToast();
  const [addTarget, setAddTarget] = useState(null);
  const [purchaseTarget, setPurchaseTarget] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [celebrateId, setCelebrateId] = useState(null);
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("active");
  const [fOwner, setFOwner] = useState("all");
  const [fCat, setFCat] = useState("all");
  const [fPrio, setFPrio] = useState("all");
  const [sort, setSort] = useState("progress");

  const wants = useMemo(() => sanitizeWants(rawWants), [rawWants]);
  const analytics = useMemo(() => wantsAnalytics(rawWants), [rawWants]);
  const achievements = useMemo(() => wantAchievements(rawWants), [rawWants]);
  const committed = useMemo(() => committedSavings(rawWants), [rawWants]);
  const savBal = finance && typeof finance === "object" ? +finance.savBal || 0 : 0;

  const cats = useMemo(() => [...new Set(wants.map((w) => w.category))].sort(), [wants]);

  const visible = useMemo(() => {
    let list = wants.filter((w) => {
      if (fStatus === "active" && (w.archived || w.purchasedAt)) return false;
      if (fStatus === "saving" && statusOf(w) !== "saving") return false;
      if (fStatus === "ready" && statusOf(w) !== "ready") return false;
      if (fStatus === "done" && !w.purchasedAt) return false;
      if (fStatus === "archived" && !w.archived) return false;
      if (fOwner !== "all" && w.forWhom !== fOwner) return false;
      if (fCat !== "all" && w.category !== fCat) return false;
      if (fPrio !== "all" && w.priority !== fPrio) return false;
      if (q.trim()) {
        const hay = `${w.name} ${w.category} ${w.recipient} ${w.note} ${w.priority}`.toLowerCase();
        if (!hay.includes(q.trim().toLowerCase())) return false;
      }
      return true;
    });
    const prioRank = { critical: 0, high: 1, medium: 2, low: 3, someday: 4 };
    list.sort((a, b) => {
      if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
      if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sort === "progress") return pctOf(b) - pctOf(a);
      if (sort === "lowest") return pctOf(a) - pctOf(b);
      if (sort === "price") return b.target - a.target;
      if (sort === "priority") return prioRank[a.priority] - prioRank[b.priority];
      return 0;
    });
    return list;
  }, [wants, fStatus, fOwner, fCat, fPrio, q, sort]);

  const active = visible.filter((w) => !w.purchasedAt);
  const completed = wants.filter((w) => w.purchasedAt && !w.archived);

  // Save a contribution, celebrating if it crosses a fresh milestone.
  const doAdd = (contrib) => {
    const before = highestMilestone(pctOf(addTarget));
    setWants((prev) => {
      const next = addContribution(prev, addTarget.id, contrib);
      const w2 = next.find((x) => x.id === addTarget.id);
      const after = highestMilestone(pctOf(w2));
      if (after > before) {
        setCelebrateId(addTarget.id);
        setTimeout(() => setCelebrateId(null), 1800);
        toast(after >= 100 ? `🎉 ${w2.name} is fully funded!` : `${after}% toward ${w2.name} — every contribution matters.`, { tone: "success", duration: 4000 });
      } else {
        toast(`${fmtKsh(contrib.amount)} closer. Progress beats perfection.`, { tone: "success", duration: 2500 });
      }
      return next;
    });
    setAddTarget(null);
  };
  const doPurchase = ({ date, finalCost }) => {
    setWants((prev) => markPurchased(prev, purchaseTarget.id, { date, finalCost }));
    toast(purchaseTarget.forWhom === "gift" ? "🎁 Gift given — kept in your collection forever." : "🎉 It's yours. Enjoy it — you earned it.", { tone: "success", duration: 5000 });
    setPurchaseTarget(null);
  };
  const saveWant = (draft) => {
    if (editing) {
      setWants((prev) => updateWant(prev, editing.id, draft));
      toast("Want updated", { tone: "success" });
    } else {
      setWants((prev) => [newWant(draft), ...sanitizeWants(prev)]);
      toast("🗝️ Added to your dream vault", { tone: "success" });
    }
    setFormOpen(false); setEditing(null);
  };
  const doArchive = (w) => {
    setWants((prev) => archiveWant(prev, w.id, !w.archived));
    if (!w.archived) toast(`"${w.name}" archived`, { action: "Undo", onAction: () => setWants((prev) => archiveWant(prev, w.id, false)), tone: "danger" });
  };

  const pill = (on) => ({ padding: "6px 12px", borderRadius: 8, border: `1px solid ${on ? AK + "55" : BD}`, background: on ? `${AK}1a` : GL, color: on ? "#FFFFFF" : T2, fontSize: 11.5, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" });
  const sel = { background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "6px 10px", fontSize: 11.5, color: T2, outline: "none", fontFamily: "inherit", cursor: "pointer" };

  const gotAch = achievements.filter((a) => a.got).length;

  return (
    <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 1080 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T1 }}>Want List</div>
          <div style={{ fontSize: 12.5, color: T3, marginTop: 2 }}>Your dream vault — save with intention, celebrate every step, buy without regret.</div>
        </div>
        <button onClick={() => { setEditing(null); setFormOpen(true); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: `${AK}1E`, border: `1px solid ${AK}55`, borderRadius: 10, color: "#FFFFFF", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          <Plus size={14} /> New want
        </button>
      </div>

      {/* Analytics */}
      {wants.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(132px,1fr))", gap: 10 }}>
          <Chip label="Total wants" value={String(analytics.totalWants)} color={AK} />
          <Chip label="Total value" value={fmtKsh(analytics.totalValue)} color={T1} />
          <Chip label="Total saved" value={fmtKsh(analytics.totalSaved)} color={GR} />
          <Chip label="Remaining" value={fmtKsh(analytics.totalRemaining)} color={AM} />
          <Chip label="Completed" value={String(analytics.completed)} color="#9B7CE0" />
          <Chip label="Completion rate" value={`${analytics.completionRate}%`} color={CY} />
          <Chip label="Saved this month" value={fmtKsh(analytics.savedThisMonth)} color={GR} />
          <Chip label="Avg / week" value={fmtKsh(analytics.avgSpeed)} color={AC2} />
        </div>
      )}

      {/* Finance-aware committed readout */}
      {committed > 0 && (
        <Card style={{ padding: "13px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Wallet size={16} color={AK} />
          <div style={{ flex: 1, minWidth: 200, fontSize: 12, color: T2, lineHeight: 1.5 }}>
            <b style={{ color: T1 }}>{fmtKsh(committed)}</b> committed across {active.length || analytics.totalWants} active want{(analytics.totalWants) === 1 ? "" : "s"}.
            {savBal > 0 && <> That's <b style={{ color: committed <= savBal ? GR : AM }}>{Math.round((committed / savBal) * 100)}%</b> of your {fmtKsh(savBal)} savings balance.</>}
          </div>
          {analytics.closest && (
            <div style={{ fontSize: 11, color: T3, whiteSpace: "nowrap" }}>
              <TrendingUp size={11} style={{ verticalAlign: -1 }} /> Closest: <span style={{ color: progressColor(pctOf(analytics.closest)) }}>{analytics.closest.name} ({Math.round(pctOf(analytics.closest))}%)</span>
            </div>
          )}
        </Card>
      )}

      {/* Filter / search toolbar */}
      {wants.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "7px 12px" }}>
            <Search size={14} color={T3} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item, category, recipient, note…"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: T1, fontSize: 12.5, fontFamily: "inherit" }} />
            {q && <button onClick={() => setQ("")} style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={13} /></button>}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {[["active", "Active"], ["saving", "Saving"], ["ready", "Ready"], ["done", "Purchased"], ["archived", "Archived"]].map(([v, l]) => (
              <button key={v} onClick={() => setFStatus(v)} style={pill(fStatus === v)}>{l}</button>
            ))}
            <span style={{ width: 1, height: 18, background: BD }} />
            {[["all", "Everyone"], ["me", "For me"], ["gift", "Gifts"]].map(([v, l]) => (
              <button key={v} onClick={() => setFOwner(v)} style={pill(fOwner === v)}>{l}</button>
            ))}
            <select value={fCat} onChange={(e) => setFCat(e.target.value)} style={sel}>
              <option value="all">All categories</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={fPrio} onChange={(e) => setFPrio(e.target.value)} style={sel}>
              <option value="all">All priorities</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} style={sel}>
              <option value="progress">Highest progress</option>
              <option value="lowest">Lowest progress</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="priority">Priority</option>
              <option value="price">Price</option>
            </select>
          </div>
        </div>
      )}

      {/* Grid */}
      {wants.length === 0 ? (
        <Empty icon="🗝️" title="Your dream vault is empty"
          sub="Add the first thing worth saving for — a camera, a watch, a trip, a gift. Then watch discipline turn it real.">
          <button onClick={() => setFormOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", background: `${AK}1E`, border: `1px solid ${AK}55`, borderRadius: 10, color: "#FFFFFF", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 10 }}>
            <Plus size={14} /> Add your first want
          </button>
        </Empty>
      ) : fStatus === "done" ? null : active.length === 0 ? (
        <Empty icon="🔍" title="Nothing matches" sub="Try a different filter or search." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
          {active.map((w) => (
            <WantCard key={w.id} w={w} celebrate={celebrateId === w.id}
              onAdd={setAddTarget} onPurchase={setPurchaseTarget}
              onEdit={(x) => { setEditing(x); setFormOpen(true); }} onArchive={doArchive} />
          ))}
        </div>
      )}

      {/* Completed collection */}
      {completed.length > 0 && (fStatus === "active" || fStatus === "done") && (
        <Collapse id="wants_completed" title="Completed Collection" count={completed.length} defaultOpen={fStatus === "done"}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
            {completed.map((w) => (
              <WantCard key={w.id} w={w} onAdd={setAddTarget} onPurchase={setPurchaseTarget} onEdit={() => {}} onArchive={doArchive} />
            ))}
          </div>
        </Collapse>
      )}

      {/* Vault trophies */}
      <Card style={{ padding: "16px 18px" }}>
        <SH title="Vault Achievements" sub={`${gotAch}/${achievements.length} unlocked — milestones of disciplined saving`} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 9 }}>
          {achievements.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", background: a.got ? `${AK}12` : GL, border: `1px solid ${a.got ? AK + "44" : BD}`, borderRadius: 11, opacity: a.got ? 1 : 0.55 }}>
              <span style={{ fontSize: 19, filter: a.got ? "none" : "grayscale(1)" }}>{a.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: a.got ? T1 : T3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                <div style={{ fontSize: 9.5, color: T3 }}>{a.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {addTarget && <AddMoneyModal w={addTarget} onSave={doAdd} onClose={() => setAddTarget(null)} />}
      {purchaseTarget && <PurchaseModal w={purchaseTarget} onConfirm={doPurchase} onClose={() => setPurchaseTarget(null)} />}
      {formOpen && <WantForm initial={editing} onSave={saveWant} onClose={() => { setFormOpen(false); setEditing(null); }} />}
    </div>
  );
}
