// ── Image compression — shrink a picked photo before it hits storage ──
// Progress photos are kept as data URLs in localStorage (and synced whole-key),
// so they must be small. Draw the image onto a canvas capped at maxDim on its
// long edge and re-encode as JPEG. Resolves to a data URL, or rejects on a
// non-image / decode failure. Pure browser APIs — no dependencies.
export function compressImage(file, { maxDim = 1080, quality = 0.7 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type || "")) { reject(new Error("That file isn't an image")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode the image"));
      img.onload = () => {
        const long = Math.max(img.width, img.height) || 1;
        const scale = Math.min(1, maxDim / long);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas unavailable")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        try { resolve(canvas.toDataURL("image/jpeg", quality)); }
        catch (e) { reject(e instanceof Error ? e : new Error("Could not encode the image")); }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
