"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getGameCallsignFromNotes } from "@/lib/flightPlanGameCallsign";
import { normalizeAirlineCallsign } from "@/lib/scope/airlines";
import { MAP_BOUNDS, WAYPOINTS, type NamedPoint } from "@/lib/scope/mapData";
import { SCOPE_MAP_UNITS_PER_NM } from "@/lib/scope/distanceScale";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = { initialPlans: ScopeFlightPlan[] };
type Point = { x: number; y: number };
type Viewport = { zoom: number; panX: number; panY: number };
type Segment = {
  id: string;
  a: Point;
  b: Point;
  label: Point;
  angle: number;
  distanceNm: number;
};

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";
const ROUTE_COLOR = "#00efff";

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

function topToolbarButtons() {
  const row = document.querySelector<HTMLElement>("main.fixed header > div:first-child");
  return Array.from(row?.querySelectorAll<HTMLButtonElement>(":scope > button") ?? []);
}

function findPlannedRouteButton() {
  const buttons = topToolbarButtons();
  return buttons.length >= 2 ? buttons.at(-2) ?? null : null;
}

function callsignFromSelect(hit: HTMLElement | null) {
  if (!hit) return null;
  const label = hit.getAttribute("aria-label") ?? "";
  return label.match(/(?:Seleccionar|Abrir información de)\s+(.+)$/i)?.[1]?.trim() ?? null;
}

function trafficCallsign(target: Element) {
  const directHit = target.closest<HTMLElement>("[data-pf24-traffic-select='true']");
  const directCallsign = callsignFromSelect(directHit);
  if (directCallsign) return directCallsign;

  // Traffic labels and the radar symbol live under the same traffic wrapper.
  // Resolve the callsign from the sibling symbol so clicking anywhere on the
  // label (simple or expanded) selects the exact same planned route.
  const trafficLabel = target.closest<HTMLElement>("[data-pf24-traffic-label='true']");
  if (!trafficLabel) return null;
  const siblingHit = trafficLabel.parentElement?.querySelector<HTMLElement>("[data-pf24-traffic-select='true']") ?? null;
  return callsignFromSelect(siblingHit);
}

function planKey(value: string) {
  return normalizeAirlineCallsign(value).trim().toUpperCase();
}

function routeTokens(route: string) {
  return route
    .toUpperCase()
    .split(/\s+/)
    .map((raw) => raw.split("/")[0]?.replace(/[^A-Z0-9]/g, "") ?? "")
    .filter((token) => token && token !== "DCT");
}

const WAYPOINTS_BY_NAME = (() => {
  const map = new Map<string, NamedPoint[]>();
  for (const point of WAYPOINTS) {
    const key = point.name.toUpperCase();
    const list = map.get(key) ?? [];
    list.push(point);
    map.set(key, list);
  }
  return map;
})();

