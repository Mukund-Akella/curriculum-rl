function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]) {
  return `#${[r, g, b]
    .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0"))
    .join("")}`;
}

// Interpolates between two hex colors, t in [0, 1].
export function lerpColor(from, to, t) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const clamped = Math.max(0, Math.min(1, t));
  return rgbToHex(a.map((v, i) => v + (b[i] - v) * clamped));
}

const ELEVATION_LOW = "#3987e5";
const ELEVATION_HIGH = "#e66767";

export function elevationColor(z, zMin, zMax) {
  if (zMax === zMin) return ELEVATION_LOW;
  return lerpColor(ELEVATION_LOW, ELEVATION_HIGH, (z - zMin) / (zMax - zMin));
}

export const ELEVATION_SCALE = { low: ELEVATION_LOW, high: ELEVATION_HIGH };
