const PROJECT_FLIGHT_WS_PREFIX = "wss://v3api.project-flight.com/v3/traffic/server/ws/";

// Wide-area Project Flight -> Scope calibration using the measured anchors
// spread across the full map. This remains the global coordinate frame.
const MAP_XX = 0.0007199679402183645;
const MAP_XZ = 5.208285458837593e-8;
const MAP_X_OFFSET = 119.9995254587802;
const MAP_YX = -1.173930619021416e-8;
const MAP_YZ = 0.0007200273787600041;
const MAP_Y_OFFSET = 67.50174811414595;

// ProjectFlightTrafficV6 still consumes the legacy -180000..180000 world range
// and maps it to PFTracker X 15..210 / Y 37..120. Convert calibrated map points
// back into equivalent legacy X/Z values so the existing decoder/render code can
// remain untouched for now.
const LEGACY_MAP_BOUNDS = { minX: 15, maxX: 210, minY: 37, maxY: 120 } as const;
const LEGACY_WORLD_MIN = -180000;
const LEGACY_WORLD_MAX = 180000;

type MapPoint = { x: number; y: number };
type LocalAnchor = { source: MapPoint; target: MapPoint };

// At extreme ground zoom even a 0.005-0.008 Scope-unit global-fit residual is
// visibly several pixels. These six MDST samples are direct Project Flight
// measurements supplied during the triangulation pass. We correct only the local
// residual field; the SVG itself is left untouched.
//
// Four zero-correction outer anchors make the piecewise transform fade smoothly
// back into the global map instead of introducing a jump at the airport edge.
const MDST_LOCAL_ANCHORS: readonly LocalAnchor[] = [
  { source: { x: 67.18638579108024, y: 92.41396460312409 }, target: { x: 67.19, y: 92.42 } }, // RWY11
  { source: { x: 68.70524802906547, y: 93.41745567707395 }, target: { x: 68.70, y: 93.42 } }, // B1
  { source: { x: 69.55586493910535, y: 93.45708291487915 }, target: { x: 69.56, y: 93.45 } }, // RWY29
  { source: { x: 68.28650597230555, y: 93.23743045893573 }, target: { x: 68.29, y: 93.23 } }, // A1
  { source: { x: 68.46812190075686, y: 93.37256727642699 }, target: { x: 68.47, y: 93.37 } }, // B6
  { source: { x: 68.95795896689052, y: 93.52736517609387 }, target: { x: 68.96, y: 93.52 } }, // C1
  { source: { x: 66.0, y: 91.5 }, target: { x: 66.0, y: 91.5 } },
  { source: { x: 70.5, y: 91.5 }, target: { x: 70.5, y: 91.5 } },
  { source: { x: 70.5, y: 94.5 }, target: { x: 70.5, y: 94.5 } },
  { source: { x: 66.0, y: 94.5 }, target: { x: 66.0, y: 94.5 } },
] as const;

// Delaunay triangulation of the source points above. Inside each triangle the
// residual is interpolated barycentrically, so all verified anchors are exact
// and the correction is continuous across triangle borders.
const MDST_LOCAL_TRIANGLES: readonly (readonly [number, number, number])[] = [
  [8, 2, 7],
  [0, 9, 6],
  [0, 3, 9],
  [7, 0, 6],
  [3, 0, 7],
  [5, 2, 8],
  [9, 5, 8],
  [5, 1, 2],
  [1, 3, 7],
  [2, 1, 7],
  [4, 5, 9],
  [4, 1, 5],
  [3, 4, 9],
  [1, 4, 3],
] as const;

type NativeWebSocketCtor = typeof WebSocket;

declare global {
  interface Window {
    __PF24_NATIVE_WEBSOCKET__?: NativeWebSocketCtor;
    __PF24_TRAFFIC_CALIBRATION_SHIM__?: boolean;
  }
}

function globalMapPoint(worldX: number, worldZ: number): MapPoint {
  return {
    x: MAP_XX * worldX + MAP_XZ * worldZ + MAP_X_OFFSET,
    y: MAP_YX * worldX + MAP_YZ * worldZ + MAP_Y_OFFSET,
  };
}

function barycentric(point: MapPoint, a: MapPoint, b: MapPoint, c: MapPoint) {
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(denominator) < 1e-12) return null;

  const wa = ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) / denominator;
  const wb = ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) / denominator;
  const wc = 1 - wa - wb;
  return [wa, wb, wc] as const;
}

function applyMdstLocalTriangulation(point: MapPoint): MapPoint {
  const epsilon = 1e-9;

  for (const [ia, ib, ic] of MDST_LOCAL_TRIANGLES) {
    const a = MDST_LOCAL_ANCHORS[ia];
    const b = MDST_LOCAL_ANCHORS[ib];
    const c = MDST_LOCAL_ANCHORS[ic];
    const weights = barycentric(point, a.source, b.source, c.source);
    if (!weights) continue;

    const [wa, wb, wc] = weights;
    if (wa < -epsilon || wb < -epsilon || wc < -epsilon) continue;

    return {
      x: wa * a.target.x + wb * b.target.x + wc * c.target.x,
      y: wa * a.target.y + wb * b.target.y + wc * c.target.y,
    };
  }

  return point;
}

function calibratedMapPoint(worldX: number, worldZ: number) {
  return applyMdstLocalTriangulation(globalMapPoint(worldX, worldZ));
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
