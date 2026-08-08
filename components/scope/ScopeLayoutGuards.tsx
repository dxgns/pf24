"use client";

import { useEffect } from "react";

function isScopeWindow(element: Element): element is HTMLElement {
  return element instanceof HTMLElement && element.matches("section > div.absolute.z-30");
}

function clampWindowsToVisibleArea() {
  const scope = document.querySelector<HTMLElement>("main.fixed");
  const radar = scope?.querySelector<HTMLElement>(":scope > section");
  if (!scope || !radar) return;

  const radarRect = radar.getBoundingClientRect();
  const windows = Array.from(radar.children).filter(isScopeWindow);

  for (const win of windows) {
    const rect = win.getBoundingClientRect();
    const overflowBottom = rect.bottom - radarRect.bottom;
    const overflowRight = rect.right - radarRect.right;
    if (overflowBottom <= 0 && overflowRight <= 0) continue;

    const header = win.firstElementChild;
    if (!(header instanceof HTMLElement)) continue;

    const startX = rect.left + 4;
    const startY = rect.top + 4;
    const targetX = startX - Math.max(0, overflowRight + 2);
    const targetY = startY - Math.max(0, overflowBottom + 2);

    header.dispatchEvent(new MouseEvent("mousedown", {
      bubbles: true,
      clientX: startX,
      clientY: startY,
      button: 0,
      buttons: 1,
    }));
    window.dispatchEvent(new MouseEvent("mousemove", {
      bubbles: true,
      clientX: targetX,
      clientY: targetY,
      button: 0,
      buttons: 1,
    }));
    window.dispatchEvent(new MouseEvent("mouseup", {
      bubbles: true,
      clientX: targetX,
      clientY: targetY,
      button: 0,
    }));
  }
}

export default function ScopeLayoutGuards() {
  useEffect(() => {
    const scope = document.querySelector<HTMLElement>("main.fixed");
    if (!scope) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("button") : null;
      if (!(target instanceof HTMLButtonElement)) return;
      if (target.textContent?.trim() !== "CHATBOX") return;

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(clampWindowsToVisibleArea);
      });
    };

    const onResize = () => window.requestAnimationFrame(clampWindowsToVisibleArea);

    scope.addEventListener("click", onClick);
    window.addEventListener("resize", onResize);

    return () => {
      scope.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return null;
}
