"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { MAP_BOUNDS } from "@/lib/scope/mapData";
import { SCOPE_MAP_UNITS_PER_NM } from "@/lib/scope/distanceScale";

type Viewport = { zoom: number; panX: number; panY: number };
type RunwaySelection = { active?: boolean; dep?: boolean; arr?: boolean };
type RunwayState = Record<string, RunwaySelection>;
type Point = { x: number; y: number };
type RunwayGeometry = { threshold: Point; oppositeThreshold: Point };

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";
const RUNWAY_STORAGE_KEY = "pf24_scope_runways_v2";

const GLIDE_PATH_LENGTH_NM = 5;
const SHORT_TICK_HALF_NM = 0.45;
const LONG_TICK_HALF_NM = 0.96;
const END_ARM_FORWARD_NM = 1;
const END_ARM_SIDE_NM = 0.6;
const END_LEG_EXTENSION_NM = 1;
const GLIDE_STROKE = "#d2c09d";
const GLIDE_STROKE_WIDTH = 0.1;

// Exact geometry from the supplied SendaVerde.svg. The pointed end is placed
// on the active arrival runway threshold and the center of the outer edge is
// scaled to exactly 5 NM from that threshold.
const GREEN_SENDA_SVG = {
  width: 446.84378,
  height: 312.42633,
  tip: { x: 446.84379, y: 312.42632 },
  outerCenter: { x: 10.724985, y: 16.08748 },
} as const;

const RUNWAY_GEOMETRY: Record<string, Record<string, RunwayGeometry>> = {
  MDST: {
    "11": { threshold: { x: 67.19, y: 92.42 }, oppositeThreshold: { x: 69.56, y: 93.45 } },
    "29": { threshold: { x: 69.56, y: 93.45 }, oppositeThreshold: { x: 67.19, y: 92.42 } },
  },
  MDPC: {
    "08": { threshold: { x: 85.84, y: 102.23 }, oppositeThreshold: { x: 89.69, y: 101.89 } },
    "26": { threshold: { x: 89.69, y: 101.89 }, oppositeThreshold: { x: 85.84, y: 102.23 } },
    "09": { threshold: { x: 86.37, y: 102.93 }, oppositeThreshold: { x: 90.21, y: 103.34 } },
    "27": { threshold: { x: 90.21, y: 103.34 }, oppositeThreshold: { x: 86.37, y: 102.93 } },
  },
  MDAB: {
    "11": { threshold: { x: 80.82, y: 95.44 }, oppositeThreshold: { x: 82.26, y: 95.70 } },
    "29": { threshold: { x: 82.26, y: 95.70 }, oppositeThreshold: { x: 80.82, y: 95.44 } },
  },
  LEMH: {
    "19": { threshold: { x: 126.56, y: 64.82 }, oppositeThreshold: { x: 126.31, y: 66.76 } },
    "01": { threshold: { x: 126.31, y: 66.76 }, oppositeThreshold: { x: 126.56, y: 64.82 } },
  },
  GCLP: {
    "03L": { threshold: { x: 88.74, y: 71.37 }, oppositeThreshold: { x: 89.68, y: 69.42 } },
    "21R": { threshold: { x: 89.68, y: 69.42 }, oppositeThreshold: { x: 88.74, y: 71.37 } },
    "03R": { threshold: { x: 88.88, y: 71.44 }, oppositeThreshold: { x: 89.82, y: 69.49 } },
    "21L": { threshold: { x: 89.82, y: 69.49 }, oppositeThreshold: { x: 88.88, y: 71.44 } },
  },
  EGKK: {
    "08R": { threshold: { x: 126.87, y: 34.31 }, oppositeThreshold: { x: 130.33, y: 33.50 } },
    "26L": { threshold: { x: 130.33, y: 33.50 }, oppositeThreshold: { x: 126.87, y: 34.31 } },
  },
};

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

