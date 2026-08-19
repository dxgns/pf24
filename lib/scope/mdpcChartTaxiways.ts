export type MdpcTaxiwayGeometry = {
  id: string;
  d: string;
  source: "confirmed" | "chart";
};

/**
 * MDPC taxiway centerlines rebuilt from the official 10-9 taxi chart and the
 * PFTracker coordinates already confirmed in this project.
 *
 * Curves are used only where the chart visibly curves. Straight taxiways stay
 * straight. The chart scale was calibrated against both runway thresholds.
 */
export const MDPC_CHART_TAXIWAYS: MdpcTaxiwayGeometry[] = [
  // West side: J is visibly curved from RWY 08 toward the RWY 09/E area.
  { id: "J", source: "chart", d: "M 85.97 102.25 C 85.92 102.40 85.96 102.56 86.05 102.63 C 86.14 102.70 86.26 102.80 86.37 102.93" },

  // E is essentially straight on the chart, parallel to the south runway.
  { id: "E", source: "chart", d: "M 86.37 103.02 L 87.75 103.18" },

  // F is a short, nearly straight spur toward General Aviation/Cargo.
  { id: "F", source: "chart", d: "M 86.47 103.03 L 86.45 103.21" },

  // H: slight alignment changes, but no artificial bow-shaped curve.
  { id: "H", source: "confirmed", d: "M 87.55 102.08 L 87.70 102.11 L 87.77 102.30 L 87.78 102.54 L 87.82 102.84" },

  // K is straight across the midfield in the chart.
  { id: "K", source: "confirmed", d: "M 87.82 102.84 L 88.21 102.87 L 89.05 102.96" },

  // G and B are straight cross-field taxiways.
  { id: "G", source: "confirmed", d: "M 87.82 102.84 L 87.75 103.08 L 87.70 103.32" },
  { id: "B", source: "confirmed", d: "M 88.21 102.87 L 88.18 103.13 L 88.17 103.35" },

  // A is also straight through K and RWY 09/27; only the runway-end geometry
  // at the north side is treated separately by P.
  { id: "A", source: "confirmed", d: "M 89.11 102.12 L 89.08 102.54 L 89.05 102.96 L 89.07 103.20 L 88.99 103.51" },

  // P is the curved loop shown at the RWY 26 end.
  { id: "P", source: "chart", d: "M 89.62 101.99 C 89.75 102.02 89.82 102.11 89.77 102.25 C 89.73 102.34 89.53 102.31 89.36 102.27 C 89.24 102.24 89.15 102.32 89.08 102.54" },

  // South-side apron/taxiway connectors. These are straight in the 10-9.
  { id: "E2", source: "chart", d: "M 87.41 103.12 L 87.39 103.31" },
  { id: "E1", source: "confirmed", d: "M 87.61 103.15 L 87.70 103.36" },
  { id: "D", source: "confirmed", d: "M 87.80 103.34 L 87.93 103.47" },
  { id: "R1", source: "chart", d: "M 87.96 103.18 L 87.94 103.36" },
  { id: "R2", source: "chart", d: "M 88.10 103.20 L 88.09 103.37" },
];
