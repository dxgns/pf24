"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  selectApproachModeForPlan,
  selectProcedureMatches,
  type ApproachMode,
  type ApproachProcedure,
  type ProcedureMatches,
} from "@/lib/pfpilot/approaches";
import {
  getProcedureFix,
  type AltitudeRestriction,
  type FlightProcedure,
  type ProcedureKind,
  type ProcedureFix,
} from "@/lib/pfpilot/procedures";
import {
  bearingToMapPoint,
  connectProjectFlightTraffic,
  distanceToMapLegNm,
  mapDistanceNm,
  normalizeProjectFlightCallsign,
  type ProjectFlightConnectionState,
  type ProjectFlightTelemetry,
} from "@/lib/pfpilot/projectFlightLive";
import { getGameCallsignFromNotes } from "@/lib/flightPlanGameCallsign";
import { WAYPOINTS } from "@/lib/scope/mapData";
import { normalizeAirlineCallsign, spokenAirlineCallsign } from "@/lib/scope/airlines";

type PilotPlan = {
  id: string;
  callsign?: string;
  notes?: string | null;
  departure_icao?: string;
  arrival_icao?: string;
  route?: string;
  flight_level?: string;
  [key: string]: unknown;
};

type RoutePoint = {
  id: string;
  x: number;
  y: number;
};

type AltitudePlan = {
  targetFeet: number;
  distanceNm: number | null;
  requiredNm: number;
};

const TARGET_TELEMETRY_FRESH_MS = 20000;
const TARGET_TELEMETRY_HOLD_MS = 60000;
const FIX_CAPTURE_NM: Record<ProcedureKind, number> = {
  SID: 0.2,
  STAR: 0.25,
  APPROACH: 0.14,
};
const OVERSHOOT_CAPTURE_NM: Record<ProcedureKind, number> = {
  SID: 0.34,
  STAR: 0.4,
  APPROACH: 0.22,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function paddedHeading(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "---";
  return String((Math.round(value) + 360) % 360).padStart(3, "0");
}

function normalizedUsername(value: string) {
  return value.trim().replace(/^@/, "").toLowerCase();
}

function statusTone(state: ProjectFlightConnectionState, linked: boolean) {
  if (state === "LIVE" && linked) return "text-green-300";
  if (state === "LIVE") return "text-amber-300";
  return "text-slate-500";
}

function procedureForKind(matches: ProcedureMatches, kind: ProcedureKind | null) {
  if (kind === "SID") return matches.sid;
  if (kind === "STAR") return matches.star;
  if (kind === "APPROACH") return matches.approach;
  return null;
}

function approachModeLabel(mode: ApproachMode) {
  if (mode === "LOC") return "LOC (GS OUT)";
  if (mode === "RNAV") return "RNAV (GNSS)";
  return "ILS";
}

function parseFiledAltitude(value: unknown) {
  const text = String(value ?? "").trim().toUpperCase();
  const numeric = Number(text.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  if (text.includes("FL")) return Math.round(numeric * 100);
  if (numeric <= 600) return Math.round(numeric * 100);
  return Math.round(numeric);
}

function altitudeLabel(feet: number) {
  const rounded = Math.max(0, Math.round(feet / 100) * 100);
  if (rounded >= 10000) return `FL${String(Math.round(rounded / 100)).padStart(3, "0")}`;
  return `${rounded.toLocaleString("en-US")} FT`;
}

function speedLabel(knots: number) {
  return `${Math.max(0, Math.round(knots / 10) * 10)} KT`;
}

function routePoints(route: unknown): RoutePoint[] {
  const lookup = new Map(WAYPOINTS.map((point) => [point.name.toUpperCase(), point]));
  const seen = new Set<string>();
  return String(route ?? "")
    .toUpperCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^A-Z0-9]/g, ""))
    .flatMap((token) => {
      const point = lookup.get(token);
      if (!point || seen.has(token)) return [];
      seen.add(token);
      return [{ id: token, x: point.x, y: point.y }];
    });
}

function restrictionTarget(
  restriction: AltitudeRestriction,
  altitude: number,
): number | null {
  if (restriction.type === "AT" || restriction.type === "AT_OR_BELOW") return restriction.feet;
  return altitude < restriction.feet - 100 ? restriction.feet : null;
}

