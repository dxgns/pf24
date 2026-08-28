import type { ProcedureMatches } from "@/lib/pfpilot/approaches";
import type { FlightProcedure } from "@/lib/pfpilot/procedures";

export type PFPilotDirectKind = "ENROUTE" | "SID" | "STAR";

export type PFPilotDirectTarget = {
  kind: PFPilotDirectKind;
  waypoint: string;
};

const DIRECT_MARKER = "[PF24_DIRECT]";

function normalizeWaypoint(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]/g, "");
}

export function getPFPilotDirectTarget(notes: unknown): PFPilotDirectTarget | null {
  const text = String(notes ?? "");
  const match = text.match(/\[PF24_DIRECT\]\s*KIND=(ENROUTE|SID|STAR);FIX=([A-Z0-9._-]+)/i);
  if (!match) return null;
  const waypoint = normalizeWaypoint(match[2]);
  if (!waypoint) return null;
  return {
    kind: match[1].toUpperCase() as PFPilotDirectKind,
    waypoint,
  };
}

export function setPFPilotDirectTargetInNotes(
  notes: unknown,
  target: PFPilotDirectTarget | null,
) {
  const cleaned = String(notes ?? "")
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(DIRECT_MARKER))
    .join("\n")
    .trim();

  if (!target) return cleaned;
  const marker = `${DIRECT_MARKER} KIND=${target.kind};FIX=${normalizeWaypoint(target.waypoint)}`;
  return cleaned ? `${cleaned}\n${marker}` : marker;
}

function sliceProcedureFromFix(
  procedure: FlightProcedure | null,
  waypoint: string,
): FlightProcedure | null {
  if (!procedure) return null;
  const targetIndex = procedure.fixes.findIndex((fix) => fix.id.toUpperCase() === waypoint.toUpperCase());
  if (targetIndex < 0) return procedure;

  const fixes = procedure.fixes.slice(targetIndex);
  const fixIds = new Set(fixes.map((fix) => fix.id));
  const legs = procedure.legs.filter((leg) => fixIds.has(leg.from) && fixIds.has(leg.to));

  return {
    ...procedure,
    id: `${procedure.id}:DIRECT:${waypoint}`,
    entryFix: fixes[0]?.id ?? procedure.entryFix,
    fixes,
    legs,
    departureLeg: undefined,
  };
}

export function applyPFPilotDirectTarget(
  matches: ProcedureMatches,
  target: PFPilotDirectTarget | null,
): ProcedureMatches {
  if (!target) return matches;
  if (target.kind === "SID") {
    return {
      ...matches,
      sid: sliceProcedureFromFix(matches.sid, target.waypoint),
    };
  }
  if (target.kind === "STAR") {
    return {
      ...matches,
      star: sliceProcedureFromFix(matches.star, target.waypoint),
    };
  }
  return matches;
}
