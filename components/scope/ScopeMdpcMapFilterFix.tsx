"use client";

import { useEffect } from "react";

const MDPC_LABEL_GROUP = "[data-map-layer='mdpc-svg-labels-upright']";
const RUNWAY_LABELS = new Set(["08", "09", "26", "27"]);

function labelKind(text: string): "taxi" | "gate" | "runway" {
  const value = text.trim().toUpperCase();
  if (/^[A-Z]$/.test(value)) return "taxi";
  if (RUNWAY_LABELS.has(value)) return "runway";
  return "gate";
}

export default function ScopeMdpcMapFilterFix() {
  useEffect(() => {
    const radar = document.querySelector<HTMLElement>("main.fixed > section");
    if (!radar) return;

    let frame = 0;

    const sync = () => {
      frame = 0;
      const taxiVisible = radar.dataset.pf24MapFilterTaxiLetters !== "off";
      const gatesVisible = radar.dataset.pf24MapFilterGateNumbers !== "off";
      const group = radar.querySelector<SVGGElement>(MDPC_LABEL_GROUP);
      if (!group) return;

      for (const text of Array.from(group.querySelectorAll<SVGTextElement>("text"))) {
        const kind = labelKind(text.textContent ?? "");
        text.dataset.pf24MapLabelKind = kind;

        const visible = kind === "taxi"
          ? taxiVisible
          : kind === "gate"
            ? gatesVisible
            : true;

        if (visible) text.style.removeProperty("display");
        else text.style.setProperty("display", "none", "important");
      }
    };

    const queueSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    const observer = new MutationObserver(queueSync);
    observer.observe(radar, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "data-pf24-map-filter-taxi-letters",
        "data-pf24-map-filter-gate-numbers",
      ],
    });

    sync();
    const timer = window.setInterval(sync, 500);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      if (frame) window.cancelAnimationFrame(frame);
      const group = radar.querySelector<SVGGElement>(MDPC_LABEL_GROUP);
      for (const text of Array.from(group?.querySelectorAll<SVGTextElement>("text") ?? [])) {
        text.style.removeProperty("display");
      }
    };
  }, []);

  return null;
}
