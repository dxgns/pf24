"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { MAP_BOUNDS } from "@/lib/scope/mapData";

type Viewport = { zoom: number; panX: number; panY: number };
type Point = { x: number; y: number };

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";

/**
 * MTCA is uncontrolled and the simulator reference does not show numbered or
 * painted parking positions. This geometry is intentionally schematic: the
 * runway endpoints remain the PFTracker measurements in secondaryAirportData,
 * while the apron/access are approximate shapes inferred from the supplied
 * simulator overhead views.
 */
const MTCA_APRON: Point[] = [
  { x: 33.56, y: 103.18 },
  { x: 33.93, y: 103.16 },
  { x: 34.01, y: 103.22 },
  { x: 34.00, y: 103.34 },
  { x: 33.91, y: 103.40 },
  { x: 33.61, y: 103.39 },
  { x: 33.54, y: 103.32 },
];

const MTCA_ACCESS = "M 33.78 103.55 C 33.77 103.49 33.76 103.43 33.76 103.35";

// The simulator shows a single transverse holding-position marking on the
// access before the runway. Placement is approximate because no PFTracker
// coordinate was supplied for this point.
const MTCA_HOLDING_BAR = {
  a: { x: 33.725, y: 103.455 },
  b: { x: 33.805, y: 103.447 },
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

function findRadar() {
  return document.querySelector<HTMLElement>("main.fixed > section");
}

export default function MtcaSimulatorDetail() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 });

  useEffect(() => {
    setViewport(readViewport());
    const onViewport = (event: Event) => {
      const detail = (event as CustomEvent<Viewport>).detail;
      if (detail) setViewport(detail);
    };
    window.addEventListener(VIEWPORT_EVENT, onViewport);
    return () => window.removeEventListener(VIEWPORT_EVENT, onViewport);
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

  if (!host || viewport.zoom < 3) return null;

  return createPortal(
    <div className="pointer-events-none absolute inset-0 z-[6] overflow-hidden" aria-hidden="true">
      <svg
        className="absolute inset-0 block h-full w-full"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{
          transformOrigin: "0 0",
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
        }}
      >
        <g data-map-layer="mtca-simulator-detail">
          <polygon
            points={MTCA_APRON.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="#262c2d"
            fillOpacity={0.78}
            stroke="#626b6c"
            strokeWidth={0.045}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          <path
            d={MTCA_ACCESS}
            fill="none"
            stroke="#343a3b"
            strokeWidth={0.19}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {viewport.zoom >= 4 && (
            <line
              x1={MTCA_HOLDING_BAR.a.x}
              y1={MTCA_HOLDING_BAR.a.y}
              x2={MTCA_HOLDING_BAR.b.x}
              y2={MTCA_HOLDING_BAR.b.y}
              stroke="#c69b24"
              strokeWidth={0.05}
              strokeLinecap="butt"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </g>
      </svg>
    </div>,
    host,
  );
}
