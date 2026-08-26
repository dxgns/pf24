"use client";

export default function ScopeMapFilterCorrections() {
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
