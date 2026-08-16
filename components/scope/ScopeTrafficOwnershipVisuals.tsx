"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getGameCallsignFromNotes, normalizeGameCallsign } from "@/lib/flightPlanGameCallsign";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = { initialPlans: ScopeFlightPlan[] };
type StoredConnection = { callsign?: string };
type UnplannedOwners = Record<string, string>;

const CONNECTION_STORAGE_KEY = "pf24_scope_connection_session_v1";
const UNPLANNED_STORAGE_KEY = "pf24_scope_unplanned_assumed_v2";
const GREEN = "#00e000";
const GREY = "#9b9b9b";
const LIVE_ROOT = "[data-pf24-live-traffic='true']";

function norm(value: string) {
  return normalizeGameCallsign(value);
}

function readPosition() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CONNECTION_STORAGE_KEY) ?? "null") as StoredConnection | null;
    return parsed?.callsign?.trim().toUpperCase() ?? "";
  } catch {
    return "";
  }
}

function readUnplannedOwners(): UnplannedOwners {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(UNPLANNED_STORAGE_KEY) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as UnplannedOwners : {};
  } catch {
    return {};
  }
}

function trafficCallsign(label: HTMLElement) {
  const button = Array.from(label.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => {
    if (candidate.closest("[data-pf24-callsign-menu='true']")) return false;
    return /^[A-Z0-9-]{2,12}$/.test(candidate.textContent?.trim().toUpperCase() ?? "");
  });
  return button?.textContent?.trim().toUpperCase() ?? "";
}

function planKeys(plan: ScopeFlightPlan) {
  const keys = new Set<string>();
  const displayed = norm(plan.callsign);
  const game = norm(getGameCallsignFromNotes(plan.notes));
  if (displayed) keys.add(displayed);
  if (game) keys.add(game);
  return Array.from(keys);
}

function setImportant(element: HTMLElement | SVGElement | null | undefined, property: string, value: string) {
  element?.style.setProperty(property, value, "important");
}

function paintLabel(label: HTMLElement, color: string) {
  setImportant(label, "color", color);
  label.querySelectorAll<HTMLElement>("span,button,input").forEach((element) => {
    if (element.closest("[data-pf24-callsign-menu='true']")) return;
    setImportant(element, "color", color);
  });
}

export default function ScopeTrafficOwnershipVisuals({ initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const [position, setPosition] = useState("");

  const plannedOwners = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const plan of plans) {
      for (const key of planKeys(plan)) map.set(key, plan.assumed_by?.trim().toUpperCase() || null);
    }
    return map;
  }, [plans]);

  const loadPlans = useCallback(async () => {
    const { data, error } = await supabase
      .from("flight_plans")
      .select("*")
      .neq("status", "FINISHED");
    if (error) {
      console.error("PF24 Scope ownership refresh failed:", error);
      return;
    }
    setPlans((data ?? []) as ScopeFlightPlan[]);
  }, []);

  useEffect(() => {
    setPosition(readPosition());
    const onConnection = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean; callsign?: string }>).detail;
      setPosition(detail?.connected ? (detail.callsign?.trim().toUpperCase() || readPosition()) : "");
    };
    window.addEventListener("pf24-scope-connection-change", onConnection);
    return () => window.removeEventListener("pf24-scope-connection-change", onConnection);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("scope-traffic-ownership-visuals")
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, () => void loadPlans())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadPlans]);

  const sync = useCallback(() => {
    const root = document.querySelector<HTMLElement>(LIVE_ROOT);
    if (!root) return;

    const labels = Array.from(root.querySelectorAll<HTMLElement>("[data-pf24-traffic-label='true']"));
    const targets = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-pf24-traffic-select='true']"));
    const groups = Array.from(root.querySelectorAll<SVGGElement>("svg > g"));
    const unplannedOwners = readUnplannedOwners();

    labels.forEach((label, index) => {
      const callsign = trafficCallsign(label);
      const key = norm(callsign);
      if (!key) return;

      const owner = plannedOwners.has(key)
        ? plannedOwners.get(key) ?? null
        : unplannedOwners[key]?.trim().toUpperCase() || null;
      const ownedByMe = Boolean(position && owner === position);
      const color = ownedByMe ? GREEN : GREY;

      label.dataset.pf24Ownership = ownedByMe ? "mine" : owner ? "other" : "free";
      paintLabel(label, color);

      const target = targets[index];
      const group = groups[index];
      setImportant(target?.querySelector<HTMLElement>(":scope > span"), "border-color", color);
      group?.querySelectorAll<SVGLineElement>("line").forEach((line) => setImportant(line, "stroke", color));
      group?.querySelectorAll<SVGCircleElement>("circle").forEach((circle) => setImportant(circle, "fill", color));
    });
  }, [plannedOwners, position]);

  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24TrafficOwnershipBaseline = "true";
    style.textContent = `
      ${LIVE_ROOT} [data-pf24-traffic-label='true'] { color:${GREY}; }
      ${LIVE_ROOT} [data-pf24-traffic-label='true'] span,
      ${LIVE_ROOT} [data-pf24-traffic-label='true'] button,
      ${LIVE_ROOT} [data-pf24-traffic-label='true'] input { color:${GREY}; }
      ${LIVE_ROOT} [data-pf24-traffic-label='true'] input::placeholder { color:${GREY}; }
      ${LIVE_ROOT} [data-pf24-traffic-select='true'] > span { border-color:${GREY}; }
      ${LIVE_ROOT} svg > g line { stroke:${GREY}; }
      ${LIVE_ROOT} svg > g circle { fill:${GREY}; }
      ${LIVE_ROOT} [data-pf24-traffic-label='true'] [data-pf24-callsign-menu='true'],
      ${LIVE_ROOT} [data-pf24-traffic-label='true'] [data-pf24-callsign-menu='true'] button,
      ${LIVE_ROOT} [data-pf24-traffic-label='true'] [data-pf24-callsign-menu='true'] span { color:#ededed; }
      ${LIVE_ROOT} [data-pf24-traffic-label='true'] [data-pf24-callsign-menu='true'] > div:first-child { color:#22e000; }
    `;
    document.head.appendChild(style);

    sync();
    const timer = window.setInterval(sync, 180);
    const schedule = () => window.requestAnimationFrame(sync);
    const onOwnershipChange = () => schedule();

    document.addEventListener("click", schedule, true);
    window.addEventListener("pf24-scope-connection-change", schedule);
    window.addEventListener("pf24-traffic-ownership-change", onOwnershipChange);

    return () => {
      style.remove();
      window.clearInterval(timer);
      document.removeEventListener("click", schedule, true);
      window.removeEventListener("pf24-scope-connection-change", schedule);
      window.removeEventListener("pf24-traffic-ownership-change", onOwnershipChange);
    };
  }, [sync]);

  return null;
}
