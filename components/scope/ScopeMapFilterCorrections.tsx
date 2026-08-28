"use client";

import { useEffect } from "react";

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";
const FIR_BASE_STROKE = 0.16;

function storedZoom() {
  try {
    const parsed = JSON.parse(localStorage.getItem(VIEWPORT_KEY) ?? "{}") as { zoom?: number };
    return typeof parsed.zoom === "number" && Number.isFinite(parsed.zoom) ? parsed.zoom : 1;
  } catch {
    return 1;
  }
}

function firStrokeForZoom(zoom: number) {
  const safeZoom = Math.max(zoom, 0.05);
  if (safeZoom >= 1) return null;

  // The whole radar SVG is CSS-scaled, so vectorEffect alone cannot prevent
  // sub-pixel FIR/CTR lines from fading at wide zoom levels. Keep their final
  // on-screen thickness close to the normal value and add a small smooth boost
  // as the user zooms farther out.
  const targetScreenStroke = FIR_BASE_STROKE + (1 - safeZoom) * 0.09;
  return targetScreenStroke / safeZoom;
}

function applyFirZoomStroke(zoom: number) {
  const stroke = firStrokeForZoom(zoom);
  const lines = document.querySelectorAll<SVGPolylineElement>(
    "[data-map-layer='fir-airspace'] > polyline",
  );

  for (const line of Array.from(lines)) {
    if (stroke === null) {
      line.style.removeProperty("stroke-width");
    } else {
      line.style.strokeWidth = String(stroke);
    }
  }
}

export default function ScopeMapFilterCorrections() {
  useEffect(() => {
    let currentZoom = storedZoom();
    applyFirZoomStroke(currentZoom);

    const onViewport = (event: Event) => {
      const detail = (event as CustomEvent<{ zoom?: number }>).detail;
      if (typeof detail?.zoom === "number" && Number.isFinite(detail.zoom)) {
        currentZoom = detail.zoom;
        applyFirZoomStroke(currentZoom);
      }
    };

    const radar = document.querySelector<HTMLElement>("main.fixed > section");
    const observer = radar
      ? new MutationObserver(() => applyFirZoomStroke(currentZoom))
      : null;
    if (radar && observer) observer.observe(radar, { childList: true, subtree: true });

    window.addEventListener(VIEWPORT_EVENT, onViewport);
    return () => {
      observer?.disconnect();
      window.removeEventListener(VIEWPORT_EVENT, onViewport);
    };
  }, []);

  return (
    <style>{`
      [data-pf24-map-filter-ctrs='off'] [data-map-layer='fir-airspace'] {
        display: none !important;
      }

      [data-pf24-map-filter-terrain='off'] [data-pf24-menorca-layer='true'] {
        display: none !important;
      }
    `}</style>
  );
}
