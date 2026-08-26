"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getGameCallsignFromNotes } from "@/lib/flightPlanGameCallsign";
import {
  formatAltitudeRestriction,
  getInboundLeg,
  getProcedureFix,
  selectProcedureForPlan,
  type AltitudeRestriction,
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
  return String(Math.round(value) % 360).padStart(3, "0");
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

export default function PFPilotGuidanceDirector({ plan }: { plan: PilotPlan | null }) {
  const [enabled, setEnabled] = useState(false);
  const [connectionState, setConnectionState] = useState<ProjectFlightConnectionState>("OFFLINE");
  const [telemetry, setTelemetry] = useState<ProjectFlightTelemetry | null>(null);
  const [lastSeen, setLastSeen] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [targetIndex, setTargetIndex] = useState(0);
  const autoInitializedRef = useRef(false);

  const procedure = useMemo(() => selectProcedureForPlan(plan), [plan?.arrival_icao, plan?.route]);
  const gameCallsign = useMemo(
    () => normalizeProjectFlightCallsign(getGameCallsignFromNotes(plan?.notes) || String(plan?.callsign ?? "")),
    [plan?.callsign, plan?.notes],
  );

  useEffect(() => {
    setTargetIndex(0);
    setTelemetry(null);
    setLastSeen(0);
    autoInitializedRef.current = false;
  }, [plan?.id, procedure?.id]);

  useEffect(() => {
    if (!plan?.id || !gameCallsign) {
      setConnectionState("OFFLINE");
      return;
    }

    return connectProjectFlightTraffic({
      onState: setConnectionState,
      onTraffic: (traffic) => {
        const aircraft = traffic.find((item) => item.callsign === gameCallsign);
        if (!aircraft) return;
        setTelemetry(aircraft);
        setLastSeen(Date.now());
      },
    });
  }, [plan?.id, gameCallsign]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const telemetryFresh = Boolean(telemetry && lastSeen > 0 && clock - lastSeen < 15000);
  const activeTelemetry = telemetryFresh ? telemetry : null;
  const currentFix = procedure?.fixes[Math.min(targetIndex, Math.max(0, procedure.fixes.length - 1))] ?? null;
  const inboundLeg = procedure && currentFix ? getInboundLeg(procedure, currentFix.id) : null;
  const inboundStart = procedure && inboundLeg ? getProcedureFix(procedure, inboundLeg.from) : null;

  useEffect(() => {
    if (!procedure || !activeTelemetry || autoInitializedRef.current) return;
    autoInitializedRef.current = true;

    // If the aircraft is already established on the first published leg, do not
    // send it backwards to the STAR entry fix when PFPilot is opened mid-flight.
    const firstLeg = procedure.legs[0];
    if (!firstLeg) return;
    const from = getProcedureFix(procedure, firstLeg.from);
    const to = getProcedureFix(procedure, firstLeg.to);
    if (!from?.mapPoint || !to?.mapPoint) return;
    const track = distanceToMapLegNm(
      { x: activeTelemetry.mapX, y: activeTelemetry.mapY },
      from.mapPoint,
      to.mapPoint,
    );
    if (track.progress > 0.04 && track.progress < 1.15 && track.distanceNm < 3) {
      const nextIndex = procedure.fixes.findIndex((fix) => fix.id === to.id);
      if (nextIndex >= 0) setTargetIndex(nextIndex);
    }
  }, [activeTelemetry, procedure]);

  const targetDistanceNm = activeTelemetry && currentFix?.mapPoint
    ? mapDistanceNm({ x: activeTelemetry.mapX, y: activeTelemetry.mapY }, currentFix.mapPoint)
    : null;

  useEffect(() => {
    if (!procedure || targetDistanceNm === null || targetDistanceNm > 0.9) return;
    setTargetIndex((current) => Math.min(current + 1, procedure.fixes.length - 1));
  }, [procedure, currentFix?.id, targetDistanceNm]);

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
  const established = Boolean(legCapture && legCapture.progress >= -0.05 && legCapture.progress <= 1.08 && legCapture.distanceNm <= 0.55);

  const navCommand = !currentFix
    ? "NO ACTIVE PROCEDURE"
    : !currentFix.mapPoint
      ? `HOLD GUIDANCE · ${currentFix.label} GEOMETRY NOT RESOLVED`
      : established && inboundLeg
        ? `FLY ${paddedHeading(inboundLeg.course)}° · ${currentFix.label}`
        : inboundLeg
          ? `INTERCEPT ${paddedHeading(inboundLeg.course)}° · HDG ${paddedHeading(directHeading)}° TO ${currentFix.label}`
          : `HDG ${paddedHeading(directHeading)}° · DIRECT ${currentFix.label}`;

  const altitude = activeTelemetry?.altitude ?? 0;
  const altitudeAdvisory = activeTelemetry
    ? altitudeCommand(currentFix?.altitude, altitude)
    : "WAITING FOR AIRCRAFT TELEMETRY";

  const speedLimits = [
    currentFix?.speed?.knots,
    procedure?.globalSpeed && activeTelemetry && activeTelemetry.altitude < procedure.globalSpeed.belowFeet
      ? procedure.globalSpeed.maxKnots
      : undefined,
  ].filter((item): item is number => typeof item === "number");
  const maxSpeed = speedLimits.length > 0 ? Math.min(...speedLimits) : null;
  const speedAdvisory = maxSpeed ? `MAX ${maxSpeed} KT` : "NO PUBLISHED SPEED AT NEXT FIX";

  let verticalProfile = "NO DESCENT CALCULATION REQUIRED";
  if (activeTelemetry && currentFix?.altitude && targetDistanceNm !== null) {
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

  if (!plan) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-slate-950 p-8 text-center">
        <p className="mono text-xs text-slate-500">GUIDANCE DIRECTOR</p>
        <p className="mt-3 text-sm text-slate-400">Crea un plan de vuelo activo para habilitar el director.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="mono text-xs text-slate-500">GUIDANCE DIRECTOR</p>
              <span className={`mono text-[10px] ${statusTone(connectionState, telemetryFresh)}`}>
                {connectionState}{connectionState === "LIVE" ? telemetryFresh ? " · AIRCRAFT LINKED" : " · SEARCHING AIRCRAFT" : ""}
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
          <LiveMetric label="PF CALLSIGN" value={gameCallsign || "----"} />
          <LiveMetric label="ALTITUDE" value={activeTelemetry ? `${Math.round(activeTelemetry.altitude).toLocaleString("en-US")} FT` : "-----"} />
          <LiveMetric label="HEADING" value={activeTelemetry ? `${paddedHeading(activeTelemetry.heading)}°` : "---°"} />
          <LiveMetric label="GROUND SPEED" value={activeTelemetry ? `${Math.round(activeTelemetry.groundSpeed)} KT` : "--- KT"} />
        </div>

        <div className={`mt-5 rounded-2xl border p-5 ${enabled ? "border-sky-400/40 bg-sky-400/5" : "border-white/10 bg-[#020617]"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="mono text-xs text-slate-500">PFPILOT ADVISORY</p>
            {procedure && <span className="mono text-[10px] text-sky-300">{procedure.code} · RWY {procedure.runway}</span>}
          </div>
          {!enabled ? (
            <p className="mt-3 text-sm text-slate-500">Activa GUIDANCE para comenzar las indicaciones.</p>
          ) : !procedure ? (
            <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100/80">
              No hay un procedimiento cargado que coincida con el destino/ruta del FPL. El motor no inventará instrucciones.
            </div>
          ) : !activeTelemetry ? (
            <p className="mt-3 text-sm text-amber-200">Esperando al callsign {gameCallsign || "del FPL"} en Project Flight.</p>
          ) : (
            <div className="mt-4 grid gap-3">
              <AdvisoryRow label="NAV" value={navCommand} primary />
              <AdvisoryRow label="ALT" value={altitudeAdvisory} />
              <AdvisoryRow label="SPD" value={speedAdvisory} />
              <AdvisoryRow label="VNAV" value={verticalProfile} />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="mono text-xs text-slate-500">ACTIVE PROCEDURE</p>
              <p className="mono mt-2 text-2xl font-extrabold text-white">{procedure?.code ?? "NOT LOADED"}</p>
              <p className="mt-1 text-xs text-slate-500">{procedure ? `${procedure.kind} · ${procedure.airport} RWY ${procedure.runway} · ${procedure.chart}` : `ARR ${String(plan.arrival_icao ?? "----")}`}</p>
            </div>
            {procedure && (
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

          {procedure ? (
            <div className="mt-5 space-y-2">
              {procedure.fixes.map((fix, index) => (
                <div
                  key={fix.id}
                  className={`rounded-xl border p-3 ${index === targetIndex ? "border-sky-400/50 bg-sky-400/5" : "border-white/10 bg-[#020617]"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={`mono text-xs font-bold ${index === targetIndex ? "text-sky-300" : "text-slate-300"}`}>{fix.label}</span>
                    <span className="mono text-[10px] text-slate-500">{fix.source === "DME_FIX" ? "DME" : "FIX"}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    <span>ALT {formatAltitudeRestriction(fix.altitude)}</span>
                    <span>SPD {fix.speed ? `MAX ${fix.speed.knots} KT` : "—"}</span>
                  </div>
                  {fix.dme && !fix.mapPoint && (
                    <p className="mt-2 text-[10px] leading-4 text-amber-200/70">{fix.dme.distanceNm.toFixed(1)} DME {fix.dme.station} · geometric fix definition stored; coordinate resolver will use the station reference.</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-500">Primera librería cargada: MDST PIXES4B / ETBOD4B. Se selecciona automáticamente desde el FPL.</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
          <p className="mono text-xs text-slate-500">NEXT CONSTRAINT</p>
          <p className="mono mt-3 text-xl font-bold text-sky-300">{currentFix?.label ?? "—"}</p>
          <p className="mt-2 text-sm text-slate-400">ALT {formatAltitudeRestriction(currentFix?.altitude)} · SPD {currentFix?.speed ? `MAX ${currentFix.speed.knots} KT` : "—"}</p>
          <p className="mt-2 text-xs text-slate-500">{targetDistanceNm !== null ? `${targetDistanceNm.toFixed(1)} NM to fix` : currentFix?.dme ? "DME geometry pending resolver" : "Distance unavailable"}</p>
        </div>

        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-5 text-amber-100/75">
          Las restricciones de velocidad son valores publicados de procedimiento. Project Flight entrega GS al director; PFPilot no la presenta como IAS ni la usa para afirmar cumplimiento de IAS.
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