function distanceToProcedureFix(
  procedure: FlightProcedure,
  targetIndex: number,
  futureIndex: number,
  position: { x: number; y: number },
) {
  if (futureIndex < targetIndex) return null;
  const current = procedure.fixes[targetIndex];
  if (!current?.mapPoint) return null;
  let distance = mapDistanceNm(position, current.mapPoint);
  for (let index = targetIndex + 1; index <= futureIndex; index += 1) {
    const previous = procedure.fixes[index - 1]?.mapPoint;
    const next = procedure.fixes[index]?.mapPoint;
    if (!previous || !next) return null;
    distance += mapDistanceNm(previous, next);
  }
  return distance;
}

function findSidAltitudeTarget(
  procedure: FlightProcedure,
  targetIndex: number,
  altitude: number,
  filedAltitude: number | null,
  position: { x: number; y: number },
): AltitudePlan {
  let highestFloor = 0;

  for (let index = targetIndex; index < procedure.fixes.length; index += 1) {
    const restriction = procedure.fixes[index].altitude;
    if (!restriction) continue;
    if (restriction.type === "AT_OR_ABOVE") {
      highestFloor = Math.max(highestFloor, restriction.feet);
      continue;
    }

    const target = restriction.feet;
    const distanceNm = distanceToProcedureFix(procedure, targetIndex, index, position);
    return {
      targetFeet: restriction.type === "AT_OR_BELOW"
        ? Math.min(filedAltitude ?? target, target)
        : target,
      distanceNm,
      requiredNm: Math.max(0, altitude - target) / 300,
    };
  }

  const target = Math.max(highestFloor, filedAltitude ?? Math.max(highestFloor, Math.round(altitude / 100) * 100));
  return { targetFeet: target, distanceNm: null, requiredNm: 0 };
}

function findArrivalAltitudeTarget(
  procedure: FlightProcedure,
  targetIndex: number,
  altitude: number,
  filedAltitude: number | null,
  position: { x: number; y: number },
  approach: ApproachProcedure | null,
  mode: ApproachMode,
) {
  const currentFix = procedure.fixes[targetIndex] ?? null;

  if (approach?.approach.glideSlope?.checkFix === currentFix?.id && mode === "ILS") {
    const target = approach.approach.glideSlope.checkAltitudeFeet;
    return {
      targetFeet: target,
      distanceNm: currentFix?.mapPoint ? mapDistanceNm(position, currentFix.mapPoint) : null,
      requiredNm: Math.max(0, altitude - target) / 300,
    } satisfies AltitudePlan;
  }

  for (let index = targetIndex; index < procedure.fixes.length; index += 1) {
    const restriction = procedure.fixes[index].altitude;
    if (!restriction) continue;
    const target = restrictionTarget(restriction, altitude);
    if (target === null) continue;
    const distanceNm = distanceToProcedureFix(procedure, targetIndex, index, position);
    const requiredNm = Math.max(0, altitude - target) / 300;

    // Do not command an early descent hundreds of miles before a restriction.
    // The 3:1 rule plus a 2 NM stabilization buffer is deliberately conservative.
    if (target < altitude - 150 && distanceNm !== null && distanceNm > requiredNm + 2) {
      return {
        targetFeet: filedAltitude && Math.abs(altitude - filedAltitude) < 1500
          ? filedAltitude
          : Math.round(altitude / 100) * 100,
        distanceNm,
        requiredNm,
      } satisfies AltitudePlan;
    }

    return { targetFeet: target, distanceNm, requiredNm } satisfies AltitudePlan;
  }

  const minimum = approach?.approach.minima[mode];
  if (minimum) {
    const mapIndex = minimum.mapFix
      ? procedure.fixes.findIndex((fix) => fix.id === minimum.mapFix)
      : procedure.fixes.length - 1;
    const effectiveIndex = mapIndex >= targetIndex ? mapIndex : procedure.fixes.length - 1;
    const distanceNm = distanceToProcedureFix(procedure, targetIndex, effectiveIndex, position);
    return {
      targetFeet: minimum.feet,
      distanceNm,
      requiredNm: Math.max(0, altitude - minimum.feet) / 300,
    } satisfies AltitudePlan;
  }

  return {
    targetFeet: filedAltitude ?? Math.round(altitude / 100) * 100,
    distanceNm: null,
    requiredNm: 0,
  } satisfies AltitudePlan;
}

