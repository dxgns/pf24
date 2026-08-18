"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { MAP_BOUNDS } from "@/lib/scope/mapData";

type Viewport = { zoom: number; panX: number; panY: number };

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";

// Same access geometry already used by SecondaryAirportGround. The simulator
// reference shows these as unpainted pavement accesses, so this overlay masks
// the generic yellow centerlines without changing the chart-derived topology.
const MDCR_UNPAINTED_ACCESSES = [
  "M 56.8731 109.1073 Q 56.8900 109.0700 56.9120 109.0374",
  "M 56.9605 109.1560 Q 56.9780 109.1200 56.9994 109.0861",
];

// Approximate placement derived from the supplied simulator overhead view and
// anchored to the known MDCR apron geometry. This is not a PFTracker-confirmed
// coordinate, so it should remain easy to refine if a closer reference arrives.
const MDCR_HELIPAD = { x: 57.005, y: 108.985 };

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

export default function MdcrSimulatorDetail() {
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
        <g data-map-layer="mdcr-simulator-detail">
          {MDCR_UNPAINTED_ACCESSES.map((d, index) => (
            <path
              key={index}
              d={d}
              fill="none"
              stroke="#343a3b"
              strokeWidth={0.18}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <circle
            cx={MDCR_HELIPAD.x}
            cy={MDCR_HELIPAD.y}
            r={0.055}
            fill="none"
            stroke="#d5dad9"
            strokeWidth={0.045}
            vectorEffect="non-scaling-stroke"
          />
          {viewport.zoom >= 4 && (
            <text
              x={MDCR_HELIPAD.x}
              y={MDCR_HELIPAD.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={0.12}
              fontFamily="monospace"
              fontWeight="700"
              fill="#d5dad9"
            >
              H
            </text>
          )}
        </g>
      </svg>
    </div>,
    host,
  );
}
