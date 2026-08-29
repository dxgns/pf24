"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_TRAFFIC_SETTINGS,
  readTrafficSettings,
  TRAFFIC_SETTINGS_EVENT,
  type TrafficSettings,
} from "@/components/scope/ScopeTrafficSettings";
import { MAP_BOUNDS } from "@/lib/scope/mapData";
import { scopeClientPointToLocal } from "@/lib/scope/domCoordinates";
import {
  SCOPE_SERVER_EVENT,
  readScopeServerMode,
  type SweatboxAircraft,
  type SweatboxSessionDetail,
  type SweatboxSnapshot,
} from "@/lib/scope/sweatbox";

type Point = { x: number; y: number };
type Viewport = { zoom: number; panX: number; panY: number };
type DragState = {
  id: string;
  start: Point;
  initial: Point;
  startClientX: number;
  startClientY: number;
  moved: boolean;
};

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";
const SNAPSHOT_EVENT = "pf24-sweatbox-snapshot";
const LABEL_OFFSETS_KEY = "pf24_sweatbox_label_offsets_v1";
const VECTOR_PIXELS_PER_NM = 28;
const DEFAULT_LABEL_OFFSET = { x: 17, y: 14 } as const;

function readViewport(): Viewport {
  try {
    const value = JSON.parse(localStorage.getItem(VIEWPORT_KEY) ?? "{}") as Partial<Viewport>;
    return {
      zoom: typeof value.zoom === "number" && Number.isFinite(value.zoom) ? value.zoom : 1,
      panX: typeof value.panX === "number" && Number.isFinite(value.panX) ? value.panX : 0,
      panY: typeof value.panY === "number" && Number.isFinite(value.panY) ? value.panY : 0,
    };
  } catch {
    return { zoom: 1, panX: 0, panY: 0 };
  }
}

function readOffsets(): Record<string, Point> {
  try {
    const parsed = JSON.parse(localStorage.getItem(LABEL_OFFSETS_KEY) ?? "{}") as Record<string, Point>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function screenPoint(size: Point, point: Point, viewport: Viewport): Point {
  const mapWidth = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
  const mapHeight = MAP_BOUNDS.maxY - MAP_BOUNDS.minY;
  const fit = Math.min(size.x / mapWidth, size.y / mapHeight);
  const offsetX = (size.x - mapWidth * fit) / 2;
  const offsetY = (size.y - mapHeight * fit) / 2;
  return {
    x: (offsetX + (point.x - MAP_BOUNDS.minX) * fit) * viewport.zoom + viewport.panX,
    y: (offsetY + (point.y - MAP_BOUNDS.minY) * fit) * viewport.zoom + viewport.panY,
  };
}

function headingUnit(heading: number): Point {
  const radians = heading * Math.PI / 180;
  return { x: Math.sin(radians), y: -Math.cos(radians) };
}

function labelFor(id: string) {
  return document.querySelector<HTMLElement>(`[data-pf24-sweatbox-traffic='true'] [data-pf24-traffic-label='true'][data-pf24-sweatbox-id='${CSS.escape(id)}']`);
}

function markerFor(id: string) {
  return document.querySelector<HTMLButtonElement>(`[data-pf24-sweatbox-traffic='true'] button[data-pf24-traffic-select='true'][data-pf24-sweatbox-id='${CSS.escape(id)}']`);
}

function setLabelTransform(id: string, offset: Point) {
  const label = labelFor(id);
  if (!label) return;
  label.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
  label.style.transformOrigin = "0 0";
  label.style.cursor = "move";
}

function findSweatboxLabel(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>("[data-pf24-sweatbox-traffic='true'] [data-pf24-traffic-label='true'][data-pf24-sweatbox-id]");
}

function unlockInstructorFplEditor() {
  const editor = document.querySelector<HTMLElement>("[data-pf24-atc-fpl-editor='true']");
  if (!editor) return;

  editor.dataset.pf24SweatboxInstructorEditor = "true";
  editor.style.pointerEvents = "auto";
  editor.style.zIndex = "3000";

  editor.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input,textarea").forEach((field) => {
    if (field.disabled) field.disabled = false;
    if (field.readOnly) field.readOnly = false;
    field.removeAttribute("disabled");
    field.removeAttribute("readonly");
    field.setAttribute("aria-disabled", "false");
    field.tabIndex = 0;
    field.style.pointerEvents = "auto";
    field.style.userSelect = "text";
    field.style.cursor = "text";
  });

  editor.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    button.style.pointerEvents = "auto";
  });
}

