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

async function renderInline(layer: HTMLElement, image: HTMLImageElement) {
  if (layer.dataset.pf24MapInline === "true") return true;

  try {
    const response = await fetch(image.src);
    if (!response.ok) return false;
    const svgText = await response.text();
    if (!svgText.includes("<svg")) return false;

    const transform = image.style.transform;
    const transformOrigin = image.style.transformOrigin || "0 0";

    const holder = document.createElement("div");
    holder.dataset.pf24MapInlineHolder = "true";
    holder.style.position = "absolute";
    holder.style.inset = "0";
    holder.style.width = "100%";
    holder.style.height = "100%";
    holder.style.pointerEvents = "none";
    holder.innerHTML = svgText;

    const svg = holder.querySelector<SVGSVGElement>("svg");
    if (!svg) return false;

    svg.style.position = "absolute";
    svg.style.left = "0";
    svg.style.top = "0";
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.maxWidth = "none";
    svg.style.maxHeight = "none";
    svg.style.display = "block";
    svg.style.opacity = "1";
    svg.style.visibility = "visible";
    svg.style.transformOrigin = transformOrigin;
    svg.style.transform = transform;

    image.replaceWith(holder);
    layer.dataset.pf24MapInline = "true";
    return true;
  } catch {
    return false;
  }
}

export default function ScopeRadarMapVisibility() {
  useEffect(() => {
    let attempts = 0;
    let timer: number | null = null;
    let disposed = false;

    const apply = async () => {
      if (disposed) return;
      attempts += 1;
      const layer = findMapLayer();

      if (layer) {
        layer.dataset.pf24AirspaceMap = "true";
        layer.style.zIndex = "4";
        layer.style.opacity = "1";
        layer.style.visibility = "visible";
        layer.style.display = "block";
        layer.style.pointerEvents = "none";

        const image = layer.querySelector<HTMLImageElement>("img");
        if (image) {
          image.style.opacity = "1";
          image.style.visibility = "visible";
          image.style.display = "block";
          image.style.objectFit = "fill";
          await renderInline(layer, image);
        }
      }

      const ready = Boolean(layer?.dataset.pf24MapInline === "true");
      if (!ready && attempts < 30) {
        timer = window.setTimeout(() => void apply(), 150);
      }
    };

    void apply();

    return () => {
      disposed = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
