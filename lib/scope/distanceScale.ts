import { MAP_BOUNDS } from "@/lib/scope/mapData";

// PF24 Scope calibration from the supplied 2.00 NM PNA TWR references:
// PNA (87.44, 102.59) -> CIRCULO 1 (87.44, 107.00) = 4.41 map units
// PNA (87.44, 102.59) -> CIRCULO 2 (87.47, 98.23) ~= 4.3601 map units
// Averaging both references gives ~2.1925 Scope map units per nautical mile.
export const SCOPE_MAP_UNITS_PER_NM = 2.1925;

export function scopeFitScale(widthPx: number, heightPx: number) {
  const mapWidth = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
  const mapHeight = MAP_BOUNDS.maxY - MAP_BOUNDS.minY;
  if (!(widthPx > 0) || !(heightPx > 0)) return 0;
  return Math.min(widthPx / mapWidth, heightPx / mapHeight);
}

export function scopePixelsPerNm(widthPx: number, heightPx: number) {
  return scopeFitScale(widthPx, heightPx) * SCOPE_MAP_UNITS_PER_NM;
}

export function scopeDistanceNmFromScreenDelta(
  dxPx: number,
  dyPx: number,
  widthPx: number,
  heightPx: number,
  radarZoom: number,
) {
  const pixelsPerNm = scopePixelsPerNm(widthPx, heightPx);
  const safeZoom = Math.max(0.01, radarZoom);
  if (!(pixelsPerNm > 0)) return 0;
  return Math.hypot(dxPx, dyPx) / safeZoom / pixelsPerNm;
}
