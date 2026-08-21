"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { supabase } from "@/lib/supabase";
import type { ScopeFlightPlan } from "@/lib/scope/types";
import { MAP_BOUNDS } from "@/lib/scope/mapData";
import { getGameCallsignFromNotes } from "@/lib/flightPlanGameCallsign";
import {
  AIRLINE_CALLSIGNS,
  normalizeAirlineCallsign,
  spokenAirlineCallsign,
} from "@/lib/scope/airlines";
import {
  DEFAULT_TRAFFIC_SETTINGS,
  readTrafficSettings,
  TRAFFIC_SETTINGS_EVENT,
  type TrafficSettings,
} from "@/components/scope/ScopeTrafficSettings";

type Traffic = {
  id: string;
  rawCallsign: string;
  callsign: string;
  username: string;
  aircraftType: string;
  altitude: number;
  verticalRate: number;
  heading: number;
  groundSpeed: number;
  x: number;
  y: number;
};

type Point = { x: number; y: number };
type Viewport = { zoom: number; panX: number; panY: number };
type WireField = { field: number; wire: number; bytes?: Uint8Array; number?: number };
type PopupType = "altitude" | "speed" | "waypoint";
type PopupState = { id: string; type: PopupType } | null;
type CallsignMenuState = { id: string; expanded: boolean } | null;
type ControlState = {
  assignedAltitude: string;
  assignedHeading: number | null;
  assignedSpeed: number | null;
  freeText: string;
  waypoint: string | null;
};
type TrailPoint = Point & { time: number };
type LabelDrag = {
  id: string;
  dx: number;
  dy: number;
  startX: number;
  startY: number;
  moved: boolean;
};

type Props = {
  initialPlans: ScopeFlightPlan[];
  serverId: string;
};

const PROJECT_FLIGHT_WS_PREFIX = "wss://v3api.project-flight.com/v3/traffic/server/ws/";
const DEFAULT_SERVER_ID = "2ykygVZiX5";
const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";
const CONNECTION_EVENT = "pf24-scope-connection-change";
const CONTROLS_KEY = "pf24_scope_traffic_controls_v1";
const LABEL_OFFSETS_KEY = "pf24_scope_traffic_label_offsets_v1";
const TARGET_SIZE = 18;
const SIMPLE_WIDTH = 66;
const SIMPLE_HEIGHT = 30;
const DETAIL_WIDTH = 108;
const DETAIL_HEIGHT = 45;
const VECTOR_PIXELS_PER_NM = 28;
const GROUND_VECTOR_PIXELS = 10;
const GROUND_ALTITUDE_FT = 100;
const TRAIL_SAMPLE_MS = 1200;
const STALE_TRAFFIC_MS = 15000;
const STALE_SWEEP_MS = 3000;

const MIN_X = -180000;
const MAX_X = 180000;
const MIN_Z = -180000;
const MAX_Z = 180000;

// Project Flight traffic was originally calibrated against the PFTracker map
// before the render viewBox was extended south to y=0 for EFKT. Keep that
// calibration basis independent from the current render bounds.
const TRAFFIC_MAP_BOUNDS = { minX: 15, maxX: 210, minY: 37, maxY: 120 } as const;

const ALTITUDE_OPTIONS = Array.from({ length: 41 }, (_, index) => String(index * 5).padStart(3, "0"));
const SPEED_OPTIONS = Array.from({ length: 21 }, (_, index) => 50 + index * 10);
const AIRLINE_ICAO_CODES = Array.from(new Set(AIRLINE_CALLSIGNS.map((airline) => airline.icao)))
  .sort((a, b) => b.length - a.length);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isGroundTraffic(item: Pick<Traffic, "altitude">) {
  return item.altitude <= GROUND_ALTITUDE_FT;
}

function groundTrafficScale(zoom: number) {
  const safeZoom = Math.max(1, zoom);
  return clamp(0.72 / Math.pow(safeZoom, 0.16), 0.42, 0.72);
}

function findRadar() {
  return document.querySelector<HTMLElement>("main.fixed > section");
}

function findFooter() {
  return document.querySelector<HTMLElement>("main.fixed footer");
}

function scopeConnected() {
  const row = document.querySelector<HTMLElement>("main.fixed header > div:first-child");
  return Array.from(row?.querySelectorAll<HTMLButtonElement>(":scope > button") ?? []).some(
    (button) => button.textContent?.trim().toUpperCase() === "DISCONNECT",
  );
}

function toolbarButtons() {
  const row = document.querySelector<HTMLElement>("main.fixed header > div:first-child");
  return row ? Array.from(row.querySelectorAll<HTMLButtonElement>(":scope > button")) : [];
}

function readViewport(): Viewport {
  try {
    const parsed = JSON.parse(localStorage.getItem(VIEWPORT_KEY) ?? "{}") as Partial<Viewport>;
    return {
      zoom: typeof parsed.zoom === "number" ? parsed.zoom : 1,
      panX: typeof parsed.panX === "number" ? parsed.panX : 0,
      panY: typeof parsed.panY === "number" ? parsed.panY : 0,
    };
  } catch {
    return { zoom: 1, panX: 0, panY: 0 };
  }
}

function readControls(): Record<string, ControlState> {
  try {
    return JSON.parse(localStorage.getItem(CONTROLS_KEY) ?? "{}") as Record<string, ControlState>;
  } catch {
    return {};
  }
}

function readLabelOffsets(): Record<string, Point> {
  try {
    return JSON.parse(localStorage.getItem(LABEL_OFFSETS_KEY) ?? "{}") as Record<string, Point>;
  } catch {
    return {};
  }
}

