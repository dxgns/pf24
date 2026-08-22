"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { scopeDistanceNmFromScreenDelta } from "@/lib/scope/distanceScale";
import { MAP_BOUNDS } from "@/lib/scope/mapData";

type Point = { x: number; y: number };
type Viewport = { zoom: number; panX: number; panY: number };
type FrozenQdm = { id: number; originBase: Point; endBase: Point };
type RenderedQdm = {
  id?: number;
  origin: Point;
  endpoint: Point;
  angle: number;
  label: Point;
  labelText: string;
};
type ContextMenuPoint = { x: number; y: number };

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";
const LINE_COLOR = "#8a8a8a";
const LABEL_OFFSET_PX = 10;
const CONTEXT_MENU_WIDTH = 146;
const CONTEXT_MENU_HEIGHT = 47;

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
    target.closest("[data-pf24-qdm-line='true']") ||
    target.closest("[data-pf24-qdm-context-menu='true']")
  );
}

function blocksMapContextMenu(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("section > div.absolute.z-30") ||
    target.closest("[data-pf24-weather-window='true']") ||
    target.closest("[data-pf24-atis-dialog='true']") ||
    target.closest(".connectBox") ||
    target.closest("input,select,textarea") ||
    target.closest("[data-pf24-traffic-popup='true']") ||
    target.closest("[data-pf24-callsign-menu='true']") ||
    target.closest("[data-pf24-qdm-context-menu='true']")
  );
}

function bearingFromDelta(dx: number, dy: number) {
  const degrees = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  return Math.round(degrees) % 360;
}

function readableLineAngle(dx: number, dy: number) {
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return angle;
}

function labelBelowLine(dx: number, dy: number) {
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return { x: 0, y: LABEL_OFFSET_PX };

  const normalA = { x: -dy / length, y: dx / length };
  const normalB = { x: dy / length, y: -dx / length };

  if (Math.abs(normalA.y - normalB.y) < 0.001) {
    const normal = normalA.x >= normalB.x ? normalA : normalB;
    return { x: normal.x * LABEL_OFFSET_PX, y: normal.y * LABEL_OFFSET_PX };
  }

  const normal = normalA.y > normalB.y ? normalA : normalB;
  return { x: normal.x * LABEL_OFFSET_PX, y: normal.y * LABEL_OFFSET_PX };
}

function mapCoordinatesFromScreen(point: Point, rect: DOMRect, viewport: Viewport) {
  const zoom = Math.max(0.01, viewport.zoom);
  const baseX = (point.x - viewport.panX) / zoom;
  const baseY = (point.y - viewport.panY) / zoom;
  const mapWidth = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
  const mapHeight = MAP_BOUNDS.maxY - MAP_BOUNDS.minY;
  const fitScale = Math.min(rect.width / mapWidth, rect.height / mapHeight);
  if (!(fitScale > 0)) return null;

  const offsetX = (rect.width - mapWidth * fitScale) / 2;
  const offsetY = (rect.height - mapHeight * fitScale) / 2;
  return {
    x: MAP_BOUNDS.minX + (baseX - offsetX) / fitScale,
    y: MAP_BOUNDS.minY + (baseY - offsetY) / fitScale,
  };
}

