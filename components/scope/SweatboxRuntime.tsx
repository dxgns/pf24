"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MAP_BOUNDS, WAYPOINTS } from "@/lib/scope/mapData";
import { SCOPE_MAP_UNITS_PER_NM } from "@/lib/scope/distanceScale";
import {
  SCOPE_SERVER_EVENT,
  SWEATBOX_COMMAND_EVENT,
  SWEATBOX_SELECTION_EVENT,
  SWEATBOX_ATIS_EVENT,
  SWEATBOX_SECTOR_EVENT,
  defaultSweatboxFlightPlan,
  readScopeServerMode,
  readSweatboxRoom,
  type ScopeServerMode,
  type SweatboxAircraft,
  type SweatboxFlightPlan,
  type SweatboxSessionDetail,
  type SweatboxSnapshot,
} from "@/lib/scope/sweatbox";

type Point = { x: number; y: number };
type Viewport = { zoom: number; panX: number; panY: number };
type Tool = "procedure" | "direct" | "heading" | "speed" | "altitude" | null;
type ProcedureAction = "LAND" | "TAKEOFF" | "GO_AROUND";

type Props = {
  controllerName: string;
  canInstruct: boolean;
};

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";
const SNAPSHOT_MS = 250;
const SIM_STEP_MS = 50;
const GROUND_ALTITUDE_FT = 100;

const AIRPORTS: Record<string, { x: number; y: number; elevation: number; runways: string[] }> = {
  MDPC: { x: 87.44, y: 102.59, elevation: 47, runways: ["08", "09", "26", "27"] },
  MDST: { x: 68.47, y: 92.81, elevation: 565, runways: ["11", "29"] },
  LCLK: { x: 159.82, y: 91.21, elevation: 8, runways: ["04", "22"] },
  LCPH: { x: 133.84, y: 99.63, elevation: 41, runways: ["11", "29"] },
  GCLP: { x: 77.2, y: 56.0, elevation: 78, runways: ["03L", "03R", "21L", "21R"] },
  LEMH: { x: 125.0, y: 49.8, elevation: 302, runways: ["01", "19"] },
  EGKK: { x: 120.0, y: 25.5, elevation: 203, runways: ["08R", "26L"] },
  EFKT: { x: 163.5, y: 7.0, elevation: 643, runways: ["16", "34"] },
  EGHI: { x: 105.0, y: 25.0, elevation: 44, runways: ["02", "20"] },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeHeading(value: number) {
  return ((value % 360) + 360) % 360;
}

function shortestTurn(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

function runwayHeading(runway: string) {
  const number = Number(runway.match(/^\d{2}/)?.[0] ?? 0);
  return normalizeHeading(number * 10 || 360);
}

function headingVector(heading: number) {
  const radians = heading * Math.PI / 180;
  return { x: Math.sin(radians), y: -Math.cos(radians) };
}

function bearing(from: Point, to: Point) {
  return normalizeHeading(Math.atan2(to.x - from.x, -(to.y - from.y)) * 180 / Math.PI);
}

function mapDistanceNm(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y) / SCOPE_MAP_UNITS_PER_NM;
}

function project(point: Point, heading: number, distanceNm: number) {
  const unit = headingVector(heading);
  return {
    x: point.x + unit.x * distanceNm * SCOPE_MAP_UNITS_PER_NM,
    y: point.y + unit.y * distanceNm * SCOPE_MAP_UNITS_PER_NM,
  };
}

function runwayGeometry(airportCode: string, runway: string) {
  const airport = AIRPORTS[airportCode];
  if (!airport) return null;
  const course = runwayHeading(runway);
  // The airport reference point is used as the runway midpoint. A 1.35 NM
  // nominal runway gives the simulator stable threshold geometry even where the
  // decorative airport SVG is not visible at the current zoom.
  const threshold = project(airport, normalizeHeading(course + 180), 0.675);
  const rolloutEnd = project(airport, course, 0.675);
  const gate = project(threshold, normalizeHeading(course + 180), 6);
  return { airport, course, threshold, rolloutEnd, gate };
}

function readViewport(): Viewport {
  try {
    const raw = JSON.parse(localStorage.getItem(VIEWPORT_KEY) ?? "{}") as Partial<Viewport>;
    return {
      zoom: typeof raw.zoom === "number" ? raw.zoom : 1,
      panX: typeof raw.panX === "number" ? raw.panX : 0,
      panY: typeof raw.panY === "number" ? raw.panY : 0,
    };
  } catch {
    return { zoom: 1, panX: 0, panY: 0 };
  }
}

function screenPoint(size: Point, point: Point, viewport: Viewport) {
  const mapWidth = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
  const mapHeight = MAP_BOUNDS.maxY - MAP_BOUNDS.minY;
  const fit = Math.min(size.x / mapWidth, size.y / mapHeight);
  const offsetX = (size.x - mapWidth * fit) / 2;
  const offsetY = (size.y - mapHeight * fit) / 2;
  return {
    x: (offsetX + (point.x - MAP_BOUNDS.minX) * fit) * viewport.zoom + viewport.panX,
    y: (offsetY + (point.y - MAP_BOUNDS.minY) * fit) * viewport.zoom + viewport.panY,
  };
}

function mapPointFromClient(host: HTMLElement, clientX: number, clientY: number, viewport: Viewport): Point {
  const rect = host.getBoundingClientRect();
  const scaleX = host.clientWidth / Math.max(1, rect.width);
  const scaleY = host.clientHeight / Math.max(1, rect.height);
  const localX = (clientX - rect.left) * scaleX;
  const localY = (clientY - rect.top) * scaleY;
  const mapWidth = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
  const mapHeight = MAP_BOUNDS.maxY - MAP_BOUNDS.minY;
  const fit = Math.min(host.clientWidth / mapWidth, host.clientHeight / mapHeight);
  const offsetX = (host.clientWidth - mapWidth * fit) / 2;
  const offsetY = (host.clientHeight - mapHeight * fit) / 2;
  const baseX = (localX - viewport.panX) / Math.max(0.01, viewport.zoom);
  const baseY = (localY - viewport.panY) / Math.max(0.01, viewport.zoom);
  return {
    x: clamp(MAP_BOUNDS.minX + (baseX - offsetX) / fit, MAP_BOUNDS.minX, MAP_BOUNDS.maxX),
    y: clamp(MAP_BOUNDS.minY + (baseY - offsetY) / fit, MAP_BOUNDS.minY, MAP_BOUNDS.maxY),
  };
}

function defaultAircraft(point: Point, index: number): SweatboxAircraft {
  const callsign = `SWT${String(index).padStart(3, "0")}`;
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `swt-${Date.now()}-${index}`,
    callsign,
    aircraftType: "A320",
    x: point.x,
    y: point.y,
    altitude: 0,
    heading: 0,
    speed: 0,
    verticalRate: 0,
    targetAltitude: 0,
    targetHeading: 0,
    targetSpeed: 0,
    navMode: "MANUAL",
    navTarget: null,
    procedureAirport: null,
    procedureCode: null,
    runway: null,
    flightPlan: defaultSweatboxFlightPlan(callsign),
    assumedBy: null,
    freeText: "",
  };
}

