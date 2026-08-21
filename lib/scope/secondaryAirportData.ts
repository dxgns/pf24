import type { MapPoint } from "@/lib/scope/mapData";

export type SecondaryRunway = {
  id: string;
  endA: MapPoint & { label: string };
  endB: MapPoint & { label: string };
};

export type SecondaryStand = MapPoint & { name: string };
export type SecondaryTaxiway = { id: string; d: string; label?: string; labelAt?: MapPoint };
export type SecondaryBuilding = { id: string; points: MapPoint[]; label?: string };
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

export const MDST_REFERENCE_RUNWAY: SecondaryRunway = {
  id: "MDST_11_29",
  endA: { x: 67.19, y: 92.42, label: "11" },
  endB: { x: 69.56, y: 93.45, label: "29" },
};

export const MDST_REFERENCE_STANDS: SecondaryStand[] = [
  { name: "A1", x: 68.29, y: 93.23 }, { name: "A2", x: 68.25, y: 93.18 },
  { name: "A3", x: 68.27, y: 93.20 }, { name: "A4", x: 68.30, y: 93.21 },
  { name: "B6", x: 68.47, y: 93.37 }, { name: "B5", x: 68.51, y: 93.31 },
  { name: "B4", x: 68.58, y: 93.32 }, { name: "B3", x: 68.64, y: 93.33 },
  { name: "B2", x: 68.68, y: 93.34 }, { name: "B2R", x: 68.69, y: 93.36 },
  { name: "B1", x: 68.70, y: 93.42 }, { name: "C1", x: 68.96, y: 93.52 },
  { name: "C2", x: 68.92, y: 93.47 }, { name: "C3", x: 68.87, y: 93.45 },
  { name: "C4", x: 68.80, y: 93.45 },
];

export const MDAB_REFERENCE_RUNWAY: SecondaryRunway = {
  id: "MDAB_11_29",
  endA: { x: 80.58, y: 95.40, label: "11" },
  endB: { x: 82.31, y: 95.71, label: "29" },
};

// MDST, MDAB and MDCR now use dedicated SVG renderers. MTCA intentionally
// renders only its verified runway in MdcrMtcaSvgAirport. Keeping the old
// schematics here caused duplicate, slightly offset airport geometry.
export const SECONDARY_AIRPORTS: SecondaryAirport[] = [];