function defaultControl(): ControlState {
  return {
    assignedAltitude: "000",
    assignedHeading: null,
    assignedSpeed: null,
    freeText: "",
    waypoint: null,
  };
}

function radarCoordinates(worldX: number, worldZ: number): Point {
  const normalizedX = clamp((worldX - MIN_X) / (MAX_X - MIN_X), 0, 1);
  const normalizedY = clamp((worldZ - MIN_Z) / (MAX_Z - MIN_Z), 0, 1);
  return {
    x: TRAFFIC_MAP_BOUNDS.minX + normalizedX * (TRAFFIC_MAP_BOUNDS.maxX - TRAFFIC_MAP_BOUNDS.minX),
    y: TRAFFIC_MAP_BOUNDS.minY + normalizedY * (TRAFFIC_MAP_BOUNDS.maxY - TRAFFIC_MAP_BOUNDS.minY),
  };
}

// ScopeRadarMap uses the CURRENT expanded SVG viewBox. Traffic coordinates are
// calibrated above, then projected through these render bounds so EFKT remains visible.
function screenPoint(size: Point, x: number, y: number, viewport: Viewport): Point {
  const mapWidth = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
  const mapHeight = MAP_BOUNDS.maxY - MAP_BOUNDS.minY;
  const fitScale = Math.min(size.x / mapWidth, size.y / mapHeight);
  const renderedWidth = mapWidth * fitScale;
  const renderedHeight = mapHeight * fitScale;
  const offsetX = (size.x - renderedWidth) / 2;
  const offsetY = (size.y - renderedHeight) / 2;
  const baseX = offsetX + (x - MAP_BOUNDS.minX) * fitScale;
  const baseY = offsetY + (y - MAP_BOUNDS.minY) * fitScale;

  return {
    x: baseX * viewport.zoom + viewport.panX,
    y: baseY * viewport.zoom + viewport.panY,
  };
}

function headingUnit(heading: number): Point {
  const radians = heading * Math.PI / 180;
  return { x: Math.sin(radians), y: -Math.cos(radians) };
}

function flightLevel(altitude: number) {
  return String(Math.max(0, Math.round(altitude / 100))).padStart(3, "0");
}

function trend(verticalRate: number) {
  if (verticalRate > 150) return "↑";
  if (verticalRate < -150) return "↓";
  return "";
}

function normalizeCallsign(raw: string) {
  return normalizeAirlineCallsign(raw);
}

function spokenCallsign(displayCallsign: string, rawCallsign?: string) {
  const compact = displayCallsign.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const prefix = AIRLINE_ICAO_CODES.find((icao) => compact.startsWith(icao) && compact.length > icao.length);
  if (!prefix) return displayCallsign.toUpperCase();
  return spokenAirlineCallsign(compact, rawCallsign);
}

function aircraftCode(raw: string) {
  const upper = raw.trim().toUpperCase();
  if (/^[A-Z0-9]{3,4}$/.test(upper)) return upper;
  if (/A320/.test(upper)) return "A320";
  if (/A321/.test(upper)) return "A321";
  if (/A319/.test(upper)) return "A319";
  if (/A330/.test(upper)) return "A330";
  if (/A340/.test(upper)) return "A340";
  if (/A350/.test(upper)) return "A350";
  if (/A220/.test(upper)) return "A220";
  if (/737[- ]?800|B738/.test(upper)) return "B738";
  if (/737[- ]?900|B739/.test(upper)) return "B739";
  if (/737/.test(upper)) return "B737";
  if (/747[- ]?400|B744/.test(upper)) return "B744";
  if (/747/.test(upper)) return "B747";
  if (/757/.test(upper)) return "B757";
  if (/767/.test(upper)) return "B767";
  if (/777/.test(upper)) return "B777";
  if (/787/.test(upper)) return "B787";
  if (/DASH.?8|DH8D/.test(upper)) return "DH8D";
  return upper.replace(/[^A-Z0-9]/g, "").slice(0, 4) || "----";
}

function planKey(callsign: string) {
  return normalizeCallsign(callsign);
}

function gamePlanKey(plan: ScopeFlightPlan) {
  return planKey(getGameCallsignFromNotes(plan.notes) || plan.callsign);
}

function routeWaypoints(plan: ScopeFlightPlan | undefined) {
  if (!plan?.route) return [];
  return Array.from(
    new Set(
      plan.route
        .toUpperCase()
        .split(/\s+/)
        .map((item) => item.replace(/[^A-Z0-9]/g, ""))
        .filter((item) => item && item !== "DCT" && /^[A-Z0-9]{2,7}$/.test(item)),
    ),
  );
}

function cruiseLevel(plan: ScopeFlightPlan | undefined) {
  const digits = String(plan?.flight_level ?? "").replace(/\D/g, "");
  return digits ? digits.slice(-3).padStart(3, "0") : "999";
}

function readVarint(bytes: Uint8Array, start: number) {
  let value = 0;
  let multiplier = 1;
  let offset = start;
  for (let count = 0; count < 10 && offset < bytes.length; count += 1) {
    const byte = bytes[offset++];
    value += (byte & 0x7f) * multiplier;
    if ((byte & 0x80) === 0) return { value, offset };
    multiplier *= 128;
  }
  throw new Error("Invalid protobuf varint");
}

