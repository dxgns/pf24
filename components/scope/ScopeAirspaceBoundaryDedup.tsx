"use client";

import { useEffect } from "react";

const VIEWPORT_EVENT = "pf24-radar-viewport";

// MDST APP and MDPC APP share BEREL <-> PIXES. Rendering that segment in both
// dashed paths gives each copy a different dash phase, which visually fills the
// gaps and makes the shared boundary look like a solid line. Keep the segment on
// MDST APP and leave MDPC APP open at BEREL so the shared edge is painted once.
const MDPC_APP_CLOSED =
  "M 73.93 85.06 L 83.72 84.96 L 100.56 96.22 L 99.61 103.25 C 99.23 106.06 94.10 110.25 87.36 110.25 C 79.10 110.25 71.19 106.00 71.20 102.55 L 71.24 94.06 Z";
const MDPC_APP_WITH_SHARED_EDGE_DEDUPED =
  "M 73.93 85.06 L 83.72 84.96 L 100.56 96.22 L 99.61 103.25 C 99.23 106.06 94.10 110.25 87.36 110.25 C 79.10 110.25 71.19 106.00 71.20 102.55 L 71.24 94.06";

function patchSharedEdge() {
  const root = document.querySelector<HTMLElement>("[data-pf24-vector-map='true']");
  if (!root) return;

  for (const path of Array.from(root.querySelectorAll<SVGPathElement>("path"))) {
    if (path.getAttribute("d") === MDPC_APP_CLOSED) {
      path.setAttribute("d", MDPC_APP_WITH_SHARED_EDGE_DEDUPED);
    }
  }
}

export default function ScopeAirspaceBoundaryDedup() {
  useEffect(() => {
    patchSharedEdge();

    const onViewport = () => patchSharedEdge();
    window.addEventListener(VIEWPORT_EVENT, onViewport);

    const observer = new MutationObserver(() => patchSharedEdge());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["d"],
    });

    const retries = window.setInterval(patchSharedEdge, 250);
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
