import { WAYPOINTS } from "@/lib/scope/mapData";

export type ProcedureKind = "SID" | "STAR" | "APPROACH";
export type AltitudeRestriction =
  | { type: "AT"; feet: number }
  | { type: "AT_OR_ABOVE"; feet: number }
  | { type: "AT_OR_BELOW"; feet: number };

export type SpeedRestriction = { type: "MAX"; knots: number };
export type MapPoint = { x: number; y: number };

export type ProcedureFix = {
  id: string;
  label: string;
  mapPoint?: MapPoint;
  altitude?: AltitudeRestriction;
  speed?: SpeedRestriction;
  source?: "NAMED_FIX" | "DME_FIX";
  dme?: {
    station: string;
    distanceNm: number;
    radial?: number;
    note: string;
  };
};

export type ProcedureLeg = {
  from: string;
  to: string;
  course: number;
};

export type ProcedureDepartureLeg = {
  type: "HEADING_UNTIL_ALTITUDE";
  heading: number;
  untilAltitudeFeet: number;
  speed?: SpeedRestriction;
  afterCourse: number;
  targetFix: string;
};

export type FlightProcedure = {
  id: string;
  code: string;
  aliases?: string[];
  airport: string;
  runway: string;
  kind: ProcedureKind;
  entryFix: string;
  fixes: ProcedureFix[];
  legs: ProcedureLeg[];
  departureLeg?: ProcedureDepartureLeg;
  globalSpeed?: {
    belowFeet: number;
    maxKnots: number;
    note: string;
  };
  chart: string;
};

type FlightPlanLike = {
  departure_icao?: unknown;
  arrival_icao?: unknown;
  route?: unknown;
};

// Same PF24 Scope scale used by the live guidance engine.
const MAP_UNITS_PER_NM = 3.28875 / 1.5;

function namedFix(name: string): MapPoint | undefined {
  const target = WAYPOINTS.find((item) => item.name.toUpperCase() === name.toUpperCase());
  return target ? { x: target.x, y: target.y } : undefined;
}

function bearingVector(bearing: number): MapPoint {
  const radians = bearing * Math.PI / 180;
  return {
    x: Math.sin(radians),
    y: -Math.cos(radians),
  };
}

/**
 * Resolve any radial/DME point once the station reference is known. This is
 * intentionally generic so later fixes such as D9.9 can use the exact same
 * geometry instead of being hand-positioned on a chart image.
 */
export function resolveDmeMapPoint(
  station: MapPoint | undefined,
  radial: number,
  distanceNm: number,
): MapPoint | undefined {
  if (!station || !Number.isFinite(radial) || !Number.isFinite(distanceNm) || distanceNm < 0) return undefined;
  const direction = bearingVector(radial);
  const distance = distanceNm * MAP_UNITS_PER_NM;
  return {
    x: station.x + direction.x * distance,
    y: station.y + direction.y * distance,
  };
}

/**
 * MDST 10-4 gives enough independent geometry to locate the STI DME reference
 * without measuring the NOT TO SCALE drawing:
 *
 * - ETBOD -> D2.0 STI is published 033°
 * - D2.0 STI is 2.0 DME on the 215° STI reference
 * - D1.8 STI is 1.8 DME on the 035° STI reference
 * - D1.8 STI -> VOGEP is published 300°
 *
 * ETBOD and VOGEP already have exact PF24 map coordinates. Solving those four
 * constraints gives a single STI station point, after which every STI radial/DME
 * fix can be generated directly by distance and radial.
 */
