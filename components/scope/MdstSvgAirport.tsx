"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { MAP_BOUNDS } from "@/lib/scope/mapData";

type Viewport = { zoom: number; panX: number; panY: number };
type MdstLabel = { text: string; x: number; y: number; transform: string; fill: string };

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";
const MDST_DETAIL_ZOOM = 2.35;

const MDST_IMAGE_MATRIX = {
  a: 0.0032079413749857145,
  b: 0.0013861513146006619,
  c: -0.0013861513146006619,
  d: 0.0032079413749857145,
  e: 67.13385340499863,
  f: 92.27547978264633,
} as const;
const MDST_IMAGE_TRANSFORM = `matrix(${MDST_IMAGE_MATRIX.a} ${MDST_IMAGE_MATRIX.b} ${MDST_IMAGE_MATRIX.c} ${MDST_IMAGE_MATRIX.d} ${MDST_IMAGE_MATRIX.e} ${MDST_IMAGE_MATRIX.f})`;
const MDST_SOURCE_LAYER_OFFSET = { x: -3.5, y: -283.5 } as const;
const MDST_MAP_MATRIX = {
  a: MDST_IMAGE_MATRIX.a,
  b: MDST_IMAGE_MATRIX.b,
  c: MDST_IMAGE_MATRIX.c,
  d: MDST_IMAGE_MATRIX.d,
  e: MDST_IMAGE_MATRIX.e + MDST_IMAGE_MATRIX.a * MDST_SOURCE_LAYER_OFFSET.x + MDST_IMAGE_MATRIX.c * MDST_SOURCE_LAYER_OFFSET.y,
  f: MDST_IMAGE_MATRIX.f + MDST_IMAGE_MATRIX.b * MDST_SOURCE_LAYER_OFFSET.x + MDST_IMAGE_MATRIX.d * MDST_SOURCE_LAYER_OFFSET.y,
} as const;
const MDST_MAP_SCALE = Math.hypot(MDST_MAP_MATRIX.a, MDST_MAP_MATRIX.b);

const MDST_LABELS: readonly MdstLabel[] = [
  { text: "A", x: -295.375, y: 258.03086, transform: "translate(733.12233,88.08914)", fill: "#c9c9c9" },
  { text: "B", x: -295.375, y: 258.03086, transform: "translate(865.47178,88.432936)", fill: "#c9c9c9" },
  { text: "11", x: -295.375, y: 258.03086, transform: "matrix(0.07291631,0,0,0.07660707,63.429095,295.68029)", fill: "#f1f1f1" },
  { text: "29", x: -295.375, y: 258.03086, transform: "matrix(0.07291631,0,0,0.07660707,787.30827,297.18948)", fill: "#f1f1f1" },
  { text: "A1", x: -295.375, y: 258.03086, transform: "matrix(0.21715218,0,0,0.19713917,482.42326,358.05635)", fill: "#c9c9c9" },
  { text: "A2", x: -295.375, y: 258.03086, transform: "matrix(0.21715218,0,0,0.19713917,475.06838,357.99242)", fill: "#c9c9c9" },
  { text: "A3", x: -295.375, y: 258.03086, transform: "matrix(0.21715218,0,0,0.19713917,467.69338,357.92992)", fill: "#c9c9c9" },
  { text: "A4", x: -295.375, y: 258.03086, transform: "matrix(0.21715218,0,0,0.19713917,461.08577,357.87186)", fill: "#c9c9c9" },
  { text: "B6", x: -295.375, y: 258.03086, transform: "matrix(0.21715218,0,0,0.19713917,548.20367,365.00449)", fill: "#c9c9c9" },
  { text: "B5", x: -295.375, y: 258.03086, transform: "matrix(0.21715218,0,0,0.19713917,556.48493,362.47325)", fill: "#c9c9c9" },
  { text: "B4", x: -295.375, y: 258.03086, transform: "matrix(0.21715218,0,0,0.19713917,565.51617,355.24622)", fill: "#c9c9c9" },
  { text: "B3", x: -295.375, y: 258.03086, transform: "matrix(0.21715218,0,0,0.19713917,579.9068,348.92992)", fill: "#c9c9c9" },
  { text: "B2R", x: -295.375, y: 258.03086, transform: "matrix(0.21715218,0,0,0.19713917,593.04539,346.20784)", fill: "#c9c9c9" },
  { text: "B2", x: -295.375, y: 258.03086, transform: "matrix(0.21715218,0,0,0.19713917,589.87555,349.14512)", fill: "#c9c9c9" },
  { text: "B1", x: -295.375, y: 258.03086, transform: "matrix(0.21715218,0,0,0.19713917,599.4068,355.42637)", fill: "#c9c9c9" },
  { text: "C4", x: -295.375, y: 258.03086, transform: "matrix(0.21715218,0,0,0.19713917,642.23503,356.35821)", fill: "#c9c9c9" },
  { text: "C3", x: -295.375, y: 258.03086, transform: "matrix(0.21715218,0,0,0.19713917,649.38088,358.17992)", fill: "#c9c9c9" },
  { text: "C2", x: -295.375, y: 258.03086, transform: "matrix(0.21715218,0,0,0.19713917,663.03713,358.27367)", fill: "#c9c9c9" },
  { text: "C1", x: -295.375, y: 258.03086, transform: "matrix(0.21715218,0,0,0.19713917,676.28713,358.46117)", fill: "#c9c9c9" },
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

function labelPlacement(label: MdstLabel) {
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
    x: MDST_MAP_MATRIX.a * localX + MDST_MAP_MATRIX.c * localY + MDST_MAP_MATRIX.e,
    y: MDST_MAP_MATRIX.b * localX + MDST_MAP_MATRIX.d * localY + MDST_MAP_MATRIX.f,
    fontSize: 16 * localScale * MDST_MAP_SCALE,
  };
}

export default function MdstSvgAirport() {
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

  if (!host || viewport.zoom < MDST_DETAIL_ZOOM) return null;

  return createPortal(
    <div data-pf24-mdst-svg="true" className="pointer-events-none absolute inset-0 z-[6] overflow-hidden" aria-hidden="true">
      <svg
        className="absolute inset-0 block h-full w-full"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{ transformOrigin: "0 0", transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})` }}
      >
        <image href="/scope/mdst-ground.svg" x={0} y={0} width={814.5} height={167} transform={MDST_IMAGE_TRANSFORM} preserveAspectRatio="none" />
        <g data-map-layer="mdst-svg-labels-upright">
          {MDST_LABELS.map((label, index) => {
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
