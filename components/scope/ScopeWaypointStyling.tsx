export default function ScopeWaypointStyling() {
  return (
    <style>{`
      [data-pf24-vector-map="true"] g[data-map-layer="fixes"] > g > path {
        transform-box: fill-box;
        transform-origin: center;
        transform: scale(clamp(2.15, var(--pf24-radar-zoom, 1), 3.1));
        stroke: #969c9e;
        stroke-width: 0.06;
      }

      [data-pf24-vector-map="true"] g[data-map-layer="fixes"] > g > circle {
        transform-box: fill-box;
        transform-origin: center;
        transform: scale(clamp(1.45, var(--pf24-radar-zoom, 1), 2.1));
        stroke: #969c9e;
        stroke-width: 0.055;
      }

      [data-pf24-vector-map="true"] g[data-map-layer="fixes"] > g > text {
        transform-box: fill-box;
        transform-origin: left center;
        transform: scale(clamp(1.2, var(--pf24-radar-zoom, 1), 1.8));
        font-size: 0.42px;
        fill: #7d8385;
        opacity: 0.9;
        font-weight: 400;
      }
    `}</style>
  );
}
