import { WAYPOINTS } from "@/lib/scope/mapData";
import {
  PROCEDURES,
  resolveDmeMapPoint,
  type FlightProcedure,
  type MapPoint,
  type ProcedureFix,
} from "@/lib/pfpilot/procedures";
import { MAP_UNITS_PER_NM } from "@/lib/pfpilot/projectFlightLive";

export type ApproachMode = "ILS" | "LOC" | "RNAV";

export type ApproachMinimum = {
  type: "DA" | "MDA" | "DA/MDA";
  feet: number;
  mapFix?: string;
};

export type RnavTurnSegment = {
  fromFix: string;
  toFix: string;
  direction: "LEFT" | "RIGHT";
  entryCourse: number;
  exitCourse: number;
  noShortcut: boolean;
  note: string;
};

export type ApproachProfile = {
  modes: ApproachMode[];
  defaultMode: ApproachMode;
  modeTokens: Partial<Record<ApproachMode, string[]>>;
  finalCourse: number;
  navigationLabel?: string;
  localizer?: {
    ident: string;
    frequency: string;
    finalCourse: number;
  };
  airportElevationFeet: number;
  runwayElevationFeet: number;
  transitionAltitudeFeet: number;
  glideSlope?: {
    checkFix: string;
    checkAltitudeFeet: number;
    note: string;
  };
  minima: Partial<Record<ApproachMode, ApproachMinimum>>;
  visualAids?: {
    papi?: boolean;
    note?: string;
  };
  rnavTurn?: RnavTurnSegment;
  cdfa?: {
    points: Array<{ fix: string; altitudeFeet: number }>;
    note: string;
  };
  terrainCritical?: {
    fromFix: string;
    toFix: string;
    approximateClearanceFeet?: number;
    note: string;
  };
  missedApproach?: {
    initialCourse: number;
    turnAltitudeFeet: number;
    turnDirection: "LEFT" | "RIGHT";
    afterMode?: "HEADING" | "DIRECT";
    afterHeading?: number;
    targetFix: string;
    targetSpeedKnots?: number;
    climbAltitudeFeet: number;
    holdFix?: string;
    holdCourses?: [number, number];
    note: string;
  };
};

export type ApproachProcedure = FlightProcedure & {
  kind: "APPROACH";
  approach: ApproachProfile;
};

type FlightPlanLike = {
  departure_icao?: unknown;
  arrival_icao?: unknown;
  route?: unknown;
};

export type ProcedureMatches = {
  sid: FlightProcedure | null;
  star: FlightProcedure | null;
  approach: ApproachProcedure | null;
};

