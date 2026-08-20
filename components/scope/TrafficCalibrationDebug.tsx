"use client";

import { useEffect, useState } from "react";

type DebugPoint = {
  callsign: string;
  worldX: number;
  worldZ: number;
  mapX: number;
  mapY: number;
};

type WireField = { field: number; wire: number; bytes?: Uint8Array; number?: number };

const PROJECT_FLIGHT_WS_PREFIX = "wss://v3api.project-flight.com/v3/traffic/server/ws/";
const DEFAULT_SERVER_ID = "2ykygVZiX5";
const TARGET_CALLSIGN = "ACA6143";
const MIN_X = -180000;
const MAX_X = 180000;
const MIN_Z = -180000;
const MAX_Z = 180000;
const TRAFFIC_MAP_BOUNDS = { minX: 15, maxX: 210, minY: 37, maxY: 120 } as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function radarCoordinates(worldX: number, worldZ: number) {
  const normalizedX = clamp((worldX - MIN_X) / (MAX_X - MIN_X), 0, 1);
  const normalizedY = clamp((worldZ - MIN_Z) / (MAX_Z - MIN_Z), 0, 1);
  return {
    x: TRAFFIC_MAP_BOUNDS.minX + normalizedX * (TRAFFIC_MAP_BOUNDS.maxX - TRAFFIC_MAP_BOUNDS.minX),
    y: TRAFFIC_MAP_BOUNDS.minY + normalizedY * (TRAFFIC_MAP_BOUNDS.maxY - TRAFFIC_MAP_BOUNDS.minY),
  };
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

function isTrafficRecord(bytes: Uint8Array) {
  try {
    const fields = parseFields(bytes);
    const callsign = textOf(fields.find((field) => field.field === 2 && field.wire === 2));
    const worldX = doubleOf(fields.find((field) => field.field === 4 && field.wire === 1));
    const worldZ = doubleOf(fields.find((field) => field.field === 5 && field.wire === 1));
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

function decodeBinary(bytes: Uint8Array): DebugPoint | null {
  for (const record of recordsFromMessage(bytes)) {
    const fields = parseFields(record);
    const callsign = textOf(fields.find((field) => field.field === 2 && field.wire === 2)).toUpperCase();
    if (callsign !== TARGET_CALLSIGN) continue;
    const worldX = doubleOf(fields.find((field) => field.field === 4 && field.wire === 1));
    const worldZ = doubleOf(fields.find((field) => field.field === 5 && field.wire === 1));
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) continue;
    const map = radarCoordinates(worldX, worldZ);
    return { callsign, worldX, worldZ, mapX: map.x, mapY: map.y };
  }
  return null;
}

function decodeJson(value: unknown): DebugPoint | null {
  if (!value || typeof value !== "object") return null;
  const root = value as Record<string, unknown>;
  const rows: unknown[] = Array.isArray(value)
    ? value
    : Array.isArray(root.traffic)
      ? root.traffic
      : Array.isArray(root.aircraft)
        ? root.aircraft
        : [value];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const callsign = String(item.callsign ?? item.callSign ?? "").trim().toUpperCase();
    if (callsign !== TARGET_CALLSIGN) continue;
    const worldX = Number(item.x ?? item.worldX ?? item.positionX);
    const worldZ = Number(item.z ?? item.worldZ ?? item.positionZ ?? item.y);
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) continue;
    const map = radarCoordinates(worldX, worldZ);
    return { callsign, worldX, worldZ, mapX: map.x, mapY: map.y };
  }
  return null;
}

export default function TrafficCalibrationDebug({ serverId }: { serverId: string }) {
  const [point, setPoint] = useState<DebugPoint | null>(null);

  useEffect(() => {
    let disposed = false;
    let retry: number | null = null;
    let socket: WebSocket | null = null;
    const id = serverId.trim() || DEFAULT_SERVER_ID;

    const open = () => {
      if (disposed) return;
      socket = new WebSocket(`${PROJECT_FLIGHT_WS_PREFIX}${id}`);
      socket.binaryType = "arraybuffer";

      socket.onmessage = (event) => {
        void (async () => {
          let decoded: DebugPoint | null = null;
          if (typeof event.data === "string") {
            try { decoded = decodeJson(JSON.parse(event.data)); } catch { decoded = null; }
          } else if (event.data instanceof ArrayBuffer) {
            decoded = decodeBinary(new Uint8Array(event.data));
          } else if (event.data instanceof Blob) {
            decoded = decodeBinary(new Uint8Array(await event.data.arrayBuffer()));
          }
          if (!disposed && decoded) setPoint(decoded);
        })();
      };

      socket.onclose = () => {
        socket = null;
        if (!disposed) retry = window.setTimeout(open, 2000);
      };
      socket.onerror = () => socket?.close();
    };

    open();
    return () => {
      disposed = true;
      if (retry !== null) window.clearTimeout(retry);
      socket?.close();
    };
  }, [serverId]);

  return (
    <div className="pointer-events-none fixed bottom-10 left-2 z-[9999] border border-[#00e000] bg-[#101010]/95 px-2 py-1 font-mono text-[11px] leading-[14px] text-[#00ff00]">
      <div>CAL {TARGET_CALLSIGN}</div>
      {point ? <>
        <div>RAW X {point.worldX.toFixed(3)} Z {point.worldZ.toFixed(3)}</div>
        <div>MAP X {point.mapX.toFixed(3)} Y {point.mapY.toFixed(3)}</div>
        <div>REAL B30 X 87.220 Y 103.370</div>
      </> : <div>esperando trafico...</div>}
    </div>
  );
}
