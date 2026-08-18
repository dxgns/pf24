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
  MDPC_PAVEMENT_PIXEL_PATH,
  MDPC_TRACE_TRANSFORM,
} from "@/lib/scope/mdpcGroundDetail";
import { MDPC_SIMULATOR_MARKINGS } from "@/lib/scope/mdpcSimulatorDetail";

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

function Fix({ x, y, name, vor = false }: { x: number; y: number; name: string; vor?: boolean }) {
  return (
    <g>
      {vor ? (
        <circle
          cx={x}
          cy={y}
          r={0.16}
          fill="none"
          stroke="#8b9092"
          strokeWidth={0.055}
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <path
          d={`M ${x} ${y - 0.11} L ${x - 0.095} ${y + 0.07} L ${x + 0.095} ${y + 0.07} Z`}
          fill="none"
          stroke="#777d7f"
          strokeWidth={0.045}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <text x={x + 0.18} y={y + 0.11} fontSize={0.55} fill="#73797b" fontFamily="monospace">
        {name}
      </text>
    </g>
  );
}

function MdpcGround({ zoom }: { zoom: number }) {
  const surfaceDetail = zoom >= 2.35;
  const detail = zoom >= 3.0;
  const buildingDetail = zoom >= 3.8;
  const standDetail = zoom >= 5.1;

  return (
    <g data-map-layer="mdpc-ground">
      {surfaceDetail && (
        <g data-map-layer="mdpc-traced-ground" transform={MDPC_TRACE_TRANSFORM}>
          <path
            d={MDPC_PAVEMENT_PIXEL_PATH}
            fill="#22292a"
            fillOpacity={0.74}
            fillRule="evenodd"
            clipRule="evenodd"
            stroke="#5c6667"
            strokeWidth={0.045}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {detail && (
            <g data-map-layer="mdpc-ground-reference-lines">
              {MDPC_GROUND_REFERENCE_LINES.map((line) => (
                <path
                  key={line.id}
                  d={line.d}
                  fill="none"
                  stroke="#b7851d"
                  strokeOpacity={0.9}
                  strokeWidth={0.055}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          )}

          {buildingDetail && (
            <g data-map-layer="mdpc-buildings">
              {MDPC_BUILDINGS.map((building) => (
                <polygon
                  key={building.id}
                  points={building.points.map((point) => `${point.x},${point.y}`).join(" ")}
                  fill="#111f98"
                  fillOpacity={0.88}
                  stroke="#7a8586"
                  strokeWidth={0.055}
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
          <polyline
            points={points(runway)}
            fill="none"
            stroke="#343a3b"
            strokeWidth={0.31}
            strokeLinecap="butt"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={points(runway)}
            fill="none"
            stroke="#d5dad9"
            strokeWidth={0.055}
            strokeLinecap="butt"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}

      {detail &&
        MDPC_TAXIWAYS.map((taxiway) => (
          <path
            key={taxiway.id}
            d={taxiway.d}
            fill="none"
            stroke="#c28a18"
            strokeWidth={0.072}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}

      {detail && (
        <g data-map-layer="mdpc-simulator-markings">
          {MDPC_SIMULATOR_MARKINGS.filter((marking) => marking.kind === "turn").map((marking) => (
            <path
              key={marking.id}
              d={marking.d}
              fill="none"
              stroke="#c28a18"
              strokeWidth={0.052}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {MDPC_SIMULATOR_MARKINGS.filter((marking) => marking.kind === "hold").map((marking) => (
            <path
              key={marking.id}
              d={marking.d}
              fill="none"
              stroke="#d3a62b"
              strokeWidth={0.085}
              strokeLinecap="butt"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      )}

      {detail && (
        <g data-map-layer="mdpc-runway-labels" fontFamily="monospace" fill="#b4bbba">
          <text x={85.73} y={102.28} fontSize={0.22}>08</text>
          <text x={89.70} y={101.91} fontSize={0.22}>26</text>
          <text x={86.29} y={102.96} fontSize={0.22}>09</text>
          <text x={90.22} y={103.37} fontSize={0.22}>27</text>
        </g>
      )}

      {detail && (
        <text x={87.28} y={102.42} fontSize={0.42} fill="#8a9092" fontFamily="monospace">
          MDPC
        </text>
      )}

      {buildingDetail && (
        <g data-map-layer="mdpc-terminal-labels" fontFamily="monospace" fill="#aeb6b5">
          <text x={87.48} y={103.86} fontSize={0.2}>TERMINAL B</text>
          <text x={88.38} y={104.03} fontSize={0.2}>TERMINAL A</text>
        </g>
      )}

      {standDetail &&
        MDPC_STANDS.map((stand) => (
          <g key={stand.name}>
            <circle cx={stand.x} cy={stand.y} r={0.035} fill="#d6d3b1" />
            <text
              x={stand.x + 0.06}
              y={stand.y + 0.03}
              fontSize={0.25}
              fill="#d3d6d4"
              fontFamily="monospace"
            >
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
    <div
      data-pf24-vector-map="true"
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
            <Fix
              key={waypoint.name}
              x={waypoint.x}
              y={waypoint.y}
              name={waypoint.name}
              vor={waypoint.kind === "vor"}
            />
          ))}
        </g>

        <MdpcGround zoom={viewport.zoom} />
      </svg>
    </div>,
    host,
  );
}
