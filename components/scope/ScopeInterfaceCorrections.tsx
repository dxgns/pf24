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

function syncRunwaySelectorScroller() {
  for (const dialog of Array.from(document.querySelectorAll<HTMLElement>("div.absolute"))) {
    const title = dialog.firstElementChild?.textContent?.trim() ?? "";
    if (!title.includes("Runway selector dialog")) continue;

    const scroller = Array.from(dialog.querySelectorAll<HTMLElement>("div")).find(
      (candidate) => candidate.classList.contains("overflow-y-auto") && candidate.classList.contains("max-h-[520px]"),
    );
    if (scroller) scroller.dataset.pf24RunwaySelectorScroll = "true";
  }
}

function runwayActiveInfo(button: HTMLButtonElement) {
  const row = button.parentElement;
  if (!row || row.children.length !== 5 || row.children[1] !== button) return null;

  const dialog = button.closest<HTMLElement>("div.absolute");
  const title = dialog?.firstElementChild?.textContent?.trim() ?? "";
  if (!dialog || !title.includes("Runway selector dialog")) return null;

  const airport = row.children[0]?.textContent?.trim().toUpperCase() ?? "";
  if (!/^[A-Z0-9]{4}$/.test(airport)) return null;

  return {
    airport,
    dialog,
    checked: Boolean(button.querySelector("svg")),
  };
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
      [data-pf24-runway-selector-scroll='true'] {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
      [data-pf24-runway-selector-scroll='true']::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
        display: none !important;
      }
      [data-pf24-chat-tabs='true'] button {
        text-decoration: none !important;
      }
    `;
    document.head.appendChild(style);

    let syncingRunwayActive = false;

    const onClickCapture = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      if (!button) return;

      if (!syncingRunwayActive) {
        const runwayInfo = runwayActiveInfo(button);
        if (runwayInfo) {
          const nextActive = !runwayInfo.checked;

          window.setTimeout(() => {
            if (!runwayInfo.dialog.isConnected) return;
            syncingRunwayActive = true;
            try {
              for (const row of Array.from(runwayInfo.dialog.querySelectorAll<HTMLElement>("div.grid"))) {
                if (row.children.length !== 5) continue;
                const airport = row.children[0]?.textContent?.trim().toUpperCase() ?? "";
                const activeButton = row.children[1];
                if (airport !== runwayInfo.airport || !(activeButton instanceof HTMLButtonElement) || activeButton === button) continue;

                const active = Boolean(activeButton.querySelector("svg"));
                if (active !== nextActive) activeButton.click();
              }
            } finally {
              syncingRunwayActive = false;
            }
          }, 0);
        }
      }

      if (button.dataset.pf24ConfigClose !== "true") return;
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

    const syncUi = () => {
      syncChatTabLabels();
      syncRunwaySelectorScroller();
    };

    syncUi();
    const timer = window.setInterval(syncUi, 180);

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
