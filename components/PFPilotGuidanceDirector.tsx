"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getGameCallsignFromNotes } from "@/lib/flightPlanGameCallsign";
import {
  formatAltitudeRestriction,
  getInboundLeg,
  getProcedureFix,
  type AltitudeRestriction,
  type FlightProcedure,
  type ProcedureKind,
} from "@/lib/pfpilot/procedures";
import {
  selectApproachModeForPlan,
  selectProcedureMatches,
  type ApproachMode,
  type ApproachProcedure,
  type ProcedureMatches,
} from "@/lib/pfpilot/approaches";
import {
  bearingToMapPoint,
  connectProjectFlightTraffic,
  distanceToMapLegNm,
  mapDistanceNm,
  normalizeProjectFlightCallsign,
  type ProjectFlightConnectionState,
  type ProjectFlightTelemetry,
} from "@/lib/pfpilot/projectFlightLive";
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

function paddedHeading(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "---";
  return String((Math.round(value) + 360) % 360).padStart(3, "0");
}

function altitudeCommand(restriction: AltitudeRestriction | undefined, altitude: number) {
  if (!restriction) return "NO PUBLISHED ALTITUDE AT NEXT FIX";
  const target = restriction.feet;
  const tolerance = 150;
  const label = target >= 10000 && target % 100 === 0
    ? `FL${String(Math.round(target / 100)).padStart(3, "0")}`
    : `${target.toLocaleString("en-US")} FT`;

  if (restriction.type === "AT_OR_BELOW") {
    return altitude > target + tolerance ? `DESCEND ${label} OR BELOW` : `MAINTAIN ${label} OR BELOW`;
  }
  if (restriction.type === "AT_OR_ABOVE") {
    return altitude < target - tolerance ? `CLIMB ${label} OR ABOVE` : `MAINTAIN ${label} OR ABOVE`;
  }
  if (altitude > target + tolerance) return `DESCEND ${label}`;
  if (altitude < target - tolerance) return `CLIMB ${label}`;
  return `MAINTAIN ${label}`;
}

function statusTone(state: ProjectFlightConnectionState, found: boolean) {
  if (state === "LIVE" && found) return "text-green-300";
  if (state === "LIVE") return "text-amber-300";
  return "text-slate-400";
}

function normalizedUsername(value: string) {
  return value.trim().replace(/^@/, "").toLowerCase();
}

function initialProcedureKind(matches: ProcedureMatches): ProcedureKind | null {
  if (matches.sid) return "SID";
  if (matches.star) return "STAR";
  if (matches.approach) return "APPROACH";
  return null;
}

function procedureForKind(matches: ProcedureMatches, kind: ProcedureKind | null) {
  if (kind === "SID") return matches.sid;
  if (kind === "STAR") return matches.star;
  if (kind === "APPROACH") return matches.approach;
  return null;
}

function phaseAvailable(matches: ProcedureMatches, kind: ProcedureKind) {
  return Boolean(procedureForKind(matches, kind));
}

function approachModeLabel(mode: ApproachMode) {
  return mode === "ILS" ? "ILS" : "LOC (GS OUT)";
}

function feetLabel(feet: number) {
  return `${feet.toLocaleString("en-US")} FT`;
}

