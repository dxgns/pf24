"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { MAP_BOUNDS } from "@/lib/scope/mapData";

type Viewport = { zoom: number; panX: number; panY: number };
const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";

// MDCR SVG runway centreline endpoints -> verified Scope RWY12/RWY30.
const MDCR_TRANSFORM = "matrix(0.002654293298 0.001479223615 -0.001479223615 0.002654293298 56.73970455 108.85993827)";

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

  return createPortal(
    <div className="pointer-events-none absolute inset-0 z-[6] overflow-hidden" aria-hidden="true">
      <svg className="absolute inset-0 block h-full w-full" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" style={{ transformOrigin: "0 0", transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})` }}>
        {viewport.zoom >= 2.35 && (
          <image href="/scope/mdcr-ground.svg" x={0} y={0} width={851.24261} height={85.69931} transform={MDCR_TRANSFORM} preserveAspectRatio="none" />
        )}

        {/* MTCA: intentionally runway only. No apron/taxiway/airport schematic. */}
        <g data-airport="MTCA" data-map-layer="mtca-runway-only">
          <line x1={33.20} y1={103.61} x2={34.54} y2={103.47} stroke="#000" strokeWidth={0.20} strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
          <line x1={33.20} y1={103.61} x2={34.54} y2={103.47} stroke="#d5dad9" strokeWidth={0.05} strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
          {viewport.zoom >= 2 && <g fill="#b7bdbc" fontFamily="monospace" fontSize={0.21}><text x={33.24} y={103.56}>26</text><text x={34.43} y={103.57}>08</text></g>}
        </g>
      </svg>
    </div>,
    host,
  );
}
