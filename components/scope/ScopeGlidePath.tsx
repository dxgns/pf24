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
// Proportions taken from the supplied SendaPlaneo.svg: the threshold and 5 NM
// bars are roughly twice as long as the intermediate mile marks.
const SHORT_TICK_HALF_NM = 0.45;
const LONG_TICK_HALF_NM = 0.96;
const GLIDE_STROKE = "#d2c09d";
const GLIDE_STROKE_WIDTH = 0.1;

// Runway thresholds calibrated in the PF24 Scope coordinate frame.
const RUNWAY_GEOMETRY: Record<string, Record<string, RunwayGeometry>> = {
  MDST: {
    "11": {
      threshold: { x: 67.19, y: 92.42 },
      oppositeThreshold: { x: 69.56, y: 93.45 },
    },
    "29": {
      threshold: { x: 69.56, y: 93.45 },
      oppositeThreshold: { x: 67.19, y: 92.42 },
    },
  },
  MDPC: {
    "08": {
      threshold: { x: 85.84, y: 102.23 },
      oppositeThreshold: { x: 89.69, y: 101.89 },
    },
    "26": {
      threshold: { x: 89.69, y: 101.89 },
      oppositeThreshold: { x: 85.84, y: 102.23 },
    },
    "09": {
      threshold: { x: 86.37, y: 102.93 },
      oppositeThreshold: { x: 90.21, y: 103.34 },
    },
    "27": {
      threshold: { x: 90.21, y: 103.34 },
      oppositeThreshold: { x: 86.37, y: 102.93 },
    },
  },
  MDAB: {
    "11": {
      threshold: { x: 80.82, y: 95.44 },
      oppositeThreshold: { x: 82.26, y: 95.70 },
    },
    "29": {
      threshold: { x: 82.26, y: 95.70 },
      oppositeThreshold: { x: 80.82, y: 95.44 },
    },
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

function glideGeometry(runway: RunwayGeometry) {
  const dx = runway.threshold.x - runway.oppositeThreshold.x;
  const dy = runway.threshold.y - runway.oppositeThreshold.y;
  const magnitude = Math.hypot(dx, dy);
  if (!(magnitude > 0)) return null;

  const ux = dx / magnitude;
  const uy = dy / magnitude;
  const px = -uy;
  const py = ux;
  const length = GLIDE_PATH_LENGTH_NM * SCOPE_MAP_UNITS_PER_NM;
  const end = {
    x: runway.threshold.x + ux * length,
    y: runway.threshold.y + uy * length,
  };

  // Match the supplied SVG pattern: long bar at the runway threshold, four
  // shorter 1 NM bars, then another long bar at the 5 NM end point.
  const ticks = Array.from({ length: GLIDE_PATH_LENGTH_NM + 1 }, (_, index) => {
    const distance = index * SCOPE_MAP_UNITS_PER_NM;
    const center = {
      x: runway.threshold.x + ux * distance,
      y: runway.threshold.y + uy * distance,
    };
    const halfLengthNm =
      index === 0 || index === GLIDE_PATH_LENGTH_NM
        ? LONG_TICK_HALF_NM
        : SHORT_TICK_HALF_NM;
    const tickHalf = halfLengthNm * SCOPE_MAP_UNITS_PER_NM;

    return {
      x1: center.x + px * tickHalf,
      y1: center.y + py * tickHalf,
      x2: center.x - px * tickHalf,
      y2: center.y - py * tickHalf,
    };
  });

  return { end, ticks };
}

export default function ScopeGlidePath() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 });
  const [runwayState, setRunwayState] = useState<RunwayState>({});

  useEffect(() => {
    setViewport(readViewport());
    setRunwayState(readRunwayState());

    const onViewport = (event: Event) => {
      const detail = (event as CustomEvent<Viewport>).detail;
      if (detail) setViewport(detail);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === RUNWAY_STORAGE_KEY) setRunwayState(readRunwayState());
    };

    // PF24Scope writes the runway selector state to localStorage in this same tab,
    // so the native storage event does not fire here. Poll lightly to mirror changes
    // from the Runway selector dialog immediately.
    let lastSerialized = JSON.stringify(readRunwayState());
    const runwayTimer = window.setInterval(() => {
      const next = readRunwayState();
      const serialized = JSON.stringify(next);
      if (serialized === lastSerialized) return;
      lastSerialized = serialized;
      setRunwayState(next);
    }, 150);

    window.addEventListener(VIEWPORT_EVENT, onViewport);
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(runwayTimer);
      window.removeEventListener(VIEWPORT_EVENT, onViewport);
      window.removeEventListener("storage", onStorage);
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
    <div className="pointer-events-none absolute inset-0 z-[7] overflow-hidden" data-pf24-glide-path="true" aria-hidden="true">
      <svg
        className="absolute inset-0 block h-full w-full"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{
          transformOrigin: "0 0",
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
        }}
      >
        <g data-map-layer="active-runway-glide-paths">
          {activeRunways.map(({ airport, runway }) => {
            const definition = RUNWAY_GEOMETRY[airport]?.[runway];
            const geometry = definition ? glideGeometry(definition) : null;
            if (!definition || !geometry) return null;
            return (
              <g key={`${airport}-${runway}`} data-airport={airport} data-runway={runway}>
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
                    key={index}
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
              </g>
            );
          })}
        </g>
      </svg>
    </div>,
    host,
  );
}
