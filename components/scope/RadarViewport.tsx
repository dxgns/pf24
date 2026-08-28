"use client";

import { useEffect } from "react";
import {
  scopeClientDeltaToLocal,
  scopeClientPointToLocal,
  scopeElementLocalSize,
} from "@/lib/scope/domCoordinates";
import { MAP_BOUNDS } from "@/lib/scope/mapData";

type Viewport = { zoom: number; panX: number; panY: number };
type Point = { x: number; y: number };

const STORAGE_KEY = "pf24_scope_radar_viewport_v1";
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 512;
const VIEWPORT_EVENT = "pf24-radar-viewport";
const WHEEL_ZOOM_SENSITIVITY = 0.0019;
const WHEEL_COMMIT_DELAY_MS = 120;

// Airport detail SVGs are intentionally preloaded independently from their zoom
// visibility. Several airport renderers mount/unmount external <image> elements
// around the detail threshold; very fast wheel zoom can otherwise make the browser
// abort an SVG request and leave the newly mounted element blank. Keeping these
// Image objects alive for the lifetime of the radar gives every airport a stable,
// shared cached resource regardless of how quickly the detail threshold is crossed.
const AIRPORT_SVG_ASSETS = [
  "/scope/mdpc-ground-1.svg",
  "/scope/mdpc-ground-2.svg",
  "/scope/mdpc-ground-3.svg",
  "/scope/mdpc-ground-4.svg",
  "/scope/mdst-ground.svg",
  "/scope/mdab-ground.svg",
  "/scope/mdcr-ground.svg",
  "/scope/mtca-ground.svg",
] as const;

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

function mapFit(size: Point) {
  const mapWidth = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
  const mapHeight = MAP_BOUNDS.maxY - MAP_BOUNDS.minY;
  const scale = Math.min(size.x / mapWidth, size.y / mapHeight);
  return {
    scale,
    offsetX: (size.x - mapWidth * scale) / 2,
    offsetY: (size.y - mapHeight * scale) / 2,
  };
}

function mapPointFromLocal(point: Point, size: Point, viewport: Viewport): Point | null {
  const fit = mapFit(size);
  if (!(fit.scale > 0)) return null;
  const zoom = Math.max(0.01, viewport.zoom);
  const baseX = (point.x - viewport.panX) / zoom;
  const baseY = (point.y - viewport.panY) / zoom;
  return {
    x: MAP_BOUNDS.minX + (baseX - fit.offsetX) / fit.scale,
    y: MAP_BOUNDS.minY + (baseY - fit.offsetY) / fit.scale,
  };
}

function basePointFromMap(point: Point, size: Point): Point {
  const fit = mapFit(size);
  return {
    x: fit.offsetX + (point.x - MAP_BOUNDS.minX) * fit.scale,
    y: fit.offsetY + (point.y - MAP_BOUNDS.minY) * fit.scale,
  };
}

