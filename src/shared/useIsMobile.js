import { useState, useEffect } from "react";

// True when the viewport is at or below `breakpoint` px. Drives the
// drawer + overlay mobile layout; falls back to desktop when unknown.
export function useIsMobile(breakpoint = 820) {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return mobile;
}
