"use client";

/**
 * Keeps radar target/vector/trail colors tied to the ownership marker at CSS
 * paint time. ProjectFlightTrafficV6 receives frequent live updates and may
 * create fresh SVG lines/circles with its legacy green defaults; without this
 * guard those defaults can be visible for a frame before the ownership sync
 * paints them. These rules make newly-created children inherit the already
 * known ownership state immediately.
 */
export default function ScopeTrafficOwnershipColorGuard() {
  return <style>{`
    [data-pf24-live-traffic='true'] svg > g:not([data-pf24-ownership]) line {
      stroke: #d8d8d8 !important;
    }
    [data-pf24-live-traffic='true'] svg > g:not([data-pf24-ownership]) circle {
      fill: #d8d8d8 !important;
    }

    [data-pf24-live-traffic='true'] svg > g[data-pf24-ownership='free'] line {
      stroke: #d8d8d8 !important;
    }
    [data-pf24-live-traffic='true'] svg > g[data-pf24-ownership='free'] circle {
      fill: #d8d8d8 !important;
    }

    [data-pf24-live-traffic='true'] svg > g[data-pf24-ownership='other'] line {
      stroke: #9b9b9b !important;
    }
    [data-pf24-live-traffic='true'] svg > g[data-pf24-ownership='other'] circle {
      fill: #9b9b9b !important;
    }

    [data-pf24-live-traffic='true'] svg > g[data-pf24-ownership='mine'] line {
      stroke: #00e000 !important;
    }
    [data-pf24-live-traffic='true'] svg > g[data-pf24-ownership='mine'] circle {
      fill: #00e000 !important;
    }

    [data-pf24-live-traffic='true'] svg > g[data-pf24-ownership='incoming-transfer'] line {
      stroke: #d8d8d8 !important;
    }
    [data-pf24-live-traffic='true'] svg > g[data-pf24-ownership='incoming-transfer'] circle {
      fill: #d8d8d8 !important;
    }

    [data-pf24-live-traffic='true'] svg > g[data-pf24-ownership='incoming-request'] line {
      stroke: #00e000 !important;
    }
    [data-pf24-live-traffic='true'] svg > g[data-pf24-ownership='incoming-request'] circle {
      fill: #00e000 !important;
    }

    [data-pf24-live-traffic='true'] [data-pf24-traffic-select='true']:not([data-pf24-ownership]) > span,
    [data-pf24-live-traffic='true'] [data-pf24-traffic-select='true'][data-pf24-ownership='free'] > span,
    [data-pf24-live-traffic='true'] [data-pf24-traffic-select='true'][data-pf24-ownership='incoming-transfer'] > span {
      border-color: #d8d8d8 !important;
    }
    [data-pf24-live-traffic='true'] [data-pf24-traffic-select='true'][data-pf24-ownership='other'] > span {
      border-color: #9b9b9b !important;
    }
    [data-pf24-live-traffic='true'] [data-pf24-traffic-select='true'][data-pf24-ownership='mine'] > span,
    [data-pf24-live-traffic='true'] [data-pf24-traffic-select='true'][data-pf24-ownership='incoming-request'] > span {
      border-color: #00e000 !important;
    }
  `}</style>;
}