function approachTarget(aircraft: SweatboxAircraft) {
  if (aircraft.navMode !== "LAND" || !aircraft.procedureAirport || !aircraft.runway) return null;
  const geometry = runwayGeometry(aircraft.procedureAirport, aircraft.runway);
  if (!geometry) return null;
  const aircraftPoint = { x: aircraft.x, y: aircraft.y };
  const gateDistance = mapDistanceNm(aircraftPoint, geometry.gate);
  const thresholdDistance = mapDistanceNm(aircraftPoint, geometry.threshold);
  const aligned = Math.abs(shortestTurn(aircraft.heading, geometry.course)) < 35;
  const target = gateDistance > 0.45 && (!aligned || thresholdDistance > 5.7)
    ? geometry.gate
    : geometry.threshold;
  return { geometry, target, thresholdDistance };
}

function simulateAircraft(source: SweatboxAircraft, dtSeconds: number) {
  const next = { ...source, flightPlan: { ...source.flightPlan } };
  const point = { x: next.x, y: next.y };
  let desiredHeading = next.targetHeading;
  let desiredSpeed = next.targetSpeed;
  let desiredAltitude = next.targetAltitude;

  if (next.navMode === "DIRECT" && next.navTarget) {
    const waypoint = WAYPOINTS.find((item) => item.name === next.navTarget);
    if (waypoint) {
      desiredHeading = bearing(point, waypoint);
      if (mapDistanceNm(point, waypoint) < 0.18) {
        next.navMode = "MANUAL";
        next.navTarget = null;
        next.targetHeading = desiredHeading;
      }
    }
  }

  if (next.navMode === "LAND") {
    const approach = approachTarget(next);
    if (approach) {
      desiredHeading = bearing(point, approach.target);
      desiredSpeed = approach.thresholdDistance > 6 ? 190 : approach.thresholdDistance > 3 ? 165 : 135;
      const glideAltitude = approach.geometry.airport.elevation + Math.max(0, approach.thresholdDistance) * 300;
      desiredAltitude = Math.min(next.targetAltitude > 0 ? next.targetAltitude : glideAltitude, glideAltitude);
      if (approach.thresholdDistance < 0.18 && next.altitude <= approach.geometry.airport.elevation + 90) {
        desiredHeading = approach.geometry.course;
        desiredAltitude = approach.geometry.airport.elevation;
        desiredSpeed = next.speed > 70 ? 70 : 0;
        if (next.speed < 8) {
          next.navMode = "MANUAL";
          desiredSpeed = 0;
        }
      }
    }
  }

  if (next.navMode === "TAKEOFF" && next.procedureAirport && next.runway) {
    const geometry = runwayGeometry(next.procedureAirport, next.runway);
    if (geometry) {
      desiredHeading = geometry.course;
      desiredSpeed = 180;
      desiredAltitude = next.speed >= 105 ? Math.max(next.targetAltitude, geometry.airport.elevation + 3000) : geometry.airport.elevation;
    }
  }

  if (next.navMode === "GO_AROUND" && next.procedureAirport && next.runway) {
    const geometry = runwayGeometry(next.procedureAirport, next.runway);
    if (geometry) {
      desiredHeading = geometry.course;
      desiredSpeed = Math.max(180, next.targetSpeed);
      desiredAltitude = Math.max(next.targetAltitude, geometry.airport.elevation + 2000);
    }
  }

  const speedForTurn = Math.max(80, next.speed);
  const turnRate = clamp(520 / speedForTurn, 1.3, 4.2);
  const turn = clamp(shortestTurn(next.heading, desiredHeading), -turnRate * dtSeconds, turnRate * dtSeconds);
  next.heading = normalizeHeading(next.heading + turn);

  const accelRate = desiredSpeed > next.speed ? 5 : 7;
  next.speed += clamp(desiredSpeed - next.speed, -accelRate * dtSeconds, accelRate * dtSeconds);
  if (next.speed < 0.1) next.speed = 0;

  const altitudeError = desiredAltitude - next.altitude;
  let rateFpm = 0;
  if (Math.abs(altitudeError) > 15) {
    const approachDescent = next.navMode === "LAND" && altitudeError < 0;
    const maxRate = approachDescent ? 900 : altitudeError > 0 ? 2200 : 1800;
    rateFpm = clamp(altitudeError * 2.2, -maxRate, maxRate);
    const delta = rateFpm / 60 * dtSeconds;
    if (Math.abs(delta) > Math.abs(altitudeError)) next.altitude = desiredAltitude;
    else next.altitude += delta;
  }
  next.verticalRate = rateFpm;

  const distanceNm = next.speed * dtSeconds / 3600;
  const unit = headingVector(next.heading);
  next.x = clamp(next.x + unit.x * distanceNm * SCOPE_MAP_UNITS_PER_NM, MAP_BOUNDS.minX, MAP_BOUNDS.maxX);
  next.y = clamp(next.y + unit.y * distanceNm * SCOPE_MAP_UNITS_PER_NM, MAP_BOUNDS.minY, MAP_BOUNDS.maxY);
  next.targetHeading = normalizeHeading(desiredHeading);
  next.targetSpeed = Math.max(0, desiredSpeed);
  next.targetAltitude = Math.max(0, desiredAltitude);
  return next;
}

