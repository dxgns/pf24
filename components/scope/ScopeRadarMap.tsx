"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import {
  AIRSPACE_PATHS,
  MAP_BOUNDS,
  WAYPOINTS,
  type MapPath,
} from "@/lib/scope/mapData";
import { MDPC_SVG_LABELS, type MdpcSvgLabel } from "@/lib/scope/mdpcSvgAnnotations";

type Viewport = { zoom: number; panX: number; panY: number };

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";

// Calibrated against the supplied PF map reference so the coastline matches
// the existing fixes and airport placements in the PF24 Scope coordinate frame.
const HISPANIOLA_SVG_TRANSFORM =
  "matrix(0.19083778 0.00039669 0.00187641 0.18849282 26.08185468 84.46004555)";
const HISPANIOLA_SVG_WIDTH = 344.39517;
const HISPANIOLA_SVG_HEIGHT = 141.20445;

// MDST APP boundary: BEREL -> PIXES -> UNION 1 -> smooth half-ellipse -> UNION 2 -> UNION 3.
// The original left reference at x=54.51 is kept, but its y is moved to 90.425 so the
// curve can meet UNION 1 and UNION 2 with clean horizontal tangents instead of overshooting.
const MDST_APP_PATH =
  "M 71.24 94.06 L 73.93 85.06 L 63.07 83.24 C 58.34244 83.24 54.51 86.45683 54.51 90.425 C 54.51 94.39317 58.53048 97.61 63.49 97.61 L 71.20 97.61 Z";

// MDPC APP boundary: PIXES -> PC202 -> LETAD -> MESPA -> smooth lower arc through
// CIRCULO 1 -> CIRCULO 2 -> BEREL. The lower section uses two cubic curves so MESPA
// and CIRCULO 2 join their nearly vertical straight segments cleanly while CIRCULO 1
// remains the lowest reference point of the rounded boundary.
const MDPC_APP_PATH =
  "M 73.93 85.06 L 83.72 84.96 L 100.56 96.22 L 99.61 103.25 C 99.23 106.06 94.10 110.25 87.36 110.25 C 79.10 110.25 71.19 106.00 71.20 102.55 L 71.24 94.06 Z";

// MDPC TWR boundary. The straight corridor sections end at UNION 3/4/7/8 and the
// circular portions begin there with their own direction; the joins are intentionally
// not tangent-smoothed. Both rounded portions still pass exactly through the supplied
// 2 NM references CIRCULO 1 (87.44,107.00) and CIRCULO 2 (87.47,98.23).
const MDPC_TWR_PATH =
  "M 73.97 101.54 L 74.11 103.24 L 83.05 103.45 C 83.55 105.35 85.20 107.00 87.44 107.00 C 89.65 107.00 91.30 105.25 91.80 103.38 L 93.15 103.40 L 93.16 101.87 L 91.83 101.83 C 91.25 99.90 89.65 98.23 87.47 98.23 C 85.25 98.23 83.45 99.85 82.86 101.72 L 73.97 101.54 Z";

// MDST TWR boundary. UNION 2 -> UNION 3 is a true circular arc through CIRCULO 1,
// and UNION 6 -> UNION 1 is a true circular arc through CIRCULO 2. The radii are
// calculated from each supplied three-point arc, preserving the straight/arc joins.
const MDST_TWR_PATH =
  "M 70.79 95.09 L 71.70 93.08 A 3.24791575 3.24791575 0 0 0 65.49 91.48 L 60.34 88.99 L 60.32 90.56 L 65.03 92.65 A 3.36161385 3.36161385 0 0 0 70.79 95.09 Z";

// TWR styling is shared by MDPC, MDST, MDAB and MDCR.
const TWR_STROKE = "#176997";
const TWR_STROKE_WIDTH = 0.11;
const TWR_DASH = "0.38 0.28";

// The existing MDPC TWR 2 NM references are about 4.385 map units from PNA.
// Scaling that established Scope distance gives 3.28875 map units for a 1.50 NM radius.
const TWR_RADIUS_1_5_NM = 3.28875;
const MDAB_TWR_CENTER = { x: 81.52, y: 95.57 } as const;
const MDCR_TWR_CENTER = { x: 57.83, y: 109.65 } as const;

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
const MDPC_SVG_PARTS = [1, 2, 3, 4] as const;

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
  if (tone === "tower") return { stroke: TWR_STROKE, width: TWR_STROKE_WIDTH, dash: TWR_DASH };
  if (tone === "runway") return { stroke: "#82898b", width: 0.2, dash: undefined };
  return { stroke: "#777d7f", width: 0.075, dash: undefined };
}

