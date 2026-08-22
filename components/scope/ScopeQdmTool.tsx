"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
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
    target.closest("[data-pf24-distance-layer='true']") ||
    target.closest("[data-pf24-qdm-line='true']")
  );
}

function bearingFromDelta(dx: number, dy: number) {
  const degrees = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  return Math.round(degrees) % 360;
}

function readableLineAngle(dx: number, dy: number) {
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  // Keep the text following the exact line axis while avoiding upside-down text.
  // A vertical QDM therefore remains fully vertical at +/-90 degrees.
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return angle;
}

export default function ScopeQdmTool() {
  const [radar, setRadar] = useState<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 });
  const [originBase, setOriginBase] = useState<Point | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [frozenEndBase, setFrozenEndBase] = useState<Point | null>(null);
  const [sizeTick, setSizeTick] = useState(0);
  const holdingRef = useRef(false);
  const frozenRef = useRef<Point | null>(null);
  const cursorRef = useRef<Point | null>(null);
  const viewportRef = useRef(viewport);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    setViewport(readViewport());
    const onViewport = (event: Event) => {
      const detail = (event as CustomEvent<Viewport>).detail;
      if (detail) {
        viewportRef.current = detail;
        setViewport(detail);
      }
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

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0 || event.detail < 2 || frozenRef.current || blocksQdm(event.target)) return;
      const rect = radar.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const currentViewport = viewportRef.current;
      const zoom = Math.max(0.01, currentViewport.zoom);
      const origin = {
        x: (x - currentViewport.panX) / zoom,
        y: (y - currentViewport.panY) / zoom,
      };

      frozenRef.current = null;
      setFrozenEndBase(null);
      setOriginBase(origin);
      cursorRef.current = { x, y };
      setCursor({ x, y });
      holdingRef.current = true;
    };

    const onDoubleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-pf24-qdm-line='true']")) return;
      if (event.button !== 0 || blocksQdm(event.target)) return;
      const rect = radar.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!holdingRef.current || frozenRef.current) return;
      const rect = radar.getBoundingClientRect();
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      cursorRef.current = point;
      setCursor(point);
    };

    const onMouseUp = (event: MouseEvent) => {
      if (event.button !== 0 || !holdingRef.current) return;
      holdingRef.current = false;
      if (!frozenRef.current) {
        setOriginBase(null);
        cursorRef.current = null;
        setCursor(null);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "KeyQ" || !holdingRef.current || frozenRef.current) return;
      const point = cursorRef.current;
      if (!point) return;
      const currentViewport = viewportRef.current;
      const zoom = Math.max(0.01, currentViewport.zoom);
      const frozen = {
        x: (point.x - currentViewport.panX) / zoom,
        y: (point.y - currentViewport.panY) / zoom,
      };
      event.preventDefault();
      event.stopPropagation();
      frozenRef.current = frozen;
      setFrozenEndBase(frozen);
      holdingRef.current = false;
    };

    const onResize = () => setSizeTick((value) => value + 1);

    radar.addEventListener("mousedown", onMouseDown, true);
    radar.addEventListener("dblclick", onDoubleClick, true);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", onResize);
    return () => {
      radar.removeEventListener("mousedown", onMouseDown, true);
      radar.removeEventListener("dblclick", onDoubleClick, true);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", onResize);
    };
  }, [radar]);

  const rendered = useMemo(() => {
    void sizeTick;
    if (!radar || !originBase) return null;
    const rect = radar.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) return null;

    const origin = {
      x: originBase.x * viewport.zoom + viewport.panX,
      y: originBase.y * viewport.zoom + viewport.panY,
    };
    const endpoint = frozenEndBase
      ? {
          x: frozenEndBase.x * viewport.zoom + viewport.panX,
          y: frozenEndBase.y * viewport.zoom + viewport.panY,
        }
      : cursor;
    if (!endpoint) return null;

    const dx = endpoint.x - origin.x;
    const dy = endpoint.y - origin.y;
    const length = Math.hypot(dx, dy);
    const distanceNm = scopeDistanceNmFromScreenDelta(dx, dy, rect.width, rect.height, viewport.zoom);
    const bearing = bearingFromDelta(dx, dy);
    const angle = readableLineAngle(dx, dy);
    const mid = { x: (origin.x + endpoint.x) / 2, y: (origin.y + endpoint.y) / 2 };
    const labelText = `${Math.max(0, distanceNm).toFixed(1)}nm ${String(bearing).padStart(3, "0")}°`;
    const labelWidth = labelText.length * 7.2;

    const unit = length > 0.001 ? { x: dx / length, y: dy / length } : { x: 1, y: 0 };
    // Because the text now follows the line itself, the gap only needs to cover
    // the text width along that same axis.
    const halfGap = Math.min(labelWidth / 2 + 5, Math.max(0, length * 0.42));
    const gapStart = { x: mid.x - unit.x * halfGap, y: mid.y - unit.y * halfGap };
    const gapEnd = { x: mid.x + unit.x * halfGap, y: mid.y + unit.y * halfGap };

    return { origin, endpoint, distanceNm, bearing, angle, mid, labelText, gapStart, gapEnd };
  }, [cursor, frozenEndBase, originBase, radar, sizeTick, viewport]);

  if (!radar || !rendered) return null;

  const removeFrozen = () => {
    if (!frozenRef.current) return;
    frozenRef.current = null;
    setFrozenEndBase(null);
    setOriginBase(null);
    cursorRef.current = null;
    setCursor(null);
    holdingRef.current = false;
  };

  return createPortal(
    <svg
      data-pf24-qdm-layer="true"
      className="pointer-events-none absolute inset-0 z-[11] h-full w-full"
      aria-hidden="true"
    >
      {frozenEndBase && <line
        data-pf24-qdm-line="true"
        x1={rendered.origin.x}
        y1={rendered.origin.y}
        x2={rendered.endpoint.x}
        y2={rendered.endpoint.y}
        stroke="transparent"
        strokeWidth="12"
        pointerEvents="stroke"
        className="pointer-events-auto cursor-pointer"
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          removeFrozen();
        }}
      />}
      <line
        x1={rendered.origin.x}
        y1={rendered.origin.y}
        x2={rendered.gapStart.x}
        y2={rendered.gapStart.y}
        stroke={LINE_COLOR}
        strokeWidth="2"
      />
      <line
        x1={rendered.gapEnd.x}
        y1={rendered.gapEnd.y}
        x2={rendered.endpoint.x}
        y2={rendered.endpoint.y}
        stroke={LINE_COLOR}
        strokeWidth="2"
      />
      <text
        x={rendered.mid.x}
        y={rendered.mid.y}
        transform={`rotate(${rendered.angle} ${rendered.mid.x} ${rendered.mid.y})`}
        fill={LINE_COLOR}
        stroke="#0b0b0b"
        strokeWidth="2"
        paintOrder="stroke"
        fontSize="12"
        fontFamily="monospace"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {rendered.labelText}
      </text>
    </svg>,
    radar,
  );
}
