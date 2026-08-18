import type { MapPoint } from "@/lib/scope/mapData";

// Approximate Terminal B footprint traced from PFTracker reference imagery.
// Points are intentionally kept as editable PFTracker-space anchors so the
// geometry can be refined without replacing the ground map with a raster.
export const MDPC_TERMINAL_B_OUTLINE: MapPoint[] = [
  { x: 87.03, y: 103.39 }, // 1
  { x: 87.03, y: 103.42 }, // 2
  { x: 87.10, y: 103.44 }, // 3
  { x: 87.13, y: 103.65 }, // 4
  { x: 87.55, y: 103.70 }, // 5
  { x: 87.58, y: 103.39 }, // 6
  { x: 87.53, y: 103.38 }, // 7
  { x: 87.47, y: 103.64 }, // 8
  { x: 87.14, y: 103.64 }, // 9
  { x: 87.15, y: 103.40 }, // 10
];
