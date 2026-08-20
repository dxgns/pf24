const PROJECT_FLIGHT_WS_PREFIX = "wss://v3api.project-flight.com/v3/traffic/server/ws/";

// Least-squares calibration from three known MDPC stands:
// B30, stand 1 and stand 11. Project Flight raw world coordinates are
// converted to the PFTracker/map coordinate system used by the scope.
//
// The existing traffic renderer still performs its legacy normalization, so
// this shim converts raw Project Flight coordinates into equivalent legacy
// raw coordinates that produce the calibrated map position.
const RAW_X_SCALE = 1.3268978198850463;
const RAW_X_OFFSET = 13750.64550675433;
const RAW_Z_SCALE = 2.7869921152199466;
const RAW_Z_OFFSET = -30997.326394190197;

type NativeWebSocketCtor = typeof WebSocket;

declare global {
  interface Window {
    __PF24_NATIVE_WEBSOCKET__?: NativeWebSocketCtor;
    __PF24_TRAFFIC_CALIBRATION_SHIM__?: boolean;
  }
}

function calibratedX(value: number) {
  return value * RAW_X_SCALE + RAW_X_OFFSET;
}

function calibratedZ(value: number) {
  return value * RAW_Z_SCALE + RAW_Z_OFFSET;
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
      view.setFloat64(xField.dataStart, calibratedX(x), true);
      view.setFloat64(zField.dataStart, calibratedZ(z), true);
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
    item[xKey] = calibratedX(Number(item[xKey]));
    item[zKey] = calibratedZ(Number(item[zKey]));
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
