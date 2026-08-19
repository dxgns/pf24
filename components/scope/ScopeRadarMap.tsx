"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AIRSPACE_PATHS,
  MAP_BOUNDS,
  WAYPOINTS,
  type MapPath,
} from "@/lib/scope/mapData";
import {
  MDPC_SVG_BLACK,
  MDPC_SVG_BLUE,
  MDPC_SVG_GREEN,
  MDPC_SVG_LAYER_TRANSLATE,
} from "@/lib/scope/mdpcSvgBase";
import { MDPC_SVG_WHITE_FILL, MDPC_SVG_WHITE_STROKE } from "@/lib/scope/mdpcSvgWhite";
import {
  MDPC_SVG_YELLOW_0204516,
  MDPC_SVG_YELLOW_0246,
  MDPC_SVG_YELLOW_0247355,
  MDPC_SVG_YELLOW_0250474,
  MDPC_SVG_YELLOW_0260986,
} from "@/lib/scope/mdpcSvgYellow";

type Viewport = { zoom: number; panX: number; panY: number };

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";

// User-authored MDPC.svg -> PFTracker coordinates.
// Calibrated against RWY 08, 26, 09 and 27 threshold coordinates.
const MDPC_SVG_TRANSFORM =
  "matrix(0.00602718270 0.000692389997 -0.0006984094 0.00603738534 85.6661924 101.218949)";

const MDPC_TAXI_LABELS = [
  { name: "J", x: 85.99, y: 102.48 },
  { name: "E", x: 86.78, y: 103.14 },
  { name: "F", x: 86.56, y: 103.29 },
  { name: "H", x: 87.67, y: 102.40 },
  { name: "G", x: 87.78, y: 102.97 },
  { name: "G", x: 87.74, y: 103.18 },
  { name: "K", x: 88.45, y: 102.90 },
  { name: "B", x: 88.19, y: 103.01 },
  { name: "B", x: 88.17, y: 103.23 },
  { name: "A", x: 89.07, y: 102.58 },
  { name: "A", x: 89.06, y: 103.28 },
  { name: "P", x: 89.58, y: 102.18 },
  { name: "E2", x: 87.35, y: 103.32 },
  { name: "E1", x: 87.69, y: 103.35 },
  { name: "D", x: 87.86, y: 103.40 },
  { name: "R1", x: 87.94, y: 103.31 },
  { name: "R2", x: 88.06, y: 103.32 },
] as const;

