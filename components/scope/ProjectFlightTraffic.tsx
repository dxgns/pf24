"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";

type Traffic = {
  id: string;
  callsign: string;
  username: string;
  aircraftType: string;
  livery: string;
  altitude: number;
  verticalRate: number;
  heading: number;
  groundSpeed: number;
  worldX: number;
  worldZ: number;
  x: number;
  y: number;
};

type Point = { x: number; y: number };
type DragState = { dx: number; dy: number } | null;
type RadarViewportState = { zoom: number; panX: number; panY: number };
type ConnectionEvent = { connected?: boolean };

type WireField = {
  field: number;
  wire: number;
  value: Uint8Array | number | bigint;
};

const SERVER_ID = "2ykygVZiX5";
const PROJECT_FLIGHT_WS = `wss://v3api.project-flight.com/v3/traffic/server/ws/${SERVER_ID}`;

// Project Flight publishes Roblox-world X/Z coordinates rather than lat/lon.
// Keep the conversion isolated here so the bounds can be recalibrated later
// without touching the radar/tag implementation.
const WORLD_MIN_X = -180_000;
const WORLD_MAX_X = 180_000;
const WORLD_MIN_Z = -180_000;
const WORLD_MAX_Z = 180_000;

const VECTOR_LENGTH_PX = 62;
const TRAIL_DOTS = 5;
const TRAIL_SPACING_PX = 16;
const TARGET_SIZE_PX = 18;
const DETAIL_WIDTH = 190;
const DETAIL_HEIGHT = 88;
const LABEL_WIDTH = 132;
const RADAR_STORAGE_KEY = "pf24_scope_radar_viewport_v1";
const RADAR_VIEWPORT_EVENT = "pf24-radar-viewport";
const CONNECTION_EVENT = "pf24-scope-connection-change";
const RECONNECT_MS = 2_000;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function flightLevel(altitude: number) {
  return String(Math.max(0, Math.round(altitude / 100))).padStart(3, "0");
}

function trendSymbol(verticalRate: number) {
  if (verticalRate > 150) return "↑";
  if (verticalRate < -150) return "↓";
  return "";
}

function findRadar(): HTMLElement | null {
  return document.querySelector<HTMLElement>("main.fixed > section");
}

function scopeConnected() {
  const top = document.querySelector<HTMLElement>("main.fixed header > div:first-child");
  return Array.from(top?.querySelectorAll<HTMLButtonElement>(":scope > button") ?? [])
    .some((button) => button.textContent?.trim().toUpperCase() === "DISCONNECT");
}

function getToolbarButtons(): HTMLButtonElement[] {
  const row = document.querySelector<HTMLElement>("main.fixed header > div:first-child");
  return row ? Array.from(row.querySelectorAll<HTMLButtonElement>(":scope > button")) : [];
}

function readRadarViewport(): RadarViewportState {
  try {
    const raw = localStorage.getItem(RADAR_STORAGE_KEY);
    if (!raw) return { zoom: 1, panX: 0, panY: 0 };
    const parsed = JSON.parse(raw) as Partial<RadarViewportState>;
    return {
      zoom: typeof parsed.zoom === "number" && Number.isFinite(parsed.zoom) ? parsed.zoom : 1,
      panX: typeof parsed.panX === "number" && Number.isFinite(parsed.panX) ? parsed.panX : 0,
      panY: typeof parsed.panY === "number" && Number.isFinite(parsed.panY) ? parsed.panY : 0,
    };
  } catch {
    return { zoom: 1, panX: 0, panY: 0 };
  }
}

function worldToRadar(worldX: number, worldZ: number): Point {
  return {
    x: clamp(((worldX - WORLD_MIN_X) / (WORLD_MAX_X - WORLD_MIN_X)) * 100, 0, 100),
    y: clamp(((worldZ - WORLD_MIN_Z) / (WORLD_MAX_Z - WORLD_MIN_Z)) * 100, 0, 100),
  };
}

function worldPoint(hostSize: Point, x: number, y: number): Point {
  return { x: hostSize.x * x / 100, y: hostSize.y * y / 100 };
}

function screenPoint(hostSize: Point, x: number, y: number, viewport: RadarViewportState): Point {
  const point = worldPoint(hostSize, x, y);
  return {
    x: point.x * viewport.zoom + viewport.panX,
    y: point.y * viewport.zoom + viewport.panY,
  };
}

function headingUnit(heading: number): Point {
  const radians = heading * Math.PI / 180;
  return { x: Math.sin(radians), y: -Math.cos(radians) };
}

