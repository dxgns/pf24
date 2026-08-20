"use client";

import { useEffect } from "react";

function findConfigDialog(button: HTMLButtonElement) {
  return button.closest<HTMLElement>("div.absolute");
}

function syncChatTabLabels() {
  const tabs = document.querySelector<HTMLElement>("[data-pf24-chat-tabs='true']");
  if (!tabs) return;

  for (const child of Array.from(tabs.children)) {
    if (!(child instanceof HTMLButtonElement)) continue;
    const label = child.textContent?.trim() ?? "";
    if (label === "Console") continue;
    const frequency = label.match(/\b\d{3}\.\d{3}\b/)?.[0];
    if (frequency && label !== frequency) child.textContent = frequency;
  }
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
      [data-pf24-chat-tabs='true'] button {
        text-decoration: none !important;
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

    syncChatTabLabels();
    const timer = window.setInterval(syncChatTabLabels, 180);

    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("wheel", onWheelCapture, { capture: true, passive: false });
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("wheel", onWheelCapture, true);
      style.remove();
    };
  }, []);

  return null;
}