function readableScaleTransform(x: number, y: number, zoom: number) {
  const inverse = 1 / Math.pow(Math.max(zoom, 1), 0.38);
  return `translate(${x} ${y}) scale(${inverse}) translate(${-x} ${-y})`;
}

function Fix({ x, y, name, zoom, vor = false }: { x: number; y: number; name: string; zoom: number; vor?: boolean }) {
  return (
    <g transform={readableScaleTransform(x, y, zoom)}>
      {vor ? (
        <circle cx={x} cy={y} r={0.15} fill="none" stroke="#8b9092" strokeWidth={0.045} vectorEffect="non-scaling-stroke" />
      ) : (
        <path d={`M ${x} ${y - 0.10} L ${x - 0.085} ${y + 0.065} L ${x + 0.085} ${y + 0.065} Z`} fill="none" stroke="#777d7f" strokeWidth={0.04} vectorEffect="non-scaling-stroke" />
      )}
      <text x={x + 0.16} y={y + 0.095} fontSize={0.46} fill="#73797b" fontFamily="monospace">{name}</text>
    </g>
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
      localX = a * label.x + c * label.y + e;
      localY = b * label.x + d * label.y + f;
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
      <g data-map-layer="mdpc-corrected-svg">
        {MDPC_SVG_PARTS.map((part) => (
          <image
            key={part}
            href={`/scope/mdpc-ground-${part}.svg`}
            x={0}
            y={0}
            width={803.79541}
            height={396.38004}
            transform={MDPC_SVG_TRANSFORM}
            preserveAspectRatio="none"
          />
        ))}
      </g>

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
    <div data-pf24-vector-map="true" className="pointer-events-none absolute inset-0 z-[6] overflow-hidden" aria-hidden="true">
      <svg className="absolute inset-0 block h-full w-full" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" style={{ transformOrigin: "0 0", transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})` }}>
        <g data-map-layer="hispaniola-coastline">
          <image
            href="/scope/hispaniola.svg"
            x={0}
            y={0}
            width={HISPANIOLA_SVG_WIDTH}
            height={HISPANIOLA_SVG_HEIGHT}
            transform={HISPANIOLA_SVG_TRANSFORM}
            preserveAspectRatio="none"
          />
        </g>
        <g data-map-layer="airspace">
          {AIRSPACE_PATHS.map((airspace) => {
            const style = pathStyle(airspace.tone);
            if (airspace.id === "MDST_APP") {
              return <path key={airspace.id} d={MDST_APP_PATH} fill="none" stroke={style.stroke} strokeWidth={style.width} strokeDasharray={style.dash} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
            }
            if (airspace.id === "MDPC_APP") {
              return <path key={airspace.id} d={MDPC_APP_PATH} fill="none" stroke={style.stroke} strokeWidth={style.width} strokeDasharray={style.dash} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
            }
            return <polyline key={airspace.id} points={points(airspace)} fill="none" stroke={style.stroke} strokeWidth={style.width} strokeDasharray={style.dash} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
          })}
          <path data-map-layer="mdpc-twr" d={MDPC_TWR_PATH} fill="none" stroke={TWR_STROKE} strokeWidth={TWR_STROKE_WIDTH} strokeDasharray={TWR_DASH} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path data-map-layer="mdst-twr" d={MDST_TWR_PATH} fill="none" stroke={TWR_STROKE} strokeWidth={TWR_STROKE_WIDTH} strokeDasharray={TWR_DASH} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <circle data-map-layer="mdab-twr" cx={MDAB_TWR_CENTER.x} cy={MDAB_TWR_CENTER.y} r={TWR_RADIUS_1_5_NM} fill="none" stroke={TWR_STROKE} strokeWidth={TWR_STROKE_WIDTH} strokeDasharray={TWR_DASH} vectorEffect="non-scaling-stroke" />
          <circle data-map-layer="mdcr-twr" cx={MDCR_TWR_CENTER.x} cy={MDCR_TWR_CENTER.y} r={TWR_RADIUS_1_5_NM} fill="none" stroke={TWR_STROKE} strokeWidth={TWR_STROKE_WIDTH} strokeDasharray={TWR_DASH} vectorEffect="non-scaling-stroke" />
        </g>
        <MdpcSvgAirport zoom={viewport.zoom} />
        <g data-map-layer="fixes">
          {WAYPOINTS.map((waypoint) => <Fix key={`${waypoint.name}-${waypoint.x}-${waypoint.y}`} x={waypoint.x} y={waypoint.y} name={waypoint.name} zoom={viewport.zoom} vor={waypoint.kind === "vor"} />)}
        </g>
      </svg>
    </div>,
    host,
  );
}