function connectorEnd(aircraft: Point, detail: Point): Point {
  const center = { x: detail.x + DETAIL_WIDTH / 2, y: detail.y + DETAIL_HEIGHT / 2 };
  const dx = center.x - aircraft.x;
  const dy = center.y - aircraft.y;
  const halfW = DETAIL_WIDTH / 2;
  const halfH = DETAIL_HEIGHT / 2;
  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : halfW / Math.abs(dx);
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : halfH / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);
  return { x: center.x - dx * scale, y: center.y - dy * scale };
}

function readVarint(bytes: Uint8Array, start: number) {
  let value = 0n;
  let shift = 0n;
  let offset = start;
  while (offset < bytes.length && shift <= 63n) {
    const byte = bytes[offset++];
    value |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { value, offset };
    shift += 7n;
  }
  throw new Error("Invalid protobuf varint");
}

function parseWireFields(bytes: Uint8Array): WireField[] {
  const fields: WireField[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const tag = readVarint(bytes, offset);
    offset = tag.offset;
    const field = Number(tag.value >> 3n);
    const wire = Number(tag.value & 7n);
    if (!field) break;

    if (wire === 0) {
      const parsed = readVarint(bytes, offset);
      offset = parsed.offset;
      fields.push({ field, wire, value: parsed.value });
      continue;
    }
    if (wire === 1) {
      if (offset + 8 > bytes.length) break;
      fields.push({ field, wire, value: bytes.slice(offset, offset + 8) });
      offset += 8;
      continue;
    }
    if (wire === 2) {
      const length = readVarint(bytes, offset);
      offset = length.offset;
      const size = Number(length.value);
      if (!Number.isSafeInteger(size) || size < 0 || offset + size > bytes.length) break;
      fields.push({ field, wire, value: bytes.slice(offset, offset + size) });
      offset += size;
      continue;
    }
    if (wire === 5) {
      if (offset + 4 > bytes.length) break;
      fields.push({ field, wire, value: bytes.slice(offset, offset + 4) });
      offset += 4;
      continue;
    }
    break;
  }
  return fields;
}

function bytesToString(value: WireField["value"]) {
  if (!(value instanceof Uint8Array)) return "";
  try { return new TextDecoder().decode(value).replace(/\0/g, "").trim(); } catch { return ""; }
}

function bytesToDouble(value: WireField["value"]) {
  if (!(value instanceof Uint8Array) || value.byteLength !== 8) return Number.NaN;
  return new DataView(value.buffer, value.byteOffset, value.byteLength).getFloat64(0, true);
}

function fieldString(fields: WireField[], field: number) {
  return bytesToString(fields.find((item) => item.field === field && item.wire === 2)?.value ?? new Uint8Array());
}

function fieldDouble(fields: WireField[], field: number) {
  return bytesToDouble(fields.find((item) => item.field === field && item.wire === 1)?.value ?? new Uint8Array());
}

function looksLikeTrafficRecord(bytes: Uint8Array) {
  try {
    const fields = parseWireFields(bytes);
    const server = fieldString(fields, 1);
    const callsign = fieldString(fields, 2);
    return Boolean(callsign && (server === SERVER_ID || /^[A-Za-z0-9_-]{6,}$/.test(server)));
  } catch {
    return false;
  }
}

function collectRecords(bytes: Uint8Array): Uint8Array[] {
  if (looksLikeTrafficRecord(bytes)) return [bytes];
  try {
    return parseWireFields(bytes)
      .filter((field) => field.wire === 2 && field.value instanceof Uint8Array && looksLikeTrafficRecord(field.value))
      .map((field) => field.value as Uint8Array);
  } catch {
    return [];
  }
}

function decodeBinaryTraffic(bytes: Uint8Array): Omit<Traffic, "verticalRate">[] {
  const records = collectRecords(bytes);
  const result: Omit<Traffic, "verticalRate">[] = [];

  for (const record of records) {
    const fields = parseWireFields(record);
    const serverId = fieldString(fields, 1);
    if (serverId && serverId !== SERVER_ID) continue;

    const callsign = fieldString(fields, 2);
    const username = fieldString(fields, 3);
    const worldX = fieldDouble(fields, 4);
    const worldZ = fieldDouble(fields, 5);
    const heading = fieldDouble(fields, 6);
    const altitude = fieldDouble(fields, 7);
    const groundSpeed = fieldDouble(fields, 8);
    const aircraftType = fieldString(fields, 9);
    const livery = fieldString(fields, 10);

    if (!callsign || ![worldX, worldZ, heading, altitude].every(Number.isFinite)) continue;
    const point = worldToRadar(worldX, worldZ);
    result.push({
      id: username || callsign,
      callsign,
      username,
      aircraftType: aircraftType || "---",
      livery,
      altitude: Math.max(0, altitude),
      heading: ((heading % 360) + 360) % 360,
      groundSpeed: Number.isFinite(groundSpeed) ? Math.max(0, groundSpeed) : 0,
      worldX,
      worldZ,
      x: point.x,
      y: point.y,
    });
  }
  return result;
}