function pointDistance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function resolveRoutePoints(plan: ScopeFlightPlan) {
  const names = routeTokens(plan.route).filter((token) => WAYPOINTS_BY_NAME.has(token));
  const resolved: NamedPoint[] = [];

  names.forEach((name, index) => {
    const candidates = WAYPOINTS_BY_NAME.get(name) ?? [];
    if (candidates.length === 0) return;
    if (candidates.length === 1) {
      resolved.push(candidates[0]);
      return;
    }

    const previous = resolved.at(-1) ?? null;
    let nextReference: NamedPoint | null = null;
    for (let nextIndex = index + 1; nextIndex < names.length; nextIndex += 1) {
      const nextCandidates = WAYPOINTS_BY_NAME.get(names[nextIndex]) ?? [];
      if (nextCandidates.length === 1) {
        nextReference = nextCandidates[0];
        break;
      }
    }

    const chosen = [...candidates].sort((a, b) => {
      const score = (candidate: NamedPoint) => {
        let value = 0;
        if (previous) value += pointDistance(previous, candidate);
        if (nextReference) value += pointDistance(candidate, nextReference);
        if (!previous && !nextReference && candidate.kind === "vor") value -= 0.01;
        return value;
      };
      return score(a) - score(b);
    })[0];

    if (chosen) resolved.push(chosen);
  });

  return resolved;
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

function readableLineAngle(dx: number, dy: number) {
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return angle;
}

function labelBelowLine(a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (length < 0.001) return { x: mid.x, y: mid.y + 10 };

  let normal = { x: -dy / length, y: dx / length };
  if (normal.y < -0.001 || (Math.abs(normal.y) <= 0.001 && normal.x < 0)) {
    normal = { x: -normal.x, y: -normal.y };
  }
  return { x: mid.x + normal.x * 10, y: mid.y + normal.y * 10 };
}

export default function ScopePlannedRouteTool({ initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const [radar, setRadar] = useState<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 });
  const [enabled, setEnabled] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [sizeTick, setSizeTick] = useState(0);
  const enabledRef = useRef(false);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

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
    const channel = supabase
      .channel("scope-planned-route-tool")
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, (payload) => {
        const next = payload.new as ScopeFlightPlan;
        const old = payload.old as ScopeFlightPlan;
        if (payload.eventType === "INSERT" && next.status !== "FINISHED") {
          setPlans((current) => current.some((plan) => plan.id === next.id) ? current : [next, ...current]);
        } else if (payload.eventType === "UPDATE") {
          setPlans((current) => next.status === "FINISHED"
            ? current.filter((plan) => plan.id !== next.id)
            : current.some((plan) => plan.id === next.id)
              ? current.map((plan) => plan.id === next.id ? next : plan)
              : [next, ...current]);
        } else if (payload.eventType === "DELETE") {
          setPlans((current) => current.filter((plan) => plan.id !== old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const planMap = useMemo(() => {
    const map = new Map<string, ScopeFlightPlan>();
    for (const plan of plans) {
      const gameCallsign = getGameCallsignFromNotes(plan.notes) || plan.callsign;
      for (const callsign of [gameCallsign, plan.callsign]) {
        const key = planKey(callsign);
        if (key && !map.has(key)) map.set(key, plan);
      }
    }
    return map;
  }, [plans]);

  useEffect(() => {
    const onClickCapture = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const button = target.closest<HTMLButtonElement>("button");
      const routeButton = findPlannedRouteButton();
      if (button && routeButton && button === routeButton) {
        const next = !enabledRef.current;
        enabledRef.current = next;
        setEnabled(next);
        if (!next) setSelectedPlanId(null);
        return;
      }

      if (!enabledRef.current) return;
      const callsign = trafficCallsign(target);
      if (!callsign) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const plan = planMap.get(planKey(callsign));
      if (!plan) return;
      setSelectedPlanId(plan.id);
    };

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [planMap]);

  useEffect(() => {
    if (!radar) return;
    const onResize = () => setSizeTick((value) => value + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [radar]);

  const selectedPlan = useMemo(
    () => selectedPlanId ? plans.find((plan) => plan.id === selectedPlanId) ?? null : null,
    [plans, selectedPlanId],
  );

  const segments = useMemo<Segment[]>(() => {
    void sizeTick;
    if (!enabled || !radar || !selectedPlan) return [];
    const rect = radar.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) return [];

    const routePoints = resolveRoutePoints(selectedPlan);
    if (routePoints.length < 2) return [];
    const size = { x: rect.width, y: rect.height };

    return routePoints.slice(0, -1).map((point, index) => {
      const next = routePoints[index + 1];
      const a = screenPoint(size, point, viewport);
      const b = screenPoint(size, next, viewport);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      return {
        id: `${selectedPlan.id}-${index}-${point.name}-${next.name}`,
        a,
        b,
        label: labelBelowLine(a, b),
        angle: readableLineAngle(dx, dy),
        distanceNm: pointDistance(point, next) / SCOPE_MAP_UNITS_PER_NM,
      };
    });
  }, [enabled, radar, selectedPlan, sizeTick, viewport]);

  if (!radar || !enabled || segments.length === 0) return null;

  return createPortal(
    <svg
      data-pf24-planned-route-layer="true"
      className="pointer-events-none absolute inset-0 z-[11] h-full w-full"
      aria-hidden="true"
    >
      {segments.map((segment) => (
        <g key={segment.id}>
          <line
            x1={segment.a.x}
            y1={segment.a.y}
            x2={segment.b.x}
            y2={segment.b.y}
            stroke={ROUTE_COLOR}
            strokeWidth="2"
          />
          <text
            x={segment.label.x}
            y={segment.label.y}
            transform={`rotate(${segment.angle} ${segment.label.x} ${segment.label.y})`}
            fill={ROUTE_COLOR}
            stroke="#0b0b0b"
            strokeWidth="2"
            paintOrder="stroke"
            fontSize="12"
            fontFamily="monospace"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {segment.distanceNm.toFixed(1)}nm
          </text>
        </g>
      ))}
    </svg>,
    radar,
  );
}
