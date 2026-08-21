"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { MAP_BOUNDS } from "@/lib/scope/mapData";

type Viewport = { zoom: number; panX: number; panY: number };
const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";

const MDCR_TRANSFORM = "matrix(0.002654293298 0.001479223615 -0.001479223615 0.002654293298 56.73970455 108.85993827)";

// Calibrated from the actual runway centerline in the supplied MTCA SVG:
// SVG left threshold (08)  -> map 34.54, 103.47
// SVG right threshold (26) -> map 33.20, 103.61
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

function MtcaRunway() {
  return (
    <g data-airport="MTCA" data-map-layer="mtca-runway-user-svg-inline" transform={MTCA_TRANSFORM}>
      {/* Exact runway geometry from the supplied MTCA.svg. No old schematic airport is rendered. */}
      <g transform="translate(8.6486988,-184.3829)">
        <path
          d="m 4.4901536,190.65009 v 2.85001 H 196.21057 v -2.85062 z"
          fill="#000000"
        />
        <path
          d="m 4.5649889,190.71418 -0.00101,2.71352 191.5625111,-0.002 0.003,-2.71189 z"
          fill="none"
          stroke="#ffffff"
          strokeWidth={0.0650875}
        />
        <path
          d="M 4.6610083,192.05637 196.0488,192.05593"
          fill="none"
          stroke="#c8c8c6"
          strokeWidth={0.0650875}
        />

        <g transform="matrix(0.50278339,0.00466608,-0.00656978,0.67387514,-60.100539,-26.181165)" fill="#ffffff">
          {[321.0497, 321.63042, 322.22715, 324.34349, 323.74123, 323.16119].map((y, index) => (
            <path key={`mtca-08-threshold-${index}`} d={`m 133.00406,${y} 5.18729,-0.0497 0.006,0.51376 -5.19282,0.0552 z`} />
          ))}
        </g>
        <g transform="matrix(0.50278339,0.00466608,-0.00656978,0.67387514,128.69323,-26.171088)" fill="#ffffff">
          {[321.0497, 321.63042, 322.22715, 324.34349, 323.74123, 323.16119].map((y, index) => (
            <path key={`mtca-26-threshold-${index}`} d={`m 133.00406,${y} 5.18729,-0.0497 0.006,0.51376 -5.19282,0.0552 z`} />
          ))}
        </g>
      </g>
    </g>
  );
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
      <svg
        className="absolute inset-0 block h-full w-full"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{
          transformOrigin: "0 0",
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
        }}
      >
        {viewport.zoom >= 2.35 && (
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

        <MtcaRunway />

        {viewport.zoom >= 2 && (
          <g fill="#f1f1f1" fontFamily="'B612 Mono', monospace" fontSize={0.11}>
            <text x={34.49} y={103.435} textAnchor="middle">08</text>
            <text x={33.25} y={103.655} textAnchor="middle">26</text>
          </g>
        )}
      </svg>
    </div>,
    host,
  );
}
