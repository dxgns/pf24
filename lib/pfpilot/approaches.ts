import { WAYPOINTS } from "@/lib/scope/mapData";
import {
  PROCEDURES,
  resolveDmeMapPoint,
  type FlightProcedure,
  type ProcedureFix,
} from "@/lib/pfpilot/procedures";

export type ApproachMode = "ILS" | "LOC";

export type ApproachMinimum = {
  type: "DA" | "MDA";
  feet: number;
  mapFix?: string;
};

export type ApproachProfile = {
  modes: ApproachMode[];
  defaultMode: ApproachMode;
  modeTokens: Partial<Record<ApproachMode, string[]>>;
  localizer: {
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
  missedApproach?: {
    initialCourse: number;
    turnAltitudeFeet: number;
    turnDirection: "LEFT" | "RIGHT";
    afterHeading: number;
    targetFix: string;
    climbAltitudeFeet: number;
    holdFix?: string;
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
      afterHeading: 295,
      targetFix: "VOGEP",
      climbAltitudeFeet: 2500,
      holdFix: "VOGEP",
      note: "Climb to 2500 FT on course 114°. At 1000 FT turn LEFT direct VOGEP heading 295°. Hold over VOGEP or follow ATC instructions.",
    },
  },
};

export const APPROACHES: ApproachProcedure[] = [MDST_ILS_LOC_RWY11];

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
