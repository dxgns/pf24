"use client";

import { useEffect } from "react";

const LABEL_SELECTOR = "[data-pf24-traffic-label='true']";
const TARGET_SELECTOR = "[data-pf24-traffic-select='true']";
const LIVE_ROOT_SELECTOR = "[data-pf24-live-traffic='true']";

function syncTrafficColors() {
  const root = document.querySelector<HTMLElement>(LIVE_ROOT_SELECTOR);
  if (!root) return;

  const labels = Array.from(root.querySelectorAll<HTMLElement>(LABEL_SELECTOR));
  const targets = Array.from(root.querySelectorAll<HTMLButtonElement>(TARGET_SELECTOR));
  const groups = Array.from(root.querySelectorAll<SVGGElement>("svg > g"));

  labels.forEach((label, index) => {
    const color = label.style.color || getComputedStyle(label).color;
    const target = targets[index];
    const group = groups[index];

    const diamond = target?.querySelector<HTMLElement>(":scope > span");
    if (diamond) diamond.style.borderColor = color;

    group?.querySelectorAll<SVGLineElement>("line").forEach((line) => {
      line.style.stroke = color;
    });
    group?.querySelectorAll<SVGCircleElement>("circle").forEach((circle) => {
      circle.style.fill = color;
    });
  });
}

export default function ScopeTrafficColorSync() {
  useEffect(() => {
    syncTrafficColors();
    const timer = window.setInterval(syncTrafficColors, 300);
    const onChange = () => window.setTimeout(syncTrafficColors, 0);

    window.addEventListener("pf24-scope-connection-change", onChange);
    document.addEventListener("click", onChange, true);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pf24-scope-connection-change", onChange);
      document.removeEventListener("click", onChange, true);
    };
  }, []);

  return null;
}
