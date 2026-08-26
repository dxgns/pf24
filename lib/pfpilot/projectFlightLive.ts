export type ProjectFlightTelemetry = {
  id: string;
  rawCallsign: string;
  callsign: string;
  username: string;
  aircraftType: string;
  worldX: number;
  worldZ: number;
  mapX: number;
  mapY: number;
  altitude: number;
  heading: number;
  groundSpeed: number;
};

export type ProjectFlightConnectionState = "CONNECTING" | "LIVE" | "RECONNECTING" | "OFFLINE";

type WireField = {
  field: number;
  wire: number;
  bytes?: Uint8Array;
  number?: number;
};

type NativeWebSocketCtor = typeof WebSocket;

declare global {
  interface Window {
    __PF24_NATIVE_WEBSOCKET__?: NativeWebSocketCtor;
  }
}

const SERVER_ID = "2ykygVZiX5";
const WS_URL = `wss://v3api.project-flight.com/v3/traffic/server/ws/${SERVER_ID}`;

// Same wide-area calibration used by the Scope. Keeping PFPilot in the same
// coordinate frame lets guidance use the already calibrated PF24 waypoint map.
const MAP_XX = 0.0007199679402183645;
const MAP_XZ = 5.208285458837593e-8;
const MAP_X_OFFSET = 119.9995254587802;
const MAP_YX = -1.173930619021416e-8;
const MAP_YZ = 0.0007200273787600041;
const MAP_Y_OFFSET = 67.50174811414595;

// Scope geometry establishes 1.50 NM = 3.28875 map units.
export const MAP_UNITS_PER_NM = 3.28875 / 1.5;

const TELEPHONY_TO_ICAO: Record<string, string> = {
  SPEEDBIRD: "BAW",
  BRITISHAIRWAYS: "BAW",
  RYANAIR: "RYR",
  EASY: "EZY",
  EASYJET: "EZY",
  IBERIA: "IBE",
  VUELING: "VLG",
  LUFTHANSA: "DLH",
  AIRFRANCE: "AFR",
  AIRCANADA: "ACA",
  PHILIPPINE: "PAL",
  PHILIPPINEAIRLINES: "PAL",
  ELAL: "ELY",
  EMIRATES: "UAE",
  QATAR: "QTR",
  AMERICAN: "AAL",
  DELTA: "DAL",
  UNITED: "UAL",
  SOUTHWEST: "SWA",
  JETBLUE: "JBU",
  SPIRIT: "NKS",
  WIZZAIR: "WZZ",
  WIZZ: "WZZ",
  KLM: "KLM",
};

function globalMapPoint(worldX: number, worldZ: number) {
  return {
    x: MAP_XX * worldX + MAP_XZ * worldZ + MAP_X_OFFSET,
    y: MAP_YX * worldX + MAP_YZ * worldZ + MAP_Y_OFFSET,
  };
}

export function normalizeProjectFlightCallsign(raw: string) {
  const compact = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  for (const [telephony, icao] of Object.entries(TELEPHONY_TO_ICAO).sort((a, b) => b[0].length - a[0].length)) {
    if (compact.startsWith(telephony)) return `${icao}${compact.slice(telephony.length)}`;
  }
  return compact;
}

export function bearingToMapPoint(from: { x: number; y: number }, to: { x: number; y: number }) {
  const degrees = Math.atan2(to.x - from.x, -(to.y - from.y)) * 180 / Math.PI;
  return (degrees + 360) % 360;
}

export function mapDistanceNm(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y) / MAP_UNITS_PER_NM;
}

export function distanceToMapLegNm(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-9) return { distanceNm: mapDistanceNm(point, start), progress: 0 };
  const progress = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  const projected = {
    x: start.x + Math.max(0, Math.min(1, progress)) * dx,
    y: start.y + Math.max(0, Math.min(1, progress)) * dy,
  };
  return { distanceNm: mapDistanceNm(point, projected), progress };
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

function toTelemetry(raw: {
  id: string;
  rawCallsign: string;
  username: string;
  aircraftType: string;
  worldX: number;
  worldZ: number;
  altitude: number;
  heading: number;
  groundSpeed: number;
}): ProjectFlightTelemetry {
  const point = globalMapPoint(raw.worldX, raw.worldZ);
  return {
    ...raw,
    callsign: normalizeProjectFlightCallsign(raw.rawCallsign),
    aircraftType: aircraftCode(raw.aircraftType),
    mapX: point.x,
    mapY: point.y,
  };
}

function decodeBinary(bytes: Uint8Array): ProjectFlightTelemetry[] {
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
    return [toTelemetry({
      id: username || normalizeProjectFlightCallsign(rawCallsign),
      rawCallsign,
      username,
      aircraftType: type,
      worldX,
      worldZ,
      altitude: Number.isFinite(altitude) ? Math.max(0, altitude) : 0,
      heading: Number.isFinite(heading) ? ((heading % 360) + 360) % 360 : 0,
      groundSpeed: Number.isFinite(speed) ? Math.max(0, speed) : 0,
    })];
  });
}

function numberFrom(value: unknown, fallback = Number.NaN) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function decodeJson(value: unknown): ProjectFlightTelemetry[] {
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
    return [toTelemetry({
      id: String(item.id ?? username ?? rawCallsign),
      rawCallsign,
      username,
      aircraftType: String(item.aircraftType ?? item.aircraft ?? item.type ?? ""),
      worldX,
      worldZ,
      altitude: Math.max(0, numberFrom(item.altitude ?? item.alt, 0)),
      heading: ((numberFrom(item.heading ?? item.hdg, 0) % 360) + 360) % 360,
      groundSpeed: Math.max(0, numberFrom(item.speed ?? item.groundSpeed ?? item.gs, 0)),
    })];
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

export function connectProjectFlightTraffic({
  onTraffic,
  onState,
}: {
  onTraffic: (traffic: ProjectFlightTelemetry[]) => void;
  onState: (state: ProjectFlightConnectionState) => void;
}) {
  let stopped = false;
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (stopped || typeof window === "undefined") return;
    onState(socket ? "RECONNECTING" : "CONNECTING");
    const WebSocketCtor = window.__PF24_NATIVE_WEBSOCKET__ ?? window.WebSocket;
    socket = new WebSocketCtor(WS_URL);
    socket.binaryType = "arraybuffer";

    socket.onopen = () => onState("LIVE");
    socket.onmessage = (event) => {
      void decodeMessage(event.data).then((traffic) => {
        if (!stopped && traffic.length > 0) onTraffic(traffic);
      });
    };
    socket.onerror = () => {
      onState("RECONNECTING");
    };
    socket.onclose = () => {
      if (stopped) return;
      onState("RECONNECTING");
      reconnectTimer = setTimeout(connect, 3000);
    };
  };

  connect();

  return () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (socket && socket.readyState <= WebSocket.OPEN) socket.close();
    onState("OFFLINE");
  };
}
