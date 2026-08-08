"use client";

import { useEffect } from "react";

type Viewport = { zoom: number; panX: number; panY: number };

const STORAGE_KEY = "pf24_scope_radar_viewport_v1";
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 3;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readViewport(): Viewport {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { zoom: 1, panX: 0, panY: 0 };
    const parsed = JSON.parse(raw) as Partial<Viewport>;
    return {
      zoom: clamp(typeof parsed.zoom === "number" ? parsed.zoom : 1, MIN_ZOOM, MAX_ZOOM),
      panX: typeof parsed.panX === "number" && Number.isFinite(parsed.panX) ? parsed.panX : 0,
      panY: typeof parsed.panY === "number" && Number.isFinite(parsed.panY) ? parsed.panY : 0,
    };
  } catch {
    return { zoom: 1, panX: 0, panY: 0 };
  }
}

function findRadar() {
  return document.querySelector<HTMLElement>("main.fixed > section");
}

function findTrafficLayer() {
  return document.querySelector<HTMLElement>("[data-pf24-traffic-sim='true']");
}

function isWindowOrControl(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("section > div.absolute.z-30") ||
    target.closest("[data-pf24-traffic-detail='true']") ||
    target.closest("[data-pf24-traffic-select='true']") ||
    target.closest(".connectBox") ||
    target.closest("button, input, select, textarea")
  );
}

export default function RadarViewport() {
  useEffect(() => {
    const radar = findRadar();
    if (!radar) return;

    let viewport = readViewport();
    let panning = false;
    let lastX = 0;
    let lastY = 0;
    let trafficLayer: HTMLElement | null = null;

    const apply = () => {
      trafficLayer = findTrafficLayer();
      if (!trafficLayer) return;
      trafficLayer.style.transformOrigin = "0 0";
      trafficLayer.style.transform = `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`;
      trafficLayer.style.willChange = "transform";
      trafficLayer.dataset.pf24RadarZoom = viewport.zoom.toFixed(3);
    };

    const persist = () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(viewport));
    };

    apply();
    const initialRetry = window.setTimeout(apply, 300);

    const onWheel = (event: WheelEvent) => {
      if (isWindowOrControl(event.target)) return;
      event.preventDefault();

      const rect = radar.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      const oldZoom = viewport.zoom;
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      const nextZoom = clamp(oldZoom * factor, MIN_ZOOM, MAX_ZOOM);
      if (nextZoom === oldZoom) return;

      const worldX = (cursorX - viewport.panX) / oldZoom;
      const worldY = (cursorY - viewport.panY) / oldZoom;
      viewport = {
        zoom: nextZoom,
        panX: cursorX - worldX * nextZoom,
        panY: cursorY - worldY * nextZoom,
      };
      apply();
      persist();
    };

    const onMouseDown = (event: MouseEvent) => {
      const wantsPan = event.button === 1 || (event.button === 0 && event.shiftKey);
      if (!wantsPan || isWindowOrControl(event.target)) return;
      event.preventDefault();
      panning = true;
      lastX = event.clientX;
      lastY = event.clientY;
      radar.style.cursor = "grabbing";
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!panning) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      viewport = { ...viewport, panX: viewport.panX + dx, panY: viewport.panY + dy };
      apply();
    };

    const stopPan = () => {
      if (!panning) return;
      panning = false;
      radar.style.cursor = "";
      persist();
    };

    const onContextMenu = (event: MouseEvent) => {
      if (panning) event.preventDefault();
    };

    radar.addEventListener("wheel", onWheel, { passive: false });
    radar.addEventListener("mousedown", onMouseDown);
    radar.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stopPan);
    window.addEventListener("blur", stopPan);

    return () => {
      window.clearTimeout(initialRetry);
      radar.removeEventListener("wheel", onWheel);
      radar.removeEventListener("mousedown", onMouseDown);
      radar.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stopPan);
      window.removeEventListener("blur", stopPan);
      radar.style.cursor = "";
      if (trafficLayer) {
        trafficLayer.style.transform = "";
        trafficLayer.style.transformOrigin = "";
        trafficLayer.style.willChange = "";
        delete trafficLayer.dataset.pf24RadarZoom;
      }
    };
  }, []);

  return null;
}