export default function ScopeSweatboxInstructorUiFixes({ canInstruct }: { canInstruct: boolean }) {
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState(() => readScopeServerMode());
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [hostSize, setHostSize] = useState<Point>({ x: 1, y: 1 });
  const [viewport, setViewport] = useState<ViewpointOrViewport>(() => readViewport());
  const [traffic, setTraffic] = useState<SweatboxAircraft[]>([]);
  const [settings, setSettings] = useState<TrafficSettings>(() => readTrafficSettings());
  const [offsetVersion, setOffsetVersion] = useState(0);
  const offsetsRef = useRef<Record<string, Point>>({});
  const dragRef = useRef<DragState | null>(null);
  const suppressClickUntilRef = useRef(0);

  const active = connected && mode === "SWEATBOX_INSTRUCTOR" && canInstruct;

  useEffect(() => {
    offsetsRef.current = readOffsets();
  }, []);

  useEffect(() => {
    const locate = () => {
      const radar = document.querySelector<HTMLElement>("main.fixed > section");
      setHost(radar);
      if (radar) setHostSize({ x: Math.max(1, radar.clientWidth), y: Math.max(1, radar.clientHeight) });
    };
    locate();
    const timer = window.setInterval(locate, 400);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(locate) : null;
    const radar = document.querySelector<HTMLElement>("main.fixed > section");
    if (radar) observer?.observe(radar);
    return () => {
      window.clearInterval(timer);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    const onSession = (event: Event) => {
      const detail = (event as CustomEvent<SweatboxSessionDetail>).detail;
      if (!detail) return;
      setConnected(Boolean(detail.connected));
      setMode(detail.mode);
      if (!detail.connected || detail.mode !== "SWEATBOX_INSTRUCTOR") setTraffic([]);
    };
    window.addEventListener(SCOPE_SERVER_EVENT, onSession);
    return () => window.removeEventListener(SCOPE_SERVER_EVENT, onSession);
  }, []);

  useEffect(() => {
    if (!active) return;

    let frame = 0;
    const queueUnlock = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        unlockInstructorFplEditor();
      });
    };

    queueUnlock();
    const observer = new MutationObserver(queueUnlock);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled", "readonly", "style"],
    });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [active]);

  useEffect(() => {
    const onViewport = (event: Event) => {
      const detail = (event as CustomEvent<Viewport>).detail;
      if (detail) setViewport(detail);
    };
    const onSettings = (event: Event) => {
      const detail = (event as CustomEvent<TrafficSettings>).detail;
      setSettings(detail ?? readTrafficSettings());
    };
    const onSnapshot = (event: Event) => {
      const detail = (event as CustomEvent<SweatboxSnapshot>).detail;
      if (detail?.traffic) setTraffic(detail.traffic);
    };
    window.addEventListener(VIEWPORT_EVENT, onViewport);
    window.addEventListener(TRAFFIC_SETTINGS_EVENT, onSettings);
    window.addEventListener(SNAPSHOT_EVENT, onSnapshot);
    return () => {
      window.removeEventListener(VIEWPORT_EVENT, onViewport);
      window.removeEventListener(TRAFFIC_SETTINGS_EVENT, onSettings);
      window.removeEventListener(SNAPSHOT_EVENT, onSnapshot);
    };
  }, []);

  useEffect(() => {
    if (!active || !host) return;

    const applyOffsets = () => {
      for (const [id, offset] of Object.entries(offsetsRef.current)) setLabelTransform(id, offset);
    };
    applyOffsets();
    const timer = window.setInterval(applyOffsets, 100);

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const label = findSweatboxLabel(event.target);
      if (!label) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("button,input,select,textarea,[data-pf24-callsign-menu='true']")) return;
      const id = label.dataset.pf24SweatboxId ?? "";
      if (!id) return;
      const point = scopeClientPointToLocal(host, event.clientX, event.clientY);
      dragRef.current = {
        id,
        start: point,
        initial: offsetsRef.current[id] ?? { x: 0, y: 0 },
        startClientX: event.clientX,
        startClientY: event.clientY,
        moved: false,
      };
      event.preventDefault();
      event.stopPropagation();
    };

    const onMouseMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const point = scopeClientPointToLocal(host, event.clientX, event.clientY);
      if (Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY) > 3) drag.moved = true;
      const offset = {
        x: drag.initial.x + point.x - drag.start.x,
        y: drag.initial.y + point.y - drag.start.y,
      };
      offsetsRef.current = { ...offsetsRef.current, [drag.id]: offset };
      setLabelTransform(drag.id, offset);
      setOffsetVersion((value) => value + 1);
      event.preventDefault();
    };

    const onMouseUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.moved) suppressClickUntilRef.current = performance.now() + 150;
      localStorage.setItem(LABEL_OFFSETS_KEY, JSON.stringify(offsetsRef.current));
      dragRef.current = null;
    };

    const onClick = (event: MouseEvent) => {
      const label = findSweatboxLabel(event.target);
      if (!label) return;
      if (performance.now() < suppressClickUntilRef.current) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("button,input,select,textarea,[data-pf24-callsign-menu='true']")) return;
      const id = label.dataset.pf24SweatboxId ?? "";
      if (!id) return;
      const marker = markerFor(id);
      if (marker) window.setTimeout(() => marker.click(), 0);
    };

    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("mouseup", onMouseUp, true);
    document.addEventListener("click", onClick, true);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("mouseup", onMouseUp, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [active, host]);

  const lineData = useMemo(() => {
    if (!active) return [];
    return traffic.map((item) => {
      const marker = screenPoint(hostSize, item, viewport);
      const offset = offsetsRef.current[item.id] ?? { x: 0, y: 0 };
      const label = {
        x: marker.x + DEFAULT_LABEL_OFFSET.x + offset.x,
        y: marker.y + DEFAULT_LABEL_OFFSET.y + offset.y,
      };
      const unit = headingUnit(item.heading);
      const vectorLength = VECTOR_PIXELS_PER_NM * (settings.vectorMiles ?? DEFAULT_TRAFFIC_SETTINGS.vectorMiles) * Math.max(0.01, viewport.zoom);
      return { id: item.id, marker, label, unit, vectorLength };
    });
  }, [active, traffic, hostSize, viewport, settings, offsetVersion]);

  const vectorLayer = active && host ? createPortal(
    <svg
      data-pf24-sweatbox-vector-layer="true"
      className="pointer-events-none absolute inset-0 z-[9] h-full w-full overflow-visible"
      viewBox={`0 0 ${hostSize.x} ${hostSize.y}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {lineData.map((item) => <g key={item.id}>
        <line x1={item.marker.x} y1={item.marker.y} x2={item.marker.x + item.unit.x * item.vectorLength} y2={item.marker.y + item.unit.y * item.vectorLength} stroke="#00e000" strokeWidth="1.3" vectorEffect="non-scaling-stroke" />
        <line x1={item.marker.x} y1={item.marker.y} x2={item.label.x} y2={item.label.y} stroke="#00e000" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </g>)}
    </svg>,
    host,
  ) : null;

  return <>
    {vectorLayer}
    <style jsx global>{`
      html[data-pf24-sweatbox-active='true'] [data-pf24-live-sector-list='true']:not([data-pf24-sweatbox-sector-layer='true']){display:none!important}
      html[data-pf24-sweatbox-active='true'] [data-pf24-sweatbox-traffic='true']>svg{visibility:hidden!important}
      [data-pf24-sweatbox-toolbar='true']{top:0!important;right:0!important;height:21px!important;border:0!important;box-shadow:none!important;background:#064a40!important}
      [data-pf24-sweatbox-toolbar='true']>button{height:21px!important;width:26px!important;min-width:26px!important;border-right:1px solid #173d38!important;padding:0!important}
      [data-pf24-sweatbox-toolbar='true']>button svg{height:18px!important;width:21px!important}
      [data-pf24-sweatbox-toolbar='true']>div.absolute{top:21px!important}
      [data-pf24-sweatbox-instructor-editor='true']{pointer-events:auto!important;z-index:3000!important}
      [data-pf24-sweatbox-instructor-editor='true'] input,
      [data-pf24-sweatbox-instructor-editor='true'] textarea{pointer-events:auto!important;user-select:text!important;cursor:text!important;opacity:1!important}
      [data-pf24-sweatbox-instructor-editor='true'] button{pointer-events:auto!important}
    `}</style>
  </>;
}

type ViewpointOrViewport = Viewport;