function readRunwayState(): RunwayState {
  try {
    const parsed = JSON.parse(localStorage.getItem(RUNWAY_STORAGE_KEY) ?? "{}") as RunwayState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function findRadar() {
  return document.querySelector<HTMLElement>("main.fixed > section");
}

function activeArrivalRunways(state: RunwayState) {
  const result: Array<{ airport: string; runway: string }> = [];
  for (const [key, selection] of Object.entries(state)) {
    if (!selection?.active || !selection.arr) continue;
    const match = key.match(/^([A-Z0-9]{4})-(.+)$/);
    if (!match) continue;
    const [, airport, runway] = match;
    if (RUNWAY_GEOMETRY[airport]?.[runway]) result.push({ airport, runway });
  }
  return result;
}

function greenSendaTransform(runway: RunwayGeometry) {
  const targetDx = runway.threshold.x - runway.oppositeThreshold.x;
  const targetDy = runway.threshold.y - runway.oppositeThreshold.y;
  const targetMagnitude = Math.hypot(targetDx, targetDy);
  if (!(targetMagnitude > 0)) return null;

  const ux = targetDx / targetMagnitude;
  const uy = targetDy / targetMagnitude;

  const sourceDx = GREEN_SENDA_SVG.outerCenter.x - GREEN_SENDA_SVG.tip.x;
  const sourceDy = GREEN_SENDA_SVG.outerCenter.y - GREEN_SENDA_SVG.tip.y;
  const sourceMagnitude = Math.hypot(sourceDx, sourceDy);
  const sourceUx = sourceDx / sourceMagnitude;
  const sourceUy = sourceDy / sourceMagnitude;

  const cos = sourceUx * ux + sourceUy * uy;
  const sin = sourceUx * uy - sourceUy * ux;
  const scale = (GLIDE_PATH_LENGTH_NM * SCOPE_MAP_UNITS_PER_NM) / sourceMagnitude;

  const a = scale * cos;
  const b = scale * sin;
  const c = -scale * sin;
  const d = scale * cos;
  const e = runway.threshold.x - a * GREEN_SENDA_SVG.tip.x - c * GREEN_SENDA_SVG.tip.y;
  const f = runway.threshold.y - b * GREEN_SENDA_SVG.tip.x - d * GREEN_SENDA_SVG.tip.y;

  return `matrix(${a} ${b} ${c} ${d} ${e} ${f})`;
}

function glideGeometry(runway: RunwayGeometry) {
  const dx = runway.threshold.x - runway.oppositeThreshold.x;
  const dy = runway.threshold.y - runway.oppositeThreshold.y;
  const magnitude = Math.hypot(dx, dy);
  if (!(magnitude > 0)) return null;

  const ux = dx / magnitude;
  const uy = dy / magnitude;
  const px = -uy;
  const py = ux;
  const nm = SCOPE_MAP_UNITS_PER_NM;

  const end = {
    x: runway.threshold.x + ux * GLIDE_PATH_LENGTH_NM * nm,
    y: runway.threshold.y + uy * GLIDE_PATH_LENGTH_NM * nm,
  };

  const ticks = Array.from({ length: GLIDE_PATH_LENGTH_NM }, (_, index) => {
    const mile = index + 1;
    const center = {
      x: runway.threshold.x + ux * mile * nm,
      y: runway.threshold.y + uy * mile * nm,
    };
    const halfNm = mile === 3 ? LONG_TICK_HALF_NM : SHORT_TICK_HALF_NM;
    const half = halfNm * nm;
    return {
      x1: center.x + px * half,
      y1: center.y + py * half,
      x2: center.x - px * half,
      y2: center.y - py * half,
    };
  });

  const armForward = END_ARM_FORWARD_NM * nm;
  const armSide = END_ARM_SIDE_NM * nm;
  const leftArm = {
    x1: end.x,
    y1: end.y,
    x2: end.x + ux * armForward + px * armSide,
    y2: end.y + uy * armForward + py * armSide,
  };
  const rightArm = {
    x1: end.x,
    y1: end.y,
    x2: end.x + ux * armForward - px * armSide,
    y2: end.y + uy * armForward - py * armSide,
  };

  const legExtension = END_LEG_EXTENSION_NM * nm;
  const legs = [
    {
      x1: leftArm.x2,
      y1: leftArm.y2,
      x2: leftArm.x2 + px * legExtension,
      y2: leftArm.y2 + py * legExtension,
    },
    {
      x1: rightArm.x2,
      y1: rightArm.y2,
      x2: rightArm.x2 - px * legExtension,
      y2: rightArm.y2 - py * legExtension,
    },
  ];

  return { end, ticks, arms: [leftArm, rightArm], legs };
}

export default function ScopeGlidePath() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 });
  const [runwayState, setRunwayState] = useState<RunwayState>({});

  useEffect(() => {
    setViewport(readViewport());
    const initialRunways = readRunwayState();
    setRunwayState(initialRunways);
    let lastSerialized = JSON.stringify(initialRunways);

    const onViewport = (event: Event) => {
      const detail = (event as CustomEvent<Viewport>).detail;
      if (detail) setViewport(detail);
    };
    const syncRunways = () => {
      const next = readRunwayState();
      const serialized = JSON.stringify(next);
      if (serialized === lastSerialized) return;
      lastSerialized = serialized;
      setRunwayState(next);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === RUNWAY_STORAGE_KEY) syncRunways();
    };
    const onScopeClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("main.fixed button")) return;
      // Runway changes are written to localStorage by PF24Scope after the React
      // commit. Recheck after the interaction instead of parsing storage every
      // 150 ms for the entire lifetime of the scope. The short second check
      // covers browsers that defer passive effects beyond the first task.
      window.setTimeout(syncRunways, 0);
      window.setTimeout(syncRunways, 80);
    };

    window.addEventListener(VIEWPORT_EVENT, onViewport);
    window.addEventListener("storage", onStorage);
    document.addEventListener("click", onScopeClick, true);
    return () => {
      window.removeEventListener(VIEWPORT_EVENT, onViewport);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("click", onScopeClick, true);
    };
  }, []);

  useEffect(() => {
    let attempts = 0;
    const locate = () => {
      const radar = findRadar();
      if (radar) {
        setHost(radar);
        window.clearInterval(timer);
      }
      attempts += 1;
      if (attempts >= 30) window.clearInterval(timer);
    };
    const timer = window.setInterval(locate, 150);
    locate();
    return () => window.clearInterval(timer);
  }, []);

  const viewBox = useMemo(() => {
    const width = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
    const height = MAP_BOUNDS.maxY - MAP_BOUNDS.minY;
    return `${MAP_BOUNDS.minX} ${MAP_BOUNDS.minY} ${width} ${height}`;
  }, []);

  const activeRunways = useMemo(() => activeArrivalRunways(runwayState), [runwayState]);
  if (!host || activeRunways.length === 0) return null;

  return createPortal(
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" data-pf24-glide-path="true" aria-hidden="true">
      <svg
        className="absolute inset-0 block h-full w-full"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{ transformOrigin: "0 0", transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})` }}
      >
        <g data-map-layer="active-runway-glide-paths">
          {activeRunways.map(({ airport, runway }) => {
            const definition = RUNWAY_GEOMETRY[airport]?.[runway];
            const geometry = definition ? glideGeometry(definition) : null;
            const greenTransform = definition ? greenSendaTransform(definition) : null;
            if (!definition || !geometry) return null;
            return (
              <g key={`${airport}-${runway}`} data-airport={airport} data-runway={runway}>
                {greenTransform ? (
                  <image
                    href="/scope/senda-verde.svg"
                    x={0}
                    y={0}
                    width={GREEN_SENDA_SVG.width}
                    height={GREEN_SENDA_SVG.height}
                    transform={greenTransform}
                    preserveAspectRatio="none"
                  />
                ) : null}
                <line
                  x1={definition.threshold.x}
                  y1={definition.threshold.y}
                  x2={geometry.end.x}
                  y2={geometry.end.y}
                  fill="none"
                  stroke={GLIDE_STROKE}
                  strokeWidth={GLIDE_STROKE_WIDTH}
                  vectorEffect="non-scaling-stroke"
                />
                {geometry.ticks.map((tick, index) => (
                  <line
                    key={`tick-${index}`}
                    x1={tick.x1}
                    y1={tick.y1}
                    x2={tick.x2}
                    y2={tick.y2}
                    fill="none"
                    stroke={GLIDE_STROKE}
                    strokeWidth={GLIDE_STROKE_WIDTH}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {geometry.arms.map((arm, index) => (
                  <line
                    key={`arm-${index}`}
                    x1={arm.x1}
                    y1={arm.y1}
                    x2={arm.x2}
                    y2={arm.y2}
                    fill="none"
                    stroke={GLIDE_STROKE}
                    strokeWidth={GLIDE_STROKE_WIDTH}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {geometry.legs.map((leg, index) => (
                  <line
                    key={`leg-${index}`}
                    x1={leg.x1}
                    y1={leg.y1}
                    x2={leg.x2}
                    y2={leg.y2}
                    fill="none"
                    stroke={GLIDE_STROKE}
                    strokeWidth={GLIDE_STROKE_WIDTH}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </g>
            );
          })}
        </g>
      </svg>
    </div>,
    host,
  );
}
