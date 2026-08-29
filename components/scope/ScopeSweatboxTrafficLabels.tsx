"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
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
  SWEATBOX_COMMAND_EVENT,
  SWEATBOX_SNAPSHOT_EVENT,
  readScopeServerMode,
  type SweatboxAircraft,
  type SweatboxSessionDetail,
  type SweatboxSnapshot,
} from "@/lib/scope/sweatbox";

type Point = { x: number; y: number };
type Viewport = { zoom: number; panX: number; panY: number };
type TrailPoint = Point & { time: number };
type LabelDrag = {
  id: string;
  dx: number;
  dy: number;
  startX: number;
  startY: number;
  moved: boolean;
};

type Props = { canInstruct: boolean };

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";
const LABEL_OFFSETS_KEY = "pf24_sweatbox_label_offsets_v1";
const MAPP_KEY = "pf24_scope_sweatbox_mapp_v1";
const TARGET_SIZE = 18;
const SIMPLE_WIDTH = 66;
const SIMPLE_HEIGHT = 30;
const DETAIL_WIDTH = 108;
const DETAIL_HEIGHT = 45;
const VECTOR_PIXELS_PER_NM = 28;
const GROUND_VECTOR_PIXELS = 10;
const GROUND_ALTITUDE_FT = 100;
const TRAIL_SAMPLE_MS = 1200;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isGroundTraffic(item: Pick<SweatboxAircraft, "altitude">) {
  return item.altitude <= GROUND_ALTITUDE_FT;
}

function groundTrafficScale(zoom: number) {
  const safeZoom = Math.max(1, zoom);
  return clamp(0.55 * Math.pow(safeZoom, 0.18), 0.55, 1);
}

