// ── Typing guard — never let a passive trigger steal an active input ─
// A passive/scheduled surface (Week in Review on Sunday, the Who-I-Am daily
// auto-show, What's New on a version bump…) must never pop over a field the
// user is mid-way through typing into. `whenNotTyping` runs the callback now
// if it's safe, otherwise defers it until focus leaves the editable element.
// User-initiated opens (tapping a button) don't go through this — only
// passive ones do.

export function isTyping() {
  if (typeof document === "undefined") return false;
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable === true;
}

// Run `cb` as soon as it's safe. If an input is focused right now, wait for the
// next focusout where focus has actually left any editable field, then run.
// Returns a cleanup that cancels a still-pending deferral.
export function whenNotTyping(cb) {
  if (!isTyping()) { cb(); return () => {}; }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    window.removeEventListener("focusout", onOut);
    cb();
  };
  // focusout fires before focus settles on the next element, so re-check on the
  // next tick — if we've landed outside any editable field, it's safe to open.
  const onOut = () => { setTimeout(() => { if (!done && !isTyping()) finish(); }, 0); };
  window.addEventListener("focusout", onOut);
  return () => { done = true; window.removeEventListener("focusout", onOut); };
}