function latestPublishedSpeed(procedure: FlightProcedure, targetIndex: number) {
  let result: number | null = null;
  for (let index = 0; index <= Math.min(targetIndex, procedure.fixes.length - 1); index += 1) {
    if (procedure.fixes[index].speed) result = procedure.fixes[index].speed!.knots;
  }
  return result;
}

function predictiveSpeedTarget({
  procedure,
  targetIndex,
  telemetry,
  altitudePlan,
  position,
  departureSpeed,
}: {
  procedure: FlightProcedure | null;
  targetIndex: number;
  telemetry: ProjectFlightTelemetry;
  altitudePlan: AltitudePlan;
  position: { x: number; y: number };
  departureSpeed?: number;
}) {
  const currentGs = Math.max(0, telemetry.groundSpeed);
  let target = Math.max(0, Math.round(currentGs / 10) * 10);

  if (!procedure) return target;

  const sticky = latestPublishedSpeed(procedure, targetIndex);
  if (sticky !== null) target = Math.min(target || sticky, sticky);
  if (departureSpeed) target = Math.min(target || departureSpeed, departureSpeed);

  if (procedure.globalSpeed && telemetry.altitude < procedure.globalSpeed.belowFeet) {
    target = Math.min(target || procedure.globalSpeed.maxKnots, procedure.globalSpeed.maxKnots);
  }

  for (let index = targetIndex; index < procedure.fixes.length; index += 1) {
    const limit = procedure.fixes[index].speed?.knots;
    if (!limit) continue;
    const distanceNm = distanceToProcedureFix(procedure, targetIndex, index, position);
    if (distanceNm === null) continue;
    const excess = Math.max(0, currentGs - limit);
    const decelerationDistance = 1.5 + excess * 0.1;
    if (distanceNm <= decelerationDistance) target = Math.min(target || limit, limit);
  }

  if (
    altitudePlan.distanceNm !== null &&
    altitudePlan.targetFeet < telemetry.altitude - 200
  ) {
    const shortfall = altitudePlan.requiredNm - altitudePlan.distanceNm;
    if (shortfall > 0.5) {
      const energyTarget = Math.max(
        150,
        Math.floor((currentGs - 20 - Math.min(40, shortfall * 10)) / 10) * 10,
      );
      target = Math.min(target || energyTarget, energyTarget);
    }
  }

  return Math.max(0, target);
}

function turnHeading(
  approach: ApproachProcedure,
  currentFix: ProcedureFix | null,
  position: { x: number; y: number },
) {
  const turn = approach.approach.rnavTurn;
  if (!turn || currentFix?.id !== turn.toFix) return null;
  const from = getProcedureFix(approach, turn.fromFix)?.mapPoint;
  const to = getProcedureFix(approach, turn.toFix)?.mapPoint;
  if (!from || !to) return null;
  const total = Math.max(0.01, mapDistanceNm(from, to));
  const progress = clamp(mapDistanceNm(from, position) / total, 0, 1);
  const delta = turn.direction === "RIGHT"
    ? (turn.exitCourse - turn.entryCourse + 360) % 360
    : -((turn.entryCourse - turn.exitCourse + 360) % 360);
  return (turn.entryCourse + delta * progress + 360) % 360;
}

