// ── Share a clean copy of the app ────────────────────────────────────
// The app is a static single-file build; all personal data lives only in
// this browser's localStorage (and, if enabled, a private cloud account) —
// never inside the HTML. So the served file is already a clean copy: anyone
// who opens it on their own device starts empty and can never see your data.
// These helpers just make sharing that clean copy one tap.

export function appLink() {
  return location.origin + location.pathname;
}

export async function copyAppLink() {
  const link = appLink();
  try {
    await navigator.clipboard.writeText(link);
    return { ok: true, link };
  } catch {
    return { ok: false, link }; // caller can show the link to copy manually
  }
}

// Fetch the pristine served HTML (which contains no user data — localStorage
// is not part of the document) and download it as a standalone file that can
// be sideloaded or opened offline for a completely fresh experience.
export async function downloadCleanCopy() {
  const res = await fetch(appLink(), { cache: "no-store" });
  if (!res.ok) throw new Error("Couldn't read the app file.");
  const html = await res.text();
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Kahiro.html";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Best-effort native share (phones): share the link so a friend can open it
// and Add to Home Screen. Returns false if the platform has no share sheet.
export async function shareAppLink() {
  if (!navigator.share) return false;
  try {
    await navigator.share({ title: "Kahiro", text: "Kahiro — a personal OS for continuous improvement. Open this and add it to your home screen:", url: appLink() });
    return true;
  } catch {
    return false;
  }
}
