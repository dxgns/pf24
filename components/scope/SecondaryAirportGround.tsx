"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { MAP_BOUNDS } from "@/lib/scope/mapData";
import { SECONDARY_AIRPORTS } from "@/lib/scope/secondaryAirportData";

type Viewport = { zoom: number; panX: number; panY: number };

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";

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

function polygonCenter(points: Array<{ x: number; y: number }>) {
  const total = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: total.x / points.length, y: total.y / points.length };
}

export default function SecondaryAirportGround() {
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

  const groundDetail = viewport.zoom >= 3.0;
  const labelDetail = viewport.zoom >= 2.0;
  const chartDetail = viewport.zoom >= 4.0;
  const standDetail = viewport.zoom >= 5.0;

  return createPortal(
    <div
      data-pf24-secondary-airports="true"
      className="pointer-events-none absolute inset-0 z-[6] overflow-hidden"
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
        <g data-map-layer="secondary-airports">
          {SECONDARY_AIRPORTS.map((airport) => (
            <g key={airport.id} data-airport={airport.id}>
              {groundDetail && airport.aprons?.map((apron) => (
                <polygon
                  key={apron.id}
                  points={apron.points.map((point) => `${point.x},${point.y}`).join(" ")}
                  fill="#22292a"
                  fillOpacity={0.78}
                  stroke="#626b6c"
                  strokeWidth={0.05}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {groundDetail && airport.taxiways?.map((taxiway) => (
                <g key={taxiway.id}>
                  <path
                    d={taxiway.d}
                    fill="none"
                    stroke="#343a3b"
                    strokeWidth={0.17}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d={taxiway.d}
                    fill="none"
                    stroke="#c2bd0a"
                    strokeWidth={0.055}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  {chartDetail && taxiway.label && taxiway.labelAt && (
                    <text
                      x={taxiway.labelAt.x}
                      y={taxiway.labelAt.y}
                      fontSize={0.17}
                      fill="#d6d3b1"
                      fontFamily="monospace"
                    >
                      {taxiway.label}
                    </text>
                  )}
                </g>
              ))}

              {groundDetail && airport.buildings?.map((building) => {
                const center = polygonCenter(building.points);
                return (
                  <g key={building.id}>
                    <polygon
                      points={building.points.map((point) => `${point.x},${point.y}`).join(" ")}
                      fill="#111f98"
                      fillOpacity={0.88}
                      stroke="#798384"
                      strokeWidth={0.05}
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                    {chartDetail && building.label && (
                      <text
                        x={center.x}
                        y={center.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={0.13}
                        fill="#c8cecd"
                        fontFamily="monospace"
                      >
                        {building.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {airport.runways.map((runway) => (
                <g key={runway.id}>
                  <line
                    x1={runway.endA.x}
                    y1={runway.endA.y}
                    x2={runway.endB.x}
                    y2={runway.endB.y}
                    stroke="#343a3b"
                    strokeWidth={airport.uncontrolled ? 0.20 : 0.27}
                    strokeLinecap="butt"
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={runway.endA.x}
                    y1={runway.endA.y}
                    x2={runway.endB.x}
                    y2={runway.endB.y}
                    stroke="#d5dad9"
                    strokeWidth={0.05}
                    strokeLinecap="butt"
                    vectorEffect="non-scaling-stroke"
                  />
                  {labelDetail && (
                    <g fill="#b7bdbc" fontFamily="monospace" fontSize={0.21}>
                      <text x={runway.endA.x + 0.04} y={runway.endA.y - 0.05}>{runway.endA.label}</text>
                      <text x={runway.endB.x - 0.11} y={runway.endB.y + 0.10}>{runway.endB.label}</text>
                    </g>
                  )}
                </g>
              ))}

              {labelDetail && (
                <text
                  x={airport.label.x}
                  y={airport.label.y}
                  fontSize={0.34}
                  fill="#9da5a4"
                  fontFamily="monospace"
                >
                  {airport.id}
                </text>
              )}

              {standDetail && airport.stands?.map((stand) => (
                <g key={`${airport.id}-${stand.name}`}>
                  {airport.id === "MDST" && (
                    <line
                      x1={stand.x + 0.041}
                      y1={stand.y - 0.092}
                      x2={stand.x}
                      y2={stand.y}
                      stroke="#c2bd0a"
                      strokeWidth={0.045}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  <circle cx={stand.x} cy={stand.y} r={0.027} fill="#d6d3b1" />
                  <text
                    x={stand.x + 0.035}
                    y={stand.y + 0.025}
                    fontSize={0.18}
                    fill="#d3d6d4"
                    fontFamily="monospace"
                  >
                    {stand.name}
                  </text>
                </g>
              ))}
            </g>
          ))}
        </g>
      </svg>
    </div>,
    host,
  );
}
