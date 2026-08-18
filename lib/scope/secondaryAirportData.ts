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

/**
 * Runway ends, taxiway reference points and stands are PFTracker measurements
 * supplied during the Scope tracing pass. Apron/building outlines are schematic
 * vectors refined against the supplied Project Flight 10-9 charts and Tracker
 * screenshots. The Scope never loads those source images at runtime.
 */
export const SECONDARY_AIRPORTS: SecondaryAirport[] = [
  {
    id: "MDAB",
    label: { x: 81.16, y: 94.91 },
    runways: [
      {
        // The 10-9 chart identifies this runway as 11/29.
        id: "MDAB_11_29",
        endA: { x: 80.58, y: 95.40, label: "11" },
        endB: { x: 82.31, y: 95.71, label: "29" },
      },
    ],
    aprons: [
      {
        id: "MDAB_MAIN_APRON",
        points: [
          { x: 81.0084, y: 95.0501 },
          { x: 81.2285, y: 95.0692 },
          { x: 81.3487, y: 95.1923 },
          { x: 81.3240, y: 95.3301 },
          { x: 81.2034, y: 95.3796 },
          { x: 81.0459, y: 95.3514 },
          { x: 80.9320, y: 95.2497 },
        ],
      },
    ],
    taxiways: [
      {
        id: "MDAB_TX_A",
        label: "A",
        labelAt: { x: 81.13, y: 95.37 },
        d: "M 81.16 95.23 Q 81.13 95.36 81.1124 95.4954",
      },
    ],
    buildings: [
      {
        id: "MDAB_PASSENGER_TERMINAL",
        label: "PAX",
        points: [
          { x: 81.0879, y: 95.0034 },
          { x: 81.2651, y: 95.0351 },
          { x: 81.2545, y: 95.0942 },
          { x: 81.0773, y: 95.0624 },
        ],
      },
    ],
  },
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
          { x: 68.1354, y: 92.9828 },
          { x: 68.4332, y: 93.1253 },
          { x: 68.4759, y: 93.1770 },
          { x: 68.8133, y: 93.3041 },
          { x: 68.8601, y: 93.3467 },
          { x: 69.0796, y: 93.4437 },
          { x: 68.9786, y: 93.6723 },
          { x: 68.0182, y: 93.2480 },
        ],
      },
    ],
    taxiways: [
      {
        id: "MDST_TX_A",
        label: "A",
        labelAt: { x: 68.40, y: 93.04 },
        d: "M 68.4372 92.9631 Q 68.42 93.02 68.39 93.07",
      },
      {
        id: "MDST_TX_B",
        label: "B",
        labelAt: { x: 68.86, y: 93.23 },
        d: "M 68.8924 93.1641 Q 68.87 93.21 68.85 93.26",
      },
      {
        id: "MDST_APRON_SPINE",
        d: "M 68.20 93.20 Q 68.40 93.30 68.62 93.36 Q 68.84 93.42 69.00 93.50",
      },
    ],
    buildings: [
      {
        id: "MDST_GENERAL_AVIATION",
        label: "GA",
        points: [
          { x: 68.0487, y: 93.2779 },
          { x: 68.2865, y: 93.3830 },
          { x: 68.2502, y: 93.4653 },
          { x: 68.0123, y: 93.3602 },
        ],
      },
      {
        id: "MDST_PASSENGER_TERMINAL",
        label: "PAX",
        points: [
          { x: 68.3597, y: 93.4153 },
          { x: 68.6341, y: 93.5365 },
          { x: 68.5897, y: 93.6372 },
          { x: 68.3152, y: 93.5159 },
        ],
      },
      {
        id: "MDST_TOWER",
        label: "TWR",
        points: [
          { x: 68.6478, y: 93.5426 },
          { x: 68.7119, y: 93.5709 },
          { x: 68.6836, y: 93.6349 },
          { x: 68.6195, y: 93.6066 },
        ],
      },
      {
        id: "MDST_CARGO_TERMINAL",
        label: "CARGO",
        points: [
          { x: 68.7388, y: 93.5718 },
          { x: 68.9400, y: 93.6607 },
          { x: 68.9036, y: 93.7431 },
          { x: 68.7024, y: 93.6542 },
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
      { name: "C4", x: 68.80, y: 93.45 },
    ],
  },
];
