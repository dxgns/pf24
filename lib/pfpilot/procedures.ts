import { WAYPOINTS } from "@/lib/scope/mapData";

export type ProcedureKind = "SID" | "STAR" | "APPROACH";
export type AltitudeRestriction =
  | { type: "AT"; feet: number }
  | { type: "AT_OR_ABOVE"; feet: number }
  | { type: "AT_OR_BELOW"; feet: number };

export type SpeedRestriction = { type: "MAX"; knots: number };

export type ProcedureFix = {
  id: string;
  label: string;
  mapPoint?: { x: number; y: number };
  altitude?: AltitudeRestriction;
  speed?: SpeedRestriction;
  source?: "NAMED_FIX" | "DME_FIX";
  dme?: {
    station: string;
    distanceNm: number;
    note: string;
  };
};

export type ProcedureLeg = {
  from: string;
  to: string;
  course: number;
};

export type FlightProcedure = {
  id: string;
  code: string;
  airport: string;
  runway: string;
  kind: ProcedureKind;
  entryFix: string;
  fixes: ProcedureFix[];
  legs: ProcedureLeg[];
  globalSpeed?: {
    belowFeet: number;
    maxKnots: number;
    note: string;
  };
  chart: string;
};

type FlightPlanLike = {
  arrival_icao?: unknown;
  route?: unknown;
};

function namedFix(name: string) {
  const target = WAYPOINTS.find((item) => item.name.toUpperCase() === name.toUpperCase());
  return target ? { x: target.x, y: target.y } : undefined;
}

const commonVogep: ProcedureFix = {
  id: "VOGEP",
  label: "VOGEP",
  mapPoint: namedFix("VOGEP"),
  altitude: { type: "AT", feet: 2500 },
  speed: { type: "MAX", knots: 200 },
  source: "NAMED_FIX",
};

export const MDST_PIXES4B: FlightProcedure = {
  id: "MDST-PIXES4B-RWY11",
  code: "PIXES4B",
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
    commonVogep,
  ],
  legs: [{ from: "PIXES", to: "VOGEP", course: 268 }],
  globalSpeed: {
    belowFeet: 10000,
    maxKnots: 250,
    note: "MAX 250 KT BELOW FL100 UNLESS OTHERWISE AUTHORIZED",
  },
};

export const MDST_ETBOD4B: FlightProcedure = {
  id: "MDST-ETBOD4B-RWY11",
  code: "ETBOD4B",
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
      altitude: { type: "AT_OR_ABOVE", feet: 4500 },
      source: "DME_FIX",
      dme: {
        station: "STI",
        distanceNm: 2,
        note: "Intersection of the published 033° arrival leg with D2.0 STI.",
      },
    },
    {
      id: "D1.8-STI",
      label: "D1.8 STI",
      altitude: { type: "AT_OR_ABOVE", feet: 3500 },
      speed: { type: "MAX", knots: 220 },
      source: "DME_FIX",
      dme: {
        station: "STI",
        distanceNm: 1.8,
        note: "Intersection of the published 033° arrival leg with D1.8 STI.",
      },
    },
    commonVogep,
  ],
  legs: [
    { from: "ETBOD", to: "D2.0-STI", course: 33 },
    { from: "D2.0-STI", to: "D1.8-STI", course: 33 },
    { from: "D1.8-STI", to: "VOGEP", course: 300 },
  ],
  globalSpeed: {
    belowFeet: 10000,
    maxKnots: 250,
    note: "MAX 250 KT BELOW FL100 UNLESS OTHERWISE AUTHORIZED",
  },
};

export const PROCEDURES: FlightProcedure[] = [MDST_PIXES4B, MDST_ETBOD4B];

function routeTokens(route: unknown) {
  return String(route ?? "")
    .toUpperCase()
    .split(/\s+/)
    .map((item) => item.replace(/[^A-Z0-9.]/g, ""))
    .filter(Boolean);
}

export function selectProcedureForPlan(plan: FlightPlanLike | null | undefined) {
  if (!plan) return null;
  const arrival = String(plan.arrival_icao ?? "").trim().toUpperCase();
  if (arrival !== "MDST") return null;

  const tokens = routeTokens(plan.route);
  if (tokens.includes("ETBOD") || tokens.includes("ETBOD4B") || tokens.includes("ETBO4B")) {
    return MDST_ETBOD4B;
  }
  if (tokens.includes("PIXES") || tokens.includes("PIXES4B") || tokens.includes("PIXE4B")) {
    return MDST_PIXES4B;
  }
  return null;
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
