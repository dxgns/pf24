"use client";

import { useEffect } from "react";

// Keep the accepted MDPC TWR geometry correction.
const MDPC_TWR_PATH =
  "M 74.11 101.54 L 74.11 103.24 L 83.05 103.45 C 83.55 105.35 85.20 107.00 87.44 107.00 C 89.65 107.00 91.30 105.25 91.80 103.38 L 93.15 103.40 L 93.16 101.87 L 91.83 101.83 C 91.25 99.90 89.65 98.23 87.47 98.23 C 85.28 98.23 83.60 99.84 83.05 101.75 L 74.11 101.54 Z";

// MDST TWR must match ScopeRadarMap exactly. The western corridor is centered
// on the calibrated RWY 11/29 centerline. Its two long sides are parallel to the
// runway axis and its outer cap is perpendicular to both sides (90° / 90°).
// The circular sections still pass through CIRCULO 1 and CIRCULO 2.
const MDST_TWR_PATH =
  "M 70.79 95.09 L 71.70 93.08 A 3.25369060 3.25369060 0 0 0 65.68723607 91.08194226 L 58.60554768 88.00424646 L 58.10476883 89.15652401 L 65.18645722 92.23421980 A 3.27959577 3.27959577 0 0 0 70.79 95.09 Z";

function patchPath(path: SVGPathElement) {
  const layer = path.dataset.mapLayer;
  if (layer === "mdpc-twr" && path.getAttribute("d") !== MDPC_TWR_PATH) {
    path.setAttribute("d", MDPC_TWR_PATH);
  }
  if (layer === "mdst-twr" && path.getAttribute("d") !== MDST_TWR_PATH) {
    path.setAttribute("d", MDST_TWR_PATH);
  }
}

function patchNode(node: Node) {
  if (!(node instanceof Element)) return;
  if (node instanceof SVGPathElement) patchPath(node);
  for (const path of Array.from(node.querySelectorAll<SVGPathElement>("path[data-map-layer='mdpc-twr'], path[data-map-layer='mdst-twr']"))) {
    patchPath(path);
  }
}

export default function ScopeTwrGeometryCorrection() {
  useEffect(() => {
    const radar = document.querySelector<HTMLElement>("main.fixed > section");
    if (!radar) return;

    let root: HTMLElement | null = null;
    let mapObserver: MutationObserver | null = null;

    const bindMap = () => {
      const next = radar.querySelector<HTMLElement>("[data-pf24-vector-map='true']");
      if (!next || next === root) return;

      mapObserver?.disconnect();
      root = next;
      patchNode(next);
      mapObserver = new MutationObserver((records) => {
        for (const record of records) {
          if (record.type === "attributes") {
            if (record.target instanceof SVGPathElement) patchPath(record.target);
            continue;
          }
          for (const node of Array.from(record.addedNodes)) patchNode(node);
        }
      });
      mapObserver.observe(next, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["d"],
      });
    };

    bindMap();
    const hostObserver = new MutationObserver(bindMap);
    hostObserver.observe(radar, { childList: true, subtree: true });

    return () => {
      hostObserver.disconnect();
      mapObserver?.disconnect();
    };
  }, []);

  return null;
}