export default function ScopeQdmTool() {
  const [radar, setRadar] = useState<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 });
  const [originBase, setOriginBase] = useState<Point | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [frozenQdms, setFrozenQdms] = useState<FrozenQdm[]>([]);
  const [multiQdm, setMultiQdm] = useState(false);
  const [showCrd, setShowCrd] = useState(false);
  const [crdCursor, setCrdCursor] = useState<Point | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuPoint | null>(null);
  const [sizeTick, setSizeTick] = useState(0);

  const holdingRef = useRef(false);
  const originRef = useRef<Point | null>(null);
  const cursorRef = useRef<Point | null>(null);
  const viewportRef = useRef(viewport);
  const frozenRef = useRef<FrozenQdm[]>([]);
  const multiRef = useRef(false);
  const showCrdRef = useRef(false);
  const nextQdmIdRef = useRef(1);
  const rightDownRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    frozenRef.current = frozenQdms;
  }, [frozenQdms]);

  useEffect(() => {
    multiRef.current = multiQdm;
  }, [multiQdm]);

  useEffect(() => {
    showCrdRef.current = showCrd;
    if (!showCrd) setCrdCursor(null);
  }, [showCrd]);

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

    const insideRadar = (event: MouseEvent) => {
      const rect = radar.getBoundingClientRect();
      return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    };

    const radarPoint = (event: MouseEvent) => {
      const rect = radar.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button === 2 && insideRadar(event) && !blocksMapContextMenu(event.target)) {
        rightDownRef.current = { x: event.clientX, y: event.clientY, moved: false };
        return;
      }

      if (event.button !== 0 || event.detail < 2 || blocksQdm(event.target)) return;
      if (!multiRef.current && frozenRef.current.length > 0) return;
      if (!insideRadar(event)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const point = radarPoint(event);
      const currentViewport = viewportRef.current;
      const zoom = Math.max(0.01, currentViewport.zoom);
      const origin = {
        x: (point.x - currentViewport.panX) / zoom,
        y: (point.y - currentViewport.panY) / zoom,
      };

      originRef.current = origin;
      setOriginBase(origin);
      cursorRef.current = point;
      setCursor(point);
      holdingRef.current = true;
      setContextMenu(null);
    };

    const onDoubleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-pf24-qdm-line='true']")) return;
      if (event.button !== 0 || blocksQdm(event.target) || !insideRadar(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const onMouseMove = (event: MouseEvent) => {
      const rightDown = rightDownRef.current;
      if (rightDown && !rightDown.moved && Math.hypot(event.clientX - rightDown.x, event.clientY - rightDown.y) > 4) {
        rightDown.moved = true;
      }

      if (showCrdRef.current) {
        if (insideRadar(event) && !blocksMapContextMenu(event.target)) setCrdCursor(radarPoint(event));
        else setCrdCursor(null);
      }

      if (!holdingRef.current) return;
      const point = radarPoint(event);
      cursorRef.current = point;
      setCursor(point);
    };

    const onMouseUp = (event: MouseEvent) => {
      if (event.button !== 0 || !holdingRef.current) return;
      holdingRef.current = false;
      originRef.current = null;
      setOriginBase(null);
      cursorRef.current = null;
      setCursor(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "KeyQ" || !holdingRef.current) return;
      const point = cursorRef.current;
      const origin = originRef.current;
      if (!point || !origin) return;

      const currentViewport = viewportRef.current;
      const zoom = Math.max(0.01, currentViewport.zoom);
      const frozen: FrozenQdm = {
        id: nextQdmIdRef.current++,
        originBase: origin,
        endBase: {
          x: (point.x - currentViewport.panX) / zoom,
          y: (point.y - currentViewport.panY) / zoom,
        },
      };

      event.preventDefault();
      event.stopPropagation();

      setFrozenQdms((current) => {
        const next = multiRef.current ? [...current, frozen] : [frozen];
        frozenRef.current = next;
        return next;
      });
      holdingRef.current = false;
      originRef.current = null;
      setOriginBase(null);
      cursorRef.current = null;
      setCursor(null);
    };

    const onContextMenu = (event: MouseEvent) => {
      if (!insideRadar(event) || blocksMapContextMenu(event.target)) return;
      event.preventDefault();
      const rightDown = rightDownRef.current;
      if (rightDown?.moved) {
        setContextMenu(null);
        rightDownRef.current = null;
        return;
      }

      const rect = radar.getBoundingClientRect();
      const rawX = event.clientX - rect.left;
      const rawY = event.clientY - rect.top;
      setContextMenu({
        x: Math.max(2, Math.min(rawX, rect.width - CONTEXT_MENU_WIDTH - 2)),
        y: Math.max(2, Math.min(rawY, rect.height - CONTEXT_MENU_HEIGHT - 2)),
      });
      rightDownRef.current = null;
    };

    const onDocumentMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-pf24-qdm-context-menu='true']")) return;
      setContextMenu(null);
    };

    const onResize = () => setSizeTick((value) => value + 1);

    radar.addEventListener("mousedown", onMouseDown, true);
    radar.addEventListener("dblclick", onDoubleClick, true);
    radar.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("mousedown", onDocumentMouseDown, true);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", onResize);
    return () => {
      radar.removeEventListener("mousedown", onMouseDown, true);
      radar.removeEventListener("dblclick", onDoubleClick, true);
      radar.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("mousedown", onDocumentMouseDown, true);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", onResize);
    };
  }, [radar]);

  const renderQdm = useMemo(() => {
    void sizeTick;
    if (!radar) return null;
    const rect = radar.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) return null;

    return (origin: Point, endpoint: Point, id?: number): RenderedQdm => {
      const dx = endpoint.x - origin.x;
      const dy = endpoint.y - origin.y;
      const distanceNm = scopeDistanceNmFromScreenDelta(dx, dy, rect.width, rect.height, viewport.zoom);
      const bearing = bearingFromDelta(dx, dy);
      const angle = readableLineAngle(dx, dy);
      const mid = { x: (origin.x + endpoint.x) / 2, y: (origin.y + endpoint.y) / 2 };
      const offset = labelBelowLine(dx, dy);
      return {
        id,
        origin,
        endpoint,
        angle,
        label: { x: mid.x + offset.x, y: mid.y + offset.y },
        labelText: `${Math.max(0, distanceNm).toFixed(1)}nm ${String(bearing).padStart(3, "0")}°`,
      };
    };
  }, [radar, sizeTick, viewport.zoom]);

  const renderedFrozen = useMemo(() => {
    if (!renderQdm) return [];
    return frozenQdms.map((qdm) => {
      const origin = {
        x: qdm.originBase.x * viewport.zoom + viewport.panX,
        y: qdm.originBase.y * viewport.zoom + viewport.panY,
      };
      const endpoint = {
        x: qdm.endBase.x * viewport.zoom + viewport.panX,
        y: qdm.endBase.y * viewport.zoom + viewport.panY,
      };
      return renderQdm(origin, endpoint, qdm.id);
    });
  }, [frozenQdms, renderQdm, viewport]);

  const renderedActive = useMemo(() => {
    if (!renderQdm || !originBase || !cursor) return null;
    const origin = {
      x: originBase.x * viewport.zoom + viewport.panX,
      y: originBase.y * viewport.zoom + viewport.panY,
    };
    return renderQdm(origin, cursor);
  }, [cursor, originBase, renderQdm, viewport]);

  const crd = useMemo(() => {
    void sizeTick;
    if (!radar || !showCrd || !crdCursor) return null;
    const rect = radar.getBoundingClientRect();
    const coordinates = mapCoordinatesFromScreen(crdCursor, rect, viewport);
    if (!coordinates) return null;
    return {
      point: crdCursor,
      text: `X ${coordinates.x.toFixed(2)}  Y ${coordinates.y.toFixed(2)}`,
    };
  }, [crdCursor, radar, showCrd, sizeTick, viewport]);

  const removeFrozen = (id: number) => {
    setFrozenQdms((current) => {
      const next = current.filter((qdm) => qdm.id !== id);
      frozenRef.current = next;
      return next;
    });
  };

  const toggleMulti = () => {
    setMultiQdm((current) => {
      const nextMode = !current;
      multiRef.current = nextMode;
      if (!nextMode) {
        setFrozenQdms((qdms) => {
          const next = qdms.length > 1 ? [qdms[qdms.length - 1]] : qdms;
          frozenRef.current = next;
          return next;
        });
      }
      return nextMode;
    });
    setContextMenu(null);
  };

  const toggleCrd = () => {
    setShowCrd((current) => {
      const next = !current;
      showCrdRef.current = next;
      if (!next) setCrdCursor(null);
      return next;
    });
    setContextMenu(null);
  };

  if (!radar) return null;

  return createPortal(
    <>
      {(renderedFrozen.length > 0 || renderedActive) && (
        <svg
          data-pf24-qdm-layer="true"
          className="pointer-events-none absolute inset-0 z-[11] h-full w-full"
          aria-hidden="true"
        >
          {renderedFrozen.map((rendered) => (
            <g key={rendered.id}>
              <line
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
                  if (typeof rendered.id === "number") removeFrozen(rendered.id);
                }}
              />
              <line
                x1={rendered.origin.x}
                y1={rendered.origin.y}
                x2={rendered.endpoint.x}
                y2={rendered.endpoint.y}
                stroke={LINE_COLOR}
                strokeWidth="2"
              />
              <text
                x={rendered.label.x}
                y={rendered.label.y}
                transform={`rotate(${rendered.angle} ${rendered.label.x} ${rendered.label.y})`}
                fill={LINE_COLOR}
                fontSize="12"
                fontFamily="monospace"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {rendered.labelText}
              </text>
            </g>
          ))}
          {renderedActive && (
            <>
              <line
                x1={renderedActive.origin.x}
                y1={renderedActive.origin.y}
                x2={renderedActive.endpoint.x}
                y2={renderedActive.endpoint.y}
                stroke={LINE_COLOR}
                strokeWidth="2"
              />
              <text
                x={renderedActive.label.x}
                y={renderedActive.label.y}
                transform={`rotate(${renderedActive.angle} ${renderedActive.label.x} ${renderedActive.label.y})`}
                fill={LINE_COLOR}
                fontSize="12"
                fontFamily="monospace"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {renderedActive.labelText}
              </text>
            </>
          )}
        </svg>
      )}

      {crd && (
        <div
          data-pf24-crd-readout="true"
          className="pointer-events-none absolute z-[42] whitespace-nowrap border border-[#71817d] bg-[#12211e] px-[5px] py-[2px] font-mono text-[10px] leading-[12px] text-[#d7e5e1] shadow-[1px_1px_0_rgba(0,0,0,.55)]"
          style={{ left: crd.point.x + 13, top: crd.point.y + 13 }}
        >
          {crd.text}
        </div>
      )}

      {contextMenu && (
        <div
          data-pf24-qdm-context-menu="true"
          className="absolute z-[100] w-[146px] border border-[#aab5b2] bg-[#586064] p-[1px] font-mono text-[11px] text-white shadow-[2px_2px_0_rgba(0,0,0,.55)]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            onClick={toggleMulti}
            className={`flex h-[21px] w-full items-center justify-between px-[6px] text-left hover:bg-[#176a5e] ${multiQdm ? "bg-[#0b5d52] text-[#7dff72]" : ""}`}
          >
            <span>Multi QDM</span><span>{multiQdm ? "✓" : ""}</span>
          </button>
          <button
            type="button"
            onClick={toggleCrd}
            className={`flex h-[21px] w-full items-center justify-between border-t border-[#858d90] px-[6px] text-left hover:bg-[#176a5e] ${showCrd ? "bg-[#0b5d52] text-[#7dff72]" : ""}`}
          >
            <span>Show CRD</span><span>{showCrd ? "✓" : ""}</span>
          </button>
        </div>
      )}
    </>,
    radar,
  );
}