function namedFix(name: string) {
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

function resolveDmeFixFromCourseToTarget(
  station: MapPoint | undefined,
  distanceNm: number,
  target: MapPoint | undefined,
  courseToTarget: number,
): MapPoint | undefined {
  if (!station || !target) return undefined;
  const direction = bearingVector(courseToTarget);
  const radius = distanceNm * MAP_UNITS_PER_NM;
  const dx = target.x - station.x;
  const dy = target.y - station.y;

  // Candidate point = target - direction * t. Solve the DME circle and keep
  // the positive solution, i.e. the point from which the published course
  // reaches the target fix.
  const projection = dx * direction.x + dy * direction.y;
  const c = dx * dx + dy * dy - radius * radius;
  const discriminant = projection * projection - c;
  if (discriminant < 0) return undefined;

  const roots = [
    projection + Math.sqrt(discriminant),
    projection - Math.sqrt(discriminant),
  ].filter((value) => value >= 0);
  if (roots.length === 0) return undefined;
  const t = Math.min(...roots);

  return {
    x: target.x - direction.x * t,
    y: target.y - direction.y * t,
  };
}

function routeTokens(route: unknown) {
  return String(route ?? "")
    .toUpperCase()
    .split(/\s+/)
    .map((item) => item.replace(/[^A-Z0-9.]/g, ""))
    .filter(Boolean);
}

function procedureTokens(procedure: Pick<FlightProcedure, "code" | "aliases">) {
  return [procedure.code, ...(procedure.aliases ?? [])].map((item) => item.toUpperCase());
}

function routeContainsProcedure(
  procedure: Pick<FlightProcedure, "code" | "aliases">,
  tokens: Set<string>,
) {
  return procedureTokens(procedure).some((token) => tokens.has(token));
}

const mdstSgo = namedFix("SGO");
const mdstD30Sgo = resolveDmeMapPoint(mdstSgo, 294, 3);
const mdstD15Sgo = resolveDmeMapPoint(mdstSgo, 294, 1.5);
const mdstD03Sgo = resolveDmeMapPoint(mdstSgo, 294, 0.3);

const approachVogep: ProcedureFix = {
  id: "VOGEP",
  label: "VOGEP",
  mapPoint: namedFix("VOGEP"),
  altitude: { type: "AT", feet: 2500 },
  speed: { type: "MAX", knots: 200 },
  source: "NAMED_FIX",
};

export const MDST_ILS_LOC_RWY11: ApproachProcedure = {
  id: "MDST-ILS-LOC-RWY11",
  code: "ILS11",
  aliases: ["LOC11", "ILSLOC11", "ILSRWY11", "LOCRWY11"],
  airport: "MDST",
  runway: "11",
  kind: "APPROACH",
  entryFix: "VOGEP",
  chart: "MDST 10-5 · 9 JUL 26",
  fixes: [
    approachVogep,
    {
      id: "D3.0-SGO",
      label: "D3.0 SGO",
      mapPoint: mdstD30Sgo,
      altitude: { type: "AT", feet: 2000 },
      speed: { type: "MAX", knots: 180 },
      source: "DME_FIX",
      dme: {
        station: "SGO",
        distanceNm: 3,
        radial: 294,
        note: "D3.0 SGO resolved on R-294, reciprocal to the published 114° final approach course.",
      },
    },
    {
      id: "D1.5-SGO",
      label: "D1.5 SGO",
      mapPoint: mdstD15Sgo,
      source: "DME_FIX",
      dme: {
        station: "SGO",
        distanceNm: 1.5,
        radial: 294,
        note: "D1.5 SGO resolved on R-294. 1100 FT is stored as the ILS glideslope altitude check, not as a LOC altitude restriction.",
      },
    },
    {
      id: "D0.3-SGO",
      label: "D0.3 SGO",
      mapPoint: mdstD03Sgo,
      source: "DME_FIX",
      dme: {
        station: "SGO",
        distanceNm: 0.3,
        radial: 294,
        note: "D0.3 SGO is the published LOC missed-approach point on the profile view.",
      },
    },
  ],
  legs: [
    { from: "VOGEP", to: "D3.0-SGO", course: 205 },
    { from: "D3.0-SGO", to: "D1.5-SGO", course: 114 },
    { from: "D1.5-SGO", to: "D0.3-SGO", course: 114 },
  ],
  approach: {
    modes: ["ILS", "LOC"],
    defaultMode: "ILS",
    modeTokens: {
      ILS: ["ILS11", "ILSRWY11", "ILSLOC11"],
      LOC: ["LOC11", "LOCRWY11"],
    },
    finalCourse: 114,
    navigationLabel: "ILS / LOC",
    localizer: {
      ident: "IDST",
      frequency: "109.3",
      finalCourse: 114,
    },
    airportElevationFeet: 565,
    runwayElevationFeet: 565,
    transitionAltitudeFeet: 3000,
    glideSlope: {
      checkFix: "D1.5-SGO",
      checkAltitudeFeet: 1100,
      note: "Published ILS GS altitude check at D1.5 SGO. No synthetic glide-slope angle is inferred from the chart.",
    },
    minima: {
      ILS: { type: "DA", feet: 765 },
      LOC: { type: "MDA", feet: 1170, mapFix: "D0.3-SGO" },
    },
    visualAids: {
      papi: true,
      note: "PAPI may be used as a visual cross-check when the runway environment is in sight and visibility permits. It does not replace published ILS/LOC minima.",
    },
    missedApproach: {
      initialCourse: 114,
      turnAltitudeFeet: 1000,
      turnDirection: "LEFT",
      afterMode: "HEADING",
      afterHeading: 295,
      targetFix: "VOGEP",
      targetSpeedKnots: 200,
      climbAltitudeFeet: 2500,
      holdFix: "VOGEP",
      holdCourses: [295, 115],
      note: "Climb to 2500 FT on course 114°. At 1000 FT turn LEFT direct VOGEP heading 295°. Hold over VOGEP or follow ATC instructions.",
    },
  },
};

const mdstRnavD20Sgo = resolveDmeMapPoint(mdstSgo, 60, 2);
const mdstRnavD17Sgo = resolveDmeMapPoint(mdstSgo, 114, 1.7);
const mdstRnavD07Sgo = resolveDmeMapPoint(mdstSgo, 114, 0.7);
const mdstRnavD27Sgo = resolveDmeFixFromCourseToTarget(mdstSgo, 2.7, mdstRnavD17Sgo, 225);

export const MDST_RNAV_RWY29: ApproachProcedure = {
  id: "MDST-RNAV-GNSS-RWY29",
  code: "RNAV29",
  aliases: ["RNP29", "GNSS29", "RNAVRWY29", "RNAVGNSS29"],
  airport: "MDST",
  runway: "29",
  kind: "APPROACH",
  entryFix: "SGO",
  chart: "MDST 10-0 · 10 JUL 26",
  fixes: [
    {
      id: "SGO",
      label: "SGO VOR",
      mapPoint: mdstSgo,
      altitude: { type: "AT", feet: 2000 },
      speed: { type: "MAX", knots: 180 },
      source: "NAMED_FIX",
    },
    {
      id: "D2.0-SGO-RNAV29",
      label: "D2.0 SGO",
      mapPoint: mdstRnavD20Sgo,
      altitude: { type: "AT", feet: 2500 },
      speed: { type: "MAX", knots: 180 },
      source: "DME_FIX",
      dme: {
        station: "SGO",
        distanceNm: 2,
        radial: 60,
        note: "Outbound RNAV fix: D2.0 SGO on the published 060° radial from SGO.",
      },
    },
    {
      id: "D2.7-SGO-RNAV29",
      label: "D2.7 SGO",
      mapPoint: mdstRnavD27Sgo,
      altitude: { type: "AT", feet: 1800 },
      speed: { type: "MAX", knots: 160 },
      source: "DME_FIX",
      dme: {
        station: "SGO",
        distanceNm: 2.7,
        note: "Resolved as the D2.7 SGO point from which the published 225° leg reaches D1.7 SGO. The preceding right-turn curvature remains procedural guidance and is not replaced by a straight chord.",
      },
    },
    {
      id: "D1.7-SGO-RNAV29",
      label: "D1.7 SGO",
      mapPoint: mdstRnavD17Sgo,
      altitude: { type: "AT", feet: 1500 },
      source: "DME_FIX",
      dme: {
        station: "SGO",
        distanceNm: 1.7,
        radial: 114,
        note: "D1.7 SGO on R-114, reciprocal to the published 294° final approach course.",
      },
    },
    {
      id: "D0.7-SGO-RNAV29",
      label: "D0.7 SGO",
      mapPoint: mdstRnavD07Sgo,
      source: "DME_FIX",
      dme: {
        station: "SGO",
        distanceNm: 0.7,
        radial: 114,
        note: "D0.7 SGO on the 294° final. The chart depicts the missed-approach point separately beyond this reference, so D0.7 is not treated as the MAP.",
      },
    },
  ],
  legs: [
    { from: "SGO", to: "D2.0-SGO-RNAV29", course: 60 },
    { from: "D2.0-SGO-RNAV29", to: "D2.7-SGO-RNAV29", course: 225 },
    { from: "D2.7-SGO-RNAV29", to: "D1.7-SGO-RNAV29", course: 225 },
    { from: "D1.7-SGO-RNAV29", to: "D0.7-SGO-RNAV29", course: 294 },
  ],
  approach: {
    modes: ["RNAV"],
    defaultMode: "RNAV",
    modeTokens: {
      RNAV: ["RNAV29", "RNP29", "GNSS29", "RNAVRWY29", "RNAVGNSS29"],
    },
    finalCourse: 294,
    navigationLabel: "RNAV (GNSS)",
    airportElevationFeet: 565,
    runwayElevationFeet: 556,
    transitionAltitudeFeet: 3000,
    minima: {
      RNAV: { type: "DA/MDA", feet: 1060 },
    },
    visualAids: {
      papi: true,
      note: "PAPI is a visual cross-check only once the runway environment is in sight and visibility permits; it does not replace RNAV minima or the published path.",
    },
    rnavTurn: {
      fromFix: "D2.0-SGO-RNAV29",
      toFix: "D2.7-SGO-RNAV29",
      direction: "RIGHT",
      entryCourse: 60,
      exitCourse: 225,
      noShortcut: true,
      note: "Pronounced descending right turn from the outbound 060° segment. Follow the published RNAV curvature; do not fly a direct chord from D2.0 to D2.7 because the turn geometry is terrain-critical and is designed to leave the aircraft close to final alignment.",
    },
    cdfa: {
      points: [
        { fix: "D2.7-SGO-RNAV29", altitudeFeet: 1800 },
        { fix: "D1.7-SGO-RNAV29", altitudeFeet: 1500 },
      ],
      note: "CDFA profile uses the published altitude checks. PFPilot provides advisory vertical trend guidance only and never substitutes a synthetic glide path for the published procedure.",
    },
    terrainCritical: {
      fromFix: "D2.0-SGO-RNAV29",
      toFix: "D2.7-SGO-RNAV29",
      approximateClearanceFeet: 500,
      note: "Terrain-critical segment as supplied for PF24: clearance can be roughly 500 FT. Maintain the published RNAV path, altitude and speed; do not shorten the turn.",
    },
    missedApproach: {
      initialCourse: 294,
      turnAltitudeFeet: 2000,
      turnDirection: "RIGHT",
      afterMode: "DIRECT",
      targetFix: "VOGEP",
      climbAltitudeFeet: 3000,
      holdFix: "VOGEP",
      holdCourses: [343, 163],
      note: "Climb to 3000 FT on course 294°. At 2000 FT turn RIGHT direct VOGEP. Hold over VOGEP or follow ATC instructions.",
    },
  },
};

export const APPROACHES: ApproachProcedure[] = [MDST_ILS_LOC_RWY11, MDST_RNAV_RWY29];

export function selectProcedureMatches(plan: FlightPlanLike | null | undefined): ProcedureMatches {
  if (!plan) return { sid: null, star: null, approach: null };

  const departure = String(plan.departure_icao ?? "").trim().toUpperCase();
  const arrival = String(plan.arrival_icao ?? "").trim().toUpperCase();
  const tokens = new Set(routeTokens(plan.route));

  const sid = PROCEDURES.find((procedure) => (
    procedure.kind === "SID" &&
    procedure.airport === departure &&
    routeContainsProcedure(procedure, tokens)
  )) ?? null;

  const star = PROCEDURES.find((procedure) => (
    procedure.kind === "STAR" &&
    procedure.airport === arrival &&
    routeContainsProcedure(procedure, tokens)
  )) ?? null;

  const approach = APPROACHES.find((procedure) => (
    procedure.airport === arrival && routeContainsProcedure(procedure, tokens)
  )) ?? null;

  return { sid, star, approach };
}

export function selectApproachModeForPlan(
  plan: FlightPlanLike | null | undefined,
  procedure: ApproachProcedure | null | undefined,
): ApproachMode | null {
  if (!procedure) return null;
  const tokens = new Set(routeTokens(plan?.route));

  for (const mode of procedure.approach.modes) {
    const modeTokens = procedure.approach.modeTokens[mode] ?? [];
    if (modeTokens.some((token) => tokens.has(token))) return mode;
  }

  return procedure.approach.defaultMode;
}
