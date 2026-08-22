"use client";

import { useEffect } from "react";

export default function ScopeTrafficMenuLayerFix() {
  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24TrafficMenuLayerFix = "true";
    style.textContent = `
      /* The traffic callsign menu is rendered inside the radar section. The
         section normally clips at the chatbox boundary and the footer sits in
         a higher stacking context. Only while a callsign menu is open, allow
         that menu to cross the boundary and place the footer underneath the
         live-traffic layer. */
      main.fixed:has([data-pf24-callsign-menu='true']) > section {
        overflow: visible !important;
      }

      main.fixed:has([data-pf24-callsign-menu='true']) > footer {
        z-index: 7 !important;
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return null;
}
