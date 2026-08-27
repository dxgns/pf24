import {
  bearingToMapPoint,
  distanceToMapLegNm,
  mapDistanceNm,
} from "@/lib/pfpilot/projectFlightLive";

export type LateralPoint = { x: number; y: number };

type LateralGuidanceInput = {
  position: LateralPoint;
  target: LateralPoint;
  next?: LateralPoint | null;
  inboundStart?: LateralPoint | null;
  groundSpeedKnots: number;
  publishedInboundCourse?: number | null;
  publishedOutboundCourse?: number | null;
  maxInterceptDegrees?: number;
};

type TurnGeometryInput = Pick<
  LateralGuidanceInput,
  "position" | "target" | "next" | "inboundStart" | "groundSpeedKnots" | "publishedInboundCourse" | "publishedOutboundCourse"
>;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalize360(value: number) {
  return ((value % 360) + 360) % 360;
}

function signedAngleDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

function smoothstep(value: number) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function bankAngleForSpeed(speedKnots: number) {
  const speed = Math.max(0, speedKnots);
  if (speed < 140) return 18;
  if (speed < 180) return 20;
  if (speed < 230) return 23;
  return 25;
}

function turnRadiusNm(speedKnots: number) {
  const speedMps = Math.max(60, speedKnots) * 0.514444;
  const bankRadians = bankAngleForSpeed(speedKnots) * Math.PI / 180;
  const radiusMeters = (speedMps * speedMps) / (9.80665 * Math.tan(bankRadians));
  return radiusMeters / 1852;
}

function signedCrossTrackNm(point: LateralPoint, start: LateralPoint, end: LateralPoint) {
  // Convert PF24 map coordinates to a conventional east/north frame. PF24 y
  // grows southward, so north is -y.
  const legEast = end.x - start.x;
  const legNorth = -(end.y - start.y);
  const relEast = point.x - start.x;
  const relNorth = -(point.y - start.y);
  const length = Math.hypot(legEast, legNorth);
  if (length <= 1e-9) return 0;

  const signedMapUnits = (legEast * relNorth - legNorth * relEast) / length;
  const oneNmMapUnits = mapDistanceNm({ x: 0, y: 0 }, { x: 1, y: 0 });
  if (oneNmMapUnits <= 1e-9) return 0;
  return signedMapUnits * oneNmMapUnits;
}

function nominalInboundCourse(input: TurnGeometryInput) {
  if (typeof input.publishedInboundCourse === "number") return normalize360(input.publishedInboundCourse);
  if (input.inboundStart) return bearingToMapPoint(input.inboundStart, input.target);
  return bearingToMapPoint(input.position, input.target);
}

function nominalOutboundCourse(input: TurnGeometryInput) {
  if (!input.next) return null;
  if (typeof input.publishedOutboundCourse === "number") return normalize360(input.publishedOutboundCourse);
  return bearingToMapPoint(input.target, input.next);
}

function turnGeometry(input: TurnGeometryInput) {
  if (!input.next) return null;

  const inboundCourse = nominalInboundCourse(input);
  const outboundCourse = nominalOutboundCourse(input);
  if (outboundCourse === null) return null;

  const signedTurn = signedAngleDelta(inboundCourse, outboundCourse);
  const turnAngle = Math.abs(signedTurn);
  if (turnAngle < 5) return null;

  const radiusNm = turnRadiusNm(input.groundSpeedKnots);
  // Very large course reversals would otherwise create an unrealistic lead
  // distance. They still receive anticipation, but the geometry is capped to a
  // transport-aircraft-sized fly-by rather than cutting miles off the route.
  const geometryAngle = Math.min(turnAngle, 140);
  let leadNm = radiusNm * Math.tan((geometryAngle / 2) * Math.PI / 180);

  const outboundLengthNm = mapDistanceNm(input.target, input.next);
  let maxLeadNm = Math.min(5, Math.max(0.2, outboundLengthNm * 0.45));
  if (input.inboundStart) {
    const inboundLengthNm = mapDistanceNm(input.inboundStart, input.target);
    maxLeadNm = Math.min(maxLeadNm, Math.max(0.2, inboundLengthNm * 0.45));
  }
  leadNm = clamp(leadNm, 0.12, Math.max(0.12, maxLeadNm));

  return {
    inboundCourse,
    outboundCourse,
    signedTurn,
    turnAngle,
    radiusNm,
    leadNm,
    outboundLengthNm,
  };
}

function interceptHeading(input: LateralGuidanceInput) {
  const direct = bearingToMapPoint(input.position, input.target);
  if (!input.inboundStart) return direct;

  const leg = distanceToMapLegNm(input.position, input.inboundStart, input.target);
  if (leg.progress < -0.15 || leg.progress > 1.05) return direct;

  const course = typeof input.publishedInboundCourse === "number"
    ? normalize360(input.publishedInboundCourse)
    : bearingToMapPoint(input.inboundStart, input.target);
  const crossTrackNm = signedCrossTrackNm(input.position, input.inboundStart, input.target);
  const lookAheadNm = clamp(Math.max(1.2, input.groundSpeedKnots / 95), 1.2, 4.5);
  const correction = clamp(
    Math.atan2(crossTrackNm, lookAheadNm) * 180 / Math.PI,
    -(input.maxInterceptDegrees ?? 30),
    input.maxInterceptDegrees ?? 30,
  );

  // Positive cross-track means the aircraft is left of course; adding heading
  // turns right toward the published leg. Negative does the reciprocal.
  return normalize360(course + correction);
}

export function computeLateralGuidance(input: LateralGuidanceInput) {
  const baseHeading = interceptHeading(input);
  const geometry = turnGeometry(input);
  if (!geometry || !input.next) return baseHeading;

  const distanceToFixNm = mapDistanceNm(input.position, input.target);
  if (distanceToFixNm > geometry.leadNm) return baseHeading;

  // If the aircraft is materially displaced from the inbound path, regain the
  // route first. Turn anticipation must not reward a shortcut from well off leg.
  if (input.inboundStart) {
    const leg = distanceToMapLegNm(input.position, input.inboundStart, input.target);
    const regainThresholdNm = Math.max(1.5, geometry.leadNm * 0.9);
    if (leg.distanceNm > regainThresholdNm) return baseHeading;
  }

  const turnProgress = smoothstep((geometry.leadNm - distanceToFixNm) / Math.max(0.1, geometry.leadNm));
  const aheadNm = Math.min(
    geometry.outboundLengthNm * 0.45,
    Math.max(0.35, geometry.radiusNm * (0.8 + geometry.turnAngle / 140)),
  );
  const fraction = geometry.outboundLengthNm > 0.01
    ? clamp((aheadNm / geometry.outboundLengthNm) * turnProgress, 0, 0.45)
    : 0;
  const aimPoint = {
    x: input.target.x + (input.next.x - input.target.x) * fraction,
    y: input.target.y + (input.next.y - input.target.y) * fraction,
  };

  return bearingToMapPoint(input.position, aimPoint);
}

export function dynamicWaypointPassToleranceNm(
  baseToleranceNm: number,
  input: TurnGeometryInput,
) {
  const geometry = turnGeometry(input);
  if (!geometry) return baseToleranceNm;

  // A real fly-by does not cross the waypoint coordinate. The acceptance radius
  // therefore grows with the speed-derived turn lead, while guidance itself
  // continues to target/intercept the exact published route.
  return Math.max(
    baseToleranceNm,
    Math.min(baseToleranceNm * 2.5, geometry.leadNm * 0.9),
  );
}
