export type MdpcSimulatorMarking = {
  id: string;
  d: string;
  kind: "turn" | "hold";
};

/**
 * Extra MDPC centerline detail derived from the supplied overhead simulator
 * references. The geometry is anchored to the already-confirmed PFTracker
 * runway/taxiway intersections; the screenshots themselves are never loaded
 * by the Scope.
 *
 * These paths intentionally describe topology/curve behaviour rather than
 * adding new unverified geographic anchor points.
 */
export const MDPC_SIMULATOR_MARKINGS: MdpcSimulatorMarking[] = [
  // RWY 09/27: curved lead-on / lead-off geometry visible at E, G, B and A.
  {
    id: "E_rwy09_turn_west",
    kind: "turn",
    d: "M 86.49 103.02 Q 86.43 102.99 86.38 102.97 Q 86.34 102.95 86.30 102.94",
  },
  {
    id: "E_rwy09_turn_east",
    kind: "turn",
    d: "M 86.49 103.02 Q 86.43 103.00 86.38 102.97 Q 86.43 102.99 86.49 103.01",
  },
  {
    id: "G_rwy09_turn_west",
    kind: "turn",
    d: "M 87.76 103.00 Q 87.76 103.05 87.75 103.08 Q 87.71 103.08 87.66 103.07",
  },
  {
    id: "G_rwy09_turn_east",
    kind: "turn",
    d: "M 87.76 103.00 Q 87.76 103.05 87.75 103.08 Q 87.80 103.09 87.85 103.09",
  },
  {
    id: "B_rwy09_turn_west",
    kind: "turn",
    d: "M 88.19 103.04 Q 88.18 103.09 88.18 103.13 Q 88.13 103.13 88.08 103.12",
  },
  {
    id: "B_rwy09_turn_east",
    kind: "turn",
    d: "M 88.19 103.04 Q 88.18 103.09 88.18 103.13 Q 88.23 103.14 88.28 103.14",
  },
  {
    id: "A_rwy09_turn_west",
    kind: "turn",
    d: "M 89.03 103.10 Q 89.03 103.16 89.07 103.20 Q 89.02 103.20 88.97 103.19",
  },
  {
    id: "A_rwy09_turn_east",
    kind: "turn",
    d: "M 89.03 103.10 Q 89.03 103.16 89.07 103.20 Q 89.12 103.21 89.17 103.21",
  },

  // RWY 08/26: J and H have the same smooth runway-entry behaviour shown
  // in the simulator close-ups rather than a hard polyline corner.
  {
    id: "J_rwy08_turn",
    kind: "turn",
    d: "M 86.00 102.40 Q 85.99 102.31 85.97 102.25 Q 85.93 102.22 85.88 102.22",
  },
  {
    id: "H_rwy08_turn_west",
    kind: "turn",
    d: "M 87.66 102.25 Q 87.60 102.15 87.55 102.08 Q 87.50 102.07 87.45 102.08",
  },
  {
    id: "H_rwy08_turn_east",
    kind: "turn",
    d: "M 87.66 102.25 Q 87.60 102.15 87.55 102.08 Q 87.60 102.07 87.65 102.07",
  },

  // Holding-position bars. Their centres are tied to the confirmed taxiway /
  // runway crossings and are drawn as short transverse amber marks in Scope.
  { id: "hold_J_08", kind: "hold", d: "M 85.93 102.30 L 86.04 102.29" },
  { id: "hold_H_08", kind: "hold", d: "M 87.51 102.15 L 87.61 102.09" },
  { id: "hold_E_09", kind: "hold", d: "M 86.41 102.92 L 86.37 103.02" },
  { id: "hold_G_09", kind: "hold", d: "M 87.70 103.04 L 87.80 103.05" },
  { id: "hold_B_09", kind: "hold", d: "M 88.13 103.09 L 88.23 103.10" },
  { id: "hold_A_09", kind: "hold", d: "M 89.02 103.15 L 89.12 103.16" },
];