export default function PFPilotGuidanceDirector({ plan }: { plan: PilotPlan | null }) {
  const [enabled, setEnabled] = useState(false);
  const [connectionState, setConnectionState] = useState<ProjectFlightConnectionState>("OFFLINE");
  const [telemetry, setTelemetry] = useState<ProjectFlightTelemetry | null>(null);
  const [lastSeen, setLastSeen] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [activeKind, setActiveKind] = useState<ProcedureKind | null>(null);
  const [targetIndex, setTargetIndex] = useState(0);
  const [departureConditionMet, setDepartureConditionMet] = useState(false);
  const [departureTargetReached, setDepartureTargetReached] = useState(false);
  const [procedureComplete, setProcedureComplete] = useState(false);
  const [robloxUsername, setRobloxUsername] = useState("");
  const [approachMode, setApproachMode] = useState<ApproachMode>("ILS");
  const [approachAtMap, setApproachAtMap] = useState(false);
  const [missedApproachActive, setMissedApproachActive] = useState(false);
  const [missedTurnAltitudeMet, setMissedTurnAltitudeMet] = useState(false);
  const autoInitializedRef = useRef(false);

  const matches = useMemo(
    () => selectProcedureMatches(plan),
    [plan?.departure_icao, plan?.arrival_icao, plan?.route],
  );
  const procedure = useMemo(
    () => procedureForKind(matches, activeKind),
    [activeKind, matches],
  );
  const approachProcedure: ApproachProcedure | null = activeKind === "APPROACH"
    ? matches.approach
    : null;

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
    const linkedUsername = document
      .querySelector<HTMLElement>("main[data-pf24-roblox-username]")
      ?.dataset.pf24RobloxUsername ?? "";
    setRobloxUsername(normalizedUsername(linkedUsername));
  }, [plan?.id]);

  useEffect(() => {
    setTelemetry(null);
    setLastSeen(0);
  }, [plan?.id]);

  useEffect(() => {
    setActiveKind(initialProcedureKind(matches));
  }, [plan?.id, matches.sid?.id, matches.star?.id, matches.approach?.id]);

  useEffect(() => {
    const selected = selectApproachModeForPlan(plan, matches.approach);
    if (selected) setApproachMode(selected);
  }, [plan?.id, plan?.route, matches.approach?.id]);

  useEffect(() => {
    setTargetIndex(0);
    setDepartureConditionMet(false);
    setDepartureTargetReached(false);
    setProcedureComplete(false);
    setApproachAtMap(false);
    setMissedApproachActive(false);
    setMissedTurnAltitudeMet(false);
    autoInitializedRef.current = false;
  }, [procedure?.id]);

  useEffect(() => {
    if (!plan?.id || (!robloxUsername && !gameCallsign)) {
      setConnectionState("OFFLINE");
      return;
    }

    return connectProjectFlightTraffic({
      onState: setConnectionState,
      onTraffic: (traffic) => {
        const byRobloxUser = robloxUsername
          ? traffic.find((item) => normalizedUsername(item.username) === robloxUsername)
          : undefined;
        const byCallsign = traffic.find((item) =>
          normalizeAirlineCallsign(item.callsign) === gameCallsign ||
          normalizeAirlineCallsign(item.rawCallsign) === gameCallsign,
        );
        const aircraft = byRobloxUser ?? byCallsign;
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

  const telemetryFresh = Boolean(telemetry && lastSeen > 0 && clock - lastSeen < 15000);
  const activeTelemetry = telemetryFresh ? telemetry : null;
  const departureLeg = procedure?.departureLeg ?? null;
  const departureLegActive = Boolean(departureLeg && !departureConditionMet);
  const departureToFixActive = Boolean(
    departureLeg && departureConditionMet && !departureTargetReached && !procedureComplete,
  );
  const currentFix = procedure?.fixes[Math.min(targetIndex, Math.max(0, procedure.fixes.length - 1))] ?? null;
  const inboundLeg = procedure && currentFix ? getInboundLeg(procedure, currentFix.id) : null;
  const inboundStart = procedure && inboundLeg ? getProcedureFix(procedure, inboundLeg.from) : null;

  useEffect(() => {
    if (!departureLeg || !activeTelemetry || departureConditionMet) return;
    if (activeTelemetry.altitude >= departureLeg.untilAltitudeFeet) {
      setDepartureConditionMet(true);
    }
  }, [activeTelemetry, departureConditionMet, departureLeg]);

  useEffect(() => {
    const missed = approachProcedure?.approach.missedApproach;
    if (!missedApproachActive || !missed || !activeTelemetry || missedTurnAltitudeMet) return;
    if (activeTelemetry.altitude >= missed.turnAltitudeFeet) setMissedTurnAltitudeMet(true);
  }, [activeTelemetry, approachProcedure, missedApproachActive, missedTurnAltitudeMet]);

  useEffect(() => {
    if (
      !procedure ||
      (procedure.kind !== "STAR" && procedure.kind !== "APPROACH") ||
      !activeTelemetry ||
      autoInitializedRef.current
    ) return;

    autoInitializedRef.current = true;
    const position = { x: activeTelemetry.mapX, y: activeTelemetry.mapY };
    const candidates = procedure.legs.flatMap((leg) => {
      const from = getProcedureFix(procedure, leg.from);
      const to = getProcedureFix(procedure, leg.to);
      if (!from?.mapPoint || !to?.mapPoint) return [];
      const track = distanceToMapLegNm(position, from.mapPoint, to.mapPoint);
      if (track.progress <= 0.04 || track.progress >= 1.15 || track.distanceNm >= 3) return [];
      return [{ to, distanceNm: track.distanceNm, progress: track.progress }];
    });

    candidates.sort((a, b) => a.distanceNm - b.distanceNm || b.progress - a.progress);
    const best = candidates[0];
    if (!best) return;
    const nextIndex = procedure.fixes.findIndex((fix) => fix.id === best.to.id);
    if (nextIndex >= 0) setTargetIndex(nextIndex);
  }, [activeTelemetry, procedure]);

  const targetDistanceNm = activeTelemetry && currentFix?.mapPoint
    ? mapDistanceNm({ x: activeTelemetry.mapX, y: activeTelemetry.mapY }, currentFix.mapPoint)
    : null;

  const activateKind = (kind: ProcedureKind) => {
    if (!phaseAvailable(matches, kind)) return;
    setActiveKind(kind);
  };

  const approachEntryNear = (candidate: ApproachProcedure | null) => {
    if (!activeTelemetry || !candidate) return false;
    const entry = getProcedureFix(candidate, candidate.entryFix);
    if (!entry?.mapPoint) return false;
    return mapDistanceNm(
      { x: activeTelemetry.mapX, y: activeTelemetry.mapY },
      entry.mapPoint,
    ) <= 6;
  };

  useEffect(() => {
    if (!procedureComplete || !activeTelemetry) return;

    if (procedure?.kind === "SID" && matches.star) {
      const entry = getProcedureFix(matches.star, matches.star.entryFix);
      if (entry?.mapPoint && mapDistanceNm(
        { x: activeTelemetry.mapX, y: activeTelemetry.mapY },
        entry.mapPoint,
      ) <= 8) {
        setActiveKind("STAR");
      }
      return;
    }

    if (procedure?.kind === "STAR" && matches.approach && approachEntryNear(matches.approach)) {
      setActiveKind("APPROACH");
    }
  }, [
    activeTelemetry,
    matches.approach,
    matches.star,
    procedure?.kind,
    procedureComplete,
  ]);

  useEffect(() => {
    if (!procedure || targetDistanceNm === null || missedApproachActive) return;

    const threshold = procedure.kind === "APPROACH" && currentFix?.id === "D0.3-SGO" ? 0.45 : 0.9;
    if (targetDistanceNm > threshold) return;

    if (procedure.kind === "SID") {
      if (departureLeg && !departureConditionMet) return;

      if (
        departureLeg &&
        !departureTargetReached &&
        currentFix?.id === departureLeg.targetFix
      ) {
        setDepartureTargetReached(true);
        if (targetIndex < procedure.fixes.length - 1) {
          setTargetIndex((current) => current + 1);
        } else {
          setProcedureComplete(true);
        }
        return;
      }

      if (targetIndex < procedure.fixes.length - 1) {
        setTargetIndex((current) => current + 1);
      } else {
        setProcedureComplete(true);
      }
      return;
    }

    if (procedure.kind === "APPROACH") {
      if (targetIndex < procedure.fixes.length - 1) {
        setTargetIndex((current) => current + 1);
      } else {
        setApproachAtMap(true);
      }
      return;
    }

    if (targetIndex < procedure.fixes.length - 1) {
      setTargetIndex((current) => current + 1);
      return;
    }

    if (matches.approach && currentFix?.id === matches.approach.entryFix) {
      setActiveKind("APPROACH");
      return;
    }

    setProcedureComplete(true);
  }, [
    procedure,
    departureLeg,
    departureConditionMet,
    departureTargetReached,
    currentFix?.id,
    targetDistanceNm,
    targetIndex,
    matches.approach,
    missedApproachActive,
  ]);

  const directHeading = activeTelemetry && currentFix?.mapPoint
    ? bearingToMapPoint({ x: activeTelemetry.mapX, y: activeTelemetry.mapY }, currentFix.mapPoint)
    : null;

  const legCapture = activeTelemetry && inboundLeg && inboundStart?.mapPoint && currentFix?.mapPoint
    ? distanceToMapLegNm(
        { x: activeTelemetry.mapX, y: activeTelemetry.mapY },
        inboundStart.mapPoint,
        currentFix.mapPoint,
      )
    : null;
  const established = Boolean(
    legCapture &&
    legCapture.progress >= -0.05 &&
    legCapture.progress <= 1.08 &&
    legCapture.distanceNm <= 0.55,
  );

  const missed = approachProcedure?.approach.missedApproach;
  const missedTarget = approachProcedure && missed
    ? getProcedureFix(approachProcedure, missed.targetFix)
    : null;
  const missedTargetDistanceNm = activeTelemetry && missedTarget?.mapPoint
    ? mapDistanceNm(
        { x: activeTelemetry.mapX, y: activeTelemetry.mapY },
        missedTarget.mapPoint,
      )
    : null;
  const missedAtHold = Boolean(
    missedApproachActive &&
    missedTurnAltitudeMet &&
    missedTargetDistanceNm !== null &&
    missedTargetDistanceNm <= 0.9,
  );

  const activateMissedApproach = () => {
    if (!missed || !activeTelemetry) return;
    setApproachAtMap(false);
    setMissedApproachActive(true);
    setMissedTurnAltitudeMet(activeTelemetry.altitude >= missed.turnAltitudeFeet);
  };

  let navCommand = procedureComplete && procedure?.kind === "SID"
    ? "SID COMPLETE · FOLLOW FPL ROUTE"
    : procedureComplete && procedure?.kind === "STAR"
      ? "STAR COMPLETE · FOLLOW ATC / EXPECT APPROACH"
      : departureLegActive && departureLeg
        ? `FLY HDG ${paddedHeading(departureLeg.heading)}° · UNTIL ${departureLeg.untilAltitudeFeet.toLocaleString("en-US")} FT`
        : departureToFixActive && departureLeg && currentFix
          ? `${departureLeg.afterCourseMode === "HEADING" ? "FLY HDG" : "FLY"} ${paddedHeading(departureLeg.afterCourse)}° · ${currentFix.label}`
          : !currentFix
            ? "NO ACTIVE PROCEDURE"
            : !currentFix.mapPoint
              ? `HOLD GUIDANCE · ${currentFix.label} GEOMETRY NOT RESOLVED`
              : established && inboundLeg
                ? `FLY ${paddedHeading(inboundLeg.course)}° · ${currentFix.label}`
                : inboundLeg
                  ? `INTERCEPT ${paddedHeading(inboundLeg.course)}° · HDG ${paddedHeading(directHeading)}° TO ${currentFix.label}`
                  : `HDG ${paddedHeading(directHeading)}° · DIRECT ${currentFix.label}`;

  if (approachProcedure && !missedApproachActive && approachAtMap && approachMode === "LOC") {
    navCommand = "MAP D0.3 SGO · LAND IF VISUAL · OTHERWISE GO AROUND";
  }

  if (missedApproachActive && missed) {
    if (!missedTurnAltitudeMet) {
      navCommand = `GO AROUND · FLY ${paddedHeading(missed.initialCourse)}° · TURN ${missed.turnDirection} AFTER ${missed.turnAltitudeFeet.toLocaleString("en-US")} FT`;
    } else if (missedAtHold) {
      navCommand = `${missed.holdFix ?? missed.targetFix} · HOLD / FOLLOW ATC`;
    } else {
      navCommand = `TURN ${missed.turnDirection} · HDG ${paddedHeading(missed.afterHeading)}° · DIRECT ${missed.targetFix}`;
    }
  }

  const altitude = activeTelemetry?.altitude ?? 0;
  const activeAltitudeRestriction: AltitudeRestriction | undefined = departureLegActive && departureLeg
    ? { type: "AT_OR_ABOVE", feet: departureLeg.untilAltitudeFeet }
    : currentFix?.altitude;

  let altitudeAdvisory = procedureComplete && procedure?.kind === "SID"
    ? "FOLLOW FPL / ATC ALTITUDE"
    : procedureComplete && procedure?.kind === "STAR"
      ? "MAINTAIN PUBLISHED / ATC ALTITUDE"
      : activeTelemetry
        ? altitudeCommand(activeAltitudeRestriction, altitude)
        : "WAITING FOR AIRCRAFT TELEMETRY";

  const activeMinimum = approachProcedure?.approach.minima[approachMode];
  const glideSlope = approachProcedure?.approach.glideSlope;

  if (approachProcedure && activeTelemetry && !missedApproachActive) {
    const onFinalSequence = currentFix?.id === "D1.5-SGO" || currentFix?.id === "D0.3-SGO" || approachAtMap;

    if (approachMode === "ILS" && onFinalSequence && activeMinimum) {
      if (currentFix?.id === glideSlope?.checkFix && glideSlope) {
        altitudeAdvisory = `FOLLOW ILS GS · CHECK ${feetLabel(glideSlope.checkAltitudeFeet)} AT ${currentFix.label}`;
      } else if (activeTelemetry.altitude <= activeMinimum.feet + 40) {
        altitudeAdvisory = `MINIMUMS · ${activeMinimum.type} ${feetLabel(activeMinimum.feet)} · LAND IF VISUAL / GO AROUND`;
      } else if (activeTelemetry.altitude <= activeMinimum.feet + 180) {
        altitudeAdvisory = `APPROACHING MINIMUMS · ${activeMinimum.type} ${feetLabel(activeMinimum.feet)}`;
      } else {
        altitudeAdvisory = `FOLLOW ILS GS · ${activeMinimum.type} ${feetLabel(activeMinimum.feet)}`;
      }
    }

    if (approachMode === "LOC" && onFinalSequence && activeMinimum) {
      if (approachAtMap) {
        altitudeAdvisory = `MAP · ${activeMinimum.type} ${feetLabel(activeMinimum.feet)} · LAND IF VISUAL / GO AROUND`;
      } else if (activeTelemetry.altitude < activeMinimum.feet - 50) {
        altitudeAdvisory = `BELOW ${activeMinimum.type} ${feetLabel(activeMinimum.feet)} · CORRECT / GO AROUND`;
      } else if (activeTelemetry.altitude > activeMinimum.feet + 150) {
        altitudeAdvisory = `DESCEND TO ${activeMinimum.type} ${feetLabel(activeMinimum.feet)}`;
      } else {
        altitudeAdvisory = `MAINTAIN ${activeMinimum.type} ${feetLabel(activeMinimum.feet)}`;
      }
    }
  }

  if (missedApproachActive && missed && activeTelemetry) {
    altitudeAdvisory = activeTelemetry.altitude < missed.climbAltitudeFeet - 100
      ? `CLIMB ${feetLabel(missed.climbAltitudeFeet)}`
      : `MAINTAIN ${feetLabel(missed.climbAltitudeFeet)}`;
  }

  const speedLimits = [
    departureLegActive ? departureLeg?.speed?.knots : currentFix?.speed?.knots,
    procedure?.globalSpeed && activeTelemetry && activeTelemetry.altitude < procedure.globalSpeed.belowFeet
      ? procedure.globalSpeed.maxKnots
      : undefined,
  ].filter((item): item is number => typeof item === "number");
  const maxSpeed = speedLimits.length > 0 ? Math.min(...speedLimits) : null;
  let speedAdvisory = maxSpeed ? `MAX ${maxSpeed} KT` : "NO PUBLISHED SPEED AT NEXT FIX";
  if (missedApproachActive && missed) speedAdvisory = `${missed.targetFix} · MAX 200 KT`;

  let verticalProfile = "NO DESCENT CALCULATION REQUIRED";
  if (missedApproachActive && missed) {
    verticalProfile = !missedTurnAltitudeMet
      ? `MISSED · ${paddedHeading(missed.initialCourse)}° UNTIL ${feetLabel(missed.turnAltitudeFeet)} · THEN ${missed.turnDirection} HDG ${paddedHeading(missed.afterHeading)}°`
      : `MISSED · CLIMB ${feetLabel(missed.climbAltitudeFeet)} · DIRECT ${missed.targetFix}`;
  } else if (approachProcedure) {
    if (approachMode === "ILS") {
      verticalProfile = glideSlope && activeMinimum
        ? `ILS GS · ${glideSlope.checkFix.replace("-", " ")} CHECK ${feetLabel(glideSlope.checkAltitudeFeet)} · ${activeMinimum.type} ${feetLabel(activeMinimum.feet)}`
        : "ILS FINAL · FOLLOW PUBLISHED GLIDESLOPE";
    } else if (activeMinimum) {
      verticalProfile = `LOC GS OUT · ${activeMinimum.type} ${feetLabel(activeMinimum.feet)} · MAP ${activeMinimum.mapFix?.replace("-", " ") ?? "PUBLISHED MAP"}`;
    }
  } else if (departureLegActive && departureLeg) {
    verticalProfile = `ALTITUDE TRIGGER · TURN AFTER ${departureLeg.untilAltitudeFeet.toLocaleString("en-US")} FT`;
  } else if (departureToFixActive && currentFix) {
    verticalProfile = currentFix.altitude
      ? `CLIMB PROFILE · NEXT ${currentFix.label} ${formatAltitudeRestriction(currentFix.altitude)}`
      : `DEPARTURE LEG · ${currentFix.label}`;
  } else if (procedure?.kind === "SID" && !procedureComplete) {
    verticalProfile = currentFix?.altitude
      ? `CLIMB PROFILE · NEXT ${currentFix.label} ${formatAltitudeRestriction(currentFix.altitude)}`
      : `DEPARTURE LEG · ${currentFix?.label ?? "NEXT FIX"}`;
  } else if (procedureComplete && procedure?.kind === "SID") {
    verticalProfile = "SID COMPLETE · ENROUTE PHASE";
  } else if (procedureComplete && procedure?.kind === "STAR") {
    verticalProfile = "STAR COMPLETE · EXPECT APPROACH / ATC VECTOR";
  } else if (activeTelemetry && currentFix?.altitude && targetDistanceNm !== null) {
    const restriction = currentFix.altitude;
    const descTarget = restriction.type === "AT_OR_ABOVE" ? null : restriction.feet;
    if (descTarget !== null && activeTelemetry.altitude > descTarget) {
      const requiredNm = (activeTelemetry.altitude - descTarget) / 300;
      const margin = targetDistanceNm - requiredNm;
      verticalProfile = margin <= 1
        ? `DESCENT DUE · NEED ≈ ${requiredNm.toFixed(1)} NM`
        : `TOD IN ≈ ${margin.toFixed(1)} NM · NEED ≈ ${requiredNm.toFixed(1)} NM`;
    }
  }

  const visualAdvisory = approachProcedure?.approach.visualAids?.papi && !missedApproachActive
    ? "PAPI CROSS-CHECK IF RUNWAY IN SIGHT / VISIBILITY PERMITS"
    : null;

  let nextConstraintLabel = departureLegActive && departureLeg
    ? `HDG ${paddedHeading(departureLeg.heading)}°`
    : procedureComplete && procedure?.kind === "SID"
      ? "ENROUTE"
      : procedureComplete && procedure?.kind === "STAR"
        ? "EXPECT APPROACH"
        : currentFix?.label ?? "—";
  let nextConstraintAltitude = departureLegActive && departureLeg
    ? `${departureLeg.untilAltitudeFeet.toLocaleString("en-US")} FT OR ABOVE`
    : procedureComplete && procedure?.kind === "SID"
      ? "FPL / ATC"
      : procedureComplete && procedure?.kind === "STAR"
        ? "ATC / APPROACH"
        : formatAltitudeRestriction(currentFix?.altitude);
  let nextConstraintSpeed = departureLegActive && departureLeg?.speed
    ? `MAX ${departureLeg.speed.knots} KT`
    : currentFix?.speed
      ? `MAX ${currentFix.speed.knots} KT`
      : "—";
  let nextConstraintDistance = departureLegActive
    ? "Altitude-triggered transition; no fixed geographic turn point"
    : procedureComplete && procedure?.kind === "SID"
      ? "Procedure complete; STAR activates automatically near its entry or manually"
      : procedureComplete && procedure?.kind === "STAR"
        ? "Procedure complete; activate/expect the assigned approach"
        : targetDistanceNm !== null
          ? `${targetDistanceNm.toFixed(1)} NM to fix`
          : currentFix?.dme
            ? "DME geometry pending resolver"
            : "Distance unavailable";

  if (approachProcedure && activeMinimum && !missedApproachActive) {
    if (currentFix?.id === glideSlope?.checkFix && approachMode === "ILS" && glideSlope) {
      nextConstraintAltitude = `GS CHECK ${feetLabel(glideSlope.checkAltitudeFeet)}`;
    } else if (currentFix?.id === "D0.3-SGO" || approachAtMap) {
      nextConstraintAltitude = `${activeMinimum.type} ${feetLabel(activeMinimum.feet)}${approachMode === "LOC" ? " · MAP" : ""}`;
    }
  }

  if (missedApproachActive && missed) {
    nextConstraintLabel = missedTurnAltitudeMet ? missed.targetFix : `COURSE ${paddedHeading(missed.initialCourse)}°`;
    nextConstraintAltitude = missedTurnAltitudeMet
      ? feetLabel(missed.climbAltitudeFeet)
      : `${feetLabel(missed.turnAltitudeFeet)} TURN TRIGGER`;
    nextConstraintSpeed = missedTurnAltitudeMet ? "VOGEP MAX 200 KT" : "—";
    nextConstraintDistance = missedTurnAltitudeMet && missedTargetDistanceNm !== null
      ? `${missedTargetDistanceNm.toFixed(1)} NM to ${missed.targetFix}`
      : "Altitude-triggered missed-approach turn";
  }

  if (!plan) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-slate-950 p-8 text-center">
        <p className="mono text-xs text-slate-500">GUIDANCE DIRECTOR</p>
        <p className="mt-3 text-sm text-slate-400">Crea un plan de vuelo activo para habilitar el director.</p>
      </div>
    );
  }

  const displayedProjectFlightCallsign = activeTelemetry?.rawCallsign || projectFlightCallsign || gameCallsign || "----";
  const linkedIdentityLabel = activeTelemetry?.username || robloxUsername;
  const availableKinds = (["SID", "STAR", "APPROACH"] as ProcedureKind[]).filter((kind) => phaseAvailable(matches, kind));

  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="mono text-xs text-slate-500">GUIDANCE DIRECTOR</p>
              <span className={`mono text-[10px] ${statusTone(connectionState, telemetryFresh)}`}>
                {connectionState}{connectionState === "LIVE" ? telemetryFresh ? ` · AIRCRAFT LINKED${linkedIdentityLabel ? ` · @${linkedIdentityLabel}` : ""}` : " · SEARCHING AIRCRAFT" : ""}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">Asistencia en tiempo real; nunca controla la aeronave.</p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled((current) => !current)}
            className={`rounded-xl border px-4 py-2 mono text-xs font-bold ${enabled ? "border-green-400/60 bg-green-400/10 text-green-300" : "border-white/10 text-slate-400"}`}
          >
            {enabled ? "GUIDANCE ON" : "GUIDANCE OFF"}
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LiveMetric label="PF CALLSIGN" value={displayedProjectFlightCallsign} />
          <LiveMetric label="ALTITUDE" value={activeTelemetry ? `${Math.round(activeTelemetry.altitude).toLocaleString("en-US")} FT` : "-----"} />
          <LiveMetric label="HEADING" value={activeTelemetry ? `${paddedHeading(activeTelemetry.heading)}°` : "---°"} />
          <LiveMetric label="GROUND SPEED" value={activeTelemetry ? `${Math.round(activeTelemetry.groundSpeed)} KT` : "--- KT"} />
        </div>

        <div className={`mt-5 rounded-2xl border p-5 ${enabled ? "border-sky-400/40 bg-sky-400/5" : "border-white/10 bg-[#020617]"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="mono text-xs text-slate-500">PFPILOT ADVISORY</p>
            {procedure && <span className="mono text-[10px] text-sky-300">{procedure.code} · RWY {procedure.runway}</span>}
          </div>

          {approachProcedure && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
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
              {!missedApproachActive && (
                <button
                  type="button"
                  disabled={!activeTelemetry}
                  onClick={activateMissedApproach}
                  className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 mono text-[10px] font-bold text-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  GO AROUND
                </button>
              )}
            </div>
          )}

          {!enabled ? (
            <p className="mt-3 text-sm text-slate-500">Activa GUIDANCE para comenzar las indicaciones.</p>
          ) : !procedure ? (
            <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100/80">
              No hay un procedimiento cargado que coincida con la salida/llegada y la ruta del FPL. El motor no inventará instrucciones.
            </div>
          ) : !activeTelemetry ? (
            <p className="mt-3 text-sm text-amber-200">
              {robloxUsername
                ? `Esperando al usuario @${robloxUsername} en Project Flight.`
                : `Esperando al callsign ${projectFlightCallsign || gameCallsign || "del FPL"} en Project Flight.`}
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              <AdvisoryRow label="NAV" value={navCommand} primary />
              <AdvisoryRow label="ALT" value={altitudeAdvisory} />
              <AdvisoryRow label="SPD" value={speedAdvisory} />
              <AdvisoryRow label="VNAV" value={verticalProfile} />
              {visualAdvisory && <AdvisoryRow label="VIS" value={visualAdvisory} />}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="mono text-xs text-slate-500">ACTIVE PROCEDURE</p>
              <p className="mono mt-2 text-2xl font-extrabold text-white">{procedure?.code ?? "NOT LOADED"}</p>
              <p className="mt-1 text-xs text-slate-500">{procedure ? `${procedure.kind} · ${procedure.airport} RWY ${procedure.runway} · ${procedure.chart}` : `${String(plan.departure_icao ?? "----")} → ${String(plan.arrival_icao ?? "----")}`}</p>
            </div>
            {procedure && procedure.fixes.length > 1 && (procedure.kind !== "SID" || departureTargetReached) && !missedApproachActive && (
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setTargetIndex((current) => Math.max(0, current - 1))}
                  className="rounded-lg border border-white/10 bg-[#020617] px-3 py-2 mono text-xs text-slate-300"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => setTargetIndex((current) => Math.min(procedure.fixes.length - 1, current + 1))}
                  className="rounded-lg border border-white/10 bg-[#020617] px-3 py-2 mono text-xs text-slate-300"
                >
                  →
                </button>
              </div>
            )}
          </div>

          {availableKinds.length > 1 && (
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
            <div className="mt-4 rounded-xl border border-sky-400/20 bg-sky-400/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="mono text-xs font-bold text-sky-300">{approachModeLabel(approachMode)} RWY {approachProcedure.runway}</span>
                <span className="mono text-[10px] text-slate-500">{approachProcedure.approach.localizer.ident} {approachProcedure.approach.localizer.frequency}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                <span>FINAL {paddedHeading(approachProcedure.approach.localizer.finalCourse)}°</span>
                <span>ILS DA {approachProcedure.approach.minima.ILS?.feet ?? "—"} FT</span>
                <span>LOC MDA {approachProcedure.approach.minima.LOC?.feet ?? "—"} FT</span>
                {approachProcedure.approach.glideSlope && (
                  <span>GS CHECK {approachProcedure.approach.glideSlope.checkFix.replace("-", " ")} {approachProcedure.approach.glideSlope.checkAltitudeFeet} FT</span>
                )}
              </div>
              {approachProcedure.approach.visualAids?.papi && (
                <p className="mt-2 text-[10px] leading-4 text-slate-500">PAPI: visual cross-check only when runway environment is in sight and visibility permits.</p>
              )}
            </div>
          )}

          {procedure ? (
            <div className="mt-5 space-y-2">
              {procedure.departureLeg && (
                <div className={`rounded-xl border p-3 ${departureLegActive || departureToFixActive ? "border-sky-400/50 bg-sky-400/5" : "border-white/10 bg-[#020617]"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`mono text-xs font-bold ${departureLegActive || departureToFixActive ? "text-sky-300" : "text-slate-300"}`}>
                      HDG {paddedHeading(procedure.departureLeg.heading)}°
                    </span>
                    <span className="mono text-[10px] text-slate-500">ALT TRIGGER</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    <span>UNTIL {procedure.departureLeg.untilAltitudeFeet.toLocaleString("en-US")} FT</span>
                    <span>SPD {procedure.departureLeg.speed ? `MAX ${procedure.departureLeg.speed.knots} KT` : "—"}</span>
                    <span>
                      THEN {procedure.departureLeg.afterCourseMode === "HEADING" ? "HDG " : ""}{paddedHeading(procedure.departureLeg.afterCourse)}° TO {procedure.departureLeg.targetFix}
                    </span>
                  </div>
                </div>
              )}

              {procedure.fixes.map((fix, index) => {
                const active = !departureLegActive && !procedureComplete && !missedApproachActive && index === targetIndex;
                const isGsCheck = Boolean(
                  approachProcedure?.approach.glideSlope &&
                  approachProcedure.approach.glideSlope.checkFix === fix.id,
                );
                const isLocMap = Boolean(
                  approachProcedure?.approach.minima.LOC?.mapFix === fix.id,
                );
                return (
                  <div
                    key={fix.id}
                    className={`rounded-xl border p-3 ${active ? "border-sky-400/50 bg-sky-400/5" : "border-white/10 bg-[#020617]"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={`mono text-xs font-bold ${active ? "text-sky-300" : "text-slate-300"}`}>{fix.label}</span>
                      <span className="mono text-[10px] text-slate-500">{fix.source === "DME_FIX" ? "DME" : "FIX"}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span>ALT {formatAltitudeRestriction(fix.altitude)}</span>
                      <span>SPD {fix.speed ? `MAX ${fix.speed.knots} KT` : "—"}</span>
                      {isGsCheck && approachProcedure?.approach.glideSlope && (
                        <span>ILS CHECK {approachProcedure.approach.glideSlope.checkAltitudeFeet} FT</span>
                      )}
                      {isLocMap && <span>LOC MAP</span>}
                    </div>
                    {fix.dme && !fix.mapPoint && (
                      <p className="mt-2 text-[10px] leading-4 text-amber-200/70">{fix.dme.distanceNm.toFixed(1)} DME {fix.dme.station} · geometric fix definition stored; coordinate resolver will use the station reference.</p>
                    )}
                  </div>
                );
              })}

              {missedApproachActive && missed && (
                <div className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="mono text-xs font-bold text-amber-200">MISSED APPROACH</span>
                    <span className="mono text-[10px] text-slate-500">ACTIVE</span>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-slate-400">{missed.note}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-500">Librería activa: procedimientos cargados desde el código exacto incluido en la ruta del FPL.</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
          <p className="mono text-xs text-slate-500">NEXT CONSTRAINT</p>
          <p className="mono mt-3 text-xl font-bold text-sky-300">{nextConstraintLabel}</p>
          <p className="mt-2 text-sm text-slate-400">ALT {nextConstraintAltitude} · SPD {nextConstraintSpeed}</p>
          <p className="mt-2 text-xs text-slate-500">{nextConstraintDistance}</p>
        </div>

        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-5 text-amber-100/75">
          Las restricciones de velocidad son valores publicados de procedimiento. Project Flight entrega GS al director; PFPilot no la presenta como IAS ni la usa para afirmar cumplimiento de IAS.
          {approachProcedure && (
            <span className="mt-2 block">En aproximación, PFPilot usa únicamente restricciones, checks y mínimos publicados. No fabrica una pendiente ILS a partir del dibujo. PAPI es solo una ayuda visual cuando la pista está a la vista y no sustituye DA/MDA ni instrucciones ATC.</span>
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

function AdvisoryRow({ label, value, primary = false }: { label: string; value: string; primary?: boolean }) {
  return (
    <div className="grid gap-1 rounded-xl border border-white/10 bg-[#020617] p-4 sm:grid-cols-[52px_1fr] sm:items-center">
      <span className="mono text-[10px] text-slate-500">{label}</span>
      <span className={`mono font-bold ${primary ? "text-base text-sky-300" : "text-sm text-slate-200"}`}>{value}</span>
    </div>
  );
}
