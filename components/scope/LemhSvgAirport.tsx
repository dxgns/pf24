"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { MAP_BOUNDS } from "@/lib/scope/mapData";

type Viewport = { zoom: number; panX: number; panY: number };
type LemhLabel = {
  text: string;
  x: number;
  y: number;
  kind: "taxi" | "runway";
};

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";
const AIRPORT_DETAIL_MIN_ZOOM = 2.35;

// Calibrated from the pavement endpoints in the supplied LEMH SVG:
// RWY19 pavement end -> (126.56, 64.82)
// RWY01 pavement end -> (126.31, 66.76)
// The source anchors are the center points of the black runway pavement ends,
// not the inset white threshold markings.
const LEMH_TRANSFORM =
  "matrix(-0.000361817027 0.002778050163 -0.002778050163 -0.000361817027 127.347159816 64.648527722)";

// LEMH labels are intentionally rendered outside the airport SVG so they stay
// upright on screen instead of inheriting the airport rotation. Positions are
// the original SVG text anchors transformed into Scope map coordinates.
const LEMH_LABELS: LemhLabel[] = [
  { text: "F", x: 126.54545, y: 65.25813, kind: "taxi" },
  { text: "T", x: 126.62009, y: 65.03821, kind: "taxi" },
  { text: "T", x: 126.56572, y: 65.45567, kind: "taxi" },
  { text: "T", x: 126.51543, y: 65.84182, kind: "taxi" },
  { text: "T", x: 126.45971, y: 66.26964, kind: "taxi" },
  { text: "T", x: 126.41074, y: 66.66726, kind: "taxi" },
  { text: "C", x: 126.41602, y: 66.45323, kind: "taxi" },
  { text: "A2", x: 126.34889, y: 66.81863, kind: "taxi" },
  { text: "A1", x: 126.37235, y: 66.68219, kind: "taxi" },
  { text: "D", x: 126.45463, y: 66.08841, kind: "taxi" },
  { text: "D", x: 126.60006, y: 66.09142, kind: "taxi" },
  { text: "J", x: 126.77156, y: 65.69277, kind: "taxi" },
  { text: "J", x: 126.74994, y: 65.21295, kind: "taxi" },
  { text: "NR", x: 126.62538, y: 64.69118, kind: "taxi" },
  { text: "NL", x: 126.60673, y: 64.83312, kind: "taxi" },
  { text: "19", x: 126.55526, y: 64.84811, kind: "runway" },
  { text: "01", x: 126.31312, y: 66.7272, kind: "runway" },
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

export default function LemhSvgAirport() {
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

  const showAirportDetail = viewport.zoom >= AIRPORT_DETAIL_MIN_ZOOM;

  return createPortal(
    <div className="pointer-events-none absolute inset-0 z-[4] overflow-hidden" aria-hidden="true">
      <svg
        className="absolute inset-0 block h-full w-full"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{
          transformOrigin: "0 0",
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
        }}
      >
        <image
          href="/scope/lemh-ground.svg"
          x={0}
          y={0}
          width={834.60175}
          height={301.22748}
          transform={LEMH_TRANSFORM}
          preserveAspectRatio="none"
          opacity={showAirportDetail ? 1 : 0}
        />

        <g data-map-layer="lemh-upright-labels" opacity={showAirportDetail ? 1 : 0}>
          {LEMH_LABELS.map((label, index) => (
            <text
              key={`${label.text}-${index}`}
              x={label.x}
              y={label.y}
              fill={label.kind === "runway" ? "#f1f1f1" : "#c9c9c9"}
              fontFamily="'B612 Mono', monospace"
              fontSize={label.kind === "runway" ? 0.006 : 0.032}
              fontWeight={400}
              textAnchor="middle"
              dominantBaseline="middle"
              data-pf24-map-label-kind={label.kind}
            >
              {label.text}
            </text>
          ))}
        </g>
      </svg>
    </div>,
    host,
  );
}
