const PROJECT_FLIGHT_WS_PREFIX = "wss://v3api.project-flight.com/v3/traffic/server/ws/";

// Wide-area Project Flight -> Scope calibration from six measured anchors spread
// across the map. Unlike the previous MDPC-only samples, these points are far
// apart and make the real relationship obvious: Project Flight X maps almost
// directly to Scope X, Project Flight Z maps almost directly to Scope Y, both at
// ~0.00072 scale, with only negligible cross-axis terms.
//
// Least-squares fit over the six supplied anchors. Maximum residual is below
// ~0.005 Scope units, so do not reintroduce the previous apron-only calibration.
const MAP_XX = 0.0007200156519174086;
const MAP_XZ = 5.388941309750032e-8;
const MAP_X_OFFSET = 119.9981365628254;
const MAP_YX = -5.53022992363797e-8;
const MAP_YZ = 0.000720028458982184;
const MAP_Y_OFFSET = 67.50311086266628;

// ProjectFlightTrafficV6 still consumes the legacy -180000..180000 world range
// and maps it to PFTracker X 15..210 / Y 37..120. Convert calibrated map points
// back into equivalent legacy X/Z values so the existing decoder/render code can
// remain untouched for now.
const LEGACY_MAP_BOUNDS = { minX: 15, maxX: 210, minY: 37, maxY: 120 } as const;
const LEGACY_WORLD_MIN = -180000;
const LEGACY_WORLD_MAX = 180000;

type NativeWebSocketCtor = typeof WebSocket;

declare global {
  interface Window {
    __PF24_NATIVE_WEBSOCKET__?: NativeWebSocketCtor;
    __PF24_TRAFFIC_CALIBRATION_SHIM__?: boolean;
  }
}

function calibratedMapPoint(worldX: number, worldZ: number) {
  return {
    x: MAP_XX * worldX + MAP_XZ * worldZ + MAP_X_OFFSET,
    y: MAP_YX * worldX + MAP_YZ * worldZ + MAP_Y_OFFSET,
  };
}

function mapToLegacyWorld(mapX: number, mapY: number) {
  const worldSpan = LEGACY_WORLD_MAX - LEGACY_WORLD_MIN;
  return {
    x:
      LEGACY_WORLD_MIN +
      ((mapX - LEGACY_MAP_BOUNDS.minX) / (LEGACY_MAP_BOUNDS.maxX - LEGACY_MAP_BOUNDS.minX)) * worldSpan,
    z:
      LEGACY_WORLD_MIN +
      ((mapY - LEGACY_MAP_BOUNDS.minY) / (LEGACY_MAP_BOUNDS.maxY - LEGACY_MAP_BOUNDS.minY)) * worldSpan,
  };
}

function calibratedLegacyPoint(worldX: number, worldZ: number) {
  const map = calibratedMapPoint(worldX, worldZ);
  return mapToLegacyWorld(map.x, map.y);
}

function readVarint(bytes: Uint8Array, start: number, end: number) {
  let value = 0;
  let multiplier = 1;
  let offset = start;
  for (let count = 0; count < 10 && offset < end; count += 1) {
    const byte = bytes[offset++];
    value += (byte & 0x7f) * multiplier;
    if ((byte & 0x80) === 0) return { value, offset };
    multiplier *= 128;
  }
  return null;
}

type MutableField = {
  field: number;
  wire: number;
  dataStart: number;
  dataEnd: number;
};

function parseFields(bytes: Uint8Array, start: number, end: number): MutableField[] | null {
  const fields: MutableField[] = [];
  let offset = start;
  while (offset < end) {
    const tag = readVarint(bytes, offset, end);
    if (!tag) return null;
    offset = tag.offset;
    const field = Math.floor(tag.value / 8);
    const wire = tag.value % 8;
    if (field <= 0) return null;

    if (wire === 0) {
      const value = readVarint(bytes, offset, end);
      if (!value) return null;
      fields.push({ field, wire, dataStart: offset, dataEnd: value.offset });
      offset = value.offset;
      continue;
    }

    if (wire === 1) {
      if (offset + 8 > end) return null;
      fields.push({ field, wire, dataStart: offset, dataEnd: offset + 8 });
      offset += 8;
      continue;
    }

    if (wire === 2) {
      const length = readVarint(bytes, offset, end);
      if (!length) return null;
      const size = Math.floor(length.value);
      const dataStart = length.offset;
      const dataEnd = dataStart + size;
      if (size < 0 || dataEnd > end) return null;
      fields.push({ field, wire, dataStart, dataEnd });
      offset = dataEnd;
      continue;
    }

    if (wire === 5) {
      if (offset + 4 > end) return null;
      fields.push({ field, wire, dataStart: offset, dataEnd: offset + 4 });
      offset += 4;
      continue;
    }

    return null;
  }
  return fields;
}

