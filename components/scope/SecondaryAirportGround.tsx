"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { MAP_BOUNDS } from "@/lib/scope/mapData";
import { SECONDARY_AIRPORTS } from "@/lib/scope/secondaryAirportData";

type Viewport = { zoom: number; panX: number; panY: number };
type StandPoint = { x: number; y: number; name: string };
type GroundPoint = { x: number; y: number };

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";

const MDST_TURNPADS: Array<{ id: string; points: GroundPoint[] }> = [
  {
    id: "MDST_TURNPAD_11",
    points: [
      { x: 67.0668, y: 92.3577 },
      { x: 67.0528, y: 92.4389 },
      { x: 67.1058, y: 92.5170 },
      { x: 67.2196, y: 92.5563 },
      { x: 67.2947, y: 92.5348 },
      { x: 67.3046, y: 92.4627 },
    ],
  },
  {
    id: "MDST_TURNPAD_29",
    points: [
      { x: 69.7032, y: 93.5223 },
      { x: 69.6526, y: 93.5874 },
      { x: 69.5592, y: 93.6008 },
      { x: 69.4534, y: 93.5432 },
      { x: 69.4188, y: 93.4732 },
      { x: 69.4654, y: 93.4173 },
    ],
  },
];

// Calibrated from the simulator overview using A1-A4 plus TX A as control points.
const MDST_HELIPAD = {
  id: "MDST_HELIPAD_H",
  points: [
    { x: 68.2250, y: 93.1059 },
    { x: 68.2125, y: 93.0991 },
    { x: 68.1814, y: 93.1117 },
    { x: 68.1939, y: 93.1185 },
  ],
  center: { x: 68.2032, y: 93.1088 },
};

const MDST_HOLDING_BARS = [
  { id: "MDST_HOLD_A", a: { x: 68.3910, y: 92.9810 }, b: { x: 68.4551, y: 93.0093 } },
  { id: "MDST_HOLD_B", a: { x: 68.8476, y: 93.1787 }, b: { x: 68.9117, y: 93.2070 } },
];

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

/**
 * Lead-ins are anchored to the PFTracker stand coordinates. A1-A4 and C1-C4
 * follow the long curved lead-ins visible in the simulator overhead views.
 * B6 and B2R retain their distinctive non-parallel geometry.
 */
function mdstLeadIns(stand: StandPoint) {
  const calibrated: Record<string, string[]> = {
    A4: ["M 68.456 93.147 Q 68.405 93.166 68.352 93.190 Q 68.325 93.202 68.300 93.210"],
    A3: ["M 68.430 93.134 Q 68.380 93.151 68.326 93.179 Q 68.298 93.192 68.270 93.200"],
    A2: ["M 68.404 93.120 Q 68.355 93.138 68.301 93.163 Q 68.274 93.176 68.250 93.180"],
    A1: ["M 68.378 93.105 Q 68.331 93.124 68.274 93.151 Q 68.245 93.165 68.220 93.170"],
    C4: ["M 68.850 93.260 Q 68.828 93.335 68.808 93.402 Q 68.802 93.428 68.800 93.450"],
    C3: ["M 68.958 93.286 Q 68.925 93.345 68.894 93.407 Q 68.878 93.435 68.870 93.450"],
    C2: ["M 69.015 93.301 Q 68.982 93.360 68.947 93.425 Q 68.930 93.454 68.920 93.470"],
    C1: ["M 69.080 93.318 Q 69.040 93.378 69.000 93.440 Q 68.982 93.470 68.970 93.490"],
  };

  if (calibrated[stand.name]) return calibrated[stand.name];

  if (stand.name === "B6") {
    return [
      "M 68.545 93.245 Q 68.505 93.285 68.478 93.310 Q 68.458 93.330 68.450 93.350",
    ];
  }

  if (stand.name === "B2R") {
    return [
      "M 68.735 93.285 Q 68.715 93.315 68.700 93.335 Q 68.692 93.347 68.690 93.360",
      "M 68.700 93.335 Q 68.688 93.338 68.680 93.340",
    ];
  }

  return [`M ${stand.x + 0.041} ${stand.y - 0.092} L ${stand.x} ${stand.y}`];
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
              {groundDetail && airport.id === "MDST" && (
                <g data-map-layer="mdst-simulator-detail">
                  {MDST_TURNPADS.map((turnpad) => (
                    <polygon
                      key={turnpad.id}
                      points={turnpad.points.map((point) => `${point.x},${point.y}`).join(" ")}
                      fill="#343a3b"
                      fillOpacity={0.92}
                      stroke="#626b6c"
                      strokeWidth={0.045}
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  <polygon
                    points={MDST_HELIPAD.points.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill="#555b59"
                    fillOpacity={0.9}
                    stroke="#c69b24"
                    strokeWidth={0.045}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  {chartDetail && (
                    <text
                      x={MDST_HELIPAD.center.x}
                      y={MDST_HELIPAD.center.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={0.13}
                      fontFamily="monospace"
                      fontWeight="700"
                      fill="#d8d6c0"
                    >
                      H
                    </text>
                  )}
                  {chartDetail && MDST_HOLDING_BARS.map((bar) => (
                    <line
                      key={bar.id}
                      x1={bar.a.x}
                      y1={bar.a.y}
                      x2={bar.b.x}
                      y2={bar.b.y}
                      stroke="#c69b24"
                      strokeWidth={0.052}
                      strokeLinecap="butt"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </g>
              )}

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
                    stroke="#c69b24"
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
                  {airport.id === "MDST" && mdstLeadIns(stand).map((d, index) => (
                    <path
                      key={`${stand.name}-lead-${index}`}
                      d={d}
                      fill="none"
                      stroke="#c69b24"
                      strokeWidth={0.045}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
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
