const PROJECT_FLIGHT_WS_PREFIX = "wss://v3api.project-flight.com/v3/traffic/server/ws/";

// The calibration shim runs before this one. Complete traffic records therefore
// already contain calibrated legacy X/Z values. Project Flight can also emit
// position-only delta records; those do not contain a callsign, so the calibration
// shim cannot recognize them. Keep the same calibration here for those deltas.
const MAP_XX = 0.0007199679402183645;
const MAP_XZ = 5.208285458837593e-8;
const MAP_X_OFFSET = 119.9995254587802;
const MAP_YX = -1.173930619021416e-8;
const MAP_YZ = 0.0007200273787600041;
const MAP_Y_OFFSET = 67.50174811414595;
const LEGACY_MAP_BOUNDS = { minX: 15, maxX: 210, minY: 37, maxY: 120 } as const;
const LEGACY_WORLD_MIN = -180000;
const LEGACY_WORLD_MAX = 180000;

type Point = { x: number; y: number };
type LocalAnchor = { source: Point; target: Point };
type WireField = { field: number; wire: number; bytes?: Uint8Array; number?: number };
type CachedTraffic = {
  id: string;
  callsign: string;
  username: string;
  worldX: number;
  worldZ: number;
  heading: number;
  altitude: number;
  speed: number;
  aircraftType: string;
};

const MDST_LOCAL_ANCHORS: readonly LocalAnchor[] = [
  { source: { x: 67.18638579108024, y: 92.41396460312409 }, target: { x: 67.19, y: 92.42 } },
  { source: { x: 68.70524802906547, y: 93.41745567707395 }, target: { x: 68.70, y: 93.42 } },
  { source: { x: 69.55586493910535, y: 93.45708291487915 }, target: { x: 69.56, y: 93.45 } },
  { source: { x: 68.28650597230555, y: 93.23743045893573 }, target: { x: 68.29, y: 93.23 } },
  { source: { x: 68.46812190075686, y: 93.37256727642699 }, target: { x: 68.47, y: 93.37 } },
  { source: { x: 68.95795896689052, y: 93.52736517609387 }, target: { x: 68.96, y: 93.52 } },
  { source: { x: 66.0, y: 91.5 }, target: { x: 66.0, y: 91.5 } },
  { source: { x: 70.5, y: 91.5 }, target: { x: 70.5, y: 91.5 } },
  { source: { x: 70.5, y: 94.5 }, target: { x: 70.5, y: 94.5 } },
  { source: { x: 66.0, y: 94.5 }, target: { x: 66.0, y: 94.5 } },
] as const;

const MDST_LOCAL_TRIANGLES: readonly (readonly [number, number, number])[] = [
  [8, 2, 7], [0, 9, 6], [0, 3, 9], [7, 0, 6], [3, 0, 7], [5, 2, 8], [9, 5, 8],
  [5, 1, 2], [1, 3, 7], [2, 1, 7], [4, 5, 9], [4, 1, 5], [3, 4, 9], [1, 4, 3],
] as const;

declare global {
  interface Window {
    __PF24_PROJECT_FLIGHT_LIVE_UPDATE_SHIM__?: boolean;
  }
}

function barycentric(point: Point, a: Point, b: Point, c: Point) {
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(denominator) < 1e-12) return null;
  const wa = ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) / denominator;
  const wb = ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) / denominator;
  return [wa, wb, 1 - wa - wb] as const;
}

