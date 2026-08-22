"use client";

import { useEffect } from "react";

const CLOSE_ACTIONS = new Set(["ASSUME", "ACCEPT", "TRANSFER"]);

function actionFor(button: HTMLButtonElement) {
  return (button.dataset.pf24OwnerActionLabel || button.textContent || "").trim().toUpperCase();
}

function closeCallsignMenu(menu: HTMLElement) {
  // Use the same React path the traffic menu already uses when the pointer leaves it.
  menu.dispatchEvent(new MouseEvent("mouseout", {
    bubbles: true,
    cancelable: false,
    relatedTarget: document.body,
  }));

  // Fallback: if React did not synthesize onMouseLeave from the programmatic event,
  // use the traffic layer's normal background-deselect behavior.
  window.requestAnimationFrame(() => {
    if (!menu.isConnected) return;
    const activeMenu = document.querySelector<HTMLElement>("[data-pf24-callsign-menu='true']");
    if (activeMenu !== menu) return;
    const radar = document.querySelector<HTMLElement>("main.fixed > section");
    radar?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

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

  useEffect(() => {
    const onMouseUp = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest<HTMLButtonElement>("button");
      const menu = button?.closest<HTMLElement>("[data-pf24-callsign-menu='true']");
      if (!button || !menu) return;
      if (!CLOSE_ACTIONS.has(actionFor(button))) return;

      // The action handlers run on pointerdown/click. Closing after mouseup keeps
      // their normal execution intact, then gives immediate visual confirmation.
      window.setTimeout(() => closeCallsignMenu(menu), 0);
    };

    window.addEventListener("mouseup", onMouseUp, true);
    return () => window.removeEventListener("mouseup", onMouseUp, true);
  }, []);

  return null;
}
