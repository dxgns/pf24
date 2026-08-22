"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { MAP_BOUNDS } from "@/lib/scope/mapData";

type Viewport = { zoom: number; panX: number; panY: number };
type MdabLabel = { text: string; x: number; y: number; transform: string; fill: string };

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";
const MDAB_DETAIL_ZOOM = 2.35;

// Recalibrated from the uploaded MDAB runway centreline to the corrected Scope
// RWY 11 (80.82, 95.44) and RWY 29 (82.26, 95.70) coordinates.
// The same matrix moves/scales/rotates the entire airport so the ground layout
// remains aligned with the corrected runway position.
const MDAB_IMAGE_MATRIX = {
  a: 0.0022142259719154906,
  b: 0.0004340446900998935,
  c: -0.0004340446900998935,
  d: 0.0022142259719154906,
  e: 80.64512888581041,
  f: 94.97337997863933,
} as const;
const MDAB_IMAGE_TRANSFORM = `matrix(${MDAB_IMAGE_MATRIX.a} ${MDAB_IMAGE_MATRIX.b} ${MDAB_IMAGE_MATRIX.c} ${MDAB_IMAGE_MATRIX.d} ${MDAB_IMAGE_MATRIX.e} ${MDAB_IMAGE_MATRIX.f})`;
const MDAB_SOURCE_LAYER_OFFSET = { x: -16.183031, y: -136.55389 } as const;
const MDAB_MAP_MATRIX = {
  a: MDAB_IMAGE_MATRIX.a,
  b: MDAB_IMAGE_MATRIX.b,
  c: MDAB_IMAGE_MATRIX.c,
  d: MDAB_IMAGE_MATRIX.d,
  e: MDAB_IMAGE_MATRIX.e + MDAB_IMAGE_MATRIX.a * MDAB_SOURCE_LAYER_OFFSET.x + MDAB_IMAGE_MATRIX.c * MDAB_SOURCE_LAYER_OFFSET.y,
  f: MDAB_IMAGE_MATRIX.f + MDAB_IMAGE_MATRIX.b * MDAB_SOURCE_LAYER_OFFSET.x + MDAB_IMAGE_MATRIX.d * MDAB_SOURCE_LAYER_OFFSET.y,
} as const;
const MDAB_MAP_SCALE = Math.hypot(MDAB_MAP_MATRIX.a, MDAB_MAP_MATRIX.b);

const MDAB_LABELS: readonly MdabLabel[] = [
  { text: "29", x: -295.375, y: 258.03086, transform: "matrix(0.07291631,0,0,0.07660707,790.15647,295.64675)", fill: "#f1f1f1" },
  { text: "11", x: -295.375, y: 258.03086, transform: "matrix(0.07291631,0,0,0.07660707,164.38494,305.00547)", fill: "#f1f1f1" },
  { text: "A", x: -295.375, y: 258.03086, transform: "translate(575.47272,26.402513)", fill: "#c9c9c9" },
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

function labelPlacement(label: MdabLabel) {
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

  return {
    x: MDAB_MAP_MATRIX.a * localX + MDAB_MAP_MATRIX.c * localY + MDAB_MAP_MATRIX.e,
    y: MDAB_MAP_MATRIX.b * localX + MDAB_MAP_MATRIX.d * localY + MDAB_MAP_MATRIX.f,
    fontSize: 16 * localScale * MDAB_MAP_SCALE,
  };
}

export default function MdabSvgAirport() {
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

  if (!host || viewport.zoom < MDAB_DETAIL_ZOOM) return null;

  return createPortal(
    <div data-pf24-mdab-svg="true" className="pointer-events-none absolute inset-0 z-[6] overflow-hidden" aria-hidden="true">
      <svg
        className="absolute inset-0 block h-full w-full"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{ transformOrigin: "0 0", transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})` }}
      >
        <image href="/scope/mdab-ground.svg" x={0} y={0} width={794.06701} height={215.94569} transform={MDAB_IMAGE_TRANSFORM} preserveAspectRatio="none" />
        <g data-map-layer="mdab-svg-labels-upright">
          {MDAB_LABELS.map((label, index) => {
            const placement = labelPlacement(label);
            return (
              <text key={`${label.text}-${index}`} x={placement.x} y={placement.y} fill={label.fill} fontFamily="'B612 Mono', monospace" fontSize={placement.fontSize} fontWeight={400}>
                {label.text}
              </text>
            );
          })}
        </g>
      </svg>
    </div>,
    host,
  );
}
