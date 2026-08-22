export default function ScopeWaypointStyling() {
  return (
    <style>{`
      [data-pf24-vector-map="true"] g[data-map-layer="fixes"] > g > path {
        transform-box: fill-box;
        transform-origin: center;
        transform: scale(clamp(1.9, var(--pf24-radar-zoom, 1), 2.5));
        stroke: #969c9e;
        stroke-width: 0.055;
      }

      [data-pf24-vector-map="true"] g[data-map-layer="fixes"] > g > circle {
        transform-box: fill-box;
        transform-origin: center;
        transform: scale(clamp(1.3, var(--pf24-radar-zoom, 1), 1.7));
        stroke: #969c9e;
        stroke-width: 0.05;
      }

      [data-pf24-vector-map="true"] g[data-map-layer="fixes"] > g > text {
        transform-box: fill-box;
        transform-origin: left center;
        transform: scale(clamp(1.1, var(--pf24-radar-zoom, 1), 1.45));
        font-size: 0.38px;
        fill: #7d8385;
        opacity: 0.88;
        font-weight: 400;
      }
    `}</style>
  );
}