function flightLevel(altitude: number) {
  return String(Math.max(0, Math.round(altitude / 100))).padStart(3, "0");
}

function readSession(): SweatboxSessionDetail {
  const mode = readScopeServerMode();
  return {
    connected: false,
    mode,
    room: readSweatboxRoom(),
    instructor: mode === "SWEATBOX_INSTRUCTOR",
  };
}

export default function SweatboxRuntime({ controllerName, canInstruct }: Props) {
  const [session, setSession] = useState<SweatboxSessionDetail>(() => readSession());
  const [traffic, setTraffic] = useState<SweatboxAircraft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>(() => ({ zoom: 1, panX: 0, panY: 0 }));
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [hostSize, setHostSize] = useState<Point>({ x: 1, y: 1 });
  const [tool, setTool] = useState<Tool>(null);
  const [createArmed, setCreateArmed] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [fplId, setFplId] = useState<string | null>(null);
  const [fplDraft, setFplDraft] = useState<SweatboxFlightPlan | null>(null);
  const [atis, setAtis] = useState<Record<string, unknown>>({});
  const [sector, setSector] = useState<Record<string, unknown>>({});
  const trafficRef = useRef<SweatboxAircraft[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const counterRef = useRef(1);

  const instructor = session.connected && session.mode === "SWEATBOX_INSTRUCTOR" && canInstruct;
  const sweatbox = session.connected && session.mode !== "AUTOMATIC" && Boolean(session.room);
  const selected = traffic.find((item) => item.id === selectedId) ?? null;

  const setTrafficBoth = (next: SweatboxAircraft[] | ((current: SweatboxAircraft[]) => SweatboxAircraft[])) => {
    setTraffic((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      trafficRef.current = resolved;
      return resolved;
    });
  };

  useEffect(() => {
    setViewport(readViewport());
    const onViewport = (event: Event) => {
      const detail = (event as CustomEvent<Viewport>).detail;
      if (detail) setViewport(detail);
    };
    window.addEventListener(VIEWPORT_EVENT, onViewport);
    return () => window.removeEventListener(VIEWPORT_EVENT, onViewport);
  }, []);

  useEffect(() => {
    const locate = () => {
      const radar = document.querySelector<HTMLElement>("main.fixed > section");
      if (!radar) return;
      setHost(radar);
      setHostSize({ x: Math.max(1, radar.clientWidth), y: Math.max(1, radar.clientHeight) });
    };
    locate();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(locate) : null;
    const radar = document.querySelector<HTMLElement>("main.fixed > section");
    if (radar) observer?.observe(radar);
    const timer = window.setInterval(locate, 500);
    return () => {
      observer?.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const onSession = (event: Event) => {
      const detail = (event as CustomEvent<SweatboxSessionDetail>).detail;
      if (!detail) return;
      setSession({ ...detail, instructor: detail.instructor && canInstruct });
      if (!detail.connected || detail.mode === "AUTOMATIC") {
        setTrafficBoth([]);
        setSelectedId(null);
        setTool(null);
        setCreateArmed(false);
      }
    };
    window.addEventListener(SCOPE_SERVER_EVENT, onSession);
    return () => window.removeEventListener(SCOPE_SERVER_EVENT, onSession);
  }, [canInstruct]);

  useEffect(() => {
    if (!sweatbox) return;
    const channel = supabase.channel(`pf24-sweatbox-${session.room}`, {
      config: { broadcast: { self: true }, presence: { key: `${controllerName}-${Math.random().toString(36).slice(2, 8)}` } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "snapshot" }, ({ payload }) => {
        if (instructor) return;
        const snapshot = payload as SweatboxSnapshot;
        if (!snapshot || snapshot.room !== session.room || !Array.isArray(snapshot.traffic)) return;
        setTrafficBoth(snapshot.traffic);
        setAtis(snapshot.atis ?? {});
        setSector(snapshot.sector ?? {});
      })
      .on("broadcast", { event: "atis" }, ({ payload }) => {
        const row = payload as { airport?: string; data?: unknown };
        if (!row?.airport) return;
        setAtis((current) => ({ ...current, [row.airport!]: row.data }));
      })
      .on("broadcast", { event: "sector" }, ({ payload }) => {
        if (!payload || typeof payload !== "object") return;
        setSector((current) => ({ ...current, ...(payload as Record<string, unknown>) }));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ controllerName, instructor, callsign: session.callsign ?? "", joinedAt: Date.now() });
        }
      });

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [sweatbox, session.room, instructor, controllerName, session.callsign]);

  useEffect(() => {
    if (!instructor) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = clamp((now - last) / 1000, 0, 0.25);
      last = now;
      setTrafficBoth((current) => current.map((item) => simulateAircraft(item, dt)));
    }, SIM_STEP_MS);
    return () => window.clearInterval(timer);
  }, [instructor]);

  useEffect(() => {
    if (!instructor || !sweatbox) return;
    const timer = window.setInterval(() => {
      const snapshot: SweatboxSnapshot = {
        version: 1,
        room: session.room,
        sentAt: Date.now(),
        traffic: trafficRef.current,
        atis,
        sector,
      };
      void channelRef.current?.send({ type: "broadcast", event: "snapshot", payload: snapshot });
      window.dispatchEvent(new CustomEvent("pf24-sweatbox-snapshot", { detail: snapshot }));
    }, SNAPSHOT_MS);
    return () => window.clearInterval(timer);
  }, [instructor, sweatbox, session.room, atis, sector]);

  useEffect(() => {
    if (!sweatbox) return;
    const onAtis = (event: Event) => {
      const detail = (event as CustomEvent<{ airport?: string; data?: unknown }>).detail;
      if (!detail?.airport) return;
      setAtis((current) => ({ ...current, [detail.airport!]: detail.data }));
      if (instructor) void channelRef.current?.send({ type: "broadcast", event: "atis", payload: detail });
    };
    const onSector = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail;
      if (!detail) return;
      setSector((current) => ({ ...current, ...detail }));
      if (instructor) void channelRef.current?.send({ type: "broadcast", event: "sector", payload: detail });
    };
    window.addEventListener(SWEATBOX_ATIS_EVENT, onAtis);
    window.addEventListener(SWEATBOX_SECTOR_EVENT, onSector);
    return () => {
      window.removeEventListener(SWEATBOX_ATIS_EVENT, onAtis);
      window.removeEventListener(SWEATBOX_SECTOR_EVENT, onSector);
    };
  }, [sweatbox, instructor]);

  useEffect(() => {
    if (!instructor) return;
    const onCommand = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail ?? {};
      const action = String(detail.action ?? "");
      if (action === "arm-create") {
        setCreateArmed(true);
        setTool(null);
        return;
      }
      if (!selectedId) return;
      setTrafficBoth((current) => current.map((item) => {
        if (item.id !== selectedId) return item;
        if (action === "heading") {
          const value = clamp(Number(detail.value ?? item.targetHeading), 0, 359);
          return { ...item, navMode: "MANUAL", navTarget: null, targetHeading: value };
        }
        if (action === "speed") {
          return { ...item, targetSpeed: clamp(Number(detail.value ?? item.targetSpeed), 0, 520) };
        }
        if (action === "altitude") {
          return { ...item, targetAltitude: clamp(Number(detail.value ?? item.targetAltitude), 0, 60000) };
        }
        if (action === "direct") {
          const waypoint = String(detail.value ?? "").toUpperCase();
          return { ...item, navMode: "DIRECT", navTarget: waypoint };
        }
        if (action === "procedure") {
          const procedure = String(detail.procedure ?? "") as ProcedureAction;
          const airport = String(detail.airport ?? "").toUpperCase();
          const runway = String(detail.runway ?? "").toUpperCase();
          const geometry = runwayGeometry(airport, runway);
          if (!geometry) return item;
          const altitude = procedure === "GO_AROUND"
            ? clamp(Number(detail.altitude ?? geometry.airport.elevation + 3000), geometry.airport.elevation + 1000, 60000)
            : procedure === "TAKEOFF"
              ? geometry.airport.elevation
              : item.targetAltitude || item.altitude;
          return {
            ...item,
            navMode: procedure,
            procedureAirport: airport,
            procedureCode: procedure,
            runway,
            targetHeading: geometry.course,
            targetAltitude: altitude,
            targetSpeed: procedure === "LAND" ? Math.max(135, Math.min(item.speed || 180, 190)) : 180,
          };
        }
        return item;
      }));
    };
    window.addEventListener(SWEATBOX_COMMAND_EVENT, onCommand);
    return () => window.removeEventListener(SWEATBOX_COMMAND_EVENT, onCommand);
  }, [instructor, selectedId]);

  useEffect(() => {
    if (!host || !instructor || !createArmed) return;
    const create = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("button,input,select,textarea,[data-pf24-sweatbox-toolbar='true']")) return;
      event.preventDefault();
      event.stopPropagation();
      const point = mapPointFromClient(host, event.clientX, event.clientY, viewport);
      const aircraft = defaultAircraft(point, counterRef.current++);
      setTrafficBoth((current) => [...current, aircraft]);
      setSelectedId(aircraft.id);
      window.dispatchEvent(new CustomEvent(SWEATBOX_SELECTION_EVENT, { detail: { id: aircraft.id, aircraft } }));
      setCreateArmed(false);
    };
    host.addEventListener("click", create, true);
    return () => host.removeEventListener("click", create, true);
  }, [host, instructor, createArmed, viewport]);

  const select = (item: SweatboxAircraft) => {
    setSelectedId(item.id);
    setMenuId(null);
    window.dispatchEvent(new CustomEvent(SWEATBOX_SELECTION_EVENT, { detail: { id: item.id, aircraft: item } }));
  };

  const saveFpl = () => {
    if (!instructor || !fplId || !fplDraft) return;
    const clean: SweatboxFlightPlan = {
      ...fplDraft,
      callsign: fplDraft.callsign.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12),
      flightLevel: fplDraft.flightLevel.replace(/\D/g, "").slice(0, 3),
      departure: fplDraft.departure.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4),
      cruiseSpeed: fplDraft.cruiseSpeed.replace(/\D/g, "").slice(0, 3),
      arrival: fplDraft.arrival.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4),
      aircraft: fplDraft.aircraft.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8),
      alternate: fplDraft.alternate.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4),
      flightRules: fplDraft.flightRules.toUpperCase().slice(0, 3),
      registration: fplDraft.registration.toUpperCase().slice(0, 10),
      route: fplDraft.route.toUpperCase().replace(/\s+/g, " ").trim(),
    };
    setTrafficBoth((current) => current.map((item) => item.id === fplId
      ? { ...item, callsign: clean.callsign || item.callsign, aircraftType: clean.aircraft || item.aircraftType, flightPlan: clean }
      : item));
    setFplDraft(clean);
  };

  const openFpl = (item: SweatboxAircraft) => {
    setFplId(item.id);
    setFplDraft({ ...item.flightPlan });
    setMenuId(null);
  };

  if (!host || !sweatbox) return null;

  const trafficLayer = createPortal(
    <div data-pf24-live-traffic="true" data-pf24-sweatbox-traffic="true" className="pointer-events-none absolute inset-0 z-[8] overflow-hidden">
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${hostSize.x} ${hostSize.y}`} preserveAspectRatio="none" aria-hidden="true">
        {traffic.map((item) => {
          const marker = screenPoint(hostSize, item, viewport);
          const offset = { x: 17, y: 14 };
          return <line key={`line-${item.id}`} x1={marker.x} y1={marker.y} x2={marker.x + offset.x} y2={marker.y + offset.y} stroke="#00e000" strokeWidth="1.1" />;
        })}
      </svg>
      {traffic.map((item) => {
        const marker = screenPoint(hostSize, item, viewport);
        const active = selectedId === item.id;
        const labelLeft = marker.x + 17;
        const labelTop = marker.y + 14;
        return <div key={item.id}>
          <button type="button" data-pf24-traffic-select="true" data-pf24-sweatbox-id={item.id} onClick={(event) => { event.stopPropagation(); select(item); }} className="pointer-events-auto absolute z-[10] h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2" style={{ left: marker.x, top: marker.y }} aria-label={`Seleccionar ${item.callsign}`}>
            <span className={`absolute inset-0 rotate-45 border ${active ? "border-[#00ff00]" : "border-[#00d800]"}`} />
          </button>
          <div data-pf24-traffic-label="true" data-pf24-traffic-id={item.id} data-pf24-sweatbox-id={item.id} className={`pointer-events-auto absolute z-[11] font-mono text-[9px] leading-[9px] text-[#00e000] ${active ? "w-[108px]" : "w-[72px]"}`} style={{ left: labelLeft, top: labelTop }} onClick={(event) => { event.stopPropagation(); select(item); }}>
            <div className="relative">
              <button type="button" onDoubleClick={(event) => { event.stopPropagation(); setMenuId(menuId === item.id ? null : item.id); }} className="block max-w-[86px] overflow-hidden text-ellipsis whitespace-nowrap bg-transparent text-left text-[#00e000]">{item.callsign}</button>
              {menuId === item.id && <div data-pf24-callsign-menu="true" className="absolute left-0 top-[10px] z-[90] w-[118px] border border-[#f2f2f2] bg-[#555c60] text-[10px] leading-[18px] text-[#ededed] shadow-lg">
                <div className="border-b border-[#f2f2f2] px-2 text-center text-[#22e000]">{item.callsign}</div>
                <button type="button" onClick={(event) => { event.stopPropagation(); openFpl(item); }} className="block w-full border-b border-[#f2f2f2] px-2 text-center hover:bg-[#626a6f]">FPL</button>
                <button type="button" onClick={(event) => { event.stopPropagation(); if (instructor) setTrafficBoth((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, assumedBy: controllerName } : candidate)); setMenuId(null); }} className="block w-full border-b border-[#f2f2f2] px-2 text-center hover:bg-[#626a6f]">Assume</button>
                {instructor && <button type="button" onClick={(event) => { event.stopPropagation(); setTrafficBoth((current) => current.filter((candidate) => candidate.id !== item.id)); setSelectedId(null); setMenuId(null); }} className="block w-full px-2 text-center hover:bg-[#626a6f]">Delete</button>}
              </div>}
            </div>
            <div className="grid grid-cols-[32px_32px]">
              <span>{flightLevel(item.altitude)}{item.verticalRate > 120 ? "↑" : item.verticalRate < -120 ? "↓" : ""}</span>
              <span>{String(Math.round(item.speed)).padStart(3, "0")}</span>
            </div>
            <div className="truncate">{item.flightPlan.arrival || "XXXX"}</div>
            {active && <>
              <div className="grid grid-cols-[44px_64px] text-[#9cff9c]"><span>HDG {String(Math.round(item.targetHeading)).padStart(3, "0")}</span><span>SPD {Math.round(item.targetSpeed)}</span></div>
              <div className="truncate text-[#9cff9c]">ALT {Math.round(item.targetAltitude)} · {item.navMode}{item.navTarget ? ` ${item.navTarget}` : ""}</div>
            </>}
          </div>
        </div>;
      })}
      {createArmed && <div className="pointer-events-none absolute left-1/2 top-[8px] z-[100] -translate-x-1/2 border border-[#e7e7e7] bg-[#555c60] px-3 py-1 font-mono text-[10px] text-white">CREATE TRAFFIC · CLICK MAP</div>}
    </div>,
    host,
  );

  return <>
    {trafficLayer}
    <SweatboxInstructorToolbar
      visible={instructor}
      selected={selected}
      activeTool={tool}
      setActiveTool={setTool}
      onArmCreate={() => window.dispatchEvent(new CustomEvent(SWEATBOX_COMMAND_EVENT, { detail: { action: "arm-create" } }))}
    />
    {fplId && fplDraft && <SweatboxFplEditor draft={fplDraft} setDraft={setFplDraft} readOnly={!instructor} onSave={saveFpl} onClose={() => { setFplId(null); setFplDraft(null); }} host={host} />}
  </>;
}