function parseFields(bytes: Uint8Array): WireField[] {
  const fields: WireField[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const tag = readVarint(bytes, offset);
    offset = tag.offset;
    const field = Math.floor(tag.value / 8);
    const wire = tag.value % 8;
    if (field <= 0) break;

    if (wire === 0) {
      const value = readVarint(bytes, offset);
      offset = value.offset;
      fields.push({ field, wire, number: value.value });
      continue;
    }
    if (wire === 1) {
      if (offset + 8 > bytes.length) break;
      fields.push({ field, wire, bytes: bytes.slice(offset, offset + 8) });
      offset += 8;
      continue;
    }
    if (wire === 2) {
      const length = readVarint(bytes, offset);
      offset = length.offset;
      const size = Math.floor(length.value);
      if (size < 0 || offset + size > bytes.length) break;
      fields.push({ field, wire, bytes: bytes.slice(offset, offset + size) });
      offset += size;
      continue;
    }
    if (wire === 5) {
      if (offset + 4 > bytes.length) break;
      fields.push({ field, wire, bytes: bytes.slice(offset, offset + 4) });
      offset += 4;
      continue;
    }
    break;
  }
  return fields;
}

function textOf(field?: WireField) {
  if (!field?.bytes) return "";
  try {
    return new TextDecoder().decode(field.bytes).replace(/\0/g, "").trim();
  } catch {
    return "";
  }
}

function doubleOf(field?: WireField) {
  if (!field?.bytes || field.bytes.byteLength !== 8) return Number.NaN;
  const copy = new Uint8Array(field.bytes);
  return new DataView(copy.buffer).getFloat64(0, true);
}

function stringField(fields: WireField[], number: number) {
  return textOf(fields.find((field) => field.field === number && field.wire === 2));
}

function doubleField(fields: WireField[], number: number) {
  return doubleOf(fields.find((field) => field.field === number && field.wire === 1));
}

function isTrafficRecord(bytes: Uint8Array) {
  try {
    const fields = parseFields(bytes);
    const callsign = stringField(fields, 2);
    const worldX = doubleField(fields, 4);
    const worldZ = doubleField(fields, 5);
    return Boolean(callsign && Number.isFinite(worldX) && Number.isFinite(worldZ));
  } catch {
    return false;
  }
}

function recordsFromMessage(bytes: Uint8Array) {
  if (isTrafficRecord(bytes)) return [bytes];
  try {
    return parseFields(bytes)
      .filter((field) => field.wire === 2 && field.bytes && isTrafficRecord(field.bytes))
      .map((field) => field.bytes as Uint8Array);
  } catch {
    return [];
  }
}

function decodeBinary(bytes: Uint8Array): Omit<Traffic, "verticalRate">[] {
  return recordsFromMessage(bytes).flatMap((record) => {
    const fields = parseFields(record);
    const rawCallsign = stringField(fields, 2);
    const username = stringField(fields, 3);
    const worldX = doubleField(fields, 4);
    const worldZ = doubleField(fields, 5);
    const heading = doubleField(fields, 6);
    const altitude = doubleField(fields, 7);
    const speed = doubleField(fields, 8);
    const type = stringField(fields, 9);

    if (!rawCallsign || !Number.isFinite(worldX) || !Number.isFinite(worldZ)) return [];
    const point = radarCoordinates(worldX, worldZ);
    const callsign = normalizeCallsign(rawCallsign);
    return [{
      id: username || callsign,
      rawCallsign,
      callsign,
      username,
      aircraftType: aircraftCode(type),
      altitude: Number.isFinite(altitude) ? Math.max(0, altitude) : 0,
      heading: Number.isFinite(heading) ? ((heading % 360) + 360) % 360 : 0,
      groundSpeed: Number.isFinite(speed) ? Math.max(0, speed) : 0,
      x: point.x,
      y: point.y,
    }];
  });
}

function numberFrom(value: unknown, fallback = Number.NaN) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function decodeJson(value: unknown): Omit<Traffic, "verticalRate">[] {
  if (!value || typeof value !== "object") return [];
  const root = value as Record<string, unknown>;
  const rows: unknown[] = Array.isArray(value)
    ? value
    : Array.isArray(root.traffic)
      ? root.traffic
      : Array.isArray(root.aircraft)
        ? root.aircraft
        : [value];

  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const rawCallsign = String(item.callsign ?? item.callSign ?? "").trim();
    const username = String(item.username ?? item.user ?? item.player ?? "").trim();
    const worldX = numberFrom(item.x ?? item.worldX ?? item.positionX);
    const worldZ = numberFrom(item.z ?? item.worldZ ?? item.positionZ ?? item.y);
    if (!rawCallsign || !Number.isFinite(worldX) || !Number.isFinite(worldZ)) return [];

    const point = radarCoordinates(worldX, worldZ);
    const callsign = normalizeCallsign(rawCallsign);
    return [{
      id: String(item.id ?? username ?? callsign),
      rawCallsign,
      callsign,
      username,
      aircraftType: aircraftCode(String(item.aircraftType ?? item.aircraft ?? item.type ?? "")),
      altitude: Math.max(0, numberFrom(item.altitude ?? item.alt, 0)),
      heading: ((numberFrom(item.heading ?? item.hdg, 0) % 360) + 360) % 360,
      groundSpeed: Math.max(0, numberFrom(item.speed ?? item.groundSpeed ?? item.gs, 0)),
      x: point.x,
      y: point.y,
    }];
  });
}

async function decodeMessage(data: unknown) {
  if (typeof data === "string") {
    try {
      return decodeJson(JSON.parse(data));
    } catch {
      return [];
    }
  }
  if (data instanceof ArrayBuffer) return decodeBinary(new Uint8Array(data));
  if (data instanceof Blob) return decodeBinary(new Uint8Array(await data.arrayBuffer()));
  return [];
}

