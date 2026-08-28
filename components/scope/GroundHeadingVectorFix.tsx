"use client";

import { useEffect } from "react";

const GROUND_HEADING_PIXELS = 20;
const LIVE_TRAFFIC_SELECTOR = "[data-pf24-live-traffic='true']";

function extendGroundHeadingVector(line: SVGLineElement) {
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
}

function patchNode(node: Node) {
  if (!(node instanceof Element)) return;
  if (node instanceof SVGLineElement) extendGroundHeadingVector(node);
  for (const line of Array.from(node.querySelectorAll<SVGLineElement>("svg g line"))) {
    extendGroundHeadingVector(line);
  }
}

export default function GroundHeadingVectorFix() {
  useEffect(() => {
    const radar = document.querySelector<HTMLElement>("main.fixed > section");
    if (!radar) return;

    let observedLayer: HTMLElement | null = null;
    let layerObserver: MutationObserver | null = null;

    const bindLayer = () => {
      const next = radar.querySelector<HTMLElement>(LIVE_TRAFFIC_SELECTOR);
      if (next === observedLayer) return;

      layerObserver?.disconnect();
      layerObserver = null;
      observedLayer = next;
      if (!next) return;

      patchNode(next);
      layerObserver = new MutationObserver((records) => {
        for (const record of records) {
          if (record.type === "attributes") {
            if (record.target instanceof SVGLineElement) extendGroundHeadingVector(record.target);
            continue;
          }
          for (const node of Array.from(record.addedNodes)) patchNode(node);
        }
      });
      layerObserver.observe(next, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["x1", "y1", "x2", "y2", "stroke-width", "stroke"],
      });
    };

    bindLayer();

    // Only watch structural changes in the radar so a traffic-layer reconnect can
    // be rebound. Attribute churn from every moving target stays inside the much
    // smaller live-traffic observer above instead of waking a document-wide scan.
    const hostObserver = new MutationObserver(bindLayer);
    hostObserver.observe(radar, { childList: true, subtree: true });

    return () => {
      hostObserver.disconnect();
      layerObserver?.disconnect();
    };
  }, []);

  return null;
}
