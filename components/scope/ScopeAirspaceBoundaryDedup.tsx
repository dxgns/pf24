"use client";

import { useEffect } from "react";

// MDST APP and MDPC APP share BEREL <-> PIXES. Rendering that segment in both
// dashed paths gives each copy a different dash phase, which visually fills the
// gaps and makes the shared boundary look like a solid line. Keep the segment on
// MDST APP and leave MDPC APP open at BEREL so the shared edge is painted once.
const MDPC_APP_CLOSED =
  "M 73.93 85.06 L 83.72 84.96 L 100.56 96.22 L 99.61 103.25 C 99.23 106.06 94.10 110.25 87.36 110.25 C 79.10 110.25 71.19 106.00 71.20 102.55 L 71.24 94.06 Z";
const MDPC_APP_WITH_SHARED_EDGE_DEDUPED =
  "M 73.93 85.06 L 83.72 84.96 L 100.56 96.22 L 99.61 103.25 C 99.23 106.06 94.10 110.25 87.36 110.25 C 79.10 110.25 71.19 106.00 71.20 102.55 L 71.24 94.06";

function patchNode(node: ParentNode) {
  if (node instanceof SVGPathElement && node.getAttribute("d") === MDPC_APP_CLOSED) {
    node.setAttribute("d", MDPC_APP_WITH_SHARED_EDGE_DEDUPED);
    return;
  }

  for (const path of Array.from(node.querySelectorAll<SVGPathElement>("path"))) {
    if (path.getAttribute("d") === MDPC_APP_CLOSED) {
      path.setAttribute("d", MDPC_APP_WITH_SHARED_EDGE_DEDUPED);
    }
  }
}

export default function ScopeAirspaceBoundaryDedup() {
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
          for (const node of Array.from(record.addedNodes)) {
            if (node instanceof Element) patchNode(node);
          }
        }
      });
      mapObserver.observe(next, { childList: true, subtree: true });
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
