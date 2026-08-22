"use client";

import { useEffect } from "react";

const WINDOW_SELECTOR = "main.fixed > section > div.absolute.z-30, [data-pf24-weather-window='true'], [data-pf24-conflict-window='true']";
const COLLISION_GAP = 2;

type DragState = {
  element: HTMLElement;
  startMouseX: number;
  startMouseY: number;
  startRect: DOMRect;
};

function scopeWindows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(WINDOW_SELECTOR)).filter((element) => {
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

function overlaps(a: DOMRect, b: DOMRect, gap = COLLISION_GAP) {
  return !(
    a.right + gap <= b.left ||
    a.left >= b.right + gap ||
    a.bottom + gap <= b.top ||
    a.top >= b.bottom + gap
  );
}

function proposedRect(start: DOMRect, dx: number, dy: number): DOMRect {
  return new DOMRect(start.left + dx, start.top + dy, start.width, start.height);
}

function clampWindowsToVisibleArea() {
  const scope = document.querySelector<HTMLElement>("main.fixed");
  const radar = scope?.querySelector<HTMLElement>(":scope > section");
  if (!scope || !radar) return;

  const radarRect = radar.getBoundingClientRect();
  const windows = scopeWindows();

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

    let drag: DragState | null = null;

    const onMouseDown = (event: MouseEvent) => {
      // Automatic layout corrections use synthetic mouse events so PF24Scope's
      // existing drag state remains the single source of truth. Those programmatic
      // moves must bypass the user collision guard or an already-overlapping pair
      // can never be separated.
      if (!event.isTrusted) return;
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      const win = target?.closest<HTMLElement>(WINDOW_SELECTOR);
      if (!win) return;
      const header = win.firstElementChild;
      if (!(header instanceof HTMLElement) || !header.contains(target)) return;
      if (target?.closest("button")) return;

      drag = {
        element: win,
        startMouseX: event.clientX,
        startMouseY: event.clientY,
        startRect: win.getBoundingClientRect(),
      };
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!event.isTrusted) return;
      if (!drag || !(event.buttons & 1)) return;
      const dx = event.clientX - drag.startMouseX;
      const dy = event.clientY - drag.startMouseY;
      const nextRect = proposedRect(drag.startRect, dx, dy);
      const collision = scopeWindows().some((other) => other !== drag?.element && overlaps(nextRect, other.getBoundingClientRect()));

      if (collision) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const onMouseUp = (event: MouseEvent) => {
      if (!event.isTrusted) return;
      drag = null;
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("button") : null;
      if (!(target instanceof HTMLButtonElement)) return;
      if (target.textContent?.trim() !== "CHATBOX") return;

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(clampWindowsToVisibleArea);
      });
    };

    const onResize = () => window.requestAnimationFrame(clampWindowsToVisibleArea);

    scope.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("mousemove", onMouseMove, true);
    window.addEventListener("mouseup", onMouseUp, true);
    scope.addEventListener("click", onClick);
    window.addEventListener("resize", onResize);

    return () => {
      scope.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("mousemove", onMouseMove, true);
      window.removeEventListener("mouseup", onMouseUp, true);
      scope.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return null;
}
