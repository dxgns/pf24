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
      /* Keep the combined METAR / ATIS panel visually in line with the other scope windows. */
      [data-pf24-weather-window='true'] {
        transform: scale(.92);
        transform-origin: top left;
      }
    `;
    document.head.appendChild(style);

    const onClickCapture = (event: MouseEvent) => {
      const button = event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("button")
        : null;
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

    document.addEventListener("click", onClickCapture, true);
    return () => {
      document.removeEventListener("click", onClickCapture, true);
      style.remove();
    };
  }, []);

  return null;
}