function numberValue(value: unknown, fallback = Number.NaN) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function decodeJsonTraffic(value: unknown): Omit<Traffic, "verticalRate">[] {
  const root = value as Record<string, unknown> | unknown[];
  const rows = Array.isArray(root)
    ? root
    : Array.isArray((root as Record<string, unknown>)?.traffic)
      ? (root as Record<string, unknown>).traffic as unknown[]
      : Array.isArray((root as Record<string, unknown>)?.aircraft)
        ? (root as Record<string, unknown>).aircraft as unknown[]
        : [root];

  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const callsign = String(item.callsign ?? item.callSign ?? item.flight ?? "").trim();
    const username = String(item.username ?? item.user ?? item.player ?? "").trim();
    const worldX = numberValue(item.x ?? item.worldX ?? item.positionX);
    const worldZ = numberValue(item.z ?? item.worldZ ?? item.positionZ ?? item.y);
    const heading = numberValue(item.heading ?? item.hdg, 0);
    const altitude = numberValue(item.altitude ?? item.alt, 0);
    const groundSpeed = numberValue(item.speed ?? item.groundSpeed ?? item.gs, 0);
    if (!callsign || !Number.isFinite(worldX) || !Number.isFinite(worldZ)) return [];
    const point = worldToRadar(worldX, worldZ);
    return [{
      id: String(item.id ?? username ?? callsign),
      callsign,
      username,
      aircraftType: String(item.aircraftType ?? item.aircraft ?? item.type ?? "---"),
      livery: String(item.livery ?? ""),
      altitude: Math.max(0, altitude),
      heading: ((heading % 360) + 360) % 360,
      groundSpeed: Math.max(0, groundSpeed),
      worldX,
      worldZ,
      x: point.x,
      y: point.y,
    }];
  });
}

