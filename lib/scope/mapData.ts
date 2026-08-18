export type MapPoint = { x: number; y: number };
export type NamedPoint = MapPoint & { name: string; kind?: "fix" | "vor" | "airport" | "stand" };
export type MapPath = { id: string; points: MapPoint[]; closed?: boolean; tone: "fir" | "app" | "tower" | "ground" | "runway" };

export const MAP_BOUNDS = { minX: 15, maxX: 210, minY: 37, maxY: 120 } as const;

export const WAYPOINTS: NamedPoint[] = [
  { name: "BODLO", x: 15.0, y: 75.0 }, { name: "POKEG", x: 67.24, y: 75.0 },
  { name: "PIXAR", x: 79.86, y: 77.39 }, { name: "BETIR", x: 87.68, y: 80.0 },
  { name: "CHUMA", x: 93.35, y: 83.87 }, { name: "MUNOZ", x: 109.75, y: 89.25 },
  { name: "NEGON", x: 109.75, y: 120.0 }, { name: "KATOK", x: 107.06, y: 93.72 },
  { name: "LETAD", x: 100.56, y: 96.22 }, { name: "VIRTO", x: 99.24, y: 101.25 },
  { name: "MESPA", x: 99.61, y: 103.25 }, { name: "PC103", x: 94.16, y: 105.85 },
  { name: "MAROG", x: 92.37, y: 102.59 }, { name: "PC106", x: 90.57, y: 108.19 },
  { name: "MIBNI", x: 83.77, y: 107.16 }, { name: "PC199", x: 84.97, y: 102.75 },
  { name: "PC200", x: 73.71, y: 105.63 }, { name: "AGNAL", x: 74.74, y: 102.31 },
  { name: "PC203", x: 88.74, y: 98.31 }, { name: "PC114", x: 92.64, y: 94.53 },
  { name: "PC201", x: 84.43, y: 93.55 }, { name: "DASVO", x: 77.99, y: 93.81 },
  { name: "BEREL", x: 71.24, y: 94.06 }, { name: "ETBOD", x: 62.45, y: 103.08 },
  { name: "VOGEP", x: 63.06, y: 85.38 }, { name: "PIXES", x: 73.93, y: 85.06 },
  { name: "PC202", x: 83.72, y: 84.96 }, { name: "ILOBI", x: 79.93, y: 82.88 },
  { name: "PNA", x: 87.44, y: 102.59, kind: "vor" }, { name: "SGO", x: 68.47, y: 92.81, kind: "vor" },
  { name: "LUBES", x: 136.19, y: 91.40 }, { name: "BONEK", x: 140.93, y: 86.24 },
  { name: "KRASI", x: 176.44, y: 78.94 }, { name: "KOBER", x: 171.94, y: 94.95 },
  { name: "EMEDA", x: 164.63, y: 103.46 }, { name: "BETID", x: 151.76, y: 105.46 },
  { name: "KURSA", x: 135.96, y: 98.25 }, { name: "PHA", x: 133.84, y: 99.63, kind: "vor" },
  { name: "LCA", x: 159.82, y: 91.21, kind: "vor" }, { name: "ESERI", x: 134.70, y: 106.59 },
  { name: "NIMSI", x: 124.76, y: 103.21 }, { name: "GINRE", x: 136.95, y: 73.81 },
  { name: "MORSS", x: 148.82, y: 61.44 }, { name: "KONAN", x: 162.06, y: 40.71 },
  { name: "EFLA", x: 190.44, y: 42.25 }, { name: "AMUBA", x: 210.0, y: 37.44 },
];