function SweatboxInstructorToolbar({ visible, selected, activeTool, setActiveTool, onArmCreate }: {
  visible: boolean;
  selected: SweatboxAircraft | null;
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  onArmCreate: () => void;
}) {
  const [header, setHeader] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHeader(document.querySelector<HTMLElement>("main.fixed header"));
  }, []);
  if (!visible || !header) return null;

  const choose = (tool: Exclude<Tool, null>) => {
    if (!selected && tool !== null) return;
    setActiveTool(activeTool === tool ? null : tool);
  };

  return createPortal(
    <div data-pf24-sweatbox-toolbar="true" className="pointer-events-auto absolute right-[4px] top-[23px] z-[200] flex h-[54px] border border-[#092f2a] bg-[#064a40] shadow-[0_2px_6px_rgba(0,0,0,.45)]">
      <ToolButton title="Automatic procedure" disabled={!selected} active={activeTool === "procedure"} onClick={() => choose("procedure")}><ProcedureIcon /></ToolButton>
      <ToolButton title="Direct to waypoint" disabled={!selected} active={activeTool === "direct"} onClick={() => choose("direct")}><DirectIcon /></ToolButton>
      <ToolButton title="Heading" disabled={!selected} active={activeTool === "heading"} onClick={() => choose("heading")}><HeadingIcon /></ToolButton>
      <ToolButton title="Speed" disabled={!selected} active={activeTool === "speed"} onClick={() => choose("speed")}><SpeedIcon /></ToolButton>
      <ToolButton title="Altitude" disabled={!selected} active={activeTool === "altitude"} onClick={() => choose("altitude")}><AltitudeIcon /></ToolButton>
      <ToolButton title="Create traffic" active={false} onClick={onArmCreate}><CreateIcon /></ToolButton>
      {activeTool && selected && <ToolPopup tool={activeTool} selected={selected} close={() => setActiveTool(null)} />}
    </div>,
    header,
  );
}

