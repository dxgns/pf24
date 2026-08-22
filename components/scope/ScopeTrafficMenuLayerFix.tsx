"use client";

import { useEffect } from "react";

export default function ScopeTrafficMenuLayerFix() {
  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24TrafficMenuLayerFix = "true";
    style.textContent = `
      /* Callsign menus live inside two clipping/stacking contexts: the radar
         section and the live-traffic overlay itself. While a menu is open,
         temporarily release both contexts and raise the traffic overlay above
         the chat footer. */
      main.fixed:has([data-pf24-callsign-menu='true']) > section {
        overflow: visible !important;
      }

      main.fixed:has([data-pf24-callsign-menu='true']) [data-pf24-live-traffic='true'] {
        overflow: visible !important;
        z-index: 90 !important;
      }

      main.fixed:has([data-pf24-callsign-menu='true']) [data-pf24-callsign-menu='true'] {
        z-index: 120 !important;
      }

      main.fixed:has([data-pf24-callsign-menu='true']) > footer {
        z-index: 40 !important;
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return null;
}
