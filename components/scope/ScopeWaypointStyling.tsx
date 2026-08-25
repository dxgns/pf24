export default function ScopeWaypointStyling() {
  return (
    <style>{`
      [data-pf24-vector-map="true"] g[data-map-layer="fixes"] > g > path,
      [data-pf24-egtt-waypoints="true"] g[data-map-layer="fixes"] > g > path {
        transform-box: fill-box;
        transform-origin: center;
        transform: scale(clamp(1.85, var(--pf24-radar-zoom, 1), 2.3));
        stroke: #969c9e;
        stroke-width: 0.055;
      }

      [data-pf24-vector-map="true"] g[data-map-layer="fixes"] > g > circle,
      [data-pf24-egtt-waypoints="true"] g[data-map-layer="fixes"] > g > circle {
        transform-box: fill-box;
        transform-origin: center;
        transform: scale(clamp(1.25, var(--pf24-radar-zoom, 1), 1.55));
        stroke: #969c9e;
        stroke-width: 0.05;
      }

      [data-pf24-vector-map="true"] g[data-map-layer="fixes"] > g > text,
      [data-pf24-egtt-waypoints="true"] g[data-map-layer="fixes"] > g > text {
        transform-box: fill-box;
        transform-origin: left center;
        transform: translateX(0.18px) scale(clamp(1.08, var(--pf24-radar-zoom, 1), 1.35));
        font-size: 0.38px;
        fill: #7d8385;
        opacity: 0.88;
        font-weight: 400;
      }
    `}</style>
  );
}
