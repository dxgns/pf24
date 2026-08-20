"use client";

import { useEffect } from "react";

function findConfigDialog(button: HTMLButtonElement) {
  return button.closest<HTMLElement>("div.absolute");
}

export default function ScopeInterfaceCorrections() {
  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24InterfaceCorrections = "true";
    style.textContent = `
      [data-pf24-weather-window='true'] {
        transform: scale(.92);
        transform-origin: top left;
      }
      [data-pf24-keyboard-scroll-only='true'] {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
        overflow-y: hidden !important;
      }
      [data-pf24-keyboard-scroll-only='true']::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    const onClickCapture = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      if (!button || button.dataset.pf24ConfigClose !== "true") return;
      const dialog = findConfigDialog(button);
      if (!dialog) return;
      const cancel = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => {
        const label = candidate.textContent?.trim().toLowerCase();
        return label === "cancel" || label === "cancelar";
      });
      if (!cancel) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      cancel.click();
    };

    const onWheelCapture = (event: WheelEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("[data-pf24-keyboard-scroll-only='true']")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("wheel", onWheelCapture, { capture: true, passive: false });
    return () => {
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("wheel", onWheelCapture, true);
      style.remove();
    };
  }, []);

  return null;
}
