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
  turnLeadExtraNm?: number;
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
  // Large reversals are capped so the fly-by lead never cuts several miles off
  // the route. Procedure-specific reversals/holds should keep their own logic.
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

function courseInterceptHeading({
  position,
  start,
  end,
  course,
  groundSpeedKnots,
  maxInterceptDegrees,
}: {
  position: LateralPoint;
  start: LateralPoint;
  end: LateralPoint;
  course: number;
  groundSpeedKnots: number;
  maxInterceptDegrees: number;
}) {
  const crossTrackNm = signedCrossTrackNm(position, start, end);
  const lookAheadNm = clamp(Math.max(1.2, groundSpeedKnots / 95), 1.2, 4.5);
  const correction = clamp(
    Math.atan2(crossTrackNm, lookAheadNm) * 180 / Math.PI,
    -maxInterceptDegrees,
    maxInterceptDegrees,
  );
  return normalize360(course + correction);
}

function interceptHeading(input: LateralGuidanceInput) {
  const direct = bearingToMapPoint(input.position, input.target);
  if (!input.inboundStart) return direct;

  const leg = distanceToMapLegNm(input.position, input.inboundStart, input.target);
  if (leg.progress < -0.15 || leg.progress > 1.05) return direct;

  const course = typeof input.publishedInboundCourse === "number"
    ? normalize360(input.publishedInboundCourse)
    : bearingToMapPoint(input.inboundStart, input.target);

  return courseInterceptHeading({
    position: input.position,
    start: input.inboundStart,
    end: input.target,
    course,
    groundSpeedKnots: input.groundSpeedKnots,
    maxInterceptDegrees: input.maxInterceptDegrees ?? 30,
  });
}

function outboundRecoveryHeading(input: LateralGuidanceInput) {
  if (!input.next) return null;
  const course = nominalOutboundCourse(input);
  if (course === null) return null;

  return courseInterceptHeading({
    position: input.position,
    start: input.target,
    end: input.next,
    course,
    groundSpeedKnots: input.groundSpeedKnots,
    maxInterceptDegrees: input.maxInterceptDegrees ?? 30,
  });
}

function remainingInboundNm(input: LateralGuidanceInput) {
  if (!input.inboundStart) return mapDistanceNm(input.position, input.target);

  const leg = distanceToMapLegNm(input.position, input.inboundStart, input.target);
  if (leg.progress < -0.2 || leg.progress > 1.2) return mapDistanceNm(input.position, input.target);

  const inboundLengthNm = mapDistanceNm(input.inboundStart, input.target);
  return Math.max(0, inboundLengthNm * (1 - leg.progress));
}

export function computeLateralGuidance(input: LateralGuidanceInput) {
  // Once the aircraft has crossed the abeam plane of the active waypoint, never
  // command a turn back toward that old waypoint. Recover the outbound published
  // leg instead. This also covers the short render/state window before the
  // waypoint sequencer advances to the next fix.
  if (input.inboundStart && input.next) {
    const inboundLeg = distanceToMapLegNm(input.position, input.inboundStart, input.target);
    if (inboundLeg.progress > 1.0) {
      const recovery = outboundRecoveryHeading(input);
      if (recovery !== null) return recovery;
    }
  }

  const baseHeading = interceptHeading(input);
  const geometry = turnGeometry(input);
  if (!geometry || !input.next) return baseHeading;

  // Use along-track distance to the leg intersection whenever possible. Radial
  // distance to the fix delays a turn when the aircraft is a little off the
  // inbound centerline, which is exactly what caused late localizer captures.
  const remainingNm = remainingInboundNm(input);

  // Tangent lead is the physical turn requirement. Add only a short roll-in /
  // command-response allowance; unlike the previous progressive-heading model,
  // the director now commands the outbound heading immediately once this point
  // is reached, so a large artificial extra lead is neither needed nor desirable.
  const rollInSeconds = clamp(2.5 + geometry.turnAngle / 90, 2.5, 4.0);
  const rollInLeadNm = clamp(
    Math.max(0, input.groundSpeedKnots) * rollInSeconds / 3600,
    0.08,
    0.3,
  );
  const commandLeadNm = Math.min(
    5.25,
    geometry.leadNm + rollInLeadNm + clamp(input.turnLeadExtraNm ?? 0, 0, 1.0),
  );
  if (remainingNm > commandLeadNm) return baseHeading;

  // If materially displaced from the inbound leg, recover it first instead of
  // using turn anticipation as a shortcut from well outside the procedure.
  if (input.inboundStart) {
    const leg = distanceToMapLegNm(input.position, input.inboundStart, input.target);
    const regainThresholdNm = Math.max(1.25, commandLeadNm * 0.8);
    if (leg.distanceNm > regainThresholdNm) return baseHeading;
  }

  // Once the speed-derived anticipation point is reached, give the pilot/AP the
  // actual heading required for the next leg immediately. The aircraft's own
  // turn dynamics create the curved fly-by path. After sequencing, normal
  // cross-track logic applies only the small corrections needed to capture and
  // hold the outbound course/localizer.
  return geometry.outboundCourse;
}

export function dynamicWaypointPassToleranceNm(
  baseToleranceNm: number,
  input: TurnGeometryInput,
) {
  const geometry = turnGeometry(input);
  let tolerance = geometry
    ? Math.max(
        baseToleranceNm,
        Math.min(baseToleranceNm * 2.5, geometry.leadNm * 0.9),
      )
    : baseToleranceNm;

  // If the aircraft has already crossed the waypoint abeam plane, allow the
  // sequencer to accept the closest fly-by even when turn dynamics carried it a
  // little outside the normal radius. Without this recovery, the target could
  // remain stuck on the old fix and eventually command a turn backwards.
  if (input.inboundStart) {
    const inboundLeg = distanceToMapLegNm(input.position, input.inboundStart, input.target);
    if (inboundLeg.progress > 1.0) {
      const crossTrackNm = Math.abs(signedCrossTrackNm(input.position, input.inboundStart, input.target));
      const recoveryCapNm = clamp(baseToleranceNm * 6, 1.5, 6);
      if (crossTrackNm <= recoveryCapNm) {
        tolerance = Math.max(
          tolerance,
          Math.min(recoveryCapNm, crossTrackNm + 0.25),
        );
      }
    }
  }

  return tolerance;
}