function resolveMdstStiGeometry() {
  const etbod = namedFix("ETBOD");
  const vogep = namedFix("VOGEP");
  if (!etbod || !vogep) return null;

  const inbound033 = bearingVector(33);
  const outbound300 = bearingVector(300);
  const radial215 = bearingVector(215);
  const radial035 = bearingVector(35);
  const d20Radius = 2 * MAP_UNITS_PER_NM;
  const d18Radius = 1.8 * MAP_UNITS_PER_NM;

  // ETBOD + t*033 - 2NM*R215 = VOGEP - s*300 - 1.8NM*R035
  // Solve the two unknown along-track distances t and s in the map plane.
  const rhs = {
    x: vogep.x - etbod.x + d20Radius * radial215.x - d18Radius * radial035.x,
    y: vogep.y - etbod.y + d20Radius * radial215.y - d18Radius * radial035.y,
  };
  const determinant = inbound033.x * outbound300.y - outbound300.x * inbound033.y;
  if (Math.abs(determinant) < 1e-9) return null;

  const t = (rhs.x * outbound300.y - outbound300.x * rhs.y) / determinant;
  const d20 = {
    x: etbod.x + inbound033.x * t,
    y: etbod.y + inbound033.y * t,
  };
  const sti = {
    x: d20.x - radial215.x * d20Radius,
    y: d20.y - radial215.y * d20Radius,
  };
  const d18 = resolveDmeMapPoint(sti, 35, 1.8);
  if (!d18) return null;

  return { sti, d20, d18 };
}

const mdstStiGeometry = resolveMdstStiGeometry();

// Exported for future MDST procedures that publish additional STI radial/DME fixes.
export const MDST_STI_DME_REFERENCE = mdstStiGeometry?.sti;

const mdstSgo = namedFix("SGO");
const mdstD20Sgo = resolveDmeMapPoint(mdstSgo, 295, 2);

const commonVogep4B: ProcedureFix = {
  id: "VOGEP",
  label: "VOGEP",
  mapPoint: namedFix("VOGEP"),
  altitude: { type: "AT", feet: 2500 },
  speed: { type: "MAX", knots: 200 },
  source: "NAMED_FIX",
};

const commonD20Sgo: ProcedureFix = {
  id: "D2.0-SGO",
  label: "D2.0 SGO",
  mapPoint: mdstD20Sgo,
  altitude: { type: "AT_OR_ABOVE", feet: 3000 },
  source: "DME_FIX",
  dme: {
    station: "SGO",
    distanceNm: 2,
    radial: 295,
    note: "Resolved from D2.0 SGO on R-295, reciprocal to the published 115° leg to SGO.",
  },
};

const commonSgo: ProcedureFix = {
  id: "SGO",
  label: "SGO",
  mapPoint: mdstSgo,
  altitude: { type: "AT", feet: 3000 },
  speed: { type: "MAX", knots: 200 },
  source: "NAMED_FIX",
};

const allRunwaysGlobalSpeed = {
  belowFeet: 10000,
  maxKnots: 250,
  note: "MAX 250 KT BELOW FL100 UNLESS OTHERWISE AUTHORIZED",
};

function mdstRunway29DepartureLeg(afterCourse: number, targetFix: string): ProcedureDepartureLeg {
  return {
    type: "HEADING_UNTIL_ALTITUDE",
    heading: 294,
    untilAltitudeFeet: 2000,
    speed: { type: "MAX", knots: 180 },
    afterCourse,
    targetFix,
  };
}

export const MDST_PIXES4B: FlightProcedure = {
  id: "MDST-PIXES4B-RWY11",
  code: "PIXES4B",
  aliases: ["PIXE4B"],
  airport: "MDST",
  runway: "11",
  kind: "STAR",
  entryFix: "PIXES",
  chart: "MDST 10-4 · 9 JUL 26",
  fixes: [
    {
      id: "PIXES",
      label: "PIXES",
      mapPoint: namedFix("PIXES"),
      altitude: { type: "AT_OR_BELOW", feet: 5000 },
      speed: { type: "MAX", knots: 220 },
      source: "NAMED_FIX",
    },
    commonVogep4B,
  ],
  legs: [{ from: "PIXES", to: "VOGEP", course: 268 }],
  globalSpeed: allRunwaysGlobalSpeed,
};