function connectorEnd(marker: Point, label: Point, width: number, height: number) {
  const center = { x: label.x + width / 2, y: label.y + height / 2 };
  const dx = center.x - marker.x;
  const dy = center.y - marker.y;
  if (dx === 0 && dy === 0) return center;
  const sx = dx === 0 ? Number.POSITIVE_INFINITY : (width / 2) / Math.abs(dx);
  const sy = dy === 0 ? Number.POSITIVE_INFINITY : (height / 2) / Math.abs(dy);
  const scale = Math.min(sx, sy);
  return { x: center.x - dx * scale, y: center.y - dy * scale };
}

function DragEdges({ onMouseDown }: { onMouseDown: (event: ReactMouseEvent<HTMLElement>) => void }) {
  const base = "pointer-events-auto absolute z-[4] block bg-transparent";
  return <>
    <span data-pf24-traffic-drag-edge="top" onMouseDown={onMouseDown} className={`${base} -left-[4px] -top-[5px] h-[6px] w-[calc(100%+8px)] cursor-move`} />
    <span data-pf24-traffic-drag-edge="right" onMouseDown={onMouseDown} className={`${base} -right-[5px] -top-[2px] h-[calc(100%+4px)] w-[6px] cursor-move`} />
    <span data-pf24-traffic-drag-edge="bottom" onMouseDown={onMouseDown} className={`${base} -bottom-[5px] -left-[4px] h-[6px] w-[calc(100%+8px)] cursor-move`} />
    <span data-pf24-traffic-drag-edge="left" onMouseDown={onMouseDown} className={`${base} -left-[5px] -top-[2px] h-[calc(100%+4px)] w-[6px] cursor-move`} />
  </>;
}