export const AIRSPACE_PATHS: MapPath[] = [
  { id: "MDCS_FIR", tone: "fir", closed: true, points: [
    { x: 15, y: 75 }, { x: 67.24, y: 75 }, { x: 79.86, y: 77.39 }, { x: 87.68, y: 80 },
    { x: 93.35, y: 83.87 }, { x: 109.75, y: 89.25 }, { x: 109.75, y: 120 }, { x: 15, y: 120 },
  ]},
  { id: "MDCS_E", tone: "fir", closed: true, points: [
    { x: 62.45, y: 103.08 }, { x: 73.93, y: 85.06 }, { x: 79.86, y: 77.39 }, { x: 87.68, y: 80 },
    { x: 93.35, y: 83.87 }, { x: 109.75, y: 89.25 }, { x: 109.75, y: 120 }, { x: 62.45, y: 120 },
  ]},
  { id: "LCCC", tone: "fir", closed: true, points: [
    { x: 109.75, y: 120 }, { x: 109.75, y: 89.25 }, { x: 136.95, y: 73.81 }, { x: 148.82, y: 61.44 },
    { x: 162.06, y: 40.71 }, { x: 190.44, y: 42.25 }, { x: 210, y: 37.44 }, { x: 210, y: 120 },
  ]},
  { id: "LCCC_N", tone: "fir", closed: true, points: [
    { x: 109.75, y: 89.25 }, { x: 159.82, y: 91.21 }, { x: 210, y: 91.21 }, { x: 210, y: 37.44 },
    { x: 190.44, y: 42.25 }, { x: 162.06, y: 40.71 }, { x: 148.82, y: 61.44 }, { x: 136.95, y: 73.81 },
  ]},
  { id: "LCLK_APP", tone: "app", closed: true, points: [
    { x: 136.19, y: 91.40 }, { x: 140.93, y: 86.24 }, { x: 176.44, y: 78.94 }, { x: 171.94, y: 94.95 },
    { x: 164.63, y: 103.46 }, { x: 151.76, y: 105.46 }, { x: 135.96, y: 98.25 },
  ]},
  { id: "LCPH_APP", tone: "app", closed: true, points: [
    { x: 136.19, y: 91.40 }, { x: 135.96, y: 98.25 }, { x: 144.33, y: 102.14 }, { x: 134.70, y: 106.59 },
    { x: 124.76, y: 103.21 }, { x: 126.75, y: 92.82 },
  ]},
  { id: "MDPC_APP", tone: "app", closed: true, points: [
    { x: 73.93, y: 85.06 }, { x: 83.72, y: 84.96 }, { x: 100.56, y: 96.22 }, { x: 99.61, y: 103.25 },
    { x: 87.36, y: 110.25 }, { x: 71.20, y: 102.55 }, { x: 71.24, y: 94.06 },
  ]},
  { id: "MDST_APP", tone: "app", closed: true, points: [
    { x: 71.24, y: 94.06 }, { x: 73.93, y: 85.06 }, { x: 63.07, y: 83.24 }, { x: 54.51, y: 86.59 },
    { x: 63.49, y: 97.61 }, { x: 71.20, y: 97.61 },
  ]},
];

export const MDPC_RUNWAYS: MapPath[] = [
  { id: "MDPC_08_26", tone: "runway", points: [{ x: 85.84, y: 102.23 }, { x: 89.69, y: 101.89 }] },
  { id: "MDPC_09_27", tone: "runway", points: [{ x: 86.37, y: 102.93 }, { x: 90.21, y: 103.34 }] },
];

export const MDPC_TAXIWAYS: Array<{ id: string; d: string }> = [
  { id: "H", d: "M 87.55 102.08 Q 87.78 102.44 87.82 102.84" },
  { id: "G", d: "M 87.82 102.84 Q 87.76 102.96 87.75 103.08" },
  { id: "B", d: "M 88.21 102.87 Q 88.19 103.00 88.18 103.13" },
  { id: "A", d: "M 89.05 102.96 Q 89.02 103.08 89.07 103.20" },
  { id: "K", d: "M 87.82 102.84 L 88.21 102.87 L 89.05 102.96" },
  { id: "E", d: "M 86.38 102.97 Q 87.10 103.26 87.60 103.31" },
  { id: "J", d: "M 85.97 102.25 Q 86.00 102.48 86.08 102.72" },
  { id: "F", d: "M 86.54 103.20 Q 86.63 103.34 86.69 103.51" },
  { id: "D", d: "M 87.80 103.34 L 87.93 103.47" },
];

export const MDPC_STANDS: NamedPoint[] = [
  { name: "B33", x: 87.02, y: 103.34, kind: "stand" },
  { name: "B32", x: 87.08, y: 103.35, kind: "stand" },
  { name: "B31", x: 87.14, y: 103.35, kind: "stand" },
];
