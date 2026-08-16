"use client";

import { useEffect } from "react";

type Viewport = { zoom: number; panX: number; panY: number };

const STORAGE_KEY = "pf24_scope_radar_viewport_v1";
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 6;
const VIEWPORT_EVENT = "pf24-radar-viewport";

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

function isScopeWindowOrFormControl(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("section > div.absolute.z-30") ||
    target.closest("[data-pf24-weather-window='true']") ||
    target.closest("[data-pf24-atis-dialog='true']") ||
    target.closest(".connectBox") ||
    target.closest("input, select, textarea") ||
    target.closest("button:not([data-pf24-traffic-select='true'])")
  );
}

function isPanBlocked(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(isScopeWindowOrFormControl(target) || target.closest("[data-pf24-traffic-detail='true']"));
}

export default function RadarViewport() {
  useEffect(() => {
    const radar = findRadar();
    if (!radar) return;

    let viewport = readViewport();
    let panning = false;
    let movedDuringPan = false;
    let suppressTrafficClick = false;
    let lastX = 0;
    let lastY = 0;

    const publish = () => {
      window.dispatchEvent(new CustomEvent<Viewport>(VIEWPORT_EVENT, { detail: { ...viewport } }));
      radar.dataset.pf24RadarZoom = viewport.zoom.toFixed(3);
      radar.style.setProperty("--pf24-radar-zoom", String(viewport.zoom));
      radar.style.setProperty("--pf24-radar-pan-x", `${viewport.panX}px`);
      radar.style.setProperty("--pf24-radar-pan-y", `${viewport.panY}px`);
    };

    const persist = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(viewport));

    publish();
    const initialRetry = window.setTimeout(publish, 300);

    const onWheel = (event: WheelEvent) => {
      if (isScopeWindowOrFormControl(event.target)) return;
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
      viewport = { zoom: nextZoom, panX: cursorX - worldX * nextZoom, panY: cursorY - worldY * nextZoom };
      publish();
      persist();
    };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 2 || isPanBlocked(event.target)) return;
      event.preventDefault();
      panning = true;
      movedDuringPan = false;
      lastX = event.clientX;
      lastY = event.clientY;
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!panning) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 1) movedDuringPan = true;
      lastX = event.clientX;
      lastY = event.clientY;
      viewport = { ...viewport, panX: viewport.panX + dx, panY: viewport.panY + dy };
      publish();
    };

    const stopPan = () => {
      if (!panning) return;
      panning = false;
      suppressTrafficClick = movedDuringPan;
      movedDuringPan = false;
      persist();
    };

    const onClickCapture = (event: MouseEvent) => {
      if (!suppressTrafficClick) return;
      suppressTrafficClick = false;
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("[data-pf24-traffic-select='true']")) return;
      event.preventDefault();
      event.stopPropagation();
    };

    const onContextMenu = (event: MouseEvent) => {
      if (event.target instanceof Element && radar.contains(event.target) && !isScopeWindowOrFormControl(event.target)) event.preventDefault();
    };

    radar.addEventListener("wheel", onWheel, { passive: false });
    radar.addEventListener("mousedown", onMouseDown);
    radar.addEventListener("click", onClickCapture, true);
    radar.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stopPan);
    window.addEventListener("blur", stopPan);

    return () => {
      window.clearTimeout(initialRetry);
      radar.removeEventListener("wheel", onWheel);
      radar.removeEventListener("mousedown", onMouseDown);
      radar.removeEventListener("click", onClickCapture, true);
      radar.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stopPan);
      window.removeEventListener("blur", stopPan);
      radar.style.removeProperty("--pf24-radar-zoom");
      radar.style.removeProperty("--pf24-radar-pan-x");
      radar.style.removeProperty("--pf24-radar-pan-y");
      delete radar.dataset.pf24RadarZoom;
    };
  }, []);

  return null;
}
