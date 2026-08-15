"use client";

import { useEffect } from "react";

function findMapLayer() {
  const radar = document.querySelector<HTMLElement>("main.fixed > section");
  if (!radar) return null;

  return Array.from(radar.children).find((child) => {
    if (!(child instanceof HTMLElement)) return false;
    return child.classList.contains("pointer-events-none") &&
      child.classList.contains("absolute") &&
      child.classList.contains("inset-0") &&
      child.className.includes("bg-[#070e0c]");
  }) as HTMLElement | undefined;
}

export default function ScopeRadarMapVisibility() {
  useEffect(() => {
    let attempts = 0;
    let timer: number | null = null;

    const apply = () => {
      attempts += 1;
      const layer = findMapLayer();

      if (layer) {
        layer.dataset.pf24AirspaceMap = "true";
        layer.style.zIndex = "4";
        layer.style.opacity = "1";
        layer.style.visibility = "visible";
        layer.style.display = "block";

        const image = layer.querySelector<HTMLImageElement>("img");
        if (image) {
          image.style.opacity = "1";
          image.style.visibility = "visible";
          image.style.display = "block";
          image.style.objectFit = "fill";
        }
      }

      if ((!layer || !layer.querySelector("img")) && attempts < 20) {
        timer = window.setTimeout(apply, 150);
      }
    };

    apply();

    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
