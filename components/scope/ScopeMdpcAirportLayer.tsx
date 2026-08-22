"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { MAP_BOUNDS } from "@/lib/scope/mapData";
import { MDPC_SVG_LABELS, type MdpcSvgLabel } from "@/lib/scope/mdpcSvgAnnotations";

type Viewport = { zoom: number; panX: number; panY: number };

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";
const MDPC_DETAIL_ZOOM = 2.35;

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

function labelPlacement(label: MdpcSvgLabel) {
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

export default function ScopeMdpcAirportLayer() {
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

  if (!host || viewport.zoom < MDPC_DETAIL_ZOOM) return null;

  return createPortal(
    <div data-pf24-mdpc-svg-layer="true" className="pointer-events-none absolute inset-0 z-[4] overflow-hidden" aria-hidden="true">
      <svg
        className="absolute inset-0 block h-full w-full"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{
          transformOrigin: "0 0",
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
        }}
      >
        <g data-map-layer="mdpc-corrected-svg-low">
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

        <g data-map-layer="mdpc-svg-labels-upright-low">
          {MDPC_SVG_LABELS.map((label, index) => {
            const placement = labelPlacement(label);
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
      </svg>
    </div>,
    host,
  );
}
