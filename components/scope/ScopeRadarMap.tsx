"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
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
import {
  MDPC_SVG_GRAY_STROKES,
  MDPC_SVG_LABELS,
  MDPC_SVG_RED_STROKES,
  type MdpcSvgLabel,
} from "@/lib/scope/mdpcSvgAnnotations";

type Viewport = { zoom: number; panX: number; panY: number };

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";

// User-authored MDPC.svg -> PFTracker coordinates.
// Calibrated against RWY 08, 26, 09 and 27 threshold coordinates.
const MDPC_SVG_TRANSFORM =
  "matrix(0.00602718270 0.000692389997 -0.0006984094 0.00603738534 85.6661924 101.218949)";

const MDPC_MAP_MATRIX = {
  a: 0.00602718270,
  b: 0.000692389997,
  c: -0.0006984094,
  d: 0.00603738534,
  e: 85.6661924,
  f: 101.218949,
} as const;
const MDPC_LAYER_OFFSET = { x: -50.204581, y: -68.619965 } as const;
const MDPC_MAP_SCALE = (
  Math.hypot(MDPC_MAP_MATRIX.a, MDPC_MAP_MATRIX.b) +
  Math.hypot(MDPC_MAP_MATRIX.c, MDPC_MAP_MATRIX.d)
) / 2;

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

function mdpcSvgLabelPlacement(label: MdpcSvgLabel) {
  let localX = label.x;
  let localY = label.y;
  let localScale = 1;

  const matrixMatch = label.transform.match(/^matrix\(([^)]+)\)$/);
  const translateMatch = label.transform.match(/^translate\(([^)]+)\)$/);

  if (matrixMatch) {
    const values = matrixMatch[1].split(/[ ,]+/).map(Number);
    if (values.length === 6 && values.every(Number.isFinite)) {
      const [a, b, c, d, e, f] = values;
      const x = a * label.x + c * label.y + e;
      const y = b * label.x + d * label.y + f;
      localX = x;
      localY = y;
      localScale = (Math.hypot(a, b) + Math.hypot(c, d)) / 2;
    }
  } else if (translateMatch) {
    const values = translateMatch[1].split(/[ ,]+/).map(Number);
    if (values.length >= 1 && values.every(Number.isFinite)) {
      localX += values[0] ?? 0;
      localY += values[1] ?? 0;
    }
  }

  localX += MDPC_LAYER_OFFSET.x;
  localY += MDPC_LAYER_OFFSET.y;

  return {
    x: MDPC_MAP_MATRIX.a * localX + MDPC_MAP_MATRIX.c * localY + MDPC_MAP_MATRIX.e,
    y: MDPC_MAP_MATRIX.b * localX + MDPC_MAP_MATRIX.d * localY + MDPC_MAP_MATRIX.f,
    fontSize: 16 * localScale * MDPC_MAP_SCALE,
  };
}

function MdpcSvgAirport({ zoom }: { zoom: number }) {
  if (zoom < 2.35) return null;

  return (
    <>
      <g data-map-layer="mdpc-user-svg" transform={MDPC_SVG_TRANSFORM}>
        <g transform={MDPC_SVG_LAYER_TRANSLATE}>
          {MDPC_SVG_GREEN[0] && <path d={MDPC_SVG_GREEN[0]} fill="#004000" />}

          {MDPC_SVG_BLACK.map((d, index) => (
            <path key={`black-${index}`} d={d} fill="#000000" />
          ))}

          {MDPC_SVG_GREEN.slice(1).map((d, index) => (
            <path key={`green-overlay-${index}`} d={d} fill="#004000" />
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

          {MDPC_SVG_GRAY_STROKES.map((d, index) => (
            <path
              key={`gray-detail-${index}`}
              d={d}
              fill="none"
              stroke="#c9c9c9"
              strokeWidth={0.246}
            />
          ))}

          {MDPC_SVG_RED_STROKES.map((d, index) => (
            <path
              key={`red-detail-${index}`}
              d={d}
              fill="none"
              stroke="#7e0000"
              strokeWidth={0.246}
            />
          ))}
        </g>
      </g>

      {/* Keep all MDPC annotations horizontal in map coordinates. Their anchor
          positions still come from the original SVG; only SVG rotation/shear is removed. */}
      <g data-map-layer="mdpc-svg-labels-upright">
        {MDPC_SVG_LABELS.map((label, index) => {
          const placement = mdpcSvgLabelPlacement(label);
          return (
            <text
              key={`${label.text}-${index}`}
              x={placement.x}
              y={placement.y}
              fill={label.fill}
              fontFamily="'B612 Mono', monospace"
              fontSize={placement.fontSize}
              fontWeight={400}
            >
              {label.text}
            </text>
          );
        })}
      </g>
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
              key={`${waypoint.name}-${waypoint.x}-${waypoint.y}`}
              x={waypoint.x}
              y={waypoint.y}
              name={waypoint.name}
              zoom={viewport.zoom}
              vor={waypoint.kind === "vor"}
            />
          ))}
        </g>
      </svg>
    </div>,
    host,
  );
}