function readViewport(): Viewport {
  try {
    const parsed = JSON.parse(localStorage.getItem(VIEWPORT_KEY) ?? "{}") as Partial<Viewport>;
    return {
      zoom: typeof parsed.zoom === "number" ? parsed.zoom : 1,
      panX: typeof parsed.panX === "number" ? parsed.panX : 0,
      panY: typeof parsed.panY === "number" ? parsed.panY : 0,
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

function readMapp(): Record<string, boolean> {
  try {
    const parsed = JSON.parse(localStorage.getItem(MAPP_KEY) ?? "{}") as Record<string, boolean>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function screenPoint(size: Point, point: Point, viewport: Viewport): Point {
  const mapWidth = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
  const mapHeight = MAP_BOUNDS.maxY - MAP_BOUNDS.minY;
  const fitScale = Math.min(size.x / mapWidth, size.y / mapHeight);
  const renderedWidth = mapWidth * fitScale;
  const renderedHeight = mapHeight * fitScale;
  const offsetX = (size.x - renderedWidth) / 2;
  const offsetY = (size.y - renderedHeight) / 2;
  const baseX = offsetX + (point.x - MAP_BOUNDS.minX) * fitScale;
  const baseY = offsetY + (point.y - MAP_BOUNDS.minY) * fitScale;
  return {
    x: baseX * viewport.zoom + viewport.panX,
    y: baseY * viewport.zoom + viewport.panY,
  };
}

function headingUnit(heading: number): Point {
  const radians = heading * Math.PI / 180;
  return { x: Math.sin(radians), y: -Math.cos(radians) };
}

function connectorEnd(marker: Point, label: Point, width: number, height: number) {
  const center = { x: label.x + width / 2, y: label.y + height / 2 };
  const dx = center.x - marker.x;
  const dy = center.y - marker.y;
  if (dx === 0 && dy === 0) return center;
  const sx = dx === 0 ? Number.POSITIVE_INFINITY : (width / 2) / Math.abs(dx);
  const sy = dy === 0 ? Number.POSITIVE_INFINITY : (height / 2) / Math.abs(dy);
  const scale = Math.min(sx, sy);
  return { x: center.x - dx * scale, y: center.y - dy * scale };
}

function flightLevel(altitude: number) {
  return String(Math.max(0, Math.round(altitude / 100))).padStart(3, "0");
}

function trend(verticalRate: number) {
  if (verticalRate > 150) return "↑";
  if (verticalRate < -150) return "↓";
  return "";
}

function routeWaypoints(item: SweatboxAircraft) {
  const route = item.flightPlan.route ?? "";
  return Array.from(new Set(
    route
      .toUpperCase()
      .split(/\s+/)
      .map((value) => value.replace(/[^A-Z0-9]/g, ""))
      .filter((value) => value && value !== "DCT" && /^[A-Z0-9]{2,7}$/.test(value)),
  ));
}

function cruiseLevel(item: SweatboxAircraft) {
  const digits = String(item.flightPlan.flightLevel ?? "").replace(/\D/g, "");
  return digits ? digits.slice(-3).padStart(3, "0") : "999";
}

function toolbarButtons() {
  const row = document.querySelector<HTMLElement>("main.fixed header > div:first-child");
  return row ? Array.from(row.querySelectorAll<HTMLButtonElement>(":scope > button")) : [];
}

function runtimeMarker(id: string) {
  return document.querySelector<HTMLButtonElement>(
    `[data-pf24-sweatbox-traffic='true'] button[data-pf24-traffic-select='true'][data-pf24-sweatbox-id='${CSS.escape(id)}']`,
  );
}

function findScopeWindow(title: string) {
  const wanted = title.trim().toUpperCase();
  return Array.from(document.querySelectorAll<HTMLElement>("main.fixed > section > div.absolute.z-30"))
    .find((element) => element.firstElementChild?.textContent?.trim().toUpperCase().includes(wanted)) ?? null;
}

function DragEdges({ onMouseDown }: { onMouseDown: (event: ReactMouseEvent<HTMLElement>) => void }) {
  const base = "pointer-events-auto absolute z-[4] block bg-transparent";
  return <>
    <span data-pf24-traffic-drag-edge="top" onMouseDown={onMouseDown} className={`${base} -left-[4px] -top-[5px] h-[6px] w-[calc(100%+8px)] cursor-move`} />
    <span data-pf24-traffic-drag-edge="right" onMouseDown={onMouseDown} className={`${base} -right-[5px] -top-[2px] h-[calc(100%+4px)] w-[6px] cursor-move`} />
    <span data-pf24-traffic-drag-edge="bottom" onMouseDown={onMouseDown} className={`${base} -bottom-[5px] -left-[4px] h-[6px] w-[calc(100%+8px)] cursor-move`} />
    <span data-pf24-traffic-drag-edge="left" onMouseDown={onMouseDown} className={`${base} -left-[5px] -top-[2px] h-[calc(100%+4px)] w-[6px] cursor-move`} />
  </>;
}

export default function ScopeSweatboxTrafficLabels({ canInstruct }: Props) {
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState(() => readScopeServerMode());
  const [position, setPosition] = useState("");
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [holdWindow, setHoldWindow] = useState<HTMLElement | null>(null);
  const [hostSize, setHostSize] = useState<Point>({ x: 1, y: 1 });
  const [viewport, setViewport] = useState<Viewport>(() => readViewport());
  const [traffic, setTraffic] = useState<SweatboxAircraft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [callsignMenu, setCallsignMenu] = useState<{ id: string; expanded: boolean } | null>(null);
  const [settings, setSettings] = useState<TrafficSettings>(() => readTrafficSettings());
  const [showHeading, setShowHeading] = useState(false);
  const [showTrail, setShowTrail] = useState(false);
  const [trailVersion, setTrailVersion] = useState(0);
  const [mappState, setMappState] = useState<Record<string, boolean>>(() => readMapp());
  const [labelOffsets, setLabelOffsets] = useState<Record<string, Point>>(() => readOffsets());
  const dragRef = useRef<LabelDrag | null>(null);
  const suppressClickRef = useRef<string | null>(null);
  const trafficRef = useRef<SweatboxAircraft[]>([]);
  const trailsRef = useRef<Map<string, TrailPoint[]>>(new Map());
  const lastTrailSampleRef = useRef<Map<string, number>>(new Map());

  const active = connected && mode !== "AUTOMATIC";
  const instructor = active && mode === "SWEATBOX_INSTRUCTOR" && canInstruct;

  useEffect(() => {
    trafficRef.current = traffic;
  }, [traffic]);

  useEffect(() => {
    const locate = () => {
      const radar = document.querySelector<HTMLElement>("main.fixed > section");
      if (radar) {
        setHost(radar);
        setHostSize({ x: Math.max(1, radar.clientWidth), y: Math.max(1, radar.clientHeight) });
      }
      setHoldWindow(findScopeWindow("HOLD LIST"));
    };
    locate();
    const radar = document.querySelector<HTMLElement>("main.fixed > section");
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(locate) : null;
    if (radar) observer?.observe(radar);
    const domObserver = new MutationObserver(() => window.requestAnimationFrame(locate));
    const main = document.querySelector<HTMLElement>("main.fixed");
    if (main) domObserver.observe(main, { childList: true, subtree: true });
    return () => {
      observer?.disconnect();
      domObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const onSession = (event: Event) => {
      const detail = (event as CustomEvent<SweatboxSessionDetail>).detail;
      if (!detail) return;
      setConnected(Boolean(detail.connected));
      setMode(detail.mode);
      setPosition(detail.callsign?.trim().toUpperCase() ?? "");
      if (!detail.connected || detail.mode === "AUTOMATIC") {
        setTraffic([]);
        setSelectedId(null);
        setCallsignMenu(null);
        trailsRef.current.clear();
        lastTrailSampleRef.current.clear();
      }
    };
    window.addEventListener(SCOPE_SERVER_EVENT, onSession);
    return () => window.removeEventListener(SCOPE_SERVER_EVENT, onSession);
  }, []);

  useEffect(() => {
    const onSnapshot = (event: Event) => {
      const detail = (event as CustomEvent<SweatboxSnapshot>).detail;
      if (!detail?.traffic) return;

      const now = Date.now();
      const ids = new Set(detail.traffic.map((item) => item.id));
      let changedTrail = false;
      for (const item of detail.traffic) {
        const last = lastTrailSampleRef.current.get(item.id) ?? 0;
        if (now - last < TRAIL_SAMPLE_MS) continue;
        lastTrailSampleRef.current.set(item.id, now);
        const history = trailsRef.current.get(item.id) ?? [];
        const maxPoints = Math.max(12, settings.trailCount * 4);
        trailsRef.current.set(item.id, [...history, { x: item.x, y: item.y, time: now }].slice(-maxPoints));
        changedTrail = true;
      }
      for (const id of Array.from(trailsRef.current.keys())) {
        if (ids.has(id)) continue;
        trailsRef.current.delete(id);
        lastTrailSampleRef.current.delete(id);
        changedTrail = true;
      }
      if (changedTrail) setTrailVersion((value) => value + 1);

      setTraffic(detail.traffic);
      setSelectedId((current) => current && detail.traffic.some((item) => item.id === current) ? current : null);
    };
    const onViewport = (event: Event) => {
      const detail = (event as CustomEvent<Viewport>).detail;
      if (detail) setViewport(detail);
    };
    const onSettings = (event: Event) => {
      setSettings((event as CustomEvent<TrafficSettings>).detail ?? readTrafficSettings());
    };
    window.addEventListener(SWEATBOX_SNAPSHOT_EVENT, onSnapshot);
    window.addEventListener(VIEWPORT_EVENT, onViewport);
    window.addEventListener(TRAFFIC_SETTINGS_EVENT, onSettings);
    return () => {
      window.removeEventListener(SWEATBOX_SNAPSHOT_EVENT, onSnapshot);
      window.removeEventListener(VIEWPORT_EVENT, onViewport);
      window.removeEventListener(TRAFFIC_SETTINGS_EVENT, onSettings);
    };
  }, [settings.trailCount]);

  useEffect(() => {
    if (!active) return;
    const row = document.querySelector<HTMLElement>("main.fixed header > div:first-child");
    if (!row) return;

    const sync = () => {
      const buttons = toolbarButtons();
      setShowHeading(Boolean(buttons[5]?.classList.contains("scopeToolOn")));
      setShowTrail(Boolean(buttons[6]?.classList.contains("scopeToolOn")));
    };
    const queueSync = () => window.setTimeout(sync, 0);

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(row, { subtree: true, attributes: true, attributeFilter: ["class"] });
    document.addEventListener("click", queueSync, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", queueSync, true);
    };
  }, [active]);

  useEffect(() => {
    if (!active || !host) return;

    const onMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const aircraft = trafficRef.current.find((item) => item.id === drag.id);
      if (!aircraft) return;
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) drag.moved = true;
      const pointer = scopeClientPointToLocal(host, event.clientX, event.clientY);
      const marker = screenPoint(hostSize, aircraft, viewport);
      setLabelOffsets((current) => ({
        ...current,
        [drag.id]: {
          x: pointer.x - marker.x - drag.dx,
          y: pointer.y - marker.y - drag.dy,
        },
      }));
    };

    const onUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.moved) {
        suppressClickRef.current = drag.id;
        window.setTimeout(() => {
          if (suppressClickRef.current === drag.id) suppressClickRef.current = null;
        }, 60);
      }
      dragRef.current = null;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [active, host, hostSize, viewport]);

  useEffect(() => {
    try {
      localStorage.setItem(LABEL_OFFSETS_KEY, JSON.stringify(labelOffsets));
    } catch {
      // Dragging still works when localStorage is unavailable.
    }
  }, [labelOffsets]);

  useEffect(() => {
    if (!active) return;
    const deselect = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest("[data-pf24-sweatbox-native-label='true']") ||
        target?.closest("[data-pf24-sweatbox-native-target='true']") ||
        target?.closest("[data-pf24-sweatbox-native-menu='true']") ||
        target?.closest("[data-pf24-sweatbox-toolbar='true']") ||
        target?.closest("[data-pf24-atc-fpl-editor='true']")
      ) return;
      setSelectedId(null);
      setCallsignMenu(null);
    };
    document.addEventListener("click", deselect, true);
    return () => document.removeEventListener("click", deselect, true);
  }, [active]);

  useEffect(() => {
    if (!holdWindow) return;
    if (active) holdWindow.dataset.pf24SweatboxHoldWindow = "true";
    else delete holdWindow.dataset.pf24SweatboxHoldWindow;
    return () => { delete holdWindow.dataset.pf24SweatboxHoldWindow; };
  }, [active, holdWindow]);

  const lineData = useMemo(() => traffic.map((item) => {
    const marker = screenPoint(hostSize, item, viewport);
    const activeItem = item.id === selectedId;
    const ground = isGroundTraffic(item);
    const groundScale = groundTrafficScale(viewport.zoom);
    const labelScale = ground && !activeItem ? groundScale : 1;
    const offset = labelOffsets[item.id] ?? { x: 16, y: 14 };
    const label = { x: marker.x + offset.x, y: marker.y + offset.y };
    const width = (activeItem ? DETAIL_WIDTH : SIMPLE_WIDTH) * labelScale;
    const height = (activeItem ? DETAIL_HEIGHT : SIMPLE_HEIGHT) * labelScale;
    const end = connectorEnd(marker, label, width, height);
    const unit = headingUnit(item.heading);
    const vectorLength = ground ? GROUND_VECTOR_PIXELS : VECTOR_PIXELS_PER_NM * settings.vectorMiles * viewport.zoom;
    const history = (trailsRef.current.get(item.id) ?? []).slice(-settings.trailCount);
    return { item, marker, label, end, unit, vectorLength, history, ground, groundScale, labelScale, activeItem };
  }), [traffic, hostSize, viewport, labelOffsets, selectedId, settings.vectorMiles, settings.trailCount, trailVersion]);

  if (!active || !host) return null;

  const selectAircraft = (item: SweatboxAircraft) => {
    setSelectedId(item.id);
    setCallsignMenu(null);
    runtimeMarker(item.id)?.click();
  };

  const sendCommand = (action: string, item: SweatboxAircraft) => {
    window.dispatchEvent(new CustomEvent(SWEATBOX_COMMAND_EVENT, {
      detail: { action, id: item.id, position },
    }));
    setCallsignMenu(null);
  };

  const toggleMapp = (item: SweatboxAircraft) => {
    setMappState((current) => {
      const next = { ...current };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = true;
      try { localStorage.setItem(MAPP_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    setCallsignMenu(null);
  };

  const layer = createPortal(
    <div data-pf24-sweatbox-native-traffic="true" className="pointer-events-none absolute inset-0 z-[13] overflow-hidden">
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${hostSize.x} ${hostSize.y}`} preserveAspectRatio="none" aria-hidden="true">
        {lineData.map(({ item, marker, end, unit, vectorLength, history, ground, groundScale }) => <g key={item.id}>
          {showTrail && history.map((trailPoint, index) => {
            const point = screenPoint(hostSize, trailPoint, viewport);
            const opacity = settings.trailFade
              ? 0.38 + ((index + 1) / Math.max(1, history.length)) * 0.62
              : 1;
            return <circle
              key={`${item.id}-trail-${trailPoint.time}`}
              cx={point.x}
              cy={point.y}
              r={ground ? 3 * groundScale : 3}
              fill="#00ff00"
              opacity={opacity}
            />;
          })}
          {showHeading && <line
            x1={marker.x}
            y1={marker.y}
            x2={marker.x + unit.x * vectorLength}
            y2={marker.y + unit.y * vectorLength}
            stroke="#00e000"
            strokeWidth={ground ? "1" : "1.5"}
            vectorEffect="non-scaling-stroke"
          />}
          <line
            x1={marker.x}
            y1={marker.y}
            x2={end.x}
            y2={end.y}
            stroke="#00e000"
            strokeWidth={ground ? "0.8" : "1.2"}
            vectorEffect="non-scaling-stroke"
          />
        </g>)}
      </svg>

      {lineData.map(({ item, marker, label, ground, groundScale, labelScale, activeItem }) => {
        const displayCallsign = item.flightPlan.callsign?.trim().toUpperCase() || item.callsign;
        const destination = item.flightPlan.arrival?.trim().toUpperCase() || "XXXX";
        const waypoints = routeWaypoints(item);
        const currentWaypoint = item.navTarget || waypoints[0] || "XXXXX";
        const cruise = cruiseLevel(item);
        const assignedAltitude = flightLevel(item.targetAltitude);
        const headingText = `AHDG${String(Math.round(item.targetHeading) % 360).padStart(3, "0")}`;
        const speedText = item.targetSpeed > 0 ? String(Math.round(item.targetSpeed)).padStart(3, "0") : "ASP";
        const menuOpen = callsignMenu?.id === item.id;
        const menuExpanded = menuOpen ? callsignMenu.expanded : false;
        const mapp = Boolean(mappState[item.id]);
        const assumedHere = Boolean(position && item.assumedBy?.trim().toUpperCase() === position);

        const startLabelDrag = (event: ReactMouseEvent<HTMLElement>) => {
          if (event.button !== 0) return;
          const target = event.target instanceof Element ? event.target : null;
          if (target?.closest("button,input,[data-pf24-sweatbox-native-menu='true']")) return;
          event.preventDefault();
          event.stopPropagation();
          const pointer = scopeClientPointToLocal(host, event.clientX, event.clientY);
          dragRef.current = {
            id: item.id,
            dx: pointer.x - label.x,
            dy: pointer.y - label.y,
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
          };
        };

        const activateLabel = (event: ReactMouseEvent<HTMLElement>) => {
          event.stopPropagation();
          if (suppressClickRef.current === item.id) {
            suppressClickRef.current = null;
            return;
          }
          selectAircraft(item);
        };

        const openCallsignMenu = (event: ReactMouseEvent<HTMLElement>) => {
          event.preventDefault();
          event.stopPropagation();
          setSelectedId(item.id);
          runtimeMarker(item.id)?.click();
          setCallsignMenu({ id: item.id, expanded: false });
        };

        const menu = menuOpen ? <div
          data-pf24-sweatbox-native-menu="true"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className="pointer-events-auto absolute left-0 top-[10px] z-[50] w-[118px] border border-[#f2f2f2] bg-[#555c60] font-mono text-[10px] leading-[18px] text-[#ededed] shadow-[0_2px_8px_rgba(0,0,0,.45)]"
        >
          <div className="border-b border-[#f2f2f2] px-2 text-center text-[11px] leading-[20px] text-[#22e000]">{displayCallsign}</div>
          <button type="button" onClick={(event) => { event.stopPropagation(); sendCommand("callsign", item); }} className="block w-full border-b border-[#f2f2f2] px-2 text-center hover:bg-[#626a6f]">Callsign</button>
          <button type="button" onClick={(event) => { event.stopPropagation(); sendCommand("assume", item); }} className="block w-full border-b border-[#f2f2f2] px-2 text-center hover:bg-[#626a6f]">{assumedHere ? "Assumed" : "Assume"}</button>
          <button type="button" onClick={(event) => { event.stopPropagation(); sendCommand("open-fpl", item); }} className="block w-full border-b border-[#f2f2f2] px-2 text-center hover:bg-[#626a6f]">FPL</button>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); setCallsignMenu({ id: item.id, expanded: !menuExpanded }); }}
            className="flex w-full items-center justify-center gap-2 border-b border-[#f2f2f2] px-2 hover:bg-[#626a6f]"
          >
            <span className={`inline-block text-[9px] transition-transform ${menuExpanded ? "rotate-180" : ""}`}>▽</span>
            <span>More</span>
          </button>
          {menuExpanded && <>
            <button type="button" onClick={(event) => { event.stopPropagation(); toggleMapp(item); }} className="block w-full border-b border-[#f2f2f2] px-2 text-center hover:bg-[#626a6f]">{mapp ? "XMAPP" : "MAPP"}</button>
            <button type="button" onClick={(event) => { event.stopPropagation(); sendCommand("hold", item); }} className="block w-full border-b border-[#f2f2f2] px-2 text-center hover:bg-[#626a6f]">{item.held ? "XHOLD" : "HOLD"}</button>
            <button type="button" onClick={(event) => { event.stopPropagation(); sendCommand("free", item); }} className="block w-full border-b border-[#f2f2f2] px-2 text-center hover:bg-[#626a6f]">FREE</button>
            <button type="button" onClick={(event) => { event.stopPropagation(); sendCommand("contact", item); }} className="block w-full border-b border-[#f2f2f2] px-2 text-center hover:bg-[#626a6f]">Contact Me</button>
            {instructor && <button type="button" onClick={(event) => { event.stopPropagation(); sendCommand("delete", item); }} className="block w-full px-2 text-center hover:bg-[#626a6f]">Delete</button>}
          </>}
        </div> : null;

        return <div key={item.id}>
          <button
            type="button"
            data-pf24-sweatbox-native-target="true"
            onClick={(event) => { event.stopPropagation(); selectAircraft(item); }}
            className="pointer-events-auto absolute z-[14] -translate-x-1/2 -translate-y-1/2"
            style={{
              left: marker.x,
              top: marker.y,
              width: ground ? TARGET_SIZE * groundScale : TARGET_SIZE,
              height: ground ? TARGET_SIZE * groundScale : TARGET_SIZE,
            }}
            aria-label={`Seleccionar ${displayCallsign}`}
          >
            <span className={`absolute inset-0 rotate-45 border ${activeItem ? "border-[#00ff00]" : "border-[#00d800]"}`} />
          </button>

          {!activeItem && <div
            data-pf24-sweatbox-native-label="true"
            data-pf24-traffic-label="true"
            data-pf24-traffic-id={item.id}
            onMouseDown={startLabelDrag}
            onClick={activateLabel}
            className="pointer-events-auto absolute z-[15] w-[66px] cursor-move whitespace-nowrap text-left font-mono text-[9px] leading-[8px] text-[#00e000]"
            style={{ left: label.x, top: label.y, transform: `scale(${labelScale})`, transformOrigin: "0 0" }}
          >
            <DragEdges onMouseDown={startLabelDrag} />
            <span className="block h-[7px] text-[8px] leading-[7px]">I</span>
            <div className="relative h-[9px] w-[62px] overflow-visible">
              <button
                type="button"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={openCallsignMenu}
                className="block h-[9px] w-[62px] overflow-hidden text-ellipsis whitespace-nowrap border-0 bg-transparent p-0 text-left text-[9px] leading-[9px] text-[#00e000] outline-none"
              >{displayCallsign}</button>
              {mapp && <span className="pointer-events-none absolute left-[54px] top-0 text-[9px] leading-[9px] text-[#ff6a00]">MAPP</span>}
              {menu}
            </div>
            <span className="grid w-[58px] grid-cols-[30px_28px] text-[9px] leading-[8px]">
              <span>{flightLevel(item.altitude)}{trend(item.verticalRate)}</span>
              <span>{String(Math.round(item.speed)).padStart(3, "0")}</span>
            </span>
            <span className="block w-[58px] pl-[30px] text-[9px] leading-[7px]">{destination}</span>
          </div>}

          {activeItem && <div
            data-pf24-sweatbox-native-label="true"
            data-pf24-traffic-label="true"
            data-pf24-traffic-id={item.id}
            onMouseDown={startLabelDrag}
            className="pointer-events-auto absolute z-[16] w-[108px] cursor-move select-none font-mono text-[9px] leading-[9px] text-[#00e000]"
            style={{ left: label.x, top: label.y }}
          >
            <DragEdges onMouseDown={startLabelDrag} />
            <div className="h-[8px] overflow-visible text-[#ffff00] leading-[8px]">A9999{mapp && <span className="ml-[9px] text-[#ff6a00]">MAPP</span>}</div>
            <div className="grid w-[102px] min-w-0 grid-cols-[56px_8px_38px] gap-0 leading-[9px]">
              <div className="relative min-w-0">
                <button
                  type="button"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={openCallsignMenu}
                  className="block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap border-0 bg-transparent p-0 text-left text-[9px] leading-[9px] text-[#00e000] outline-none"
                >{displayCallsign}</button>
                {menu}
              </div>
              <span>--</span>
              <span className="min-w-0 overflow-hidden">{item.aircraftType}</span>
            </div>
            <div className="grid w-[106px] grid-cols-[29px_43px_34px] gap-0 leading-[9px]">
              <span>{flightLevel(item.altitude)}{trend(item.verticalRate)}</span>
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{currentWaypoint}</span>
              <span>N{Math.round(item.speed)}</span>
            </div>
            <div className="grid w-[102px] grid-cols-[29px_29px_44px] gap-0 leading-[9px]">
              <span>{assignedAltitude}</span>
              <span>{cruise}</span>
              <span>{destination}</span>
            </div>
            <div className="grid w-[108px] grid-cols-[43px_29px_36px] gap-0 leading-[9px]">
              <span>{headingText}</span>
              <span>{speedText}</span>
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{item.freeText || "TXT"}</span>
            </div>
          </div>}
        </div>;
      })}
    </div>,
    host,
  );

  const held = traffic.filter((item) => item.held);
  const holdLayer = holdWindow ? createPortal(
    <div data-pf24-sweatbox-hold-list="true" className="w-full max-w-full overflow-hidden border-x-2 border-b-2 border-[#ededed] bg-[#555c61] font-mono text-[10px] leading-[15px] text-[#e8e8e8] box-border">
      <div className="grid w-full min-w-0 grid-cols-[28px_minmax(0,1fr)_34px_34px] border-b border-[#ededed] box-border">
        <span className="min-w-0 border-r border-[#ededed]" />
        <span className="min-w-0 truncate text-center text-[12px]">CALLSIGN</span>
        <span className="min-w-0 text-center text-[12px]">FL</span>
        <span className="min-w-0 text-center text-[12px]">AFL</span>
      </div>
      <div className="min-h-[78px] w-full min-w-0 overflow-hidden">
        {held.map((item) => <div key={item.id} className="grid w-full min-w-0 grid-cols-[28px_minmax(0,1fr)_34px_34px] box-border">
          <span className="min-w-0 border-r border-[#ededed]" />
          <span className="min-w-0 truncate px-[3px]">{item.flightPlan.callsign || item.callsign}</span>
          <span className="min-w-0 truncate text-center">{cruiseLevel(item)}</span>
          <span className="min-w-0 truncate text-center">{flightLevel(item.targetAltitude)}</span>
        </div>)}
      </div>
    </div>,
    holdWindow,
  ) : null;

  return <>
    {layer}
    {holdLayer}
    <style jsx global>{`
      html[data-pf24-sweatbox-active='true'] [data-pf24-sweatbox-traffic='true'] > svg{visibility:hidden!important}
      html[data-pf24-sweatbox-active='true'] [data-pf24-sweatbox-traffic='true'] [data-pf24-traffic-select='true'],
      html[data-pf24-sweatbox-active='true'] [data-pf24-sweatbox-traffic='true'] [data-pf24-traffic-label='true']{visibility:hidden!important;pointer-events:none!important}
      html[data-pf24-sweatbox-active='true'] [data-pf24-sweatbox-hold-window='true'] > :not(:first-child):not([data-pf24-sweatbox-hold-list='true']){display:none!important}
    `}</style>
  </>;
}
