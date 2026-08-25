"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { MAP_BOUNDS } from "@/lib/scope/mapData";

type Viewport = { zoom: number; panX: number; panY: number };

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";
const AIRPORT_DETAIL_MIN_ZOOM = 2.35;

// Calibrated from the four pavement ends in the supplied GCLP SVG.
// The anchors are the physical pavement ends, not the inset white runway markings:
// RWY 01L -> (88.74, 71.37)
// RWY 01R -> (88.88, 71.44)
// RWY 21R -> (89.68, 69.42)
// RWY 21L -> (89.82, 69.49)
// A least-squares affine fit over all four anchors keeps both parallel runways
// aligned simultaneously; residual error is below 0.001 Scope map units.
const GCLP_TRANSFORM =
  "matrix(0.000345487461 -0.000709326423 0.000649487309 0.000317187036 87.8328662 71.5692600)";

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

export default function GclpSvgAirport() {
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

  if (!host) return null;

  const showAirportDetail = viewport.zoom >= AIRPORT_DETAIL_MIN_ZOOM;

  return createPortal(
    <div
      data-pf24-gclp-svg="true"
      className="pointer-events-none absolute inset-0 z-[4] overflow-hidden"
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 block h-full w-full"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{
          transformOrigin: "0 0",
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
        }}
      >
        <image
          href="/scope/gclp-ground.svg"
          x={0}
          y={0}
          width={4316.5}
          height={1890}
          transform={GCLP_TRANSFORM}
          preserveAspectRatio="none"
          opacity={showAirportDetail ? 1 : 0}
        />
      </svg>
    </div>,
    host,
  );
}
