"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { MAP_BOUNDS } from "@/lib/scope/mapData";

type Viewport = { zoom: number; panX: number; panY: number };

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";
const AIRPORT_DETAIL_MIN_ZOOM = 2.35;

// Calibrated from the four physical pavement ends in the supplied EGKK SVG:
// RWY 08R -> (126.87, 34.31)
// RWY 08L -> (126.74, 34.17)
// RWY 26L -> (130.33, 33.50)
// RWY 26R -> (129.10, 33.62)
// A least-squares affine fit over all four pavement anchors keeps both runways
// aligned simultaneously rather than fitting either runway in isolation.
const EGKK_TRANSFORM =
  "matrix(0.00617984376 -0.00139871246 0.00297038547 0.00592008192 125.383112 32.2890036)";
const EGKK_SVG_WIDTH = 728.18;
const EGKK_SVG_HEIGHT = 472.34;

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

export default function EgkkSvgAirport() {
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
      data-pf24-egkk-svg="true"
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
          href="/scope/egkk-ground.svg"
          x={0}
          y={0}
          width={EGKK_SVG_WIDTH}
          height={EGKK_SVG_HEIGHT}
          transform={EGKK_TRANSFORM}
          preserveAspectRatio="none"
          opacity={showAirportDetail ? 1 : 0}
        />
      </svg>
    </div>,
    host,
  );
}
