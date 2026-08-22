"use client";

import { useEffect } from "react";

const VIEWPORT_EVENT = "pf24-radar-viewport";

// Keep only the accepted MDPC TWR geometry correction here.
// MDST TWR is rendered directly from ScopeRadarMap and must not be overwritten at runtime.
const MDPC_TWR_PATH =
  "M 74.11 101.54 L 74.11 103.24 L 83.05 103.45 C 83.55 105.35 85.20 107.00 87.44 107.00 C 89.65 107.00 91.30 105.25 91.80 103.38 L 93.15 103.40 L 93.16 101.87 L 91.83 101.83 C 91.25 99.90 89.65 98.23 87.47 98.23 C 85.28 98.23 83.60 99.84 83.05 101.75 L 74.11 101.54 Z";

function patchTwrGeometry() {
  const root = document.querySelector<HTMLElement>("[data-pf24-vector-map='true']");
  if (!root) return;

  const mdpc = root.querySelector<SVGPathElement>("path[data-map-layer='mdpc-twr']");
  if (mdpc && mdpc.getAttribute("d") !== MDPC_TWR_PATH) {
    mdpc.setAttribute("d", MDPC_TWR_PATH);
  }
}

export default function ScopeTwrGeometryCorrection() {
  useEffect(() => {
    patchTwrGeometry();

    const onViewport = () => patchTwrGeometry();
    window.addEventListener(VIEWPORT_EVENT, onViewport);

    const observer = new MutationObserver(() => patchTwrGeometry());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["d"],
    });

    const retries = window.setInterval(patchTwrGeometry, 250);
    const stopRetries = window.setTimeout(() => window.clearInterval(retries), 5000);

    return () => {
      window.removeEventListener(VIEWPORT_EVENT, onViewport);
      observer.disconnect();
      window.clearInterval(retries);
      window.clearTimeout(stopRetries);
    };
  }, []);

  return null;
}
