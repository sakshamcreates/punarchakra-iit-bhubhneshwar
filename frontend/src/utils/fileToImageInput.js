// Converts a File the user picked into the exact input.image shape
// backend/src/services/agentTools.js's inspect_item expects:
// { base64, mimetype, filename }. No compression/resizing — the real
// classifier reads whatever bytes are sent.
export function fileToImageInput(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.replace(/^data:[^;]+;base64,/, "");
      resolve({ base64, mimetype: file.type || "image/jpeg", filename: file.name });
    };
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

// Converts a File into a full `data:<mimetype>;base64,<data>` URL —
// used to persist the ACTUAL uploaded photo bytes on the listing
// (listing.images), instead of a `blob:` object URL
// (`URL.createObjectURL`). A blob: URL only stays valid for the
// lifetime of the browser tab/document that created it, so it breaks
// (renders as a broken image) the moment the listing is viewed from a
// fresh page load, a refresh, or a different session — which is
// exactly the "broken image in Agent Resolution" symptom. A data:
// URL embeds the real bytes, so it keeps working everywhere the
// listing record itself is read. See SellPage.handleStartResolution.
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

// The inverse of fileToDataUrl: parses a `data:<mimetype>;base64,<data>`
// URL (as stored on listing.images[0]) back into the
// { base64, mimetype, filename } shape POST /agent/advance expects for
// inspect_item, so AgentResolutionPage can replay the user's ORIGINAL
// Sell-flow upload straight into the agent session instead of asking
// them to upload a second time. Returns null for anything that isn't
// a real embedded data: URL (e.g. a remote https:// placeholder image
// on a seed/demo listing), so callers can safely fall back to
// prompting for a photo in that case.
export function dataUrlToImageInput(dataUrl, filename = "listing-photo.jpg") {
  if (typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return null;
  const [, mimetype, base64] = match;
  if (!base64) return null;
  return { base64, mimetype, filename };
}
