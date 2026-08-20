import type { MapPoint } from "@/lib/scope/mapData";

export type SecondaryRunway = {
  id: string;
  endA: MapPoint & { label: string };
  endB: MapPoint & { label: string };
};

export type SecondaryStand = MapPoint & { name: string };
export type SecondaryTaxiway = {
  id: string;
  d: string;
  label?: string;
  labelAt?: MapPoint;
};
export type SecondaryBuilding = {
  id: string;
  points: MapPoint[];
  label?: string;
};

export type SecondaryAirport = {
  id: "MDAB" | "MDCR" | "MTCA" | "MDST";
  label: MapPoint;
  runways: SecondaryRunway[];
  aprons?: Array<{ id: string; points: MapPoint[] }>;
  taxiways?: SecondaryTaxiway[];
  buildings?: SecondaryBuilding[];
  stands?: SecondaryStand[];
  uncontrolled?: boolean;
};

// Dedicated SVG airports keep their reference coordinates here but are not
// included in SECONDARY_AIRPORTS. Rendering their old schematic geometry at the
// same time as the SVG created overlapping, slightly different coordinate frames.
export const MDST_REFERENCE_RUNWAY: SecondaryRunway = {
  id: "MDST_11_29",
  endA: { x: 67.19, y: 92.42, label: "11" },
  endB: { x: 69.56, y: 93.45, label: "29" },
};

export const MDST_REFERENCE_STANDS: SecondaryStand[] = [
  { name: "A1", x: 68.29, y: 93.23 },
  { name: "A2", x: 68.25, y: 93.18 },
  { name: "A3", x: 68.27, y: 93.20 },
  { name: "A4", x: 68.30, y: 93.21 },
  { name: "B6", x: 68.45, y: 93.35 },
  { name: "B5", x: 68.51, y: 93.31 },
  { name: "B4", x: 68.58, y: 93.32 },
  { name: "B3", x: 68.64, y: 93.33 },
  { name: "B2", x: 68.68, y: 93.34 },
  { name: "B2R", x: 68.69, y: 93.36 },
  { name: "B1", x: 68.70, y: 93.42 },
  { name: "C1", x: 68.97, y: 93.49 },
  { name: "C2", x: 68.92, y: 93.47 },
  { name: "C3", x: 68.87, y: 93.45 },
  { name: "C4", x: 68.80, y: 93.45 },
];

export const MDAB_REFERENCE_RUNWAY: SecondaryRunway = {
  id: "MDAB_11_29",
  endA: { x: 80.58, y: 95.40, label: "11" },
  endB: { x: 82.31, y: 95.71, label: "29" },
};

/**
 * Runway ends and schematic ground geometry for airports that do not yet have
 * a dedicated SVG renderer.
 */
export const SECONDARY_AIRPORTS: SecondaryAirport[] = [
  {
    id: "MDCR",
    label: { x: 56.80, y: 108.77 },
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
          { x: 56.8991, y: 108.9272 },
          { x: 57.0350, y: 108.9914 },
          { x: 57.0620, y: 109.0867 },
          { x: 57.0076, y: 109.1021 },
          { x: 56.8941, y: 109.0389 },
          { x: 56.8524, y: 108.9698 },
        ],
      },
    ],
    taxiways: [
      {
        id: "MDCR_TX_A",
        label: "A",
        labelAt: { x: 56.89, y: 109.01 },
        d: "M 56.8731 109.1073 Q 56.8900 109.0700 56.9120 109.0374",
      },
      {
        id: "MDCR_TX_B",
        label: "B",
        labelAt: { x: 57.00, y: 109.07 },
        d: "M 56.9605 109.1560 Q 56.9780 109.1200 56.9994 109.0861",
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
];