// Visual stand labels are tied to the actual lead-in-line ends in the MDPC SVG.
// They intentionally remain separate from aircraft stop coordinates.
const MDPC_STAND_LABELS = [
  { name: "B33", x: 87.00, y: 103.34 },
  { name: "B32", x: 87.06, y: 103.35 },
  { name: "B31", x: 87.12, y: 103.36 },
  { name: "B30", x: 87.19, y: 103.38 },
  { name: "B29", x: 87.20, y: 103.43 },
  { name: "B28", x: 87.20, y: 103.48 },
  { name: "B27", x: 87.19, y: 103.54 },
  { name: "B25", x: 87.19, y: 103.61 },
  { name: "B23", x: 87.43, y: 103.39 },
  { name: "B26", x: 87.43, y: 103.46 },
  { name: "B21", x: 87.43, y: 103.52 },
  { name: "B24", x: 87.64, y: 103.40 },
  { name: "B22", x: 87.64, y: 103.47 },
  { name: "B20", x: 87.64, y: 103.53 },

  // Terminal A: exact left-to-right sequence. 11A was previously skipped,
  // which shifted every label that followed it by one stand.
  { name: "11A", x: 87.568, y: 103.591 },
  { name: "11", x: 87.634, y: 103.599 },
  { name: "10", x: 87.847, y: 103.623 },
  { name: "9A", x: 87.914, y: 103.631 },
  { name: "9", x: 87.980, y: 103.638 },
  { name: "8", x: 88.048, y: 103.646 },
  { name: "7", x: 88.120, y: 103.654 },
  { name: "6", x: 88.192, y: 103.663 },
  { name: "5", x: 88.273, y: 103.672 },
  { name: "4", x: 88.358, y: 103.682 },
  { name: "3", x: 88.446, y: 103.692 },
  { name: "2", x: 88.531, y: 103.702 },
  { name: "1A", x: 88.592, y: 103.709 },
  { name: "1", x: 88.604, y: 103.710 },

  // N positions: labels sit at the free end of each vertical lead-in line.
  { name: "N5", x: 88.252, y: 103.366 },
  { name: "N4", x: 88.310, y: 103.372 },
  { name: "N3", x: 88.371, y: 103.379 },
  { name: "N2", x: 88.432, y: 103.385 },
  { name: "N1", x: 88.496, y: 103.391 },
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

function readableScaleTransform(x: number, y: number, zoom: number) {
  const inverse = 1 / Math.pow(Math.max(zoom, 1), 0.38);
  return `translate(${x} ${y}) scale(${inverse}) translate(${-x} ${-y})`;
}

function ReadableText({
  x,
  y,
  zoom,
  children,
  fontSize = 0.34,
  fill = "#dedfcb",
  anchor = "middle",
}: {
  x: number;
  y: number;
  zoom: number;
  children: ReactNode;
  fontSize?: number;
  fill?: string;
  anchor?: "start" | "middle" | "end";
}) {
  return (
    <g transform={readableScaleTransform(x, y, zoom)}>
      <text
        x={x}
        y={y}
        fontSize={fontSize}
        fill={fill}
        fontFamily="monospace"
        fontWeight={600}
        textAnchor={anchor}
        dominantBaseline="middle"
      >
        {children}
      </text>
    </g>
  );
}

function Fix({
  x,
  y,
  name,
  zoom,
  vor = false,
}: {
  x: number;
  y: number;
  name: string;
  zoom: number;
  vor?: boolean;
}) {
  return (
    <g transform={readableScaleTransform(x, y, zoom)}>
      {vor ? (
        <circle
          cx={x}
          cy={y}
          r={0.15}
          fill="none"
          stroke="#8b9092"
          strokeWidth={0.045}
          vectorEffect="non-scaling-stroke"
        />
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

function YellowPaths({ paths, width }: { paths: readonly string[]; width: number }) {
  return (
    <>
      {paths.map((d, index) => (
        <path
          key={`${width}-${index}`}
          d={d}
          fill="none"
          stroke="#d0d900"
          strokeWidth={width}
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
      ))}
    </>
  );
}

function MdpcSvgAirport({ zoom }: { zoom: number }) {
  if (zoom < 2.35) return null;

  return (
    <g data-map-layer="mdpc-user-svg" transform={MDPC_SVG_TRANSFORM}>
      <g transform={MDPC_SVG_LAYER_TRANSLATE}>
        {MDPC_SVG_GREEN.map((d, index) => (
          <path key={`green-${index}`} d={d} fill="#004000" />
        ))}
        {MDPC_SVG_BLACK.map((d, index) => (
          <path key={`black-${index}`} d={d} fill="#000000" />
        ))}
        {MDPC_SVG_BLUE.map((d, index) => (
          <path key={`blue-${index}`} d={d} fill="#00008d" />
        ))}
        {MDPC_SVG_WHITE_STROKE.map((d, index) => (
          <path key={`white-stroke-${index}`} d={d} fill="none" stroke="#ffffff" strokeWidth={0.246} />
        ))}
        {MDPC_SVG_WHITE_FILL.map((d, index) => (
          <path key={`white-fill-${index}`} d={d} fill="#ffffff" />
        ))}
        <YellowPaths paths={MDPC_SVG_YELLOW_0246} width={0.246} />
        <YellowPaths paths={MDPC_SVG_YELLOW_0247355} width={0.247355} />
        <YellowPaths paths={MDPC_SVG_YELLOW_0204516} width={0.204516} />
        <YellowPaths paths={MDPC_SVG_YELLOW_0250474} width={0.250474} />
        <YellowPaths paths={MDPC_SVG_YELLOW_0260986} width={0.260986} />
      </g>
    </g>
  );
}

function MdpcLabels({ zoom }: { zoom: number }) {
  return (
    <>
      {zoom >= 5.2 && (
        <g data-map-layer="mdpc-taxiway-labels">
          {MDPC_TAXI_LABELS.map((label, index) => (
            <ReadableText
              key={`${label.name}-${index}`}
              x={label.x}
              y={label.y}
              zoom={zoom}
              fontSize={0.34}
              fill="#ffffff"
            >
              {label.name}
            </ReadableText>
          ))}
        </g>
      )}

      {zoom >= 8.5 && (
        <g data-map-layer="mdpc-stand-labels">
          {MDPC_STAND_LABELS.map((stand) => (
            <ReadableText
              key={stand.name}
              x={stand.x}
              y={stand.y}
              zoom={zoom}
              fontSize={0.25}
              fill="#ffffff"
            >
              {stand.name}
            </ReadableText>
          ))}
        </g>
      )}
    </>
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

        <MdpcSvgAirport zoom={viewport.zoom} />

        <g data-map-layer="fixes">
          {WAYPOINTS.map((waypoint) => (
            <Fix
              key={waypoint.name}
              x={waypoint.x}
              y={waypoint.y}
              name={waypoint.name}
              zoom={viewport.zoom}
              vor={waypoint.kind === "vor"}
            />
          ))}
        </g>

        <MdpcLabels zoom={viewport.zoom} />
      </svg>
    </div>,
    host,
  );
}
