"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";

type Traffic = {
  id: string;
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

const SERVER_ID = "2ykygVZiX5";
const WS_URL = `wss://v3api.project-flight.com/v3/traffic/server/ws/${SERVER_ID}`;
const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";
const CONNECTION_EVENT = "pf24-scope-connection-change";
const TARGET_SIZE = 18;
const LABEL_WIDTH = 132;
const DETAIL_WIDTH = 190;
const DETAIL_HEIGHT = 88;
const VECTOR_LENGTH = 62;

// Temporary Project Flight world bounds. They are isolated so we can calibrate
// the radar once we inspect live positions from this specific server.
const MIN_X = -180000;
const MAX_X = 180000;
const MIN_Z = -180000;
const MAX_Z = 180000;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function findRadar() {
  return document.querySelector<HTMLElement>("main.fixed > section");
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

function radarCoordinates(worldX: number, worldZ: number): Point {
  return {
    x: clamp(((worldX - MIN_X) / (MAX_X - MIN_X)) * 100, 0, 100),
    y: clamp(((worldZ - MIN_Z) / (MAX_Z - MIN_Z)) * 100, 0, 100),
  };
}

function screenPoint(size: Point, x: number, y: number, viewport: Viewport): Point {
  return {
    x: size.x * (x / 100) * viewport.zoom + viewport.panX,
    y: size.y * (y / 100) * viewport.zoom + viewport.panY,
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
    const server = stringField(fields, 1);
    const callsign = stringField(fields, 2);
    return Boolean(callsign && (!server || server === SERVER_ID || server.length >= 6));
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
    const server = stringField(fields, 1);
    if (server && server !== SERVER_ID) return [];

    const callsign = stringField(fields, 2);
    const username = stringField(fields, 3);
    const worldX = doubleField(fields, 4);
    const worldZ = doubleField(fields, 5);
    const heading = doubleField(fields, 6);
    const altitude = doubleField(fields, 7);
    const speed = doubleField(fields, 8);
    const aircraftType = stringField(fields, 9) || "---";

    if (!callsign || !Number.isFinite(worldX) || !Number.isFinite(worldZ)) return [];
    const point = radarCoordinates(worldX, worldZ);
    return [{
      id: username || callsign,
      callsign,
      username,
      aircraftType,
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
    const callsign = String(item.callsign ?? item.callSign ?? "").trim();
    const username = String(item.username ?? item.user ?? item.player ?? "").trim();
    const worldX = numberFrom(item.x ?? item.worldX ?? item.positionX);
    const worldZ = numberFrom(item.z ?? item.worldZ ?? item.positionZ ?? item.y);
    if (!callsign || !Number.isFinite(worldX) || !Number.isFinite(worldZ)) return [];
    const point = radarCoordinates(worldX, worldZ);
    return [{
      id: String(item.id ?? username ?? callsign),
      callsign,
      username,
      aircraftType: String(item.aircraftType ?? item.aircraft ?? item.type ?? "---"),
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

export default function ProjectFlightTrafficV2() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [hostSize, setHostSize] = useState<Point>({ x: 1, y: 1 });
  const [traffic, setTraffic] = useState<Traffic[]>([]);
  const [connected, setConnected] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Point | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 });
  const [showHeading, setShowHeading] = useState(false);
  const [showTrail, setShowTrail] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const dragRef = useRef<Point | null>(null);
  const previousRef = useRef<Map<string, { altitude: number; time: number }>>(new Map());

  const selected = useMemo(() => traffic.find((item) => item.id === selectedId) ?? null, [traffic, selectedId]);

  useEffect(() => {
    setViewport(readViewport());
    const onViewport = (event: Event) => {
      const next = (event as CustomEvent<Viewport>).detail;
      if (next) setViewport(next);
    };
    window.addEventListener(VIEWPORT_EVENT, onViewport);
    return () => window.removeEventListener(VIEWPORT_EVENT, onViewport);
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
    const resize = () => setHostSize({ x: Math.max(1, host.clientWidth), y: Math.max(1, host.clientHeight) });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [host]);

  useEffect(() => {
    setConnected(scopeConnected());
    const onConnection = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean }>).detail;
      setConnected(Boolean(detail?.connected));
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
    style.dataset.pf24LiveProjectFlightTraffic = "true";
    style.textContent = `
      main.fixed > section > button.absolute.z-10 { display:none!important; }
      main.fixed > section > div.absolute.right-\\[11px\\].top-\\[272px\\] { display:none!important; }
      [data-pf24-live-traffic='true'] { transform:none!important; transform-origin:initial!important; }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    let disposed = false;

    const stop = () => {
      if (reconnectRef.current !== null) {
        window.clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      const current = socketRef.current;
      socketRef.current = null;
      if (current && (current.readyState === WebSocket.CONNECTING || current.readyState === WebSocket.OPEN)) current.close();
    };

    const open = () => {
      if (disposed || !connected || socketRef.current) return;
      const socket = new WebSocket(WS_URL);
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;

      socket.onmessage = (event) => {
        void decodeMessage(event.data).then((decoded) => {
          if (disposed || decoded.length === 0) return;
          const now = performance.now();
          const next = decoded.map((item): Traffic => {
            const previous = previousRef.current.get(item.id);
            let verticalRate = 0;
            if (previous && now > previous.time) {
              const minutes = (now - previous.time) / 60000;
              verticalRate = minutes > 0 ? (item.altitude - previous.altitude) / minutes : 0;
              if (!Number.isFinite(verticalRate) || Math.abs(verticalRate) > 15000) verticalRate = 0;
            }
            previousRef.current.set(item.id, { altitude: item.altitude, time: now });
            return { ...item, verticalRate };
          });
          const ids = new Set(next.map((item) => item.id));
          setTraffic(next);
          setSelectedId((current) => current && ids.has(current) ? current : null);
        });
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

    if (connected) open();
    else {
      stop();
      setTraffic([]);
      setSelectedId(null);
      setDetail(null);
      previousRef.current.clear();
    }

    return () => {
      disposed = true;
      stop();
    };
  }, [connected]);

  useEffect(() => {
    const onToolbar = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      if (!(button instanceof HTMLButtonElement)) return;
      const index = toolbarButtons().indexOf(button);
      if (index === 5) setShowHeading((value) => !value);
      if (index === 6) setShowTrail((value) => !value);
    };
    document.addEventListener("click", onToolbar, true);
    return () => document.removeEventListener("click", onToolbar, true);
  }, []);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!dragRef.current || !host || !detail) return;
      const rect = host.getBoundingClientRect();
      setDetail({
        x: clamp(event.clientX - rect.left - dragRef.current.x, 2, hostSize.x - DETAIL_WIDTH - 2),
        y: clamp(event.clientY - rect.top - dragRef.current.y, 2, hostSize.y - DETAIL_HEIGHT - 2),
      });
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [detail, host, hostSize.x, hostSize.y]);

  useEffect(() => {
    const deselect = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-pf24-traffic-select='true']") || target?.closest("[data-pf24-traffic-detail='true']")) return;
      setSelectedId(null);
      setDetail(null);
    };
    document.addEventListener("click", deselect, true);
    return () => document.removeEventListener("click", deselect, true);
  }, []);

  if (!host || !connected) return null;

  const selectedPoint = selected ? screenPoint(hostSize, selected.x, selected.y, viewport) : null;

  return createPortal(
    <div data-pf24-live-traffic="true" className="pointer-events-none absolute inset-0 z-[8] overflow-hidden">
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${hostSize.x} ${hostSize.y}`} preserveAspectRatio="none" aria-hidden="true">
        {traffic.map((item) => {
          const point = screenPoint(hostSize, item.x, item.y, viewport);
          const unit = headingUnit(item.heading);
          return <g key={item.id}>
            {showTrail && Array.from({ length: 5 }, (_, index) => {
              const distance = (index + 1) * 16;
              return <circle key={`${item.id}-${index}`} cx={point.x - unit.x * distance} cy={point.y - unit.y * distance} r="2.2" fill="#00d000"/>;
            })}
            {showHeading && <line x1={point.x} y1={point.y} x2={point.x + unit.x * VECTOR_LENGTH} y2={point.y + unit.y * VECTOR_LENGTH} stroke="#00e000" strokeWidth="1.5"/>}
          </g>;
        })}
        {selectedPoint && detail && <line x1={selectedPoint.x} y1={selectedPoint.y} x2={detail.x + 30} y2={detail.y} stroke="#00e000" strokeWidth="1.5"/>}
      </svg>

      {traffic.map((item) => {
        const active = item.id === selectedId;
        const point = screenPoint(hostSize, item.x, item.y, viewport);
        return <div key={item.id} className="absolute" style={{ left: point.x, top: point.y }}>
          <button
            type="button"
            data-pf24-traffic-select="true"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedId(item.id);
              setDetail({
                x: clamp(point.x - 8, 2, hostSize.x - DETAIL_WIDTH - 2),
                y: clamp(point.y + 72, 2, hostSize.y - DETAIL_HEIGHT - 2),
              });
            }}
            className="pointer-events-auto absolute z-[10] -translate-x-1/2 -translate-y-1/2"
            style={{ width: TARGET_SIZE, height: TARGET_SIZE }}
          >
            <span className={`absolute inset-0 rotate-45 border ${active ? "border-[#00ff00]" : "border-[#00d800]"}`}/>
          </button>

          {!active && <button
            type="button"
            data-pf24-traffic-select="true"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedId(item.id);
              setDetail({
                x: clamp(point.x - 8, 2, hostSize.x - DETAIL_WIDTH - 2),
                y: clamp(point.y + 72, 2, hostSize.y - DETAIL_HEIGHT - 2),
              });
            }}
            className="pointer-events-auto absolute left-[17px] top-[15px] z-[9] whitespace-nowrap text-left font-mono text-[#00e000]"
            style={{ width: LABEL_WIDTH }}
          >
            <span className="block text-[9px] leading-[11px]">I</span>
            <span className="block text-[13px] leading-[14px]">{item.callsign}</span>
            <span className="block text-[12px] leading-[14px]">A{flightLevel(item.altitude)}{trend(item.verticalRate)}&nbsp;&nbsp;{String(Math.round(item.groundSpeed)).padStart(3, "0")}</span>
            <span className="block pl-[64px] text-[12px] leading-[13px]">{item.aircraftType}</span>
          </button>}
        </div>;
      })}

      {selected && detail && <div
        data-pf24-traffic-detail="true"
        onMouseDown={(event) => {
          event.stopPropagation();
          const rect = host.getBoundingClientRect();
          dragRef.current = { x: event.clientX - rect.left - detail.x, y: event.clientY - rect.top - detail.y };
        }}
        className="pointer-events-auto absolute z-[12] w-[190px] cursor-move select-none font-mono text-[12px] leading-[17px] text-[#00e000]"
        style={{ left: detail.x, top: detail.y }}
      >
        <div className="text-[#ffff00]">A----</div>
        <div>{selected.callsign} -- &nbsp;{selected.aircraftType}</div>
        <div>{flightLevel(selected.altitude)}{trend(selected.verticalRate)} HDG{String(Math.round(selected.heading)).padStart(3, "0")} N{Math.round(selected.groundSpeed)}</div>
        <div>{selected.username || "---"}</div>
        <div>AHDG ASP TXT</div>
      </div>}
    </div>,
    host,
  );
}
