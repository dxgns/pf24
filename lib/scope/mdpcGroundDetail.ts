import type { MapPoint } from "@/lib/scope/mapData";

const P1: MapPoint = { x: 87.03, y: 103.39 };
const P2: MapPoint = { x: 87.03, y: 103.42 };
const P3: MapPoint = { x: 87.10, y: 103.44 };
const P4: MapPoint = { x: 87.13, y: 103.65 };
const P5: MapPoint = { x: 87.55, y: 103.70 };
const P6: MapPoint = { x: 87.58, y: 103.39 };
const P7: MapPoint = { x: 87.53, y: 103.38 };
const P8: MapPoint = { x: 87.47, y: 103.64 };
const P9: MapPoint = { x: 87.14, y: 103.64 };
const P10: MapPoint = { x: 87.15, y: 103.40 };

export const MDPC_TERMINAL_B_BUILDINGS: Array<{ id: string; points: MapPoint[] }> = [
  { id: "terminal-b-west", points: [P1, P2, P4, P9, P3, P10] },
  { id: "terminal-b-south", points: [P4, P5, P8, P9] },
  { id: "terminal-b-east", points: [P7, P6, P5, P8] },
];
