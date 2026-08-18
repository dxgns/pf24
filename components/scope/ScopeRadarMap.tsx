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
import { MDPC_TERMINAL_B_OUTLINE } from "@/lib/scope/mdpcGroundDetail";

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

function polygonPoints(list: Array<{ x: number; y: number }>) {
  return list.map((point) => `${point.x},${point.y}`).join(" ");
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
        <circle cx={x} cy={y} r={0.16} fill="none" stroke="#8b9092" strokeWidth={0.055} vectorEffect="non-scaling-stroke" />
      ) : (
        <path d={`M ${x} ${y - 0.11} L ${x - 0.095} ${y + 0.07} L ${x + 0.095} ${y + 0.07} Z`} fill="none" stroke="#777d7f" strokeWidth={0.045} vectorEffect="non-scaling-stroke" />
      )}
      <text x={x + 0.18} y={y + 0.11} fontSize={0.55} fill="#73797b" fontFamily="monospace">{name}</text>
    </g>
  );
}

function MdpcGround({ zoom }: { zoom: number }) {
  const detail = zoom >= 3.1;
  const buildingDetail = zoom >= 4.0;
  const standDetail = zoom >= 5.2;

  return (
    <g data-map-layer="mdpc-ground">
      {MDPC_RUNWAYS.map((runway) => (
        <g key={runway.id}>
          <polyline
            points={points(runway)}
            fill="none"
            stroke="#373d3e"
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

      {detail && MDPC_TAXIWAYS.map((taxiway) => (
        <path
          key={taxiway.id}
          d={taxiway.d}
          fill="none"
          stroke="#b7b30a"
          strokeWidth={0.065}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {buildingDetail && (
        <polygon
          points={polygonPoints(MDPC_TERMINAL_B_OUTLINE)}
          fill="#101ab0"
          fillOpacity={0.86}
          stroke="#6e7576"
          strokeWidth={0.065}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {detail && <text x={87.28} y={102.42} fontSize={0.42} fill="#8a9092" fontFamily="monospace">MDPC</text>}

      {standDetail && MDPC_STANDS.map((stand) => (
        <g key={stand.name}>
          <circle cx={stand.x} cy={stand.y} r={0.035} fill="#d6d3b1" />
          <text x={stand.x + 0.06} y={stand.y + 0.03} fontSize={0.25} fill="#d3d6d4" fontFamily="monospace">{stand.name}</text>
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
            <Fix key={waypoint.name} x={waypoint.x} y={waypoint.y} name={waypoint.name} vor={waypoint.kind === "vor"} />
          ))}
        </g>

        <MdpcGround zoom={viewport.zoom} />
      </svg>
    </div>,
    host,
  );
}
