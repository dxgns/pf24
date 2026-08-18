import type { MapPoint } from "@/lib/scope/mapData";

export type SecondaryRunway = {
  id: string;
  endA: MapPoint & { label: string };
  endB: MapPoint & { label: string };
};

export type SecondaryStand = MapPoint & { name: string };

export type SecondaryAirport = {
  id: "MDAB" | "MDCR" | "MTCA" | "MDST";
  label: MapPoint;
  runways: SecondaryRunway[];
  aprons?: Array<{ id: string; points: MapPoint[] }>;
  taxiways?: Array<{ id: string; d: string }>;
  buildings?: Array<{ id: string; points: MapPoint[] }>;
  stands?: SecondaryStand[];
  uncontrolled?: boolean;
};

/**
 * Coordinates below come from PFTracker measurements supplied during the
 * Scope map tracing pass.  The screenshots are references only; the Scope
 * renders these vectors and never loads the Tracker images.
 */
export const SECONDARY_AIRPORTS: SecondaryAirport[] = [
  {
    id: "MDAB",
    label: { x: 81.16, y: 94.93 },
    runways: [
      {
        id: "MDAB_12_30",
        endA: { x: 80.58, y: 95.40, label: "12" },
        endB: { x: 82.31, y: 95.71, label: "30" },
      },
    ],
    aprons: [
      {
        id: "MDAB_MAIN_APRON",
        points: [
          { x: 80.96, y: 95.13 },
          { x: 81.22, y: 95.12 },
          { x: 81.34, y: 95.20 },
          { x: 81.31, y: 95.31 },
          { x: 81.09, y: 95.35 },
          { x: 80.96, y: 95.28 },
        ],
      },
    ],
    taxiways: [
      {
        id: "MDAB_APRON_LINK",
        d: "M 81.16 95.23 Q 81.13 95.36 81.1124 95.4954",
      },
    ],
    buildings: [
      {
        id: "MDAB_TERMINAL",
        points: [
          { x: 81.03, y: 95.04 },
          { x: 81.24, y: 95.05 },
          { x: 81.27, y: 95.13 },
          { x: 81.06, y: 95.14 },
        ],
      },
    ],
  },
  {
    id: "MDCR",
    label: { x: 56.84, y: 108.80 },
    runways: [
      {
        id: "MDCR_12_30",
        endA: { x: 56.86, y: 109.10, label: "12" },
        endB: { x: 58.78, y: 110.17, label: "30" },
      },
    ],
    aprons: [
      {
        id: "MDCR_THRESHOLD_APRON",
        points: [
          { x: 56.78, y: 108.93 },
          { x: 56.94, y: 108.91 },
          { x: 57.06, y: 109.00 },
          { x: 57.04, y: 109.10 },
          { x: 56.86, y: 109.12 },
          { x: 56.79, y: 109.05 },
        ],
      },
    ],
    taxiways: [
      {
        id: "MDCR_APRON_LINK",
        d: "M 56.90 109.02 Q 56.88 109.06 56.8565 109.0981",
      },
    ],
  },
  {
    id: "MTCA",
    label: { x: 33.78, y: 103.28 },
    uncontrolled: true,
    runways: [
      {
        id: "MTCA_26_08",
        endA: { x: 33.20, y: 103.61, label: "26" },
        endB: { x: 34.54, y: 103.47, label: "08" },
      },
    ],
  },
  {
    id: "MDST",
    label: { x: 68.28, y: 92.65 },
    runways: [
      {
        id: "MDST_11_29",
        endA: { x: 67.14, y: 92.39, label: "11" },
        endB: { x: 69.63, y: 93.49, label: "29" },
      },
    ],
    aprons: [
      {
        id: "MDST_MAIN_APRON",
        points: [
          { x: 68.14, y: 93.08 },
          { x: 68.32, y: 93.12 },
          { x: 68.47, y: 93.25 },
          { x: 68.80, y: 93.31 },
          { x: 69.04, y: 93.43 },
          { x: 69.02, y: 93.58 },
          { x: 68.72, y: 93.52 },
          { x: 68.42, y: 93.49 },
          { x: 68.20, y: 93.30 },
        ],
      },
    ],
    taxiways: [
      {
        id: "MDST_TX_A",
        d: "M 68.4372 92.9631 Q 68.42 93.02 68.39 93.07",
      },
      {
        id: "MDST_TX_B",
        d: "M 68.8924 93.1641 Q 68.87 93.21 68.85 93.26",
      },
      {
        id: "MDST_APRON_SPINE",
        d: "M 68.20 93.20 Q 68.40 93.30 68.62 93.36 Q 68.84 93.42 69.00 93.50",
      },
    ],
    buildings: [
      {
        id: "MDST_TERMINAL",
        points: [
          { x: 68.37, y: 93.51 },
          { x: 68.77, y: 93.58 },
          { x: 68.73, y: 93.70 },
          { x: 68.34, y: 93.63 },
        ],
      },
    ],
    stands: [
      { name: "A1", x: 68.22, y: 93.17 },
      { name: "A2", x: 68.25, y: 93.18 },
      { name: "A3", x: 68.27, y: 93.20 },
      { name: "A4", x: 68.30, y: 93.21 },
      { name: "B6", x: 68.45, y: 93.35 },
      { name: "B5", x: 68.51, y: 93.31 },
      { name: "B4", x: 68.58, y: 93.32 },
      { name: "B3", x: 68.64, y: 93.33 },
      { name: "B2", x: 68.68, y: 93.34 },
      { name: "B2R", x: 68.69, y: 93.36 },
      { name: "B1", x: 68.74, y: 93.39 },
      { name: "C1", x: 68.97, y: 93.49 },
      { name: "C2", x: 68.92, y: 93.47 },
      { name: "C3", x: 68.87, y: 93.45 },
      { name: "C4", x: 68.44, y: 93.44 },
    ],
  },
];
