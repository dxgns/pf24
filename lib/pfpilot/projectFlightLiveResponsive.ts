import {
  MAP_UNITS_PER_NM,
  bearingToMapPoint,
  connectProjectFlightTraffic as connectBaseProjectFlightTraffic,
  distanceToMapLegNm,
  mapDistanceNm,
  normalizeProjectFlightCallsign,
  type ProjectFlightConnectionState,
  type ProjectFlightTelemetry,
} from "./projectFlightLive";

export {
  MAP_UNITS_PER_NM,
  bearingToMapPoint,
  distanceToMapLegNm,
  mapDistanceNm,
  normalizeProjectFlightCallsign,
};
export type { ProjectFlightConnectionState, ProjectFlightTelemetry };

type TimedSample = {
  telemetry: ProjectFlightTelemetry;
  receivedAt: number;
};

type SampleHistory = {
  previous: TimedSample | null;
  latest: TimedSample;
};

const PREDICTION_INTERVAL_MS = 200;
const PREDICTION_MAX_MS = 2200;
const TARGET_STALE_MS = 7000;
const ANY_TRAFFIC_STALE_MS = 18000;
const WATCHDOG_INTERVAL_MS = 500;
const MANAGED_RECONNECT_DELAY_MS = 450;
const MANAGED_RECONNECT_GRACE_MS = 5000;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeHeading(value: number) {
  return ((value % 360) + 360) % 360;
}

function headingDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

function normalizedUsername(value: string) {
  return value.trim().replace(/^@/, "").toLowerCase();
}

function configuredTargetUsername() {
  if (typeof document === "undefined") return "";
  return normalizedUsername(
    document
      .querySelector<HTMLElement>("main[data-pf24-roblox-username]")
      ?.dataset.pf24RobloxUsername ?? "",
  );
}

function telemetryKey(item: ProjectFlightTelemetry) {
  return item.id || item.username || item.callsign || item.rawCallsign;
}

function projectedTelemetry(history: SampleHistory, now: number) {
  const { latest, previous } = history;
  const ageMs = Math.max(0, now - latest.receivedAt);
  if (ageMs < PREDICTION_INTERVAL_MS || ageMs > PREDICTION_MAX_MS) return null;

  const ageSeconds = ageMs / 1000;
  let turnRate = 0;
  let verticalRate = 0;
  let acceleration = 0;

  if (previous) {
    const sampleSeconds = Math.max(0.15, (latest.receivedAt - previous.receivedAt) / 1000);
    turnRate = clamp(
      headingDelta(previous.telemetry.heading, latest.telemetry.heading) / sampleSeconds,
      -6,
      6,
    );
    verticalRate = clamp(
      (latest.telemetry.altitude - previous.telemetry.altitude) / sampleSeconds,
      -100,
      100,
    );
    acceleration = clamp(
      (latest.telemetry.groundSpeed - previous.telemetry.groundSpeed) / sampleSeconds,
      -8,
      8,
    );
  }

  const predictedHeading = normalizeHeading(latest.telemetry.heading + turnRate * ageSeconds);
  const predictedSpeed = Math.max(0, latest.telemetry.groundSpeed + acceleration * ageSeconds);
  const predictedAltitude = Math.max(0, latest.telemetry.altitude + verticalRate * ageSeconds);
  const travelHeading = normalizeHeading(latest.telemetry.heading + turnRate * ageSeconds * 0.5);
  const averageSpeed = Math.max(0, (latest.telemetry.groundSpeed + predictedSpeed) * 0.5);
  const distanceNm = averageSpeed * ageSeconds / 3600;
  const distanceMap = distanceNm * MAP_UNITS_PER_NM;
  const radians = travelHeading * Math.PI / 180;

  return {
    ...latest.telemetry,
    mapX: latest.telemetry.mapX + Math.sin(radians) * distanceMap,
    mapY: latest.telemetry.mapY - Math.cos(radians) * distanceMap,
    heading: predictedHeading,
    altitude: predictedAltitude,
    groundSpeed: predictedSpeed,
  } satisfies ProjectFlightTelemetry;
}

