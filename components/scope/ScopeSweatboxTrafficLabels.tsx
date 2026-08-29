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
  SWEATBOX_SNAPSHOT_EVENT,
  readScopeServerMode,
  type SweatboxAircraft,
  type SweatboxSessionDetail,
  type SweatboxSnapshot,
} from "@/lib/scope/sweatbox";

type Point = { x: number; y: number };
type Viewport = { zoom: number; panX: number; panY: number };
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
const TARGET_SIZE = 18;
const SIMPLE_WIDTH = 66;
const SIMPLE_HEIGHT = 30;
const DETAIL_WIDTH = 108;
const DETAIL_HEIGHT = 45;
const VECTOR_PIXELS_PER_NM = 28;
const GROUND_VECTOR_PIXELS = 10;
const GROUND_ALTITUDE_FT = 100;

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

function runtimeLabel(id: string) {
  return document.querySelector<HTMLElement>(
    `[data-pf24-sweatbox-traffic='true'] [data-pf24-traffic-label='true'][data-pf24-sweatbox-id='${CSS.escape(id)}']`,
  );
}

function clickRuntimeMenuAction(id: string, label: string) {
  const root = runtimeLabel(id);
  if (!root) return;

  const clickAction = () => {
    const menu = root.querySelector<HTMLElement>("[data-pf24-callsign-menu='true']");
    const button = Array.from(menu?.querySelectorAll<HTMLButtonElement>("button") ?? [])
      .find((candidate) => candidate.textContent?.trim().toUpperCase() === label.toUpperCase());
    button?.click();
  };

  if (root.querySelector("[data-pf24-callsign-menu='true']")) {
    clickAction();
    return;
  }

  root.querySelector<HTMLButtonElement>("[data-pf24-sweatbox-callsign='true']")?.click();
  window.setTimeout(clickAction, 0);
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
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [hostSize, setHostSize] = useState<Point>({ x: 1, y: 1 });
  const [viewport, setViewport] = useState<Viewport>(() => readViewport());
  const [traffic, setTraffic] = useState<SweatboxAircraft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [callsignMenu, setCallsignMenu] = useState<{ id: string; expanded: boolean } | null>(null);
  const [settings, setSettings] = useState<TrafficSettings>(() => readTrafficSettings());
  const [showHeading, setShowHeading] = useState(false);
  const [labelOffsets, setLabelOffsets] = useState<Record<string, Point>>(() => readOffsets());
  const dragRef = useRef<LabelDrag | null>(null);
  const suppressClickRef = useRef<string | null>(null);
  const trafficRef = useRef<SweatboxAircraft[]>([]);

  const active = connected && mode !== "AUTOMATIC";
  const instructor = active && mode === "SWEATBOX_INSTRUCTOR" && canInstruct;

  useEffect(() => {
    trafficRef.current = traffic;
  }, [traffic]);

  useEffect(() => {
    const locate = () => {
      const radar = document.querySelector<HTMLElement>("main.fixed > section");
      if (!radar) return;
      setHost(radar);
      setHostSize({ x: Math.max(1, radar.clientWidth), y: Math.max(1, radar.clientHeight) });
    };
    locate();
    const radar = document.querySelector<HTMLElement>("main.fixed > section");
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(locate) : null;
    if (radar) observer?.observe(radar);
    return () => observer?.disconnect();
  }, []);

  useEffect(() => {
    const onSession = (event: Event) => {
      const detail = (event as CustomEvent<SweatboxSessionDetail>).detail;
      if (!detail) return;
      setConnected(Boolean(detail.connected));
      setMode(detail.mode);
      if (!detail.connected || detail.mode === "AUTOMATIC") {
        setTraffic([]);
        setSelectedId(null);
        setCallsignMenu(null);
      }
    };
    window.addEventListener(SCOPE_SERVER_EVENT, onSession);
    return () => window.removeEventListener(SCOPE_SERVER_EVENT, onSession);
  }, []);

  useEffect(() => {
    const onSnapshot = (event: Event) => {
      const detail = (event as CustomEvent<SweatboxSnapshot>).detail;
      if (!detail?.traffic) return;
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
  }, []);

  useEffect(() => {
    if (!active) return;
    const onToolbar = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      if (!(button instanceof HTMLButtonElement)) return;
      const buttons = toolbarButtons();
      const index = buttons.indexOf(button);
      const label = button.textContent?.trim().toUpperCase() ?? "";
      if (index === 5 || label.includes("VECTOR") || label.includes("HDG")) {
        setShowHeading((value) => !value);
      }
    };
    document.addEventListener("click", onToolbar, true);
    return () => document.removeEventListener("click", onToolbar, true);
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
      try {
        localStorage.setItem(LABEL_OFFSETS_KEY, JSON.stringify(labelOffsets));
      } catch {
        // Label dragging remains available when local storage is unavailable.
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [active, host, hostSize, viewport, labelOffsets]);

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
    return { item, marker, label, end, unit, vectorLength, ground, groundScale, labelScale, activeItem };
  }), [traffic, hostSize, viewport, labelOffsets, selectedId, settings.vectorMiles]);

  if (!active || !host) return null;

  const selectAircraft = (item: SweatboxAircraft) => {
    setSelectedId(item.id);
    setCallsignMenu(null);
    runtimeMarker(item.id)?.click();
  };

  const layer = createPortal(
    <div data-pf24-sweatbox-native-traffic="true" className="pointer-events-none absolute inset-0 z-[13] overflow-hidden">
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${hostSize.x} ${hostSize.y}`} preserveAspectRatio="none" aria-hidden="true">
        {lineData.map(({ item, marker, end, unit, vectorLength, ground }) => <g key={item.id}>
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
          onMouseLeave={() => setCallsignMenu(null)}
          className="pointer-events-auto absolute left-0 top-[10px] z-[50] w-[118px] border border-[#f2f2f2] bg-[#555c60] font-mono text-[10px] leading-[18px] text-[#ededed] shadow-[0_2px_8px_rgba(0,0,0,.45)]"
        >
          <div className="border-b border-[#f2f2f2] px-2 text-center text-[11px] leading-[20px] text-[#22e000]">{displayCallsign}</div>
          <button type="button" onClick={(event) => event.stopPropagation()} className="block w-full border-b border-[#f2f2f2] px-2 text-center hover:bg-[#626a6f]">Callsign</button>
          <button type="button" onClick={(event) => { event.stopPropagation(); clickRuntimeMenuAction(item.id, "Assume"); setCallsignMenu(null); }} className="block w-full border-b border-[#f2f2f2] px-2 text-center hover:bg-[#626a6f]">Assume</button>
          <button type="button" onClick={(event) => { event.stopPropagation(); clickRuntimeMenuAction(item.id, "FPL"); setCallsignMenu(null); }} className="block w-full border-b border-[#f2f2f2] px-2 text-center hover:bg-[#626a6f]">FPL</button>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); setCallsignMenu({ id: item.id, expanded: !menuExpanded }); }}
            className="flex w-full items-center justify-center gap-2 border-b border-[#f2f2f2] px-2 hover:bg-[#626a6f]"
          >
            <span className={`inline-block text-[9px] transition-transform ${menuExpanded ? "rotate-180" : ""}`}>▽</span>
            <span>More</span>
          </button>
          {menuExpanded && <>
            {["MAPP", "HOLD", "FREE", "Contact Me"].map((entry) => <button key={entry} type="button" onClick={(event) => event.stopPropagation()} className="block w-full border-b border-[#f2f2f2] px-2 text-center hover:bg-[#626a6f]">{entry}</button>)}
            {instructor && <button type="button" onClick={(event) => { event.stopPropagation(); clickRuntimeMenuAction(item.id, "Delete"); setCallsignMenu(null); }} className="block w-full px-2 text-center hover:bg-[#626a6f]">Delete</button>}
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
            <div className="relative h-[9px] w-[62px]">
              <button
                type="button"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={openCallsignMenu}
                className="block h-[9px] w-[62px] overflow-hidden text-ellipsis whitespace-nowrap border-0 bg-transparent p-0 text-left text-[9px] leading-[9px] text-[#00e000] outline-none"
              >{displayCallsign}</button>
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
            onMouseLeave={() => {
              if (dragRef.current?.id === item.id) return;
              setSelectedId((current) => current === item.id ? null : current);
              setCallsignMenu((current) => current?.id === item.id ? null : current);
            }}
            className="pointer-events-auto absolute z-[16] w-[108px] cursor-move select-none font-mono text-[9px] leading-[9px] text-[#00e000]"
            style={{ left: label.x, top: label.y }}
          >
            <DragEdges onMouseDown={startLabelDrag} />
            <div className="h-[8px] text-[#ffff00] leading-[8px]">A9999</div>
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

  return <>
    {layer}
    <style jsx global>{`
      html[data-pf24-sweatbox-active='true'] [data-pf24-sweatbox-traffic='true'] > svg{visibility:hidden!important}
      html[data-pf24-sweatbox-active='true'] [data-pf24-sweatbox-traffic='true'] [data-pf24-traffic-select='true'],
      html[data-pf24-sweatbox-active='true'] [data-pf24-sweatbox-traffic='true'] [data-pf24-traffic-label='true']{visibility:hidden!important;pointer-events:none!important}
    `}</style>
  </>;
}
