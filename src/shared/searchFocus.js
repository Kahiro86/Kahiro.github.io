// ── Search focus bus — deep-link a palette result to the right inner tab ──
// The command palette navigates to a module via the normal nav; this tiny
// pub/sub then tells that module which inner tab to land on (and which record
// it was after). Fully decoupled: modules opt in with useFocusRequest, and if
// nothing listens the result simply lands on the module's default tab — i.e.
// exactly the pre-existing behaviour, so this can never break navigation.
import { useEffect, useState } from "react";

let current = null;
const subs = new Set();

// Request focus, then auto-expire it. The expiry matters because the target
// module may still be mounting when we navigate: a freshly-mounted component
// reads `current` on first render, reacts, and the value clears shortly after
// so it never re-applies to an unrelated later visit to the same module.
let clearTimer = null;
export function requestFocus(f) {
  current = f ? { ...f, nonce: Date.now() } : null;
  subs.forEach((fn) => fn(current));
  clearTimeout(clearTimer);
  if (current) clearTimer = setTimeout(() => { current = null; }, 4000);
}

// Subscribe to the live focus request (null when none/expired).
export function useFocusRequest() {
  const [f, setF] = useState(current);
  useEffect(() => {
    const fn = (x) => setF(x);
    subs.add(fn);
    return () => subs.delete(fn);
  }, []);
  return f;
}