export const MDST_ETBOD4B: FlightProcedure = {
  id: "MDST-ETBOD4B-RWY11",
  code: "ETBOD4B",
  aliases: ["ETBO4B"],
  airport: "MDST",
  runway: "11",
  kind: "STAR",
  entryFix: "ETBOD",
  chart: "MDST 10-4 · 9 JUL 26",
  fixes: [
    {
      id: "ETBOD",
      label: "ETBOD",
      mapPoint: namedFix("ETBOD"),
      source: "NAMED_FIX",
    },
    {
      id: "D2.0-STI",
      label: "D2.0 STI",
      mapPoint: mdstStiGeometry?.d20,
      altitude: { type: "AT_OR_ABOVE", feet: 4500 },
      source: "DME_FIX",
      dme: {
        station: "STI",
        distanceNm: 2,
        radial: 215,
        note: "Resolved from D2.0 STI / R-215 and the published 033° leg from ETBOD.",
      },
    },
    {
      id: "D1.8-STI",
      label: "D1.8 STI",
      mapPoint: mdstStiGeometry?.d18,
      altitude: { type: "AT_OR_ABOVE", feet: 3500 },
      speed: { type: "MAX", knots: 220 },
      source: "DME_FIX",
      dme: {
        station: "STI",
        distanceNm: 1.8,
        radial: 35,
        note: "Resolved from D1.8 STI / R-035 and the published 300° leg to VOGEP.",
      },
    },
    commonVogep4B,
  ],
  legs: [
    { from: "ETBOD", to: "D2.0-STI", course: 33 },
    { from: "D2.0-STI", to: "D1.8-STI", course: 33 },
    { from: "D1.8-STI", to: "VOGEP", course: 300 },
  ],
  globalSpeed: allRunwaysGlobalSpeed,
};

export const MDST_PIXES3R: FlightProcedure = {
  id: "MDST-PIXES3R-ALL",
  code: "PIXES3R",
  aliases: ["PIXE3R"],
  airport: "MDST",
  runway: "ALL",
  kind: "STAR",
  entryFix: "PIXES",
  chart: "MDST 10-3 · 10 JUL 26",
  fixes: [
    {
      id: "PIXES",
      label: "PIXES",
      mapPoint: namedFix("PIXES"),
      altitude: { type: "AT_OR_BELOW", feet: 5000 },
      source: "NAMED_FIX",
    },
    commonD20Sgo,
    commonSgo,
  ],
  legs: [
    { from: "PIXES", to: "D2.0-SGO", course: 235 },
    { from: "D2.0-SGO", to: "SGO", course: 115 },
  ],
  globalSpeed: allRunwaysGlobalSpeed,
};

export const MDST_VOGEP3R: FlightProcedure = {
  id: "MDST-VOGEP3R-ALL",
  code: "VOGEP3R",
  aliases: ["VOGE3R"],
  airport: "MDST",
  runway: "ALL",
  kind: "STAR",
  entryFix: "VOGEP",
  chart: "MDST 10-3 · 10 JUL 26",
  fixes: [
    {
      id: "VOGEP",
      label: "VOGEP",
      mapPoint: namedFix("VOGEP"),
      altitude: { type: "AT_OR_BELOW", feet: 5000 },
      source: "NAMED_FIX",
    },
    commonD20Sgo,
    commonSgo,
  ],
  legs: [
    { from: "VOGEP", to: "D2.0-SGO", course: 164 },
    { from: "D2.0-SGO", to: "SGO", course: 115 },
  ],
  globalSpeed: allRunwaysGlobalSpeed,
};

export const MDST_ETBOD3R: FlightProcedure = {
  id: "MDST-ETBOD3R-ALL",
  code: "ETBOD3R",
  aliases: ["ETBO3R"],
  airport: "MDST",
  runway: "ALL",
  kind: "STAR",
  entryFix: "ETBOD",
  chart: "MDST 10-3 · 10 JUL 26",
  fixes: [
    {
      id: "ETBOD",
      label: "ETBOD",
      mapPoint: namedFix("ETBOD"),
      source: "NAMED_FIX",
    },
    commonD20Sgo,
    commonSgo,
  ],
  legs: [
    { from: "ETBOD", to: "D2.0-SGO", course: 11 },
    { from: "D2.0-SGO", to: "SGO", course: 115 },
  ],
  globalSpeed: allRunwaysGlobalSpeed,
};

export const MDST_PIXES2C: FlightProcedure = {
  id: "MDST-PIXES2C-RWY29",
  code: "PIXES2C",
  aliases: ["PIXE2C"],
  airport: "MDST",
  runway: "29",
  kind: "SID",
  entryFix: "RWY29",
  chart: "MDST 10-6 · 9 JUL 26",
  departureLeg: mdstRunway29DepartureLeg(63, "PIXES"),
  fixes: [
    {
      id: "PIXES",
      label: "PIXES",
      mapPoint: namedFix("PIXES"),
      altitude: { type: "AT_OR_ABOVE", feet: 5000 },
      source: "NAMED_FIX",
    },
  ],
  legs: [],
  globalSpeed: allRunwaysGlobalSpeed,
};