async function decodeMessage(data: unknown) {
  if (typeof data === "string") {
    try { return decodeJsonTraffic(JSON.parse(data)); } catch { return []; }
  }
  if (data instanceof Blob) return decodeBinaryTraffic(new Uint8Array(await data.arrayBuffer()));
  if (data instanceof ArrayBuffer) return decodeBinaryTraffic(new Uint8Array(data));
  if (ArrayBuffer.isView(data)) return decodeBinaryTraffic(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  return [];
}

export default function ProjectFlightTraffic() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [hostSize, setHostSize] = useState<Point>({ x: 1, y: 1 });
  const [traffic, setTraffic] = useState<Traffic[]>([]);
  const [connected, setConnected] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHeading, setShowHeading] = useState(false);
  const [showTrail, setShowTrail] = useState(false);
  const [detailPosition, setDetailPosition] = useState<Point | null>(null);
  const [radarViewport, setRadarViewport] = useState<RadarViewportState>({ zoom: 1, panX: 0, panY: 0 });
  const dragRef = useRef<DragState>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const lastTrafficRef = useRef<Map<string, { altitude: number; time: number }>>(new Map());

  const selected = useMemo(() => traffic.find((a) => a.id === selectedId) ?? null, [selectedId, traffic]);

  useEffect(() => {
    setRadarViewport(readRadarViewport());
    const onViewport = (event: Event) => {
      const detail = (event as CustomEvent<RadarViewportState>).detail;
      if (detail) setRadarViewport(detail);
    };
    window.addEventListener(RADAR_VIEWPORT_EVENT, onViewport);
    return () => window.removeEventListener(RADAR_VIEWPORT_EVENT, onViewport);
  }, []);

  useEffect(() => {
    const radar = findRadar();
    setHost(radar);
    if (radar) setHostSize({ x: Math.max(1, radar.clientWidth), y: Math.max(1, radar.clientHeight) });
    const retry = window.setTimeout(() => {
      const next = findRadar();
      setHost(next);
      if (next) setHostSize({ x: Math.max(1, next.clientWidth), y: Math.max(1, next.clientHeight) });
    }, 250);
    return () => window.clearTimeout(retry);
  }, []);

  useEffect(() => {
    if (!host) return;
    const update = () => setHostSize({ x: Math.max(1, host.clientWidth), y: Math.max(1, host.clientHeight) });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [host]);

  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24ProjectFlightTraffic = "true";
    style.textContent = `
      main.fixed > section > button.absolute.z-10 { display: none !important; }
      main.fixed > section > div.absolute.right-\\[11px\\].top-\\[272px\\] { display: none !important; }
      [data-pf24-live-traffic='true'] { transform: none !important; transform-origin: initial !important; will-change: auto !important; }
      [data-pf24-traffic-select='true'], [data-pf24-traffic-detail='true'] { text-rendering: geometricPrecision; -webkit-font-smoothing: antialiased; }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    setConnected(scopeConnected());
    const onConnection = (event: Event) => {
      const detail = (event as CustomEvent<ConnectionEvent>).detail;
      setConnected(Boolean(detail?.connected));
    };
    window.addEventListener(CONNECTION_EVENT, onConnection);
    const delayed = window.setTimeout(() => setConnected(scopeConnected()), 420);
    return () => {
      window.clearTimeout(delayed);
      window.removeEventListener(CONNECTION_EVENT, onConnection);
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    const closeSocket = () => {
      if (reconnectRef.current !== null) {
        window.clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket && socket.readyState <= WebSocket.OPEN) socket.close(1000, "PF24 Scope disconnected");
    };

    const connectSocket = () => {
      if (disposed || !connected || socketRef.current) return;
      const socket = new WebSocket(PROJECT_FLIGHT_WS);
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;

      socket.onmessage = (event) => {
        void decodeMessage(event.data).then((decoded) => {
          if (disposed || decoded.length === 0) return;
          const now = performance.now();
          const next = decoded.map((item): Traffic => {
            const previous = lastTrafficRef.current.get(item.id);
            let verticalRate = 0;
            if (previous && now > previous.time) {
              const minutes = (now - previous.time) / 60_000;
              verticalRate = minutes > 0 ? (item.altitude - previous.altitude) / minutes : 0;
              if (!Number.isFinite(verticalRate) || Math.abs(verticalRate) > 15_000) verticalRate = 0;
            }
            lastTrafficRef.current.set(item.id, { altitude: item.altitude, time: now });
            return { ...item, verticalRate };
          });
          const liveIds = new Set(next.map((item) => item.id));
          for (const id of lastTrafficRef.current.keys()) if (!liveIds.has(id)) lastTrafficRef.current.delete(id);
          setTraffic(next);
          setSelectedId((current) => current && liveIds.has(current) ? current : null);
        });
      };

      socket.onerror = () => {
        // onclose handles the controlled retry.
      };

      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null;
        if (disposed || !connected) return;
        reconnectRef.current = window.setTimeout(() => {
          reconnectRef.current = null;
          connectSocket();
        }, RECONNECT_MS);
      };
    };

    if (connected) connectSocket();
    else {
      closeSocket();
      setTraffic([]);
      setSelectedId(null);
      setDetailPosition(null);
      lastTrafficRef.current.clear();
    }

    return () => {
      disposed = true;
      closeSocket();
    };
  }, [connected]);

  useEffect(() => {
    const onToolbarClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      if (!(button instanceof HTMLButtonElement)) return;
      const buttons = getToolbarButtons();
      const index = buttons.indexOf(button);
      if (index === 5) setShowHeading((value) => !value);
      if (index === 6) setShowTrail((value) => !value);
    };
    document.addEventListener("click", onToolbarClick, true);
    return () => document.removeEventListener("click", onToolbarClick, true);
  }, []);

  useEffect(() => {
    const deselect = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-pf24-traffic-select='true']") || target?.closest("[data-pf24-traffic-detail='true']")) return;
      setSelectedId(null);
      setDetailPosition(null);
    };
    document.addEventListener("click", deselect, true);
    return () => document.removeEventListener("click", deselect, true);
  }, []);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || !host) return;
      const rect = host.getBoundingClientRect();
      setDetailPosition({
        x: clamp(event.clientX - rect.left - drag.dx, 2, hostSize.x - DETAIL_WIDTH - 2),
        y: clamp(event.clientY - rect.top - drag.dy, 2, hostSize.y - DETAIL_HEIGHT - 2),
      });
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [host, hostSize.x, hostSize.y]);

  function selectTraffic(a: Traffic, event: React.MouseEvent<HTMLElement>) {
    event.stopPropagation();
    setSelectedId(a.id);
    const point = screenPoint(hostSize, a.x, a.y, radarViewport);
    setDetailPosition({
      x: clamp(point.x - 8, 2, hostSize.x - DETAIL_WIDTH - 2),
      y: clamp(point.y + 72, 2, hostSize.y - DETAIL_HEIGHT - 2),
    });
  }

  function startDetailDrag(event: React.MouseEvent<HTMLDivElement>) {
    if (!detailPosition) return;
    event.stopPropagation();
    dragRef.current = {
      dx: event.clientX - (host?.getBoundingClientRect().left ?? 0) - detailPosition.x,
      dy: event.clientY - (host?.getBoundingClientRect().top ?? 0) - detailPosition.y,
    };
  }

  if (!host || !connected) return null;

  const selectedPoint = selected ? screenPoint(hostSize, selected.x, selected.y, radarViewport) : null;
  const connector = selectedPoint && detailPosition ? connectorEnd(selectedPoint, detailPosition) : null;

  return createPortal(
    <div className="pointer-events-none absolute inset-0 z-[8] overflow-hidden" data-pf24-live-traffic="true">
      <svg className="absolute inset-0 h-full w-full" width={hostSize.x} height={hostSize.y} viewBox={`0 0 ${hostSize.x} ${hostSize.y}`} preserveAspectRatio="none" aria-hidden="true">
        {traffic.map((a) => {
          const point = screenPoint(hostSize, a.x, a.y, radarViewport);
          const unit = headingUnit(a.heading);
          const vectorEnd = { x: point.x + unit.x * VECTOR_LENGTH_PX, y: point.y + unit.y * VECTOR_LENGTH_PX };
          return <g key={a.id}>
            {showTrail && Array.from({ length: TRAIL_DOTS }, (_, index) => {
              const distance = (index + 1) * TRAIL_SPACING_PX;
              return <circle key={`${a.id}-trail-${index}`} cx={point.x - unit.x * distance} cy={point.y - unit.y * distance} r="2.2" fill="#00d000" opacity={0.95 - index * 0.11}/>;
            })}
            {showHeading && <line x1={point.x} y1={point.y} x2={vectorEnd.x} y2={vectorEnd.y} stroke="#00e000" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>}
          </g>;
        })}
        {selectedPoint && connector && <line x1={selectedPoint.x} y1={selectedPoint.y} x2={connector.x} y2={connector.y} stroke="#00e000" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>}
      </svg>

      {traffic.map((a) => {
        const active = a.id === selectedId;
        const fl = flightLevel(a.altitude);
        const trend = trendSymbol(a.verticalRate);
        const point = screenPoint(hostSize, a.x, a.y, radarViewport);
        return <div key={a.id} className="absolute" style={{ left: point.x, top: point.y }}>
          <button type="button" data-pf24-traffic-select="true" onClick={(event) => selectTraffic(a, event)} className="pointer-events-auto absolute z-[10] -translate-x-1/2 -translate-y-1/2" style={{ width: TARGET_SIZE_PX, height: TARGET_SIZE_PX }} aria-label={`Seleccionar ${a.callsign}`}>
            <span className={`absolute inset-0 rotate-45 border ${active ? "border-[#00ff00]" : "border-[#00d800]"}`}/>
          </button>

          {!active && <button type="button" data-pf24-traffic-select="true" onClick={(event) => selectTraffic(a, event)} className="pointer-events-auto absolute left-[17px] top-[15px] z-[9] whitespace-nowrap text-left font-mono text-[#00e000]" style={{ width: LABEL_WIDTH }} aria-label={`Abrir información de ${a.callsign}`}>
            <span className="block text-[9px] leading-[11px]">I</span>
            <span className="block text-[13px] leading-[14px]">{a.callsign}</span>
            <span className="block text-[12px] leading-[14px]">A{fl}{trend}&nbsp;&nbsp;{String(Math.round(a.groundSpeed)).padStart(3, "0")}</span>
            <span className="block pl-[64px] text-[12px] leading-[13px]">{a.aircraftType}</span>
          </button>}
        </div>;
      })}

      {selected && detailPosition && <div data-pf24-traffic-detail="true" onMouseDown={startDetailDrag} className="pointer-events-auto absolute z-[12] w-[190px] cursor-move select-none font-mono text-[12px] leading-[17px] text-[#00e000]" style={{ left: detailPosition.x, top: detailPosition.y }}>
        <div className="text-[#ffff00]">A----</div>
        <div>{selected.callsign} -- &nbsp;{selected.aircraftType}</div>
        <div>{flightLevel(selected.altitude)}{trendSymbol(selected.verticalRate)} HDG{String(Math.round(selected.heading)).padStart(3, "0")} N{Math.round(selected.groundSpeed)}</div>
        <div>{selected.username || "---"}</div>
        <div>{selected.livery || "---"}</div>
      </div>}
    </div>,
    host,
  );
}
