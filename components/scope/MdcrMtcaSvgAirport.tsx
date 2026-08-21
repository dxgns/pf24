"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { MAP_BOUNDS } from "@/lib/scope/mapData";

type Viewport = { zoom: number; panX: number; panY: number };
const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";
const AIRPORT_DETAIL_MIN_ZOOM = 2.35;

const MDCR_TRANSFORM = "matrix(0.002654293298 0.001479223615 -0.001479223615 0.002654293298 56.73970455 108.85993827)";

// Calibrated from the actual MTCA runway geometry in the supplied SVG.
// The whole SVG is rendered so its green background, runway markings and
// small runway numbers keep exactly the proportions and placement authored there.
const MTCA_TRANSFORM = "matrix(-0.007001493198 0.000731483017 -0.000731483017 -0.007001493198 34.638800837 103.513989923)";

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

export default function MdcrMtcaSvgAirport() {
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
      if (radar) { setHost(radar); window.clearInterval(timer); }
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
        {showAirportDetail && (
          <image
            href="/scope/mdcr-ground.svg"
            x={0}
            y={0}
            width={851.24261}
            height={85.69931}
            transform={MDCR_TRANSFORM}
            preserveAspectRatio="none"
          />
        )}

        {showAirportDetail && (
          <image
            href="/scope/mtca-ground.svg"
            x={0}
            y={0}
            width={217.87869}
            height={15.99907}
            transform={MTCA_TRANSFORM}
            preserveAspectRatio="none"
          />
        )}
      </svg>
    </div>,
    host,
  );
}