export const MDST_VOGEP2C: FlightProcedure = {
  id: "MDST-VOGEP2C-RWY29",
  code: "VOGEP2C",
  aliases: ["VOGE2C"],
  airport: "MDST",
  runway: "29",
  kind: "SID",
  entryFix: "RWY29",
  chart: "MDST 10-6 · 9 JUL 26",
  departureLeg: mdstRunway29DepartureLeg(343, "VOGEP"),
  fixes: [
    {
      id: "VOGEP",
      label: "VOGEP",
      mapPoint: namedFix("VOGEP"),
      altitude: { type: "AT_OR_ABOVE", feet: 5000 },
      source: "NAMED_FIX",
    },
  ],
  legs: [],
  globalSpeed: allRunwaysGlobalSpeed,
};

export const MDST_ETBOD2C: FlightProcedure = {
  id: "MDST-ETBOD2C-RWY29",
  code: "ETBOD2C",
  aliases: ["ETBO2C"],
  airport: "MDST",
  runway: "29",
  kind: "SID",
  entryFix: "RWY29",
  chart: "MDST 10-6 · 9 JUL 26",
  departureLeg: mdstRunway29DepartureLeg(187, "ETBOD"),
  fixes: [
    {
      id: "ETBOD",
      label: "ETBOD",
      mapPoint: namedFix("ETBOD"),
      source: "NAMED_FIX",
    },
  ],
  legs: [],
  globalSpeed: allRunwaysGlobalSpeed,
};

export const PROCEDURES: FlightProcedure[] = [
  MDST_PIXES4B,
  MDST_ETBOD4B,
  MDST_PIXES3R,
  MDST_VOGEP3R,
  MDST_ETBOD3R,
  MDST_PIXES2C,
  MDST_VOGEP2C,
  MDST_ETBOD2C,
];

function routeTokens(route: unknown) {
  return String(route ?? "")
    .toUpperCase()
    .split(/\s+/)
    .map((item) => item.replace(/[^A-Z0-9.]/g, ""))
    .filter(Boolean);
}

function procedureTokens(procedure: FlightProcedure) {
  return [procedure.code, ...(procedure.aliases ?? [])].map((item) => item.toUpperCase());
}

function routeContainsProcedure(procedure: FlightProcedure, tokens: Set<string>) {
  return procedureTokens(procedure).some((token) => tokens.has(token));
}

export function selectProcedureForPlan(plan: FlightPlanLike | null | undefined) {
  if (!plan) return null;
  const departure = String(plan.departure_icao ?? "").trim().toUpperCase();
  const arrival = String(plan.arrival_icao ?? "").trim().toUpperCase();
  const tokens = new Set(routeTokens(plan.route));

  const sid = PROCEDURES.find((procedure) => (
    procedure.kind === "SID" &&
    procedure.airport === departure &&
    routeContainsProcedure(procedure, tokens)
  ));
  if (sid) return sid;

  return PROCEDURES.find((procedure) => (
    procedure.kind !== "SID" &&
    procedure.airport === arrival &&
    routeContainsProcedure(procedure, tokens)
  )) ?? null;
}

export function getProcedureFix(procedure: FlightProcedure, id: string) {
  return procedure.fixes.find((fix) => fix.id === id) ?? null;
}

export function getInboundLeg(procedure: FlightProcedure, targetFixId: string) {
  return procedure.legs.find((leg) => leg.to === targetFixId) ?? null;
}

export function formatAltitudeRestriction(restriction: AltitudeRestriction | undefined) {
  if (!restriction) return "—";
  const label = restriction.feet >= 10000 && restriction.feet % 100 === 0
    ? `FL${String(Math.round(restriction.feet / 100)).padStart(3, "0")}`
    : `${restriction.feet.toLocaleString("en-US")} FT`;
  if (restriction.type === "AT") return label;
  if (restriction.type === "AT_OR_ABOVE") return `${label} OR ABOVE`;
  return `${label} OR BELOW`;
}
