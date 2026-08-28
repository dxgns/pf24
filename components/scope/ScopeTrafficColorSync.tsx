"use client";

import { useEffect } from "react";

const LABEL_SELECTOR = "[data-pf24-traffic-label='true']";
const TARGET_SELECTOR = "[data-pf24-traffic-select='true']";
const LIVE_ROOT_SELECTOR = "[data-pf24-live-traffic='true']";

function syncTrafficColors(root: HTMLElement) {
  const labels = Array.from(root.querySelectorAll<HTMLElement>(LABEL_SELECTOR));
  const targets = Array.from(root.querySelectorAll<HTMLButtonElement>(TARGET_SELECTOR));
  const groups = Array.from(root.querySelectorAll<SVGGElement>("svg > g"));

  labels.forEach((label, index) => {
    const color = label.style.color || getComputedStyle(label).color;
    const target = targets[index];
    const group = groups[index];

    const diamond = target?.querySelector<HTMLElement>(":scope > span");
    if (diamond && diamond.style.borderColor !== color) diamond.style.borderColor = color;

    group?.querySelectorAll<SVGLineElement>("line").forEach((line) => {
      if (line.style.stroke !== color) line.style.stroke = color;
    });
    group?.querySelectorAll<SVGCircleElement>("circle").forEach((circle) => {
      if (circle.style.fill !== color) circle.style.fill = color;
    });
  });
}

export default function ScopeTrafficColorSync() {
  useEffect(() => {
    const radar = document.querySelector<HTMLElement>("main.fixed > section");
    if (!radar) return;

    let root: HTMLElement | null = null;
    let rootObserver: MutationObserver | null = null;
    let frame = 0;

    const schedule = () => {
      if (frame || !root) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (root) syncTrafficColors(root);
      });
    };

    const bindRoot = () => {
      const next = radar.querySelector<HTMLElement>(LIVE_ROOT_SELECTOR);
      if (next === root) return;

      rootObserver?.disconnect();
      rootObserver = null;
      root = next;
      if (!next) return;

      schedule();
      rootObserver = new MutationObserver(schedule);
      rootObserver.observe(next, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style"],
      });
    };

    bindRoot();
    const hostObserver = new MutationObserver(bindRoot);
    hostObserver.observe(radar, { childList: true, subtree: true });

    const onChange = () => schedule();
    window.addEventListener("pf24-scope-connection-change", onChange);
    document.addEventListener("click", onChange, true);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      hostObserver.disconnect();
      rootObserver?.disconnect();
      window.removeEventListener("pf24-scope-connection-change", onChange);
      document.removeEventListener("click", onChange, true);
    };
  }, []);

  return null;
}
