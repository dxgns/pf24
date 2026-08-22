"use client";

import { useEffect } from "react";

const GAP_PX = 2;
const STARTUP_CHECKS_MS = [0, 60, 140, 280, 520, 900, 1400, 2200];

function findScopeWindow(title: string): HTMLElement | null {
  const normalized = title.toUpperCase();
  return Array.from(document.querySelectorAll<HTMLElement>("main.fixed > section > div.absolute.z-30"))
    .find((element) => element.firstElementChild?.textContent?.toUpperCase().includes(normalized)) ?? null;
}

function verticallyOverlaps(a: DOMRect, b: DOMRect) {
  return a.top < b.bottom && a.bottom > b.top;
}

function horizontallyOverlaps(a: DOMRect, b: DOMRect) {
  return a.left < b.right && a.right > b.left;
}

function dragWindowBy(win: HTMLElement, deltaY: number) {
  if (Math.abs(deltaY) < 1) return;
  const header = win.firstElementChild;
  if (!(header instanceof HTMLElement)) return;

  const rect = header.getBoundingClientRect();
  const startX = rect.left + Math.min(36, Math.max(8, rect.width / 3));
  const startY = rect.top + Math.min(8, Math.max(4, rect.height / 2));

  header.dispatchEvent(new MouseEvent("mousedown", {
    bubbles: true,
    clientX: startX,
    clientY: startY,
    button: 0,
    buttons: 1,
  }));
  window.dispatchEvent(new MouseEvent("mousemove", {
    bubbles: true,
    clientX: startX,
    clientY: startY + deltaY,
    buttons: 1,
  }));
  window.dispatchEvent(new MouseEvent("mouseup", {
    bubbles: true,
    clientX: startX,
    clientY: startY + deltaY,
    button: 0,
  }));
}

function separateSectorAndTaxi() {
  const sector = findScopeWindow("SECTOR LIST");
  const taxi = findScopeWindow("COMBINED TAXI LIST");
  if (!sector || !taxi) return;
  if (window.getComputedStyle(sector).display === "none" || window.getComputedStyle(taxi).display === "none") return;

  const section = sector.parentElement;
  if (!section || section !== taxi.parentElement || section.tagName !== "SECTION") return;

  const sectorRect = sector.getBoundingClientRect();
  const taxiRect = taxi.getBoundingClientRect();
  if (!horizontallyOverlaps(sectorRect, taxiRect) || !verticallyOverlaps(sectorRect, taxiRect)) return;

  const sectionRect = section.getBoundingClientRect();
  const desiredTaxiTop = sectorRect.bottom + GAP_PX;
  const taxiCanFitBelow = desiredTaxiTop + taxiRect.height <= sectionRect.bottom - 2;

  if (taxiCanFitBelow) {
    dragWindowBy(taxi, desiredTaxiTop - taxiRect.top);
    return;
  }

  const desiredSectorTop = taxiRect.top - GAP_PX - sectorRect.height;
  const sectorCanFitAbove = desiredSectorTop >= sectionRect.top + 2;
  if (sectorCanFitAbove) dragWindowBy(sector, desiredSectorTop - sectorRect.top);
}

function scheduleChecks() {
  const timers = STARTUP_CHECKS_MS.map((delay) => window.setTimeout(separateSectorAndTaxi, delay));
  return () => timers.forEach((timer) => window.clearTimeout(timer));
}

export default function ScopeStartupWindowOverlapGuard() {
  useEffect(() => {
    let cancelChecks = scheduleChecks();
    let frame = 0;
    let resizeObserver: ResizeObserver | null = null;

    const requestCheck = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          separateSectorAndTaxi();
        });
      });
    };

    const restartChecks = () => {
      cancelChecks();
      cancelChecks = scheduleChecks();
      requestCheck();
    };

    const attachResizeObserver = () => {
      resizeObserver?.disconnect();
      const sector = findScopeWindow("SECTOR LIST");
      const taxi = findScopeWindow("COMBINED TAXI LIST");
      if (!sector || !taxi || typeof ResizeObserver === "undefined") return;
      resizeObserver = new ResizeObserver(requestCheck);
      resizeObserver.observe(sector);
      resizeObserver.observe(taxi);
    };

    attachResizeObserver();
    const section = document.querySelector<HTMLElement>("main.fixed > section");
    const mutationObserver = section ? new MutationObserver(() => {
      attachResizeObserver();
      requestCheck();
    }) : null;
    mutationObserver?.observe(section!, { childList: true, subtree: true });

    const onConnection = () => restartChecks();
    const onVisibility = () => restartChecks();
    const onResize = () => requestCheck();

    window.addEventListener("pf24-scope-connection-change", onConnection);
    window.addEventListener("pf24-menu-visibility-sync", onVisibility);
    window.addEventListener("resize", onResize);

    return () => {
      cancelChecks();
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener("pf24-scope-connection-change", onConnection);
      window.removeEventListener("pf24-menu-visibility-sync", onVisibility);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return null;
}
