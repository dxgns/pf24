"use client";

import { useEffect } from "react";

const GROUND_HEADING_PIXELS = 20;

function extendGroundHeadingVectors() {
  const layer = document.querySelector<HTMLElement>("[data-pf24-live-traffic='true']");
  if (!layer) return;

  const lines = layer.querySelectorAll<SVGLineElement>("svg g line");
  lines.forEach((line) => {
    // ProjectFlightTrafficV6 renders ground heading vectors with strokeWidth=1.
    // Ground connector lines use 0.8, while airborne heading vectors use 1.5.
    if (line.getAttribute("stroke-width") !== "1") return;
    if (line.getAttribute("stroke") !== "#00e000") return;

    const x1 = Number(line.getAttribute("x1"));
    const y1 = Number(line.getAttribute("y1"));
    const x2 = Number(line.getAttribute("x2"));
    const y2 = Number(line.getAttribute("y2"));
    if (![x1, y1, x2, y2].every(Number.isFinite)) return;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (length < 0.001 || Math.abs(length - GROUND_HEADING_PIXELS) < 0.05) return;

    line.setAttribute("x2", String(x1 + (dx / length) * GROUND_HEADING_PIXELS));
    line.setAttribute("y2", String(y1 + (dy / length) * GROUND_HEADING_PIXELS));
  });
}

export default function GroundHeadingVectorFix() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        extendGroundHeadingVectors();
      });
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["x1", "y1", "x2", "y2", "stroke-width"],
    });
    window.addEventListener("pf24-radar-viewport", schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pf24-radar-viewport", schedule);
    };
  }, []);

  return null;
}