export function connectProjectFlightTraffic({
  onTraffic,
  onState,
}: {
  onTraffic: (traffic: ProjectFlightTelemetry[]) => void;
  onState: (state: ProjectFlightConnectionState) => void;
}) {
  let stopped = false;
  let baseStop: (() => void) | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let predictorTimer: ReturnType<typeof setInterval> | null = null;
  let watchdogTimer: ReturnType<typeof setInterval> | null = null;
  let managedRestart = false;
  let restartGraceUntil = 0;
  let baseCycleStartedAt = Date.now();
  let lastAnyRealAt = 0;
  let lastTargetRealAt = 0;
  let everReceivedRealTraffic = false;
  let everReceivedTarget = false;
  let targetCallsign = "";
  let targetKey = "";

  const targetUsername = configuredTargetUsername();
  const histories = new Map<string, SampleHistory>();

  const matchesTarget = (item: ProjectFlightTelemetry) => {
    if (targetUsername && normalizedUsername(item.username) === targetUsername) return true;
    if (!targetCallsign) return false;
    return normalizeProjectFlightCallsign(item.rawCallsign || item.callsign) === targetCallsign;
  };

  const handleRealTraffic = (traffic: ProjectFlightTelemetry[]) => {
    const now = Date.now();
    everReceivedRealTraffic = true;
    lastAnyRealAt = now;

    for (const item of traffic) {
      const key = telemetryKey(item);
      if (!key) continue;
      const existing = histories.get(key);
      histories.set(key, {
        previous: existing?.latest ?? null,
        latest: { telemetry: item, receivedAt: now },
      });

      if (matchesTarget(item)) {
        targetKey = key;
        targetCallsign = normalizeProjectFlightCallsign(item.rawCallsign || item.callsign);
        everReceivedTarget = true;
        lastTargetRealAt = now;
      }
    }

    onTraffic(traffic);
  };

  const handleState = (state: ProjectFlightConnectionState) => {
    if (managedRestart && state === "OFFLINE") return;
    onState(state);
  };

  const startBase = () => {
    if (stopped) return;
    baseCycleStartedAt = Date.now();
    baseStop = connectBaseProjectFlightTraffic({
      onTraffic: handleRealTraffic,
      onState: handleState,
    });
  };

  const managedReconnect = (reason: string) => {
    const now = Date.now();
    if (stopped || reconnectTimer || now < restartGraceUntil) return;

    console.warn(`PF24 PFPilot telemetry ${reason}; refreshing Project Flight stream.`);
    managedRestart = true;
    restartGraceUntil = now + MANAGED_RECONNECT_GRACE_MS;
    onState("RECONNECTING");

    const stop = baseStop;
    baseStop = null;
    if (stop) stop();

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      managedRestart = false;
      startBase();
    }, MANAGED_RECONNECT_DELAY_MS);
  };

  startBase();

  predictorTimer = setInterval(() => {
    if (stopped || !targetKey) return;
    const history = histories.get(targetKey);
    if (!history) return;
    const predicted = projectedTelemetry(history, Date.now());
    if (predicted) onTraffic([predicted]);
  }, PREDICTION_INTERVAL_MS);

  watchdogTimer = setInterval(() => {
    if (stopped) return;
    const now = Date.now();

    if (everReceivedTarget) {
      const lastUsefulTargetAt = Math.max(lastTargetRealAt, baseCycleStartedAt);
      if (now - lastUsefulTargetAt > TARGET_STALE_MS) {
        managedReconnect("target became stale");
        return;
      }
    }

    if (everReceivedRealTraffic) {
      const lastUsefulTrafficAt = Math.max(lastAnyRealAt, baseCycleStartedAt);
      if (now - lastUsefulTrafficAt > ANY_TRAFFIC_STALE_MS) {
        managedReconnect("feed became stale");
      }
    }
  }, WATCHDOG_INTERVAL_MS);

  return () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (predictorTimer) clearInterval(predictorTimer);
    if (watchdogTimer) clearInterval(watchdogTimer);
    reconnectTimer = null;
    predictorTimer = null;
    watchdogTimer = null;

    const stop = baseStop;
    baseStop = null;
    if (stop) stop();
    else onState("OFFLINE");
  };
}
