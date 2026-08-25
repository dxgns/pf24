"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { MAP_BOUNDS } from "@/lib/scope/mapData";

type Viewport = { zoom: number; panX: number; panY: number };
type EgttWaypoint = { name: string; x: number; y: number; vor?: boolean };

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";

const EGTT_WAYPOINTS: readonly EgttWaypoint[] = [
  { name: "LEDGO", x: 105.44, y: 42.44 },
  { name: "ERABI", x: 103.03, y: 33.34 },
  { name: "DUFFY", x: 110.70, y: 25.68 },
  { name: "LUSAT", x: 110.70, y: 31.78 },
  { name: "IMVUR", x: 118.39, y: 31.35 },
  { name: "GOSAM", x: 116.41, y: 21.06 },
  { name: "RIMOL", x: 117.04, y: 12.46 },
  { name: "NEXUS", x: 123.84, y: 19.50 },
  { name: "BEKET", x: 122.20, y: 2.29 },
  { name: "OVDAN", x: 134.17, y: 11.59 },
  { name: "DETLING", x: 142.99, y: 30.50, vor: true },
  { name: "TUNBY", x: 142.44, y: 32.97 },
  { name: "TEBRA", x: 138.75, y: 31.62 },
  { name: "AMDUT", x: 137.45, y: 39.11 },
  { name: "MAYFIELD", x: 129.60, y: 40.69, vor: true },
  { name: "HOLLY", x: 128.40, y: 39.78 },
  { name: "TELTU", x: 122.63, y: 43.14 },
  { name: "DISVO", x: 120.35, y: 45.08 },
  { name: "EPSOM", x: 124.80, y: 31.71 },
  { name: "KKW19", x: 126.20, y: 29.65 },
  { name: "ACORN", x: 129.19, y: 30.62 },
  { name: "KKN09", x: 133.48, y: 28.13 },
  { name: "KKE05", x: 134.54, y: 32.49 },
  { name: "KKE03", x: 132.93, y: 32.89 },
  { name: "TIMBA", x: 131.84, y: 34.74 },
  { name: "KKS33", x: 138.07, y: 37.12 },
  { name: "KKS14", x: 133.76, y: 37.92 },
  { name: "KKE64", x: 134.63, y: 36.88 },
  { name: "SEAFORD", x: 134.21, y: 43.74, vor: true },
  { name: "KKS25", x: 123.34, y: 42.32 },
  { name: "KKS20", x: 122.68, y: 39.93 },
  { name: "KKW09", x: 120.05, y: 37.19 },
  { name: "KKS11", x: 121.96, y: 37.22 },
  { name: "WILLO", x: 122.81, y: 36.63 },
  { name: "KKW08", x: 121.56, y: 35.46 },
  { name: "HAZEL", x: 123.14, y: 35.02 },
  { name: "KKS06", x: 124.70, y: 36.02 },
  { name: "KKS09", x: 125.89, y: 36.16 },
  { name: "KKW04", x: 124.46, y: 34.94 },
  { name: "KKW07", x: 124.91, y: 34.72 },
  { name: "KKW06", x: 125.49, y: 34.57 },
  { name: "WATERFORD", x: 109.06, y: 38.28, vor: true },
] as const;

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

function readableScaleTransform(x: number, y: number, zoom: number) {
  const inverse = 1 / Math.pow(Math.max(zoom, 1), 0.38);
  return `translate(${x} ${y}) scale(${inverse}) translate(${-x} ${-y})`;
}

function Waypoint({ waypoint, zoom }: { waypoint: EgttWaypoint; zoom: number }) {
  return (
    <g transform={readableScaleTransform(waypoint.x, waypoint.y, zoom)}>
      {waypoint.vor ? (
        <circle
          cx={waypoint.x}
          cy={waypoint.y}
          r={0.15}
          fill="none"
          stroke="#8b9092"
          strokeWidth={0.045}
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <path
          d={`M ${waypoint.x} ${waypoint.y - 0.10} L ${waypoint.x - 0.085} ${waypoint.y + 0.065} L ${waypoint.x + 0.085} ${waypoint.y + 0.065} Z`}
          fill="none"
          stroke="#777d7f"
          strokeWidth={0.04}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <text
        x={waypoint.x + 0.16}
        y={waypoint.y + 0.095}
        fontSize={0.46}
        fill="#73797b"
        fontFamily="monospace"
      >
        {waypoint.name}
      </text>
    </g>
  );
}

function findRadar() {
  return document.querySelector<HTMLElement>("main.fixed > section");
}

export default function ScopeEgttWaypoints() {
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

  return createPortal(
    <div className="pointer-events-none absolute inset-0 z-[6] overflow-hidden" aria-hidden="true" data-pf24-egtt-waypoints="true">
      <svg
        className="absolute inset-0 block h-full w-full"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{
          transformOrigin: "0 0",
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
        }}
      >
        <g data-map-layer="fixes">
          {EGTT_WAYPOINTS.map((waypoint) => (
            <Waypoint key={waypoint.name} waypoint={waypoint} zoom={viewport.zoom} />
          ))}
        </g>
      </svg>
    </div>,
    host,
  );
}
