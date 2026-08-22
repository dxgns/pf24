"use client";

import { useEffect } from "react";

const VIEWPORT_EVENT = "pf24-radar-viewport";

// Cleaned TWR geometry from the PF24 map references.
// MDPC: the western corridor is a true parallelogram (parallel top/bottom edges,
// matching vertical separation at both ends) before joining the circular portions.
const MDPC_TWR_PATH =
  "M 74.11 101.54 L 74.11 103.24 L 83.05 103.45 C 83.55 105.35 85.20 107.00 87.44 107.00 C 89.65 107.00 91.30 105.25 91.80 103.38 L 93.15 103.40 L 93.16 101.87 L 91.83 101.83 C 91.25 99.90 89.65 98.23 87.47 98.23 C 85.28 98.23 83.60 99.84 83.05 101.75 L 74.11 101.54 Z";

// MDST: restore the original corridor and circular reference geometry. The only
// intentional geometry change is the final eastern closure: UNION 1 is moved to
// x=71.70 so UNION 1 -> UNION 2 is a clean vertical segment, matching MDPC's
// straight sector-end treatment and keeping the line clear of BEREL.
// The upper arc is the original CIRCULO 1 arc; the lower arc is recalculated through
// the original CIRCULO 2 reference after the UNION 1 alignment.
const MDST_TWR_PATH =
  "M 71.70 95.09 L 71.70 93.08 A 3.24791575 3.24791575 0 0 0 65.49 91.48 L 60.34 88.99 L 60.32 90.56 L 65.03 92.65 A 3.88230984 3.88230984 0 0 0 71.70 95.09 Z";

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
