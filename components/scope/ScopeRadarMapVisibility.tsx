"use client";

import { useEffect } from "react";

type Viewport = { zoom: number; panX: number; panY: number };
const VIEWPORT_EVENT = "pf24-radar-viewport";

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

function styleInlineSvg(svg: SVGSVGElement) {
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
  svg.style.pointerEvents = "none";
  svg.style.filter = "brightness(1.65) contrast(1.08)";
  svg.setAttribute("preserveAspectRatio", "none");
}

function applyViewportToInlineMap(viewport: Viewport) {
  const layer = findMapLayer();
  const svg = layer?.querySelector<SVGSVGElement>("[data-pf24-map-inline-holder='true'] svg");
  if (!svg) return;
  styleInlineSvg(svg);
  svg.style.transformOrigin = "0 0";
  svg.style.transform = `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`;
}

async function renderInline(layer: HTMLElement, image: HTMLImageElement) {
  const existing = layer.querySelector<SVGSVGElement>("[data-pf24-map-inline-holder='true'] svg");
  if (existing) {
    styleInlineSvg(existing);
    return true;
  }

  try {
    const response = await fetch(image.src);
    if (!response.ok) return false;
    const svgText = await response.text();
    if (!svgText.includes("<svg")) return false;

    const holder = document.createElement("div");
    holder.dataset.pf24MapInlineHolder = "true";
    holder.style.position = "absolute";
    holder.style.inset = "0";
    holder.style.width = "100%";
    holder.style.height = "100%";
    holder.style.zIndex = "0";
    holder.style.pointerEvents = "none";
    holder.style.overflow = "hidden";
    holder.innerHTML = svgText;

    const svg = holder.querySelector<SVGSVGElement>("svg");
    if (!svg) return false;

    styleInlineSvg(svg);
    svg.style.transformOrigin = image.style.transformOrigin || "0 0";
    svg.style.transform = image.style.transform;

    layer.appendChild(holder);
    image.style.opacity = "0";
    image.style.visibility = "hidden";
    image.style.pointerEvents = "none";
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
        layer.style.position = "absolute";
        layer.style.inset = "0";
        layer.style.zIndex = "7";
        layer.style.opacity = "1";
        layer.style.visibility = "visible";
        layer.style.display = "block";
        layer.style.pointerEvents = "none";
        layer.style.overflow = "hidden";

        const image = layer.querySelector<HTMLImageElement>("img");
        if (image) {
          image.style.width = "100%";
          image.style.height = "100%";
          image.style.visibility = "visible";
          image.style.display = "block";
          image.style.objectFit = "fill";
          await renderInline(layer, image);
        }

        const svg = layer.querySelector<SVGSVGElement>("[data-pf24-map-inline-holder='true'] svg");
        if (svg) styleInlineSvg(svg);
      }

      const ready = Boolean(layer?.querySelector("[data-pf24-map-inline-holder='true'] svg"));
      if (!ready && attempts < 40) {
        timer = window.setTimeout(() => void apply(), 150);
      }
    };

    const onViewport = (event: Event) => {
      const viewport = (event as CustomEvent<Viewport>).detail;
      if (viewport) applyViewportToInlineMap(viewport);
      void apply();
    };

    window.addEventListener(VIEWPORT_EVENT, onViewport);
    void apply();

    return () => {
      disposed = true;
      window.removeEventListener(VIEWPORT_EVENT, onViewport);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