function transformTrafficRecord(bytes: Uint8Array, start: number, end: number): boolean {
  const fields = parseFields(bytes, start, end);
  if (!fields) return false;

  const callsign = fields.find((field) => field.field === 2 && field.wire === 2);
  const xField = fields.find((field) => field.field === 4 && field.wire === 1);
  const zField = fields.find((field) => field.field === 5 && field.wire === 1);

  if (callsign && callsign.dataEnd > callsign.dataStart && xField && zField) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const x = view.getFloat64(xField.dataStart, true);
    const z = view.getFloat64(zField.dataStart, true);
    if (Number.isFinite(x) && Number.isFinite(z)) {
      const calibrated = calibratedLegacyPoint(x, z);
      view.setFloat64(xField.dataStart, calibrated.x, true);
      view.setFloat64(zField.dataStart, calibrated.z, true);
      return true;
    }
  }

  let changed = false;
  for (const field of fields) {
    if (field.wire !== 2 || field.dataEnd <= field.dataStart) continue;
    if (transformTrafficRecord(bytes, field.dataStart, field.dataEnd)) changed = true;
  }
  return changed;
}

function transformBinary(input: ArrayBuffer): ArrayBuffer {
  const copy = input.slice(0);
  const bytes = new Uint8Array(copy);
  transformTrafficRecord(bytes, 0, bytes.length);
  return copy;
}

function transformJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(transformJson);
  if (!value || typeof value !== "object") return value;

  const item = { ...(value as Record<string, unknown>) };
  const xKey = ["x", "worldX", "positionX"].find((key) => Number.isFinite(Number(item[key])));
  const zKey = ["z", "worldZ", "positionZ"].find((key) => Number.isFinite(Number(item[key])));
  const hasCallsign = typeof item.callsign === "string" || typeof item.callSign === "string";

  if (hasCallsign && xKey && zKey) {
    const calibrated = calibratedLegacyPoint(Number(item[xKey]), Number(item[zKey]));
    item[xKey] = calibrated.x;
    item[zKey] = calibrated.z;
  }

  for (const [key, child] of Object.entries(item)) {
    if (key === xKey || key === zKey) continue;
    if (child && typeof child === "object") item[key] = transformJson(child);
  }
  return item;
}

function transformMessageData(data: unknown): unknown {
  if (typeof data === "string") {
    try {
      return JSON.stringify(transformJson(JSON.parse(data)));
    } catch {
      return data;
    }
  }
  if (data instanceof ArrayBuffer) return transformBinary(data);
  if (data instanceof Blob) {
    return data.arrayBuffer().then((buffer) => new Blob([transformBinary(buffer)], { type: data.type }));
  }
  return data;
}

export function installTrafficCalibrationShim() {
  if (typeof window === "undefined" || window.__PF24_TRAFFIC_CALIBRATION_SHIM__) return;

  const NativeWebSocket = window.WebSocket;
  window.__PF24_NATIVE_WEBSOCKET__ = NativeWebSocket;
  window.__PF24_TRAFFIC_CALIBRATION_SHIM__ = true;

  class CalibratedWebSocket extends NativeWebSocket {
    private pf24OnMessage: ((this: WebSocket, ev: MessageEvent) => unknown) | null = null;

    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols);

      const shouldCalibrate = String(url).startsWith(PROJECT_FLIGHT_WS_PREFIX);
      if (!shouldCalibrate) return;

      super.addEventListener("message", (event: MessageEvent) => {
        const handler = this.pf24OnMessage;
        if (!handler) return;
        const transformed = transformMessageData(event.data);
        if (transformed instanceof Promise) {
          void transformed.then((data) => handler.call(this, new MessageEvent("message", { data })));
        } else {
          handler.call(this, new MessageEvent("message", { data: transformed }));
        }
      });
    }

    override get onmessage() {
      return this.pf24OnMessage;
    }

    override set onmessage(handler) {
      this.pf24OnMessage = handler;
    }
  }

  window.WebSocket = CalibratedWebSocket as NativeWebSocketCtor;
}
