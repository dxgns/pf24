"use client";

import { AIRSPACE_PATHS } from "@/lib/scope/mapData";

const ctrSelectors = AIRSPACE_PATHS
  .filter((airspace) => airspace.tone === "fir")
  .map((airspace, index) =>
    airspace.id.endsWith("_CTR")
      ? `[data-pf24-map-filter-ctrs='off'] [data-map-layer='fir-airspace'] > polyline:nth-child(${index + 1})`
      : null,
  )
  .filter((selector): selector is string => selector !== null)
  .join(",\n");

export default function ScopeMapFilterCorrections() {
  return (
    <style>{`
      ${ctrSelectors} {
        display: none !important;
      }

      [data-pf24-map-filter-terrain='off'] [data-pf24-menorca-layer='true'] {
        display: none !important;
      }
    `}</style>
  );
}