function ToolButton({ title, disabled = false, active, onClick, children }: { title: string; disabled?: boolean; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" title={title} disabled={disabled} onClick={onClick} className={`flex h-[52px] w-[62px] items-center justify-center border-r-2 border-[#082f2a] bg-[#064a40] text-[#f4f4f4] hover:bg-[#0a5b50] disabled:opacity-35 ${active ? "bg-[#0a6558]" : ""}`}>{children}</button>;
}

function ToolPopup({ tool, selected, close }: { tool: Exclude<Tool, null>; selected: SweatboxAircraft; close: () => void }) {
  const [airport, setAirport] = useState(selected.procedureAirport || "MDPC");
  const [procedure, setProcedure] = useState<ProcedureAction>("LAND");
  const [runway, setRunway] = useState(AIRPORTS[selected.procedureAirport || "MDPC"]?.runways[0] ?? "09");
  const [value, setValue] = useState("");
  const airportRunways = AIRPORTS[airport]?.runways ?? [];

  useEffect(() => {
    if (!airportRunways.includes(runway)) setRunway(airportRunways[0] ?? "");
  }, [airport, runway, airportRunways]);

  const send = (detail: Record<string, unknown>) => {
    window.dispatchEvent(new CustomEvent(SWEATBOX_COMMAND_EVENT, { detail }));
    close();
  };

  return <div className="absolute right-0 top-[56px] z-[210] min-w-[230px] border border-[#ddd] bg-[#555c60] p-2 font-mono text-[10px] text-white shadow-lg">
    <div className="mb-2 border-b border-[#ddd] pb-1">{selected.callsign}</div>
    {tool === "procedure" && <div className="grid gap-2">
      <select value={airport} onChange={(event) => setAirport(event.target.value)} className="bg-[#e8e8e8] p-1 text-black">{Object.keys(AIRPORTS).sort().map((item) => <option key={item}>{item}</option>)}</select>
      <select value={procedure} onChange={(event) => setProcedure(event.target.value as ProcedureAction)} className="bg-[#e8e8e8] p-1 text-black"><option value="LAND">LANDING</option><option value="TAKEOFF">TAKEOFF</option><option value="GO_AROUND">GO AROUND</option></select>
      <select value={runway} onChange={(event) => setRunway(event.target.value)} className="bg-[#e8e8e8] p-1 text-black">{airportRunways.map((item) => <option key={item}>{item}</option>)}</select>
      {procedure === "GO_AROUND" && <input value={value} onChange={(event) => setValue(event.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="ALT FT" className="bg-[#e8e8e8] p-1 text-black" />}
      <button onClick={() => send({ action: "procedure", airport, procedure, runway, altitude: Number(value || 3000) })} className="border border-white px-2 py-1 hover:bg-[#687176]">APPLY</button>
    </div>}
    {tool === "direct" && <DirectPicker onPick={(waypoint) => send({ action: "direct", value: waypoint })} />}
    {tool === "heading" && <ValueCommand value={value} setValue={setValue} placeholder="000-359" button="SET HDG" onSend={() => send({ action: "heading", value: Number(value) })} />}
    {tool === "speed" && <ValueCommand value={value} setValue={setValue} placeholder="KT" button="SET SPD" onSend={() => send({ action: "speed", value: Number(value) })} />}
    {tool === "altitude" && <ValueCommand value={value} setValue={setValue} placeholder="ALT FT" button="SET ALT" onSend={() => send({ action: "altitude", value: Number(value) })} />}
  </div>;
}

function DirectPicker({ onPick }: { onPick: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const list = useMemo(() => WAYPOINTS.filter((point) => point.name.includes(query.toUpperCase())).slice(0, 40), [query]);
  return <div><input autoFocus value={query} onChange={(event) => setQuery(event.target.value.toUpperCase())} placeholder="WAYPOINT" className="mb-1 w-full bg-[#e8e8e8] p-1 text-black"/><div className="max-h-[180px] overflow-auto border border-[#aaa]">{list.map((point) => <button key={`${point.name}-${point.x}-${point.y}`} onClick={() => onPick(point.name)} className="block w-full border-b border-[#777] px-2 py-1 text-left hover:bg-[#687176]">{point.name}</button>)}</div></div>;
}

function ValueCommand({ value, setValue, placeholder, button, onSend }: { value: string; setValue: (value: string) => void; placeholder: string; button: string; onSend: () => void }) {
  return <div className="grid gap-2"><input autoFocus value={value} onChange={(event) => setValue(event.target.value.replace(/\D/g, "").slice(0, 5))} placeholder={placeholder} className="bg-[#e8e8e8] p-1 text-black"/><button onClick={onSend} className="border border-white px-2 py-1 hover:bg-[#687176]">{button}</button></div>;
}

function SweatboxFplEditor({ draft, setDraft, readOnly, onSave, onClose, host }: { draft: SweatboxFlightPlan; setDraft: (draft: SweatboxFlightPlan) => void; readOnly: boolean; onSave: () => void; onClose: () => void; host: HTMLElement }) {
  const patch = (key: keyof SweatboxFlightPlan, value: string) => setDraft({ ...draft, [key]: value });
  const field = (label: string, key: keyof SweatboxFlightPlan, maxLength = 12) => <label className="grid grid-cols-[150px_1fr] items-center gap-2"><span className="text-right text-[13px]">{label}</span><input disabled={readOnly} value={draft[key]} maxLength={maxLength} onChange={(event) => patch(key, event.target.value)} className="h-[28px] border border-[#aaa] bg-[#ededed] px-2 text-[13px] disabled:bg-[#ddd]"/></label>;
  return createPortal(<div data-pf24-atc-fpl-editor="true" className="absolute left-1/2 top-1/2 z-[230] w-[880px] max-w-[calc(100%-40px)] -translate-x-1/2 -translate-y-1/2 border border-[#888] bg-[#cfcfcf] p-3 font-mono text-[#101010] shadow-[0_4px_18px_rgba(0,0,0,.55)]">
    <div className="mb-2 flex justify-between text-[17px]"><span>Flight Plan</span><span className="text-[11px]">{readOnly ? "SWEATBOX VIEW" : "SWEATBOX INSTRUCTOR EDIT"}</span></div>
    <div className="grid grid-cols-2 gap-x-10 gap-y-2 border-2 border-[#ededed] p-3">
      {field("Callsign", "callsign")}{field("Flight Level", "flightLevel", 3)}{field("Departure", "departure", 4)}{field("Cruising Speed", "cruiseSpeed", 3)}{field("Arrival", "arrival", 4)}{field("Aircraft", "aircraft", 8)}{field("Alternative", "alternate", 4)}{field("Fuel Endurance", "fuelDuration", 5)}{field("Flight Rules", "flightRules", 3)}{field("Acft Registration", "registration", 10)}
      <label className="col-span-2 grid grid-cols-[150px_1fr] gap-2"><span className="pt-1 text-right text-[13px]">Route</span><textarea disabled={readOnly} value={draft.route} onChange={(event) => patch("route", event.target.value)} className="h-[70px] border border-[#aaa] bg-[#ededed] p-2 text-[13px] disabled:bg-[#ddd]"/></label>
      <label className="col-span-2 grid grid-cols-[150px_1fr] gap-2"><span className="pt-1 text-right text-[13px]">Remarks</span><textarea disabled={readOnly} value={draft.remarks} onChange={(event) => patch("remarks", event.target.value)} className="h-[55px] border border-[#aaa] bg-[#ededed] p-2 text-[13px] disabled:bg-[#ddd]"/></label>
    </div>
    <div className="mt-2 flex justify-end gap-2">{!readOnly && <button onClick={onSave} className="border border-[#777] bg-[#e9e9e9] px-5 py-1 text-[13px] hover:bg-white">Save</button>}<button onClick={onClose} className="border border-[#777] bg-[#e9e9e9] px-5 py-1 text-[13px] hover:bg-white">Close</button></div>
  </div>, host);
}

function Icon({ children }: { children: React.ReactNode }) { return <svg viewBox="0 0 64 52" className="h-[44px] w-[54px]" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="square" strokeLinejoin="miter">{children}</svg>; }
function ProcedureIcon() { return <Icon><rect x="4" y="22" width="25" height="12"/><path d="M29 28h14"/><rect x="45" y="19" width="13" height="18"/><path d="M51 19v-8M43 10h16M55 24h3M55 28h3M55 32h3"/></Icon>; }
function DirectIcon() { return <Icon><path d="M8 9l7 12H1z" fill="currentColor" stroke="none"/><path d="M15 18l29 25"/><rect x="42" y="39" width="16" height="11"/></Icon>; }
function HeadingIcon() { return <Icon><rect x="8" y="27" width="22" height="21"/><path d="M19 38L49 8"/></Icon>; }
function SpeedIcon() { return <Icon><rect x="7" y="24" width="25" height="23"/><path d="M38 13h19M51 7l6 6-6 6M57 30H38M44 24l-6 6 6 6"/></Icon>; }
function AltitudeIcon() { return <Icon><rect x="7" y="24" width="25" height="23"/><path d="M50 8v34M44 14l6-6 6 6M44 36l6 6 6-6"/></Icon>; }
function CreateIcon() { return <Icon><rect x="8" y="25" width="25" height="22"/><path d="M47 7v18M38 16h18"/></Icon>; }
