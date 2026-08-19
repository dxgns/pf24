"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import {
  AIRSPACE_PATHS,
  MAP_BOUNDS,
  MDPC_RUNWAYS,
  MDPC_STANDS,
  MDPC_TAXIWAYS,
  WAYPOINTS,
  type MapPath,
} from "@/lib/scope/mapData";
import {
  MDPC_BUILDINGS,
  MDPC_GROUND_REFERENCE_LINES,
  MDPC_TRACE_TRANSFORM,
} from "@/lib/scope/mdpcGroundDetail";
import { MDPC_SIMULATOR_MARKINGS } from "@/lib/scope/mdpcSimulatorDetail";

type Viewport = { zoom: number; panX: number; panY: number };

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";

// Airport property/background outline traced in the same PFTracker reference pixel space
// as the MDPC ground detail. This is deliberately a fill-only layer: no gray border.
const MDPC_AIRPORT_GROUNDS_PATH =
  "M 70 105 L 1600 70 L 1705 185 L 1690 680 L 1530 780 L 600 825 L 190 730 L 90 520 Z";

// Clean apron masses. These are intentionally simple chart-style shapes; the old
// satellite-derived pavement silhouette was too jagged and created false bays/spikes.
const MDPC_APRONS = [
  "M 86.93 103.28 L 87.67 103.31 L 87.71 103.67 L 87.52 103.73 L 87.16 103.72 L 86.96 103.63 Z",
  "M 87.55 103.34 L 88.70 103.42 L 88.76 103.68 L 88.62 103.73 L 87.62 103.68 Z",
  "M 88.12 103.34 L 88.59 103.38 L 88.62 103.54 L 88.18 103.51 Z",
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

function points(path: MapPath) {
  const list = path.points.map((point) => `${point.x},${point.y}`).join(" ");
  if (!path.closed || path.points.length === 0) return list;
  const first = path.points[0];
  return `${list} ${first.x},${first.y}`;
}

function pathStyle(tone: MapPath["tone"]) {
  if (tone === "fir") return { stroke: "#087153", width: 0.16, dash: undefined };
  if (tone === "app") return { stroke: "#176997", width: 0.13, dash: "0.55 0.38" };
  if (tone === "tower") return { stroke: "#2384aa", width: 0.11, dash: "0.38 0.28" };
  if (tone === "runway") return { stroke: "#82898b", width: 0.2, dash: undefined };
  return { stroke: "#777d7f", width: 0.075, dash: undefined };
}

// Keep labels readable without letting them grow at the same rate as airport geometry.
function readableScaleTransform(x: number, y: number, zoom: number) {
  const inverse = 1 / Math.pow(Math.max(zoom, 1), 0.38);
  return `translate(${x} ${y}) scale(${inverse}) translate(${-x} ${-y})`;
}

function ReadableText({
  x,
  y,
  zoom,
  children,
  fontSize = 0.62,
  fill = "#8a9092",
  anchor,
}: {
  x: number;
  y: number;
  zoom: number;
  children: React.ReactNode;
  fontSize?: number;
  fill?: string;
  anchor?: "start" | "middle" | "end";
}) {
  return (
    <g transform={readableScaleTransform(x, y, zoom)}>
      <text x={x} y={y} fontSize={fontSize} fill={fill} fontFamily="monospace" textAnchor={anchor}>
        {children}
      </text>
    </g>
  );
}

function Fix({ x, y, name, zoom, vor = false }: { x: number; y: number; name: string; zoom: number; vor?: boolean }) {
  return (
    <g transform={readableScaleTransform(x, y, zoom)}>
      {vor ? (
        <circle cx={x} cy={y} r={0.15} fill="none" stroke="#8b9092" strokeWidth={0.045} vectorEffect="non-scaling-stroke" />
      ) : (
        <path
          d={`M ${x} ${y - 0.10} L ${x - 0.085} ${y + 0.065} L ${x + 0.085} ${y + 0.065} Z`}
          fill="none"
          stroke="#777d7f"
          strokeWidth={0.04}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <text x={x + 0.16} y={y + 0.095} fontSize={0.46} fill="#73797b" fontFamily="monospace">
        {name}
      </text>
    </g>
  );
}

function MdpcAirportBackground({ zoom }: { zoom: number }) {
  if (zoom < 2.35) return null;

  return (
    <g data-map-layer="mdpc-airport-background" transform={MDPC_TRACE_TRANSFORM}>
      <path d={MDPC_AIRPORT_GROUNDS_PATH} fill="#00520d" stroke="none" />
    </g>
  );
}

function MdpcPavement({ zoom }: { zoom: number }) {
  if (zoom < 2.35) return null;

  return (
    <g data-map-layer="mdpc-pavement">
      {/* Smooth pavement corridors from the airport trace centerlines. */}
      <g transform={MDPC_TRACE_TRANSFORM}>
        {MDPC_GROUND_REFERENCE_LINES.map((line) => (
          <path
            key={`pavement-${line.id}`}
            d={line.d}
            fill="none"
            stroke="#080a0a"
            strokeWidth={18}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>

      {/* Confirmed taxiways in PFTracker coordinates. */}
      {MDPC_TAXIWAYS.map((taxiway) => (
        <path
          key={`pavement-${taxiway.id}`}
          d={taxiway.d}
          fill="none"
          stroke="#080a0a"
          strokeWidth={0.20}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {/* Main apron surfaces are clean chart-style masses instead of the noisy trace. */}
      {MDPC_APRONS.map((d, index) => (
        <path key={`mdpc-apron-${index}`} d={d} fill="#080a0a" stroke="none" />
      ))}
    </g>
  );
}

function MdpcGround({ zoom }: { zoom: number }) {
  const surfaceDetail = zoom >= 2.35;
  const detail = zoom >= 3.0;
  const buildingDetail = zoom >= 4.2;
  const standDetail = zoom >= 9.0;

  return (
    <g data-map-layer="mdpc-ground">
      {surfaceDetail && (
        <g data-map-layer="mdpc-chart-ground" transform={MDPC_TRACE_TRANSFORM}>
          {MDPC_GROUND_REFERENCE_LINES.map((line) => (
            <g key={line.id}>
              {detail && (
                <path
                  d={line.d}
                  fill="none"
                  stroke="#c79216"
                  strokeWidth={0.055}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </g>
          ))}

          {buildingDetail && (
            <g data-map-layer="mdpc-buildings">
              {MDPC_BUILDINGS.map((building) => (
                <polygon
                  key={building.id}
                  points={building.points.map((point) => `${point.x},${point.y}`).join(" ")}
                  fill="#1222a0"
                  fillOpacity={0.88}
                  stroke="#7c8788"
                  strokeWidth={0.05}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          )}
        </g>
      )}

      {MDPC_RUNWAYS.map((runway) => (
        <g key={runway.id}>
          <polyline points={points(runway)} fill="none" stroke="#161b1c" strokeWidth={0.38} strokeLinecap="butt" />
          <polyline points={points(runway)} fill="none" stroke="#969e9f" strokeWidth={0.055} strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
          <polyline points={points(runway)} fill="none" stroke="#d9dddd" strokeWidth={0.025} strokeDasharray="0.18 0.16" vectorEffect="non-scaling-stroke" />
        </g>
      ))}

      {detail && MDPC_TAXIWAYS.map((taxiway) => (
        <path
          key={taxiway.id}
          d={taxiway.d}
          fill="none"
          stroke="#c79216"
          strokeWidth={0.058}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {detail && (
        <g data-map-layer="mdpc-simulator-markings">
          {MDPC_SIMULATOR_MARKINGS.filter((marking) => marking.kind === "turn").map((marking) => (
            <path key={marking.id} d={marking.d} fill="none" stroke="#c79216" strokeWidth={0.05} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          ))}
          {MDPC_SIMULATOR_MARKINGS.filter((marking) => marking.kind === "hold").map((marking) => (
            <path key={marking.id} d={marking.d} fill="none" stroke="#d9ae35" strokeWidth={0.075} strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      )}

      {detail && (
        <g data-map-layer="mdpc-runway-labels">
          <ReadableText x={85.73} y={102.28} zoom={zoom} fontSize={0.50} fill="#c6cccc">08</ReadableText>
          <ReadableText x={89.70} y={101.91} zoom={zoom} fontSize={0.50} fill="#c6cccc">26</ReadableText>
          <ReadableText x={86.29} y={102.96} zoom={zoom} fontSize={0.50} fill="#c6cccc">09</ReadableText>
          <ReadableText x={90.22} y={103.37} zoom={zoom} fontSize={0.50} fill="#c6cccc">27</ReadableText>
        </g>
      )}

      {detail && zoom < 9 && (
        <ReadableText x={87.28} y={102.42} zoom={zoom} fontSize={0.52} fill="#8a9092">MDPC</ReadableText>
      )}

      {buildingDetail && zoom < 10 && (
        <g data-map-layer="mdpc-terminal-labels">
          <ReadableText x={87.48} y={103.86} zoom={zoom} fontSize={0.36} fill="#c1c8c7">TERMINAL B</ReadableText>
          <ReadableText x={88.38} y={104.03} zoom={zoom} fontSize={0.36} fill="#c1c8c7">TERMINAL A</ReadableText>
        </g>
      )}

      {standDetail && MDPC_STANDS.map((stand) => (
        <g key={stand.name} transform={readableScaleTransform(stand.x, stand.y, zoom)}>
          <circle cx={stand.x} cy={stand.y} r={0.028} fill="#d6d3b1" />
          <text x={stand.x + 0.05} y={stand.y + 0.028} fontSize={0.28} fill="#e0e2df" fontFamily="monospace">
            {stand.name}
          </text>
        </g>
      ))}
    </g>
  );
}

export default function ScopeRadarMap() {
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
    <div data-pf24-vector-map="true" className="pointer-events-none absolute inset-0 z-[6] overflow-hidden" aria-hidden="true">
      <svg
        className="absolute inset-0 block h-full w-full"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{ transformOrigin: "0 0", transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})` }}
      >
        {/* Layer 1: airport grounds / infield. */}
        <MdpcAirportBackground zoom={viewport.zoom} />

        {/* Layer 2: clean paved surfaces, directly above the green infield. */}
        <MdpcPavement zoom={viewport.zoom} />

        <g data-map-layer="airspace">
          {AIRSPACE_PATHS.map((airspace) => {
            const style = pathStyle(airspace.tone);
            return (
              <polyline
                key={airspace.id}
                points={points(airspace)}
                fill="none"
                stroke={style.stroke}
                strokeWidth={style.width}
                strokeDasharray={style.dash}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </g>

        <g data-map-layer="fixes">
          {WAYPOINTS.map((waypoint) => (
            <Fix key={waypoint.name} x={waypoint.x} y={waypoint.y} name={waypoint.name} zoom={viewport.zoom} vor={waypoint.kind === "vor"} />
          ))}
        </g>

        <MdpcGround zoom={viewport.zoom} />
      </svg>
    </div>,
    host,
  );
}