function applyMdstLocalTriangulation(point: Point): Point {
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

function calibratedLegacyPoint(worldX: number, worldZ: number) {
  const globalPoint = {
    x: MAP_XX * worldX + MAP_XZ * worldZ + MAP_X_OFFSET,
    y: MAP_YX * worldX + MAP_YZ * worldZ + MAP_Y_OFFSET,
  };
  const map = applyMdstLocalTriangulation(globalPoint);
  const span = LEGACY_WORLD_MAX - LEGACY_WORLD_MIN;
  return {
    x: LEGACY_WORLD_MIN + ((map.x - LEGACY_MAP_BOUNDS.minX) / (LEGACY_MAP_BOUNDS.maxX - LEGACY_MAP_BOUNDS.minX)) * span,
    z: LEGACY_WORLD_MIN + ((map.y - LEGACY_MAP_BOUNDS.minY) / (LEGACY_MAP_BOUNDS.maxY - LEGACY_MAP_BOUNDS.minY)) * span,
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
  return null;
}

function parseFields(bytes: Uint8Array): WireField[] | null {
  const fields: WireField[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const tag = readVarint(bytes, offset);
    if (!tag) return null;
    offset = tag.offset;
    const field = Math.floor(tag.value / 8);
    const wire = tag.value % 8;
    if (field <= 0) return null;

    if (wire === 0) {
      const value = readVarint(bytes, offset);
      if (!value) return null;
      fields.push({ field, wire, number: value.value });
      offset = value.offset;
      continue;
    }
    if (wire === 1) {
      if (offset + 8 > bytes.length) return null;
      fields.push({ field, wire, bytes: bytes.slice(offset, offset + 8) });
      offset += 8;
      continue;
    }
    if (wire === 2) {
      const length = readVarint(bytes, offset);
      if (!length) return null;
      offset = length.offset;
      const size = Math.floor(length.value);
      if (size < 0 || offset + size > bytes.length) return null;
      fields.push({ field, wire, bytes: bytes.slice(offset, offset + size) });
      offset += size;
      continue;
    }
    if (wire === 5) {
      if (offset + 4 > bytes.length) return null;
      fields.push({ field, wire, bytes: bytes.slice(offset, offset + 4) });
      offset += 4;
      continue;
    }
    return null;
  }
  return fields;
}

function textOf(field: WireField | undefined) {
  if (!field?.bytes) return "";
  try { return new TextDecoder().decode(field.bytes).replace(/\0/g, "").trim(); }
  catch { return ""; }
}

function doubleOf(field: WireField | undefined) {
  if (!field?.bytes || field.bytes.byteLength !== 8) return Number.NaN;
  const copy = new Uint8Array(field.bytes);
  return new DataView(copy.buffer).getFloat64(0, true);
}

function textField(fields: WireField[], field: number) {
  return textOf(fields.find((item) => item.field === field && item.wire === 2));
}

function doubleField(fields: WireField[], field: number) {
  return doubleOf(fields.find((item) => item.field === field && item.wire === 1));
}

function identityKeys(fields: WireField[]) {
  const keys = new Set<string>();
  const source = fields.find((field) => field.field === 1);
  if (source?.wire === 0 && Number.isFinite(source.number)) keys.add(`idn:${source.number}`);
  if (source?.wire === 2 && source.bytes?.length) {
    const text = textOf(source);
    if (text) keys.add(`ids:${text}`);
    else keys.add(`idh:${Array.from(source.bytes).map((value) => value.toString(16).padStart(2, "0")).join("")}`);
  }
  const callsign = textField(fields, 2).toUpperCase();
  const username = textField(fields, 3).toLowerCase();
  if (callsign) keys.add(`cs:${callsign}`);
  if (username) keys.add(`user:${username}`);
  return Array.from(keys);
}

function collectCandidateFields(bytes: Uint8Array) {
  const result: WireField[][] = [];
  const visit = (input: Uint8Array, depth: number) => {
    if (depth > 5) return;
    const fields = parseFields(input);
    if (!fields) return;
    const x = doubleField(fields, 4);
    const z = doubleField(fields, 5);
    if (Number.isFinite(x) && Number.isFinite(z) && identityKeys(fields).length > 0) result.push(fields);
    for (const field of fields) {
      if (field.wire === 2 && field.bytes && field.bytes.length >= 2) visit(field.bytes, depth + 1);
    }
  };
  visit(bytes, 0);
  return result;
}

function createHydrator() {
  const byIdentity = new Map<string, CachedTraffic>();

  const remember = (record: CachedTraffic, keys: string[]) => {
    for (const key of keys) byIdentity.set(key, record);
    if (record.callsign) byIdentity.set(`cs:${record.callsign.toUpperCase()}`, record);
    if (record.username) byIdentity.set(`user:${record.username.toLowerCase()}`, record);
  };

  const resolve = (keys: string[]) => {
    const matches = new Set<CachedTraffic>();
    for (const key of keys) {
      const match = byIdentity.get(key);
      if (match) matches.add(match);
    }
    return matches.size === 1 ? Array.from(matches)[0] : null;
  };

  const hydrateFields = (fields: WireField[]) => {
    const keys = identityKeys(fields);
    const currentCallsign = textField(fields, 2);
    const currentUsername = textField(fields, 3);
    const existing = resolve(keys);
    if (!currentCallsign && !existing) return null;

    const rawX = doubleField(fields, 4);
    const rawZ = doubleField(fields, 5);
    if (!Number.isFinite(rawX) || !Number.isFinite(rawZ)) return null;

    // Complete records were calibrated by TrafficCalibrationShim. Deltas without
    // callsign were not recognized there, so calibrate only those here.
    const position = currentCallsign ? { x: rawX, z: rawZ } : calibratedLegacyPoint(rawX, rawZ);
    const heading = doubleField(fields, 6);
    const altitude = doubleField(fields, 7);
    const speed = doubleField(fields, 8);
    const aircraftType = textField(fields, 9);
    const callsign = currentCallsign || existing?.callsign || "";
    const username = currentUsername || existing?.username || "";

    const record: CachedTraffic = existing ?? {
      id: username || callsign,
      callsign,
      username,
      worldX: position.x,
      worldZ: position.z,
      heading: 0,
      altitude: 0,
      speed: 0,
      aircraftType: "",
    };

    record.callsign = callsign;
    record.username = username;
    record.id = record.id || username || callsign;
    record.worldX = position.x;
    record.worldZ = position.z;
    if (Number.isFinite(heading)) record.heading = heading;
    if (Number.isFinite(altitude)) record.altitude = altitude;
    if (Number.isFinite(speed)) record.speed = speed;
    if (aircraftType) record.aircraftType = aircraftType;
    remember(record, keys);
    return { ...record };
  };

  const hydrateBinary = (bytes: Uint8Array) => {
    const rows = collectCandidateFields(bytes)
      .map(hydrateFields)
      .filter((row): row is CachedTraffic => Boolean(row));
    if (rows.length === 0) return null;

    const unique = new Map<string, CachedTraffic>();
    for (const row of rows) unique.set(row.id || row.callsign, row);
    return JSON.stringify(Array.from(unique.values()));
  };

  return async (data: unknown): Promise<unknown> => {
    if (data instanceof ArrayBuffer) return hydrateBinary(new Uint8Array(data)) ?? data;
    if (data instanceof Blob) {
      const buffer = await data.arrayBuffer();
      return hydrateBinary(new Uint8Array(buffer)) ?? data;
    }
    return data;
  };
}

export function installProjectFlightLiveUpdateShim() {
  if (typeof window === "undefined" || window.__PF24_PROJECT_FLIGHT_LIVE_UPDATE_SHIM__) return;
  window.__PF24_PROJECT_FLIGHT_LIVE_UPDATE_SHIM__ = true;

  const BaseWebSocket = window.WebSocket;

  class LiveUpdateWebSocket extends BaseWebSocket {
    private pf24Hydrate = false;
    private pf24UserOnMessage: ((this: WebSocket, ev: MessageEvent) => unknown) | null = null;
    private pf24Hydrator = createHydrator();

    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols);
      this.pf24Hydrate = String(url).startsWith(PROJECT_FLIGHT_WS_PREFIX);
      if (!this.pf24Hydrate) return;

      super.onmessage = (event: MessageEvent) => {
        void this.pf24Hydrator(event.data).then((data) => {
          const handler = this.pf24UserOnMessage;
          if (!handler) return;
          handler.call(this, new MessageEvent("message", { data }));
        });
      };
    }

    override get onmessage() {
      return this.pf24Hydrate ? this.pf24UserOnMessage : super.onmessage;
    }

    override set onmessage(handler) {
      if (!this.pf24Hydrate) {
        super.onmessage = handler;
        return;
      }
      this.pf24UserOnMessage = handler;
    }
  }

  window.WebSocket = LiveUpdateWebSocket as typeof WebSocket;
}
