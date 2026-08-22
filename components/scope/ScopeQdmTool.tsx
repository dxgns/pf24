"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { scopeDistanceNmFromScreenDelta } from "@/lib/scope/distanceScale";

type Point = { x: number; y: number };
type Viewport = { zoom: number; panX: number; panY: number };

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";
const LINE_COLOR = "#8a8a8a";

function readViewport(): Viewport {
  try {
    const parsed = JSON.parse(localStorage.getItem(VIEWPORT_KEY) ?? "{}") as Partial<Viewport>;
    return {
      zoom: typeof parsed.zoom === "number" && Number.isFinite(parsed.zoom) ? parsed.zoom : 1,
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

function blocksQdm(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("section > div.absolute.z-30") ||
    target.closest("[data-pf24-weather-window='true']") ||
    target.closest("[data-pf24-atis-dialog='true']") ||
    target.closest(".connectBox") ||
    target.closest("button,input,select,textarea") ||
    target.closest("[data-pf24-traffic-label='true']") ||
    target.closest("[data-pf24-traffic-popup='true']") ||
    target.closest("[data-pf24-callsign-menu='true']") ||
    target.closest("[data-pf24-distance-layer='true']")
  );
}

function bearingFromDelta(dx: number, dy: number) {
  const degrees = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  return Math.round(degrees) % 360;
}

export default function ScopeQdmTool() {
  const [radar, setRadar] = useState<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 });
  const [originBase, setOriginBase] = useState<Point | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [sizeTick, setSizeTick] = useState(0);

  useEffect(() => {
    setViewport(readViewport());
    const onViewport = (event: Event) => {
      const detail = (event as CustomEvent<Viewport>).detail;
      if (detail) setViewport(detail);
    };
    window.addEventListener(VIEWPORT_EVENT, onViewport);
    return () => window.removeEventListener(VIEWPORT_EVENT, onViewport);
  }, []);

  useEffect(() => {
    let attempts = 0;
    const locate = () => {
      const next = findRadar();
      if (next) {
        setRadar(next);
        window.clearInterval(timer);
      }
      attempts += 1;
      if (attempts >= 40) window.clearInterval(timer);
    };
    const timer = window.setInterval(locate, 100);
    locate();
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!radar) return;

    const onDoubleClick = (event: MouseEvent) => {
      if (event.button !== 0 || blocksQdm(event.target)) return;
      const rect = radar.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const zoom = Math.max(0.01, viewport.zoom);
      setOriginBase({
        x: (x - viewport.panX) / zoom,
        y: (y - viewport.panY) / zoom,
      });
      setCursor({ x, y });
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!originBase) return;
      const rect = radar.getBoundingClientRect();
      setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !originBase) return;
      setOriginBase(null);
      setCursor(null);
    };

    const onResize = () => setSizeTick((value) => value + 1);

    radar.addEventListener("dblclick", onDoubleClick, true);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      radar.removeEventListener("dblclick", onDoubleClick, true);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [originBase, radar, viewport]);

  const rendered = useMemo(() => {
    void sizeTick;
    if (!radar || !originBase || !cursor) return null;
    const rect = radar.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) return null;

    const origin = {
      x: originBase.x * viewport.zoom + viewport.panX,
      y: originBase.y * viewport.zoom + viewport.panY,
    };
    const dx = cursor.x - origin.x;
    const dy = cursor.y - origin.y;
    const distanceNm = scopeDistanceNmFromScreenDelta(dx, dy, rect.width, rect.height, viewport.zoom);
    const bearing = bearingFromDelta(dx, dy);
    const mid = { x: (origin.x + cursor.x) / 2, y: (origin.y + cursor.y) / 2 };

    return { origin, cursor, distanceNm, bearing, mid };
  }, [cursor, originBase, radar, sizeTick, viewport]);

  if (!radar || !rendered) return null;

  return createPortal(
    <svg
      data-pf24-qdm-layer="true"
      className="pointer-events-none absolute inset-0 z-[11] h-full w-full"
      aria-hidden="true"
    >
      <line
        x1={rendered.origin.x}
        y1={rendered.origin.y}
        x2={rendered.cursor.x}
        y2={rendered.cursor.y}
        stroke={LINE_COLOR}
        strokeWidth="2"
      />
      <text
        x={rendered.mid.x + 8}
        y={rendered.mid.y - 5}
        fill={LINE_COLOR}
        fontSize="12"
        fontFamily="monospace"
      >
        {Math.max(0, rendered.distanceNm).toFixed(1)}nm {String(rendered.bearing).padStart(3, "0")}°
      </text>
    </svg>,
    radar,
  );
}
