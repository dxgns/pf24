"use client";

import { useEffect } from "react";

const ORANGE = "#fd5f10";
const SELECTOR = "[data-pf24-conflict-callsign='true']";
const POSITION_KEY = "pf24_scope_conflict_window_position_v1";
const CONFLICT_WIDTH = 178;
const DEFAULT_POSITION = { x: 8, y: 390 };

type Position = { x: number; y: number };
type DragState = { element: HTMLElement; dx: number; dy: number };

function readPosition(): Position {
  try {
    const parsed = JSON.parse(localStorage.getItem(POSITION_KEY) ?? "{}") as Partial<Position>;
    return {
      x: typeof parsed.x === "number" && Number.isFinite(parsed.x) ? parsed.x : DEFAULT_POSITION.x,
      y: typeof parsed.y === "number" && Number.isFinite(parsed.y) ? parsed.y : DEFAULT_POSITION.y,
    };
  } catch {
    return DEFAULT_POSITION;
  }
}

function findConflictWindow(radar: HTMLElement) {
  return Array.from(radar.querySelectorAll<HTMLElement>(":scope > div.absolute")).find((element) => {
    const title = element.firstElementChild?.textContent?.trim().toUpperCase() ?? "";
    return title.startsWith("CONFLICT");
  }) ?? null;
}

export default function ScopeConflictColorGuard() {
  useEffect(() => {
    const painted = new Set<HTMLElement>();
    let queued = false;

    const sync = () => {
      queued = false;
      const current = new Set(Array.from(document.querySelectorAll<HTMLElement>(SELECTOR)));
      let restored = false;

      for (const element of painted) {
        if (current.has(element) && element.isConnected) continue;
        element.style.removeProperty("color");
        painted.delete(element);
        restored = true;
      }

      for (const element of current) {
        if (element.style.getPropertyValue("color") !== ORANGE || element.style.getPropertyPriority("color") !== "important") {
          element.style.setProperty("color", ORANGE, "important");
        }
        painted.add(element);
      }

      if (restored) window.dispatchEvent(new Event("pf24-traffic-ownership-change"));
    };

    const queue = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(sync);
    };

    const observer = new MutationObserver(queue);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "data-pf24-conflict-callsign"],
    });
    const timer = window.setInterval(sync, 120);
    sync();

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      for (const element of painted) element.style.removeProperty("color");
      painted.clear();
    };
  }, []);

  useEffect(() => {
    const radar = document.querySelector<HTMLElement>("main.fixed > section");
    if (!radar) return;

    let position = readPosition();
    let drag: DragState | null = null;
    let queued = false;

    const style = document.createElement("style");
    style.dataset.pf24ConflictWindowStyle = "true";
    style.textContent = `
      [data-pf24-conflict-window='true'] {
        width: ${CONFLICT_WIDTH}px !important;
        border-width: 1px !important;
        pointer-events: auto !important;
      }
      [data-pf24-conflict-window='true'] > div:first-child {
        border-bottom-width: 1px !important;
        font-size: 10px !important;
        line-height: 17px !important;
        letter-spacing: .5px !important;
        cursor: move !important;
        user-select: none !important;
      }
      [data-pf24-conflict-window='true'] > div:first-child > span {
        right: 3px !important;
        top: 3px !important;
        width: 8px !important;
        height: 11px !important;
      }
      [data-pf24-conflict-window='true'] > div:nth-child(2) {
        grid-template-columns: 1fr 38px 40px !important;
        font-size: 9px !important;
        line-height: 16px !important;
      }
      [data-pf24-conflict-window='true'] > div:nth-child(2) > span:first-child {
        padding-left: 8px !important;
      }
      [data-pf24-conflict-window='true'] > div:nth-child(n+3) {
        border-top-width: 1px !important;
      }
      [data-pf24-conflict-window='true'] > div:nth-child(n+3) > div {
        grid-template-columns: 1fr 38px 40px !important;
        font-size: 10px !important;
        line-height: 17px !important;
      }
      [data-pf24-conflict-window='true'] > div:nth-child(n+3) > div > span:first-child {
        padding-left: 10px !important;
      }
    `;
    document.head.appendChild(style);

    const clampPosition = (win: HTMLElement, next: Position): Position => ({
      x: Math.min(Math.max(0, next.x), Math.max(0, radar.clientWidth - win.offsetWidth - 2)),
      y: Math.min(Math.max(0, next.y), Math.max(0, radar.clientHeight - win.offsetHeight - 2)),
    });

    const apply = () => {
      queued = false;
      const win = findConflictWindow(radar);
      if (!win) return;
      win.dataset.pf24ConflictWindow = "true";
      win.style.zIndex = "30";
      win.style.pointerEvents = "auto";
      position = clampPosition(win, position);
      win.style.left = `${position.x}px`;
      win.style.top = `${position.y}px`;
    };

    const queueApply = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(apply);
    };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      const win = target?.closest<HTMLElement>("[data-pf24-conflict-window='true']");
      if (!win || !radar.contains(win)) return;
      const header = win.firstElementChild;
      if (!(header instanceof HTMLElement) || !header.contains(target)) return;
      if (target?.closest("button")) return;

      const rect = win.getBoundingClientRect();
      drag = {
        element: win,
        dx: event.clientX - rect.left,
        dy: event.clientY - rect.top,
      };
      event.preventDefault();
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!drag || !(event.buttons & 1)) return;
      const radarRect = radar.getBoundingClientRect();
      const next = clampPosition(drag.element, {
        x: event.clientX - radarRect.left - drag.dx,
        y: event.clientY - radarRect.top - drag.dy,
      });
      position = next;
      drag.element.style.left = `${next.x}px`;
      drag.element.style.top = `${next.y}px`;
      localStorage.setItem(POSITION_KEY, JSON.stringify(next));
    };

    const onMouseUp = () => {
      drag = null;
    };

    const observer = new MutationObserver(queueApply);
    observer.observe(radar, { childList: true, subtree: true });
    radar.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("resize", queueApply);
    apply();

    return () => {
      observer.disconnect();
      radar.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("resize", queueApply);
      style.remove();
    };
  }, []);

  return null;
}