export default function ProjectFlightTrafficV6({ initialPlans, serverId }: Props) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [footer, setFooter] = useState<HTMLElement | null>(null);
  const [hostSize, setHostSize] = useState<Point>({ x: 1, y: 1 });
  const [traffic, setTraffic] = useState<Traffic[]>([]);
  const [plans, setPlans] = useState(initialPlans);
  const [connected, setConnected] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 });
  const [showHeading, setShowHeading] = useState(false);
  const [showTrail, setShowTrail] = useState(false);
  const [settings, setSettings] = useState<TrafficSettings>(DEFAULT_TRAFFIC_SETTINGS);
  const [controls, setControls] = useState<Record<string, ControlState>>({});
  const [labelOffsets, setLabelOffsets] = useState<Record<string, Point>>({});
  const [popup, setPopup] = useState<PopupState>(null);
  const [callsignMenu, setCallsignMenu] = useState<CallsignMenuState>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const liveRef = useRef<Map<string, { traffic: Traffic; lastSeen: number }>>(new Map());
  const previousAltitudeRef = useRef<Map<string, { altitude: number; time: number }>>(new Map());
  const trailsRef = useRef<Map<string, TrailPoint[]>>(new Map());
  const lastTrailSampleRef = useRef<Map<string, number>>(new Map());
  const dragLabelRef = useRef<LabelDrag | null>(null);
  const suppressLabelClickRef = useRef<string | null>(null);
  const headingDragRef = useRef<{ id: string } | null>(null);
  const lastPointerRef = useRef({ x: 0, y: 0 });

  const wsUrl = useMemo(() => {
    const id = serverId.trim() || DEFAULT_SERVER_ID;
    return `${PROJECT_FLIGHT_WS_PREFIX}${id}`;
  }, [serverId]);

  const selected = useMemo(
    () => traffic.find((item) => item.id === selectedId) ?? null,
    [traffic, selectedId],
  );

  const planMap = useMemo(() => {
    const map = new Map<string, ScopeFlightPlan>();
    for (const plan of plans) {
      const key = gamePlanKey(plan);
      if (key && !map.has(key)) map.set(key, plan);
    }
    return map;
  }, [plans]);

  const updateControl = (id: string, patch: Partial<ControlState>) => {
    setControls((current) => {
      const next = { ...current, [id]: { ...(current[id] ?? defaultControl()), ...patch } };
      localStorage.setItem(CONTROLS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const updateLabelOffset = (id: string, point: Point) => {
    setLabelOffsets((current) => {
      const next = { ...current, [id]: point };
      localStorage.setItem(LABEL_OFFSETS_KEY, JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    setViewport(readViewport());
    setSettings(readTrafficSettings());
    setControls(readControls());
    setLabelOffsets(readLabelOffsets());

    const onViewport = (event: Event) => {
      const next = (event as CustomEvent<Viewport>).detail;
      if (next) setViewport(next);
    };
    const onSettings = (event: Event) => {
      const next = (event as CustomEvent<TrafficSettings>).detail;
      if (next) setSettings(next);
    };

    window.addEventListener(VIEWPORT_EVENT, onViewport);
    window.addEventListener(TRAFFIC_SETTINGS_EVENT, onSettings);
    return () => {
      window.removeEventListener(VIEWPORT_EVENT, onViewport);
      window.removeEventListener(TRAFFIC_SETTINGS_EVENT, onSettings);
    };
  }, []);

  useEffect(() => {
    let attempts = 0;
    const locate = () => {
      const radar = findRadar();
      const nextFooter = findFooter();
      if (radar) {
        setHost(radar);
        setHostSize({ x: Math.max(1, radar.clientWidth), y: Math.max(1, radar.clientHeight) });
      }
      if (nextFooter) setFooter(nextFooter);
      attempts += 1;
      if (radar && nextFooter || attempts >= 20) window.clearInterval(timer);
    };
    const timer = window.setInterval(locate, 200);
    locate();
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!host) return;
    const resize = () => setHostSize({ x: Math.max(1, host.clientWidth), y: Math.max(1, host.clientHeight) });
    resize();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(host);
    window.addEventListener("resize", resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [host]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("flight_plans").select("*").neq("status", "FINISHED");
      if (data) setPlans(data as ScopeFlightPlan[]);
    };
    const channel = supabase
      .channel("scope-live-traffic-flight-plans-v6")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flight_plans" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    setConnected(scopeConnected());
    const onConnection = (event: Event) => {
      setConnected(Boolean((event as CustomEvent<{ connected?: boolean }>).detail?.connected));
    };
    window.addEventListener(CONNECTION_EVENT, onConnection);
    const retry = window.setTimeout(() => setConnected(scopeConnected()), 400);
    return () => {
      window.clearTimeout(retry);
      window.removeEventListener(CONNECTION_EVENT, onConnection);
    };
  }, []);

  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24LiveProjectFlightTraffic = "v6";
    style.textContent = `
      main.fixed > section > button.absolute.z-10 { display:none!important; }
      main.fixed > section > div.absolute.right-\\[11px\\].top-\\[272px\\] { display:none!important; }
      [data-pf24-live-traffic='true'] { transform:none!important; transform-origin:initial!important; }
      [data-pf24-traffic-popup='true'] { scrollbar-width:none; -ms-overflow-style:none; }
      [data-pf24-traffic-popup='true']::-webkit-scrollbar { display:none; width:0; height:0; }
      .notranslate { translate:no; }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    let disposed = false;

    const publishTraffic = () => {
      const now = performance.now();
      for (const [id, value] of liveRef.current) {
        if (now - value.lastSeen <= STALE_TRAFFIC_MS) continue;
        liveRef.current.delete(id);
        trailsRef.current.delete(id);
        previousAltitudeRef.current.delete(id);
        lastTrailSampleRef.current.delete(id);
      }
      const next = Array.from(liveRef.current.values())
        .map((value) => value.traffic)
        .sort((a, b) => a.callsign.localeCompare(b.callsign));
      setTraffic(next);
      const ids = new Set(next.map((item) => item.id));
      setSelectedId((current) => current && ids.has(current) ? current : null);
      setCallsignMenu((current) => current && ids.has(current.id) ? current : null);
    };

    const stop = () => {
      if (reconnectRef.current !== null) window.clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
      const current = socketRef.current;
      socketRef.current = null;
      if (current && (current.readyState === WebSocket.CONNECTING || current.readyState === WebSocket.OPEN)) {
        current.close();
      }
    };

    const open = () => {
      if (disposed || !connected || socketRef.current) return;
      const socket = new WebSocket(wsUrl);
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;

      socket.onmessage = (event) => {
        void decodeMessage(event.data).then((decoded) => {
          if (disposed || decoded.length === 0) return;
          const now = performance.now();

          for (const item of decoded) {
            const oldLive = liveRef.current.get(item.id)?.traffic;
            const previousAltitude = previousAltitudeRef.current.get(item.id);
            let verticalRate = 0;

            if (previousAltitude && now > previousAltitude.time) {
              const minutes = (now - previousAltitude.time) / 60000;
              verticalRate = minutes > 0 ? (item.altitude - previousAltitude.altitude) / minutes : 0;
              if (!Number.isFinite(verticalRate) || Math.abs(verticalRate) > 15000) verticalRate = 0;
            }
            previousAltitudeRef.current.set(item.id, { altitude: item.altitude, time: now });

            if (oldLive) {
              const lastSample = lastTrailSampleRef.current.get(item.id) ?? 0;
              const history = trailsRef.current.get(item.id) ?? [];

              // Trail dots are radar-style time samples. They advance on a fixed
              // clock cadence regardless of how far (or whether) the aircraft moved.
              if (now - lastSample >= TRAIL_SAMPLE_MS) {
                trailsRef.current.set(
                  item.id,
                  [...history, { x: oldLive.x, y: oldLive.y, time: now }].slice(-5),
                );
                lastTrailSampleRef.current.set(item.id, now);
              }
            }

            liveRef.current.set(item.id, {
              traffic: { ...item, verticalRate },
              lastSeen: now,
            });
          }
          publishTraffic();
        });
      };

      socket.onerror = () => {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
      };

      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null;
        if (disposed || !connected) return;
        reconnectRef.current = window.setTimeout(() => {
          reconnectRef.current = null;
          open();
        }, 2000);
      };
    };

    const sweep = window.setInterval(publishTraffic, STALE_SWEEP_MS);
    if (connected) open();
    else {
      stop();
      setTraffic([]);
      setSelectedId(null);
      setCallsignMenu(null);
      liveRef.current.clear();
      trailsRef.current.clear();
      previousAltitudeRef.current.clear();
      lastTrailSampleRef.current.clear();
    }

    return () => {
      disposed = true;
      window.clearInterval(sweep);
      stop();
    };
  }, [connected, wsUrl]);

  useEffect(() => {
    const onToolbar = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      if (!(button instanceof HTMLButtonElement)) return;
      const buttons = toolbarButtons();
      const index = buttons.indexOf(button);
      const label = button.textContent?.trim().toUpperCase() ?? "";
      if (index === 5 || label.includes("VECTOR") || label.includes("HDG")) {
        setShowHeading((value) => !value);
      }
      if (index === 6 || label.includes("TRAIL") || label.includes("TRACE") || label.includes("HISTORY")) {
        setShowTrail((value) => !value);
      }
    };
    document.addEventListener("click", onToolbar, true);
    return () => document.removeEventListener("click", onToolbar, true);
  }, []);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      if (!host) return;
      const rect = host.getBoundingClientRect();

      if (dragLabelRef.current) {
        const drag = dragLabelRef.current;
        const aircraft = liveRef.current.get(drag.id)?.traffic;
        if (aircraft) {
          if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) drag.moved = true;
          const marker = screenPoint(hostSize, aircraft.x, aircraft.y, viewport);
          updateLabelOffset(drag.id, {
            x: event.clientX - rect.left - marker.x - drag.dx,
            y: event.clientY - rect.top - marker.y - drag.dy,
          });
        }
      }

      if (headingDragRef.current) {
        const id = headingDragRef.current.id;
        const aircraft = liveRef.current.get(id)?.traffic;
        if (aircraft) {
          const marker = screenPoint(hostSize, aircraft.x, aircraft.y, viewport);
          const dx = event.clientX - rect.left - marker.x;
          const dy = event.clientY - rect.top - marker.y;
          if (Math.hypot(dx, dy) >= 3) {
            const heading = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
            updateControl(id, { assignedHeading: Math.round(heading / 5) * 5 % 360 });
          }
        }
      }
    };

    const onUp = () => {
      const drag = dragLabelRef.current;
      const heading = headingDragRef.current;
      if (drag?.moved) {
        suppressLabelClickRef.current = drag.id;
        window.setTimeout(() => {
          if (suppressLabelClickRef.current === drag.id) suppressLabelClickRef.current = null;
        }, 50);
      }
      dragLabelRef.current = null;
      headingDragRef.current = null;

      if (heading) {
        window.setTimeout(() => {
          const pointer = lastPointerRef.current;
          const element = document.elementFromPoint(pointer.x, pointer.y);
          const label = element?.closest(`[data-pf24-traffic-id="${CSS.escape(heading.id)}"]`);
          if (!label) {
            setSelectedId((current) => current === heading.id ? null : current);
            setPopup((current) => current?.id === heading.id ? null : current);
          }
        }, 30);
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [host, hostSize, viewport]);

  useEffect(() => {
    const deselect = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest("[data-pf24-traffic-select='true']") ||
        target?.closest("[data-pf24-traffic-label='true']") ||
        target?.closest("[data-pf24-traffic-popup='true']") ||
        target?.closest("[data-pf24-callsign-menu='true']")
      ) return;
      setSelectedId(null);
      setPopup(null);
      setCallsignMenu(null);
    };
    document.addEventListener("click", deselect, true);
    return () => document.removeEventListener("click", deselect, true);
  }, []);

  if (!host || !connected) return null;

  const radarLayer = createPortal(
    <div data-pf24-live-traffic="true" className="pointer-events-none absolute inset-0 z-[8] overflow-hidden">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${hostSize.x} ${hostSize.y}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {traffic.map((item) => {
          const marker = screenPoint(hostSize, item.x, item.y, viewport);
          const unit = headingUnit(item.heading);
          const ground = isGroundTraffic(item);
          const groundScale = groundTrafficScale(viewport.zoom);
          const active = item.id === selectedId;
          const labelScale = ground && !active ? groundScale : 1;
          const offset = labelOffsets[item.id] ?? { x: 16, y: 14 };
          const label = { x: marker.x + offset.x, y: marker.y + offset.y };
          const width = (active ? DETAIL_WIDTH : SIMPLE_WIDTH) * labelScale;
          const height = (active ? DETAIL_HEIGHT : SIMPLE_HEIGHT) * labelScale;
          const end = connectorEnd(marker, label, width, height);
          const vectorLength = ground
            ? GROUND_VECTOR_PIXELS
            : VECTOR_PIXELS_PER_NM * settings.vectorMiles * viewport.zoom;
          const history = (trailsRef.current.get(item.id) ?? []).slice(-settings.trailCount);

          return <g key={item.id}>
            {showTrail && history.map((trailPoint, index) => {
              const point = screenPoint(hostSize, trailPoint.x, trailPoint.y, viewport);
              const opacity = settings.trailFade
                ? 0.38 + ((index + 1) / Math.max(1, history.length)) * 0.62
                : 1;
              return <circle
                key={`${item.id}-trail-${trailPoint.time}`}
                cx={point.x}
                cy={point.y}
                r={ground ? 3 * groundScale : 3}
                fill="#00ff00"
                opacity={opacity}
              />;
            })}
            {showHeading && <line
              x1={marker.x}
              y1={marker.y}
              x2={marker.x + unit.x * vectorLength}
              y2={marker.y + unit.y * vectorLength}
              stroke="#00e000"
              strokeWidth={ground ? "1" : "1.5"}
              vectorEffect="non-scaling-stroke"
            />}
            <line
              x1={marker.x}
              y1={marker.y}
              x2={end.x}
              y2={end.y}
              stroke="#00e000"
              strokeWidth={ground ? "0.8" : "1.2"}
              vectorEffect="non-scaling-stroke"
            />
          </g>;
        })}
      </svg>

      {traffic.map((item) => {
        const active = item.id === selectedId;
        const ground = isGroundTraffic(item);
        const groundScale = groundTrafficScale(viewport.zoom);
        const labelScale = ground && !active ? groundScale : 1;
        const marker = screenPoint(hostSize, item.x, item.y, viewport);
        const offset = labelOffsets[item.id] ?? { x: 16, y: 14 };
        const labelPoint = { x: marker.x + offset.x, y: marker.y + offset.y };
        const control = controls[item.id] ?? defaultControl();
        const plan = planMap.get(item.callsign);
        const displayCallsign = plan?.callsign?.toUpperCase() || item.callsign;
        const waypoints = routeWaypoints(plan);
        const currentWaypoint = control.waypoint ?? waypoints[0] ?? "XXXXX";
        const destination = plan?.arrival_icao?.toUpperCase() || "XXXX";
        const cruise = cruiseLevel(plan);
        const speedText = control.assignedSpeed === null ? "ASP" : String(control.assignedSpeed).padStart(3, "0");
        const headingText = control.assignedHeading === null
          ? "AHDG"
          : `AHDG${String(control.assignedHeading).padStart(3, "0")}`;
        const menuOpen = callsignMenu?.id === item.id;
        const menuExpanded = menuOpen ? Boolean(callsignMenu?.expanded) : false;

        const startLabelDrag = (event: ReactMouseEvent<HTMLElement>) => {
          if (event.button !== 0) return;
          const target = event.target instanceof Element ? event.target : null;
          if (target?.closest("button,input,[data-pf24-callsign-menu='true'],[data-pf24-traffic-popup='true']")) return;
          event.preventDefault();
          event.stopPropagation();
          dragLabelRef.current = {
            id: item.id,
            dx: event.clientX - (host.getBoundingClientRect().left + labelPoint.x),
            dy: event.clientY - (host.getBoundingClientRect().top + labelPoint.y),
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
          };
        };

        const activateLabel = (event: ReactMouseEvent<HTMLElement>) => {
          event.stopPropagation();
          if (suppressLabelClickRef.current === item.id) {
            suppressLabelClickRef.current = null;
            return;
          }
          setSelectedId(item.id);
          setPopup(null);
        };

        const openCallsignMenu = (event: ReactMouseEvent<HTMLElement>) => {
          event.preventDefault();
          event.stopPropagation();
          setCallsignMenu({ id: item.id, expanded: false });
        };

        const callsignMenuNode = menuOpen ? <div
          data-pf24-callsign-menu="true"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onMouseLeave={() => setCallsignMenu(null)}
          className="pointer-events-auto absolute left-0 top-[10px] z-[50] w-[118px] border border-[#f2f2f2] bg-[#555c60] font-mono text-[10px] leading-[18px] text-[#ededed] shadow-[0_2px_8px_rgba(0,0,0,.45)]"
        >
          <div className="border-b border-[#f2f2f2] px-2 text-center text-[11px] leading-[20px] text-[#22e000]">
            {displayCallsign}
          </div>
          {["Callsign", "Assume", "FPL"].map((label) => <button
            key={label}
            type="button"
            onClick={(event) => event.stopPropagation()}
            className="block w-full border-b border-[#f2f2f2] px-2 text-center hover:bg-[#626a6f]"
          >{label}</button>)}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setCallsignMenu({ id: item.id, expanded: !menuExpanded });
            }}
            className="flex w-full items-center justify-center gap-2 border-b border-[#f2f2f2] px-2 hover:bg-[#626a6f]"
          >
            <span className={`inline-block text-[9px] transition-transform ${menuExpanded ? "rotate-180" : ""}`}>▽</span>
            <span>More</span>
          </button>
          {menuExpanded && <>
            {["MAPP", "HOLD", "FREE", "Contact Me"].map((label, index, all) => <button
              key={label}
              type="button"
              onClick={(event) => event.stopPropagation()}
              className={`block w-full px-2 text-center hover:bg-[#626a6f] ${index < all.length - 1 ? "border-b border-[#f2f2f2]" : ""}`}
            >{label}</button>)}
          </>}
        </div> : null;

        const closeDetailedOnLeave = () => {
          if (headingDragRef.current?.id === item.id || dragLabelRef.current?.id === item.id) return;
          setSelectedId((current) => current === item.id ? null : current);
          setPopup((current) => current?.id === item.id ? null : current);
          setCallsignMenu((current) => current?.id === item.id ? null : current);
        };

        return <div key={item.id}>
          <button
            type="button"
            data-pf24-traffic-select="true"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedId(item.id);
              setPopup(null);
            }}
            className="pointer-events-auto absolute z-[10] -translate-x-1/2 -translate-y-1/2"
            style={{
              left: marker.x,
              top: marker.y,
              width: ground ? TARGET_SIZE * groundScale : TARGET_SIZE,
              height: ground ? TARGET_SIZE * groundScale : TARGET_SIZE,
            }}
            aria-label={`Seleccionar ${displayCallsign}`}
          >
            <span className={`absolute inset-0 rotate-45 border ${active ? "border-[#00ff00]" : "border-[#00d800]"}`} />
          </button>

          {!active && <div
            data-pf24-traffic-label="true"
            data-pf24-traffic-id={item.id}
            onMouseDown={startLabelDrag}
            onClick={activateLabel}
            className="pointer-events-auto absolute z-[9] w-[66px] cursor-move whitespace-nowrap text-left font-mono text-[9px] leading-[8px] text-[#00e000]"
            style={{
              left: labelPoint.x,
              top: labelPoint.y,
              transform: `scale(${labelScale})`,
              transformOrigin: "0 0",
            }}
          >
            <DragEdges onMouseDown={startLabelDrag} />
            <span className="block h-[7px] text-[8px] leading-[7px]">I</span>
            <div className="relative h-[9px] w-[62px]">
              <button
                type="button"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={openCallsignMenu}
                className="block h-[9px] w-[62px] overflow-hidden text-ellipsis whitespace-nowrap border-0 bg-transparent p-0 text-left text-[9px] leading-[9px] text-[#00e000] outline-none"
              >{displayCallsign}</button>
              {callsignMenuNode}
            </div>
            <span className="grid w-[58px] grid-cols-[30px_28px] text-[9px] leading-[8px]">
              <span>{flightLevel(item.altitude)}{trend(item.verticalRate)}</span>
              <span>{String(Math.round(item.groundSpeed)).padStart(3, "0")}</span>
            </span>
            <span className="block w-[58px] pl-[30px] text-[9px] leading-[7px]">{destination}</span>
          </div>}

          {active && <div
            data-pf24-traffic-label="true"
            data-pf24-traffic-id={item.id}
            onMouseDown={startLabelDrag}
            onMouseLeave={closeDetailedOnLeave}
            className="pointer-events-auto absolute z-[12] w-[108px] cursor-move select-none font-mono text-[9px] leading-[9px] text-[#00e000]"
            style={{ left: labelPoint.x, top: labelPoint.y }}
          >
            <DragEdges onMouseDown={startLabelDrag} />
            <div className="h-[8px] text-[#ffff00] leading-[8px]">A9999</div>
            <div className="grid w-[102px] min-w-0 grid-cols-[56px_8px_38px] gap-0 leading-[9px]">
              <div className="relative min-w-0">
                <button
                  type="button"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={openCallsignMenu}
                  className="block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap border-0 bg-transparent p-0 text-left text-[9px] leading-[9px] text-[#00e000] outline-none"
                >{displayCallsign}</button>
                {callsignMenuNode}
              </div>
              <span>--</span>
              <span className="min-w-0 overflow-hidden">{item.aircraftType}</span>
            </div>
            <div className="grid w-[106px] grid-cols-[29px_43px_34px] gap-0 leading-[9px]">
              <span>{flightLevel(item.altitude)}{trend(item.verticalRate)}</span>
              <button
                type="button"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  if (waypoints.length) setPopup({ id: item.id, type: "waypoint" });
                }}
                className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap border-0 bg-transparent p-0 text-left text-[9px] leading-[9px] text-[#00e000] outline-none"
              >{currentWaypoint}</button>
              <span>N{Math.round(item.groundSpeed)}</span>
            </div>
            <div className="grid w-[102px] grid-cols-[29px_29px_44px] gap-0 leading-[9px]">
              <button
                type="button"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setPopup({ id: item.id, type: "altitude" });
                }}
                className="border-0 bg-transparent p-0 text-left text-[9px] leading-[9px] text-[#00e000] outline-none"
              >{control.assignedAltitude}</button>
              <span>{cruise}</span>
              <span>{destination}</span>
            </div>
            <div className="grid w-[108px] grid-cols-[43px_29px_36px] gap-0 leading-[9px]">
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  headingDragRef.current = { id: item.id };
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  updateControl(item.id, { assignedHeading: null });
                }}
                className="border-0 bg-transparent p-0 text-left text-[9px] leading-[9px] text-[#00e000] outline-none"
              >{headingText}</button>
              <button
                type="button"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setPopup({ id: item.id, type: "speed" });
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  updateControl(item.id, { assignedSpeed: null });
                  setPopup(null);
                }}
                className="border-0 bg-transparent p-0 text-left text-[9px] leading-[9px] text-[#00e000] outline-none"
              >{speedText}</button>
              <input
                value={control.freeText}
                maxLength={20}
                placeholder="TXT"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  updateControl(item.id, { freeText: "" });
                }}
                onChange={(event) => updateControl(item.id, {
                  freeText: event.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9 .\-_/]/g, "")
                    .slice(0, 20),
                })}
                className="min-w-0 border-0 bg-transparent p-0 text-[9px] leading-[9px] uppercase text-[#00e000] outline-none placeholder:text-[#00e000]"
              />
            </div>

            {popup?.id === item.id && <div
              data-pf24-traffic-popup="true"
              className="absolute left-0 top-[44px] z-[30] max-h-[154px] min-w-[72px] overflow-y-auto border border-[#0b392f] bg-[#064a40] text-[9px] text-[#e6e6e6] shadow-lg"
            >
              {popup.type === "altitude" && ALTITUDE_OPTIONS.map((value) => <button
                key={value}
                type="button"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  updateControl(item.id, { assignedAltitude: value });
                  setPopup(null);
                }}
                className="block w-full px-2 py-1 text-left hover:bg-[#0a5b50]"
              >{value}</button>)}
              {popup.type === "speed" && SPEED_OPTIONS.map((value) => <button
                key={value}
                type="button"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  updateControl(item.id, { assignedSpeed: value });
                  setPopup(null);
                }}
                className="block w-full px-2 py-1 text-left hover:bg-[#0a5b50]"
              >{value} KT</button>)}
              {popup.type === "waypoint" && waypoints.map((value) => <button
                key={value}
                type="button"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  updateControl(item.id, { waypoint: value });
                  setPopup(null);
                }}
                className="block w-full px-2 py-1 text-left hover:bg-[#0a5b50]"
              >{value}</button>)}
            </div>}
          </div>}
        </div>;
      })}
    </div>,
    host,
  );

  const selectedPlan = selected ? planMap.get(selected.callsign) : undefined;
  const selectedDisplayCallsign = selectedPlan?.callsign?.toUpperCase() || selected?.callsign || "";
  const footerInfo = footer && selected ? createPortal(
    <div
      data-pf24-selected-traffic-info="true"
      translate="no"
      className="notranslate pointer-events-none absolute bottom-[9px] left-[415px] z-[60] h-[18px] max-w-[calc(100%-425px)] truncate bg-transparent px-[5px] font-mono text-[9px] leading-[18px] text-[#111]"
    >
      {selected.username || "USUARIOXXXX"}
      &nbsp;|&nbsp;
      {selectedDisplayCallsign}
      &nbsp;[<span translate="no" className="notranslate">{spokenCallsign(selectedDisplayCallsign, selected.rawCallsign)}</span>]
      &nbsp;|&nbsp;
      {(selectedPlan?.departure_icao || "XXXX").toUpperCase()} - {(selectedPlan?.arrival_icao || "XXXX").toUpperCase()}
    </div>,
    footer,
  ) : null;

  return <>{radarLayer}{footerInfo}</>;
}
