export default function ScopeWaypointStyling() {
  return (
    <style>{`
      [data-pf24-vector-map="true"] g[data-map-layer="fixes"] > g > path {
        transform-box: fill-box;
        transform-origin: center;
        transform: scale(1.75);
        stroke: #8b9092;
        stroke-width: 0.055;
      }

      [data-pf24-vector-map="true"] g[data-map-layer="fixes"] > g > text {
        font-size: 0.30px;
        fill: #656b6d;
        opacity: 0.72;
        font-weight: 400;
      }
    `}</style>
  );
}
