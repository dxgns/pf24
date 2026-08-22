"use client";

import { useEffect } from "react";

const VIEWPORT_EVENT = "pf24-radar-viewport";

// Cleaned TWR geometry from the PF24 map references.
// MDPC: the western corridor is a true parallelogram (parallel top/bottom edges,
// matching vertical separation at both ends) before joining the circular portions.
const MDPC_TWR_PATH =
  "M 74.11 101.54 L 74.11 103.24 L 83.05 103.45 C 83.55 105.35 85.20 107.00 87.44 107.00 C 89.65 107.00 91.30 105.25 91.80 103.38 L 93.15 103.40 L 93.16 101.87 L 91.83 101.83 C 91.25 99.90 89.65 98.23 87.47 98.23 C 85.28 98.23 83.60 99.84 83.05 101.75 L 74.11 101.54 Z";

// MDST: the western corridor is parallel and the lower corridor now continues
// farther as a straight line before entering the CIRCULO 2 arc. The new UNION 6
// still defines a true circular arc through CIRCULO 2 (67.15,95.86) to UNION 1.
const MDST_TWR_PATH =
  "M 70.65 95.15 L 71.50 93.00 A 3.12332709 3.12332709 0 0 0 65.49 91.48 L 60.34 88.99 L 60.05 90.17 L 65.75 92.93 A 2.77293371 2.77293371 0 0 0 70.65 95.15 Z";

function patchTwrGeometry() {
  const root = document.querySelector<HTMLElement>("[data-pf24-vector-map='true']");
  if (!root) return;

  const mdpc = root.querySelector<SVGPathElement>("path[data-map-layer='mdpc-twr']");
  const mdst = root.querySelector<SVGPathElement>("path[data-map-layer='mdst-twr']");

  if (mdpc && mdpc.getAttribute("d") !== MDPC_TWR_PATH) mdpc.setAttribute("d", MDPC_TWR_PATH);
  if (mdst && mdst.getAttribute("d") !== MDST_TWR_PATH) mdst.setAttribute("d", MDST_TWR_PATH);
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