function sameSize(a: Point, b: Point) {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
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

function wheelDeltaPixels(event: WheelEvent, pageHeight: number) {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * Math.max(1, pageHeight);
  return event.deltaY;
}

export default function RadarViewport() {
  useEffect(() => {
    const airportPreloads = AIRPORT_SVG_ASSETS.map((src) => {
      const image = new Image();
      image.decoding = "async";
      image.src = src;
      return image;
    });

    const radar = findRadar();
    if (!radar) {
      return () => {
        airportPreloads.forEach((image) => {
          image.onload = null;
          image.onerror = null;
        });
      };
    }

    let viewport = readViewport();
    let radarSize = scopeElementLocalSize(radar);
    let panning = false;
    let movedDuringPan = false;
    let suppressTrafficClick = false;
    let lastX = 0;
    let lastY = 0;
    let renderFrame = 0;
    let wheelCommitTimer: number | null = null;
    let lastPublished: Viewport | null = null;

    const publishNow = () => {
      renderFrame = 0;
      if (
        lastPublished &&
        lastPublished.zoom === viewport.zoom &&
        lastPublished.panX === viewport.panX &&
        lastPublished.panY === viewport.panY
      ) return;

      const detail = { ...viewport };
      lastPublished = detail;
      radar.dataset.pf24RadarZoom = viewport.zoom.toFixed(3);
      radar.style.setProperty("--pf24-radar-zoom", String(viewport.zoom));
      radar.style.setProperty("--pf24-radar-pan-x", `${viewport.panX}px`);
      radar.style.setProperty("--pf24-radar-pan-y", `${viewport.panY}px`);
      window.dispatchEvent(new CustomEvent<Viewport>(VIEWPORT_EVENT, { detail }));
    };

    // Pointer and trackpad events can arrive much faster than the display can
    // paint. Collapsing them to one viewport publication per animation frame
    // prevents every map/traffic overlay from re-rendering multiple times before
    // the browser has had a chance to draw the previous frame.
    const schedulePublish = () => {
      if (renderFrame) return;
      renderFrame = window.requestAnimationFrame(publishNow);
    };

    const flushPublish = () => {
      if (renderFrame) {
        window.cancelAnimationFrame(renderFrame);
        renderFrame = 0;
      }
      publishNow();
    };

    const forcePublish = () => {
      lastPublished = null;
      flushPublish();
    };

    const persist = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(viewport));
      } catch {
        // The live viewport remains usable when storage is blocked or full.
      }
    };

    const commitWheel = () => {
      wheelCommitTimer = null;
      flushPublish();
      persist();
    };

    const reframeForSize = () => {
      const nextSize = scopeElementLocalSize(radar);
      if (sameSize(radarSize, nextSize)) {
        schedulePublish();
        return;
      }

      // General Scope zoom changes the CSS layout size of the radar before the
      // outer transform is applied. Raw pan pixels therefore cannot be reused:
      // the same pan would point at a different place on the map. Preserve the
      // geographic point currently under the radar centre and solve a new pan
      // for the new logical size instead.
      const oldCenter = { x: radarSize.x / 2, y: radarSize.y / 2 };
      const anchor = mapPointFromLocal(oldCenter, radarSize, viewport);
      if (anchor) {
        const base = basePointFromMap(anchor, nextSize);
        viewport = {
          ...viewport,
          panX: nextSize.x / 2 - base.x * viewport.zoom,
          panY: nextSize.y / 2 - base.y * viewport.zoom,
        };
        persist();
      }

      radarSize = nextSize;
      schedulePublish();
    };

    flushPublish();
    // Some portal overlays attach their listener just after the viewport effect.
    // Replay the initial state once so they do not remain at 1x until first input.
    const initialRetry = window.setTimeout(forcePublish, 300);

    const onWheel = (event: WheelEvent) => {
      if (isScopeWindowOrFormControl(event.target)) return;
      event.preventDefault();

      const cursor = scopeClientPointToLocal(radar, event.clientX, event.clientY);
      const oldZoom = viewport.zoom;
      const rawDelta = wheelDeltaPixels(event, radarSize.y);
      const boundedDelta = clamp(rawDelta, -240, 240);
      const factor = Math.exp(-boundedDelta * WHEEL_ZOOM_SENSITIVITY);
      const nextZoom = clamp(oldZoom * factor, MIN_ZOOM, MAX_ZOOM);
      if (Math.abs(nextZoom - oldZoom) < 1e-9) return;

      const worldX = (cursor.x - viewport.panX) / oldZoom;
      const worldY = (cursor.y - viewport.panY) / oldZoom;
      viewport = {
        zoom: nextZoom,
        panX: cursor.x - worldX * nextZoom,
        panY: cursor.y - worldY * nextZoom,
      };
      schedulePublish();

      if (wheelCommitTimer !== null) window.clearTimeout(wheelCommitTimer);
      wheelCommitTimer = window.setTimeout(commitWheel, WHEEL_COMMIT_DELAY_MS);
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
      const physicalDx = event.clientX - lastX;
      const physicalDy = event.clientY - lastY;
      if (Math.abs(physicalDx) + Math.abs(physicalDy) > 1) movedDuringPan = true;
      lastX = event.clientX;
      lastY = event.clientY;
      const delta = scopeClientDeltaToLocal(radar, physicalDx, physicalDy);
      viewport = {
        ...viewport,
        panX: viewport.panX + delta.x,
        panY: viewport.panY + delta.y,
      };
      schedulePublish();
    };

    const stopPan = () => {
      if (!panning) return;
      panning = false;
      suppressTrafficClick = movedDuringPan;
      movedDuringPan = false;
      flushPublish();
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

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(reframeForSize)
      : null;
    resizeObserver?.observe(radar);

    radar.addEventListener("wheel", onWheel, { passive: false });
    radar.addEventListener("mousedown", onMouseDown);
    radar.addEventListener("click", onClickCapture, true);
    radar.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stopPan);
    window.addEventListener("blur", stopPan);

    return () => {
      window.clearTimeout(initialRetry);
      if (wheelCommitTimer !== null) window.clearTimeout(wheelCommitTimer);
      if (renderFrame) window.cancelAnimationFrame(renderFrame);
      resizeObserver?.disconnect();
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
      airportPreloads.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
    };
  }, []);

  return null;
}
