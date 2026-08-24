"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { MAP_BOUNDS } from "@/lib/scope/mapData";

type Viewport = { zoom: number; panX: number; panY: number };

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";

// Recalibrated from the supplied PFTracker reference using SARGO, MEROS,
// MORSS, GINRE and ELTAN as map anchors. The visible Menorca coastline in
// that reference occupies approximately x=119.7..127.5 / y=60.5..67.1.
// A uniform scale preserves the authored island shape while placing LEMH in
// the southeast portion of the island, matching the reference.
const MENORCA_SVG_TRANSFORM = "matrix(0.0177 0 0 0.0177 119.70 60.50)";
const MENORCA_SVG_WIDTH = 439.45059;
const MENORCA_SVG_HEIGHT = 371.6109;

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

export default function ScopeMenorcaIsland() {
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
    <div data-pf24-menorca-layer="true" className="pointer-events-none absolute inset-0 z-[2] overflow-hidden" aria-hidden="true">
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
          href="/scope/menorca.svg"
          x={0}
          y={0}
          width={MENORCA_SVG_WIDTH}
          height={MENORCA_SVG_HEIGHT}
          transform={MENORCA_SVG_TRANSFORM}
          preserveAspectRatio="none"
        />
      </svg>
    </div>,
    host,
  );
}
