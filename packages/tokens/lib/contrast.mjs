// WCAG 2.x contrast ratio between two opaque sRGB colors given as #rrggbb.
// https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio

const HEX = /^#[0-9a-fA-F]{6}$/;

/** True for an opaque six-digit hex color. */
export function isHexColor(value) {
  return typeof value === "string" && HEX.test(value);
}

function channel(byte) {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of #rrggbb (0 for black, 1 for white). */
export function luminance(hex) {
  if (!isHexColor(hex)) throw new Error(`not an opaque #rrggbb color: ${hex}`);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio from 1 to 21. The order of the arguments does not matter. */
export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
