"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { MAP_BOUNDS } from "@/lib/scope/mapData";
import { SCOPE_MAP_UNITS_PER_NM } from "@/lib/scope/distanceScale";

type Viewport = { zoom: number; panX: number; panY: number };
type AirportConfig = { active?: boolean; dep?: string; arr?: string; approach?: string; remarks?: string };
type ConfigMap = Record<string, AirportConfig>;
type Point = { x: number; y: number };
type RunwayGeometry = { threshold: Point; oppositeThreshold: Point };

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";
const ATIS_STORAGE_KEY = "pf24_scope_atis_configs_v1";
const ATIS_CONFIG_EVENT = "pf24-atis-config-sync";

const GLIDE_PATH_LENGTH_NM = 5;
const TICK_HALF_LENGTH_NM = 0.5;
const GLIDE_STROKE = "#d2c09d";
const GLIDE_STROKE_WIDTH = 0.1;

// Precise runway threshold geometry already calibrated in the PF24 Scope coordinate frame.
// MDST thresholds come from the calibrated RWY 11/29 SVG centerline.
// MDPC thresholds use the existing Scope runway coordinates.
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

function readConfigs(): ConfigMap {
  try {
    const parsed = JSON.parse(localStorage.getItem(ATIS_STORAGE_KEY) ?? "{}") as ConfigMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function findRadar() {
  return document.querySelector<HTMLElement>("main.fixed > section");
}

function activeArrivalRunways(configs: ConfigMap) {
  const result: Array<{ airport: string; runway: string }> = [];
  for (const [airport, config] of Object.entries(configs)) {
    if (!config?.active || !config.arr) continue;
    for (const runway of config.arr.split("/").map((value) => value.trim()).filter(Boolean)) {
      if (RUNWAY_GEOMETRY[airport]?.[runway]) result.push({ airport, runway });
    }
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
  const tickHalf = TICK_HALF_LENGTH_NM * SCOPE_MAP_UNITS_PER_NM;
  const end = {
    x: runway.threshold.x + ux * length,
    y: runway.threshold.y + uy * length,
  };

  const ticks = Array.from({ length: GLIDE_PATH_LENGTH_NM }, (_, index) => {
    const distance = (index + 1) * SCOPE_MAP_UNITS_PER_NM;
    const center = {
      x: runway.threshold.x + ux * distance,
      y: runway.threshold.y + uy * distance,
    };
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
  const [configs, setConfigs] = useState<ConfigMap>({});

  useEffect(() => {
    setViewport(readViewport());
    setConfigs(readConfigs());

    const onViewport = (event: Event) => {
      const detail = (event as CustomEvent<Viewport>).detail;
      if (detail) setViewport(detail);
    };
    const onConfig = (event: Event) => {
      const detail = (event as CustomEvent<ConfigMap>).detail;
      setConfigs(detail && typeof detail === "object" ? detail : readConfigs());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === ATIS_STORAGE_KEY) setConfigs(readConfigs());
    };

    window.addEventListener(VIEWPORT_EVENT, onViewport);
    window.addEventListener(ATIS_CONFIG_EVENT, onConfig);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(VIEWPORT_EVENT, onViewport);
      window.removeEventListener(ATIS_CONFIG_EVENT, onConfig);
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

  const activeRunways = useMemo(() => activeArrivalRunways(configs), [configs]);
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