export default function PFPilotGuidanceDirectorV2({ plan }: { plan: PilotPlan | null }) {
  const [enabled, setEnabled] = useState(false);
  const [connectionState, setConnectionState] = useState<ProjectFlightConnectionState>("OFFLINE");
  const [telemetry, setTelemetry] = useState<ProjectFlightTelemetry | null>(null);
  const [lastSeen, setLastSeen] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [robloxUsername, setRobloxUsername] = useState("");
  const [activeKind, setActiveKind] = useState<ProcedureKind | null>(null);
  const [targetIndex, setTargetIndex] = useState(0);
  const [procedureComplete, setProcedureComplete] = useState(false);
  const [departureConditionMet, setDepartureConditionMet] = useState(false);
  const [approachMode, setApproachMode] = useState<ApproachMode>("ILS");
  const [missedApproachActive, setMissedApproachActive] = useState(false);
  const [missedTurnAltitudeMet, setMissedTurnAltitudeMet] = useState(false);
  const [enrouteIndex, setEnrouteIndex] = useState(0);
  const routeInitializedRef = useRef(false);
  const targetHistoryRef = useRef({ key: "", min: Number.POSITIVE_INFINITY, last: Number.POSITIVE_INFINITY });

  const matches = useMemo(
    () => selectProcedureMatches(plan),
    [plan?.departure_icao, plan?.arrival_icao, plan?.route, plan?.notes],
  );
  const procedure = useMemo(
    () => procedureForKind(matches, activeKind),
    [matches, activeKind],
  );
  const approachProcedure = activeKind === "APPROACH" ? matches.approach : null;
  const filedAltitude = useMemo(() => parseFiledAltitude(plan?.flight_level), [plan?.flight_level]);
  const enroutePoints = useMemo(() => routePoints(plan?.route), [plan?.route]);

  const gameCallsign = useMemo(
    () => normalizeAirlineCallsign(
      normalizeProjectFlightCallsign(getGameCallsignFromNotes(plan?.notes) || String(plan?.callsign ?? "")),
    ),
    [plan?.callsign, plan?.notes],
  );
  const projectFlightCallsign = useMemo(
    () => gameCallsign ? spokenAirlineCallsign(gameCallsign) : "",
    [gameCallsign],
  );

  useEffect(() => {
    if (!plan?.id) {
      setEnabled(false);
      return;
    }
    try {
      setEnabled(window.sessionStorage.getItem(`pf24-guidance-enabled:${plan.id}`) === "1");
    } catch {
      setEnabled(false);
    }
  }, [plan?.id]);

  useEffect(() => {
    const username = document
      .querySelector<HTMLElement>("main[data-pf24-roblox-username]")
      ?.dataset.pf24RobloxUsername ?? "";
    setRobloxUsername(normalizedUsername(username));
  }, [plan?.id]);

  useEffect(() => {
    setTelemetry(null);
    setLastSeen(0);
    setActiveKind(matches.sid ? "SID" : null);
    setTargetIndex(0);
    setProcedureComplete(false);
    setDepartureConditionMet(false);
    setMissedApproachActive(false);
    setMissedTurnAltitudeMet(false);
    setEnrouteIndex(0);
    routeInitializedRef.current = false;
  }, [plan?.id]);

  useEffect(() => {
    const selected = selectApproachModeForPlan(plan, matches.approach);
    if (selected) setApproachMode(selected);
  }, [plan?.id, plan?.route, plan?.notes, matches.approach?.id]);

  useEffect(() => {
    if (!plan?.id || (!robloxUsername && !gameCallsign)) {
      setConnectionState("OFFLINE");
      return;
    }

    return connectProjectFlightTraffic({
      onState: setConnectionState,
      onTraffic: (traffic) => {
        const byUser = robloxUsername
          ? traffic.find((item) => normalizedUsername(item.username) === robloxUsername)
          : undefined;
        const byCallsign = traffic.find((item) =>
          normalizeAirlineCallsign(item.callsign) === gameCallsign ||
          normalizeAirlineCallsign(item.rawCallsign) === gameCallsign,
        );
        const aircraft = byUser ?? byCallsign;
        if (!aircraft) return;
        setTelemetry(aircraft);
        setLastSeen(Date.now());
      },
    });
  }, [plan?.id, gameCallsign, robloxUsername]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const telemetryAge = telemetry && lastSeen ? Math.max(0, clock - lastSeen) : Number.POSITIVE_INFINITY;
  const telemetryFresh = Boolean(telemetry && telemetryAge < TARGET_TELEMETRY_FRESH_MS);
  const telemetryHeld = Boolean(telemetry && telemetryAge < TARGET_TELEMETRY_HOLD_MS);
  const activeTelemetry = telemetryHeld ? telemetry : null;
  const position = activeTelemetry ? { x: activeTelemetry.mapX, y: activeTelemetry.mapY } : null;

  useEffect(() => {
    if (!procedure) return;
    setTargetIndex(0);
    setProcedureComplete(false);
    setDepartureConditionMet(false);
    setMissedApproachActive(false);
    setMissedTurnAltitudeMet(false);
    targetHistoryRef.current = { key: "", min: Number.POSITIVE_INFINITY, last: Number.POSITIVE_INFINITY };
  }, [procedure?.id]);

  const departureLeg = procedure?.departureLeg ?? null;
  const departureLegActive = Boolean(departureLeg && !departureConditionMet);
  const currentFix = procedure?.fixes[Math.min(targetIndex, Math.max(0, procedure.fixes.length - 1))] ?? null;
  const currentFixDistance = position && currentFix?.mapPoint ? mapDistanceNm(position, currentFix.mapPoint) : null;

  useEffect(() => {
    if (!departureLeg || !activeTelemetry || departureConditionMet) return;
    if (activeTelemetry.altitude >= departureLeg.untilAltitudeFeet) setDepartureConditionMet(true);
  }, [departureLeg, departureConditionMet, activeTelemetry]);

  useEffect(() => {
    const missed = approachProcedure?.approach.missedApproach;
    if (!missedApproachActive || !missed || !activeTelemetry || missedTurnAltitudeMet) return;
    if (activeTelemetry.altitude >= missed.turnAltitudeFeet) setMissedTurnAltitudeMet(true);
  }, [approachProcedure, missedApproachActive, missedTurnAltitudeMet, activeTelemetry]);

  useEffect(() => {
    if (!procedure || procedureComplete || missedApproachActive || currentFixDistance === null) return;
    if (departureLegActive) return;

    const key = `${procedure.id}:${targetIndex}`;
    const history = targetHistoryRef.current;
    if (history.key !== key) {
      targetHistoryRef.current = { key, min: currentFixDistance, last: currentFixDistance };
      return;
    }

    const min = Math.min(history.min, currentFixDistance);
    const directCapture = currentFixDistance <= FIX_CAPTURE_NM[procedure.kind];
    const crossedAfterClosePass = min <= OVERSHOOT_CAPTURE_NM[procedure.kind] && currentFixDistance > history.last + 0.03;
    targetHistoryRef.current = { key, min, last: currentFixDistance };
    if (!directCapture && !crossedAfterClosePass) return;

    if (targetIndex < procedure.fixes.length - 1) {
      setTargetIndex((index) => index + 1);
      return;
    }

    if (procedure.kind !== "APPROACH") setProcedureComplete(true);
  }, [procedure, procedureComplete, missedApproachActive, currentFixDistance, departureLegActive, targetIndex]);

  useEffect(() => {
    if (!activeTelemetry || enroutePoints.length === 0 || routeInitializedRef.current) return;
    if (activeKind === "SID" && !procedureComplete) return;
    const p = { x: activeTelemetry.mapX, y: activeTelemetry.mapY };

    for (let index = 0; index < enroutePoints.length - 1; index += 1) {
      const track = distanceToMapLegNm(p, enroutePoints[index], enroutePoints[index + 1]);
      if (track.progress >= -0.05 && track.progress <= 1.15 && track.distanceNm <= 4) {
        setEnrouteIndex(index + 1);
        routeInitializedRef.current = true;
        return;
      }
    }

    const nearest = enroutePoints
      .map((point, index) => ({ index, distance: mapDistanceNm(p, point) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (nearest) setEnrouteIndex(nearest.distance <= 1 && nearest.index < enroutePoints.length - 1 ? nearest.index + 1 : nearest.index);
    routeInitializedRef.current = true;
  }, [activeTelemetry, enroutePoints, activeKind, procedureComplete]);

  const enrouteTarget = enroutePoints[Math.min(enrouteIndex, Math.max(0, enroutePoints.length - 1))] ?? null;
  const enrouteDistance = position && enrouteTarget ? mapDistanceNm(position, enrouteTarget) : null;

  useEffect(() => {
    if (!activeTelemetry || !enrouteTarget || enrouteDistance === null) return;
    const enrouteActive = activeKind === null || (activeKind === "SID" && procedureComplete);
    if (!enrouteActive || enrouteDistance > 0.25) return;
    if (enrouteIndex < enroutePoints.length - 1) setEnrouteIndex((index) => index + 1);
  }, [activeTelemetry, enrouteTarget, enrouteDistance, activeKind, procedureComplete, enrouteIndex, enroutePoints.length]);

  useEffect(() => {
    if (!position) return;
    const nearEntry = (candidate: FlightProcedure | null, miles: number) => {
      if (!candidate) return false;
      const entry = getProcedureFix(candidate, candidate.entryFix)?.mapPoint;
      return Boolean(entry && mapDistanceNm(position, entry) <= miles);
    };

    if ((activeKind === null || (activeKind === "SID" && procedureComplete)) && nearEntry(matches.star, 6)) {
      setActiveKind("STAR");
      return;
    }
    if ((activeKind === null || (activeKind === "STAR" && procedureComplete)) && nearEntry(matches.approach, 5)) {
      setActiveKind("APPROACH");
    }
  }, [position?.x, position?.y, activeKind, procedureComplete, matches.star?.id, matches.approach?.id]);

  const altitudePlan = useMemo<AltitudePlan>(() => {
    if (!activeTelemetry || !position) return { targetFeet: filedAltitude ?? 0, distanceNm: null, requiredNm: 0 };
    const missed = approachProcedure?.approach.missedApproach;
    if (missedApproachActive && missed) {
      return {
        targetFeet: missed.climbAltitudeFeet,
        distanceNm: null,
        requiredNm: 0,
      };
    }
    if (departureLegActive && departureLeg) {
      return {
        targetFeet: departureLeg.untilAltitudeFeet,
        distanceNm: null,
        requiredNm: 0,
      };
    }
    if (!procedure || (procedure.kind === "SID" && procedureComplete)) {
      return {
        targetFeet: filedAltitude ?? Math.round(activeTelemetry.altitude / 100) * 100,
        distanceNm: null,
        requiredNm: 0,
      };
    }
    if (procedure.kind === "SID") {
      return findSidAltitudeTarget(procedure, targetIndex, activeTelemetry.altitude, filedAltitude, position);
    }
    return findArrivalAltitudeTarget(
      procedure,
      targetIndex,
      activeTelemetry.altitude,
      filedAltitude,
      position,
      approachProcedure,
      approachMode,
    );
  }, [activeTelemetry, position?.x, position?.y, filedAltitude, procedure, procedureComplete, targetIndex, departureLegActive, departureLeg, approachProcedure, approachMode, missedApproachActive]);

  const missed = approachProcedure?.approach.missedApproach;
  const missedTarget = approachProcedure && missed ? getProcedureFix(approachProcedure, missed.targetFix) : null;

  const headingTarget = useMemo(() => {
    if (!activeTelemetry || !position) return null;
    if (missedApproachActive && missed) {
      if (!missedTurnAltitudeMet) return missed.initialCourse;
      if (missed.afterMode === "HEADING" && typeof missed.afterHeading === "number") return missed.afterHeading;
      if (missedTarget?.mapPoint) return bearingToMapPoint(position, missedTarget.mapPoint);
      return missed.initialCourse;
    }
    if (departureLegActive && departureLeg) return departureLeg.heading;
    if (departureLeg && departureConditionMet && currentFix?.mapPoint && departureLeg.afterCourseMode === "HEADING") {
      return departureLeg.afterCourse;
    }
    if (approachProcedure && currentFix && approachMode === "RNAV") {
      const curved = turnHeading(approachProcedure, currentFix, position);
      if (curved !== null) return curved;
    }
    if (procedure && !procedureComplete && currentFix?.mapPoint) {
      return bearingToMapPoint(position, currentFix.mapPoint);
    }
    if ((activeKind === null || (activeKind === "SID" && procedureComplete)) && enrouteTarget) {
      return bearingToMapPoint(position, enrouteTarget);
    }
    if (approachProcedure) return approachProcedure.approach.finalCourse;
    return activeTelemetry.heading;
  }, [activeTelemetry, position?.x, position?.y, missedApproachActive, missed, missedTurnAltitudeMet, missedTarget?.mapPoint, departureLegActive, departureLeg, departureConditionMet, currentFix?.id, currentFix?.mapPoint, approachProcedure, approachMode, procedure, procedureComplete, activeKind, enrouteTarget]);

  const speedTarget = useMemo(() => {
    if (!activeTelemetry || !position) return 0;
    if (missedApproachActive && missed?.targetSpeedKnots) return missed.targetSpeedKnots;
    return predictiveSpeedTarget({
      procedure: procedureComplete && procedure?.kind === "SID" ? null : procedure,
      targetIndex,
      telemetry: activeTelemetry,
      altitudePlan,
      position,
      departureSpeed: departureLegActive ? departureLeg?.speed?.knots : undefined,
    });
  }, [activeTelemetry, position?.x, position?.y, missedApproachActive, missed?.targetSpeedKnots, procedure, procedureComplete, targetIndex, altitudePlan, departureLegActive, departureLeg?.speed?.knots]);

  const toggleGuidance = () => {
    setEnabled((current) => {
      const next = !current;
      if (plan?.id) {
        try {
          window.sessionStorage.setItem(`pf24-guidance-enabled:${plan.id}`, next ? "1" : "0");
        } catch {
          // Guidance remains usable even if browser storage is unavailable.
        }
      }
      return next;
    });
  };

  const activateKind = (kind: ProcedureKind) => {
    if (!procedureForKind(matches, kind)) return;
    setActiveKind(kind);
    setTargetIndex(0);
    setProcedureComplete(false);
  };

  const activateMissedApproach = () => {
    if (!missed || !activeTelemetry) return;
    setMissedApproachActive(true);
    setMissedTurnAltitudeMet(activeTelemetry.altitude >= missed.turnAltitudeFeet);
  };

  if (!plan) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-slate-950 p-8 text-center text-sm text-slate-500">
        Crea un plan de vuelo activo para habilitar el director.
      </div>
    );
  }

  const linkedIdentity = activeTelemetry?.username || robloxUsername;
  const displayedCallsign = activeTelemetry?.rawCallsign || projectFlightCallsign || gameCallsign || "----";
  const availableKinds = (["SID", "STAR", "APPROACH"] as ProcedureKind[]).filter((kind) => Boolean(procedureForKind(matches, kind)));
  const activeTargetLabel = procedure && !procedureComplete
    ? currentFix?.label ?? "----"
    : enrouteTarget?.id ?? "ENROUTE";

  const commandHeading = enabled && activeTelemetry ? `${paddedHeading(headingTarget)}°` : "---°";
  const commandAltitude = enabled && activeTelemetry ? altitudeLabel(altitudePlan.targetFeet) : "-----";
  const commandSpeed = enabled && activeTelemetry ? speedLabel(speedTarget) : "--- KT";

  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
      <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="mono text-xs text-slate-500">GUIDANCE DIRECTOR</p>
              <span className={`mono text-[10px] ${statusTone(connectionState, telemetryHeld)}`}>
                {connectionState}
                {connectionState === "LIVE" && telemetryHeld ? ` · AIRCRAFT LINKED${linkedIdentity ? ` · @${linkedIdentity}` : ""}${telemetryFresh ? "" : " · UPDATE DELAY"}` : ""}
                {connectionState === "LIVE" && !telemetryHeld ? " · SEARCHING AIRCRAFT" : ""}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">Flight guidance only. No aircraft controls are sent.</p>
          </div>
          <button
            type="button"
            onClick={toggleGuidance}
            className={`rounded-xl border px-4 py-2 mono text-xs font-bold ${enabled ? "border-green-400/60 bg-green-400/10 text-green-300" : "border-white/10 text-slate-400"}`}
          >
            {enabled ? "GUIDANCE ON" : "GUIDANCE OFF"}
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LiveMetric label="PF CALLSIGN" value={displayedCallsign} />
          <LiveMetric label="ALTITUDE" value={activeTelemetry ? `${Math.round(activeTelemetry.altitude).toLocaleString("en-US")} FT` : "-----"} />
          <LiveMetric label="HEADING" value={activeTelemetry ? `${paddedHeading(activeTelemetry.heading)}°` : "---°"} />
          <LiveMetric label="GROUND SPEED" value={activeTelemetry ? `${Math.round(activeTelemetry.groundSpeed)} KT` : "--- KT"} />
        </div>

        <div className={`mt-5 rounded-2xl border p-5 ${enabled ? "border-sky-400/40 bg-sky-400/5" : "border-white/10 bg-[#020617]"}`}>
          <div className="grid gap-3 sm:grid-cols-3">
            <CommandValue label="HDG" value={commandHeading} />
            <CommandValue label="ALT" value={commandAltitude} />
            <CommandValue label="SPD" value={commandSpeed} />
          </div>
          {!activeTelemetry && enabled && (
            <p className="mt-4 text-sm text-amber-200">
              {robloxUsername ? `Esperando al usuario @${robloxUsername} en Project Flight.` : `Esperando al callsign ${projectFlightCallsign || gameCallsign || "del FPL"} en Project Flight.`}
            </p>
          )}
          <p className="mt-3 text-[10px] leading-4 text-slate-600">
            HDG apunta al fix activo y no avanza al siguiente hasta cruzarlo. ALT anticipa restricciones posteriores y el nivel de vuelo. SPD conserva límites publicados y anticipa desaceleración, incluyendo energía de descenso. La API de Project Flight entrega GS, no IAS.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mono text-xs text-slate-500">ACTIVE PROCEDURE</p>
            <p className="mono mt-2 text-xl font-extrabold text-white">{procedure?.code ?? (activeKind === null ? "ENROUTE" : "NOT LOADED")}</p>
            <p className="mt-1 text-xs text-slate-500">
              {procedure ? `${procedure.kind} · ${procedure.airport} RWY ${procedure.runway}` : `${String(plan.departure_icao ?? "----")} → ${String(plan.arrival_icao ?? "----")}`}
            </p>
          </div>
          {missedApproachActive && <span className="mono text-[10px] font-bold text-amber-300">MISSED APPROACH</span>}
        </div>

        {availableKinds.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {availableKinds.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => activateKind(kind)}
                className={`rounded-lg border px-3 py-1.5 mono text-[10px] font-bold ${activeKind === kind ? "border-sky-400/60 bg-sky-400/10 text-sky-200" : "border-white/10 bg-[#020617] text-slate-500"}`}
              >
                {kind === "APPROACH" ? "APPR" : kind}
              </button>
            ))}
          </div>
        )}

        {approachProcedure && (
          <div className="mt-4 flex flex-wrap gap-2">
            {approachProcedure.approach.modes.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setApproachMode(mode)}
                className={`rounded-lg border px-3 py-1.5 mono text-[10px] font-bold ${approachMode === mode ? "border-sky-400/60 bg-sky-400/10 text-sky-200" : "border-white/10 bg-[#020617] text-slate-500"}`}
              >
                {approachModeLabel(mode)}
              </button>
            ))}
            {!missedApproachActive && missed && (
              <button
                type="button"
                disabled={!activeTelemetry}
                onClick={activateMissedApproach}
                className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 mono text-[10px] font-bold text-amber-200 disabled:opacity-40"
              >
                GO AROUND
              </button>
            )}
          </div>
        )}

        <div className="mt-5 rounded-xl border border-white/10 bg-[#020617] p-4">
          <p className="mono text-[9px] text-slate-600">TARGET</p>
          <p className="mono mt-2 text-lg font-bold text-sky-300">{activeTargetLabel}</p>
          {currentFixDistance !== null && procedure && !procedureComplete && (
            <p className="mono mt-1 text-[10px] text-slate-600">{currentFixDistance.toFixed(2)} NM</p>
          )}
          {enrouteDistance !== null && (activeKind === null || (activeKind === "SID" && procedureComplete)) && (
            <p className="mono mt-1 text-[10px] text-slate-600">{enrouteDistance.toFixed(2)} NM</p>
          )}
        </div>
      </div>
    </div>
  );
}

function LiveMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#020617] p-3">
      <p className="mono text-[9px] text-slate-600">{label}</p>
      <p className="mono mt-1 text-sm font-bold text-slate-200">{value}</p>
    </div>
  );
}

function CommandValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-sky-400/20 bg-[#020617] p-5 text-center">
      <p className="mono text-[10px] tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mono mt-2 text-2xl font-extrabold text-sky-300">{value}</p>
    </div>
  );
}
