"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getGameCallsignFromNotes,
  getTransponderModeFromNotes,
  normalizeGameCallsign,
  type FlightPlanTransponderMode,
} from "@/lib/flightPlanGameCallsign";
import { supabase } from "@/lib/supabase";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = { initialPlans: ScopeFlightPlan[] };
type PlanTransponderState = {
  mode: FlightPlanTransponderMode;
  transponder: string;
};

const LIVE_ROOT = "[data-pf24-live-traffic='true']";
const SECTOR_LIST = "[data-pf24-live-sector-list='true']";
const STBY_COLOR = "#ffff00";
const ACTIVE_COLOR = "#00e000";

function norm(value: string | null | undefined) {
  return normalizeGameCallsign(String(value ?? ""));
}

function planKeys(plan: ScopeFlightPlan) {
  const keys = new Set<string>();
  const filed = norm(plan.callsign);
  const game = norm(getGameCallsignFromNotes(plan.notes));
  if (filed) keys.add(filed);
  if (game) keys.add(game);
  return Array.from(keys);
}

function normalizeTransponder(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/[^0-7]/g, "").slice(-4);
  return digits ? digits.padStart(4, "0") : "9999";
}

function trafficCallsign(label: HTMLElement) {
  const button = Array.from(label.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => {
    if (candidate.closest("[data-pf24-callsign-menu='true']")) return false;
    return /^[A-Z0-9-]{2,12}$/.test(candidate.textContent?.trim().toUpperCase() ?? "");
  });
  return norm(button?.textContent);
}

function sectorRowCallsign(row: HTMLElement) {
  const grid = row.firstElementChild instanceof HTMLElement ? row.firstElementChild : row;
  return norm(grid.firstElementChild?.textContent);
}

function transponderNode(label: HTMLElement) {
  return Array.from(label.children).find((child): child is HTMLElement =>
    child instanceof HTMLElement && /^A\d{4}$/.test(child.textContent?.trim().toUpperCase() ?? ""),
  ) ?? null;
}

function altitudeNode(label: HTMLElement) {
  const candidates = Array.from(label.querySelectorAll<HTMLElement>("span"));
  return candidates.find((node) => {
    const text = node.textContent?.trim() ?? "";
    if (!/^\d{3}[↑↓]?$/.test(text)) return false;
    const parent = node.parentElement;
    return Boolean(parent && parent.firstElementChild === node && parent.children.length >= 2);
  }) ?? null;
}

function altitudeDigits(node: HTMLElement | null) {
  return node?.textContent?.trim().match(/^(\d{3})/)?.[1] ?? "";
}

function important(element: HTMLElement | null | undefined, property: string, value: string) {
  if (!element) return;
  if (element.style.getPropertyValue(property) === value && element.style.getPropertyPriority(property) === "important") return;
  element.style.setProperty(property, value, "important");
}

export default function ScopeTransponderModeSync({ initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const groundAltitudeRef = useRef(new Map<string, string>());
  const refreshTimerRef = useRef<number | null>(null);

  const stateByCallsign = useMemo(() => {
    const map = new Map<string, PlanTransponderState>();
    for (const plan of plans) {
      if (plan.status === "FINISHED") continue;
      const state: PlanTransponderState = {
        mode: getTransponderModeFromNotes(plan.notes),
        transponder: normalizeTransponder(plan.transponder),
      };
      for (const key of planKeys(plan)) map.set(key, state);
    }
    return map;
  }, [plans]);

  const loadPlans = useCallback(async () => {
    const { data, error } = await supabase
      .from("flight_plans")
      .select("*")
      .neq("status", "FINISHED");

    if (error) {
      console.error("PF24 Scope transponder mode refresh failed:", error);
      return;
    }
    setPlans((data ?? []) as ScopeFlightPlan[]);
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void loadPlans();
    }, 60);
  }, [loadPlans]);

  const sync = useCallback(() => {
    const root = document.querySelector<HTMLElement>(LIVE_ROOT);
    if (root) {
      const labels = Array.from(root.querySelectorAll<HTMLElement>("[data-pf24-traffic-label='true']"));

      for (const label of labels) {
        const key = trafficCallsign(label);
        const state = key ? stateByCallsign.get(key) : undefined;
        const target = label.parentElement?.querySelector<HTMLElement>(":scope > [data-pf24-traffic-select='true']") ?? null;

        if (!state) {
          delete label.dataset.pf24XpdrOff;
          if (target) delete target.dataset.pf24XpdrOff;
          continue;
        }

        const off = state.mode === "OFF";
        label.dataset.pf24XpdrOff = off ? "true" : "false";
        if (target) target.dataset.pf24XpdrOff = off ? "true" : "false";
        if (off) continue;

        const codeNode = transponderNode(label);
        if (codeNode) {
          const desiredText = `A${state.transponder}`;
          if (codeNode.textContent !== desiredText) codeNode.textContent = desiredText;
          important(codeNode, "color", state.mode === "STBY" ? STBY_COLOR : ACTIVE_COLOR);
          codeNode.dataset.pf24XpdrMode = state.mode;
        }

        const altNode = altitudeNode(label);
        if (!altNode) continue;

        const liveAltitude = altitudeDigits(altNode);
        if (state.mode === "ALT") {
          delete altNode.dataset.pf24XpdrAltitudeHold;
          continue;
        }

        const stored = groundAltitudeRef.current.get(key);
        if (!stored && liveAltitude) {
          groundAltitudeRef.current.set(key, liveAltitude);
        } else if (stored && liveAltitude && Number(liveAltitude) < Number(stored)) {
          // Keep the lowest observed altitude as the ground/reference altitude.
          groundAltitudeRef.current.set(key, liveAltitude);
        }

        const groundAltitude = groundAltitudeRef.current.get(key);
        if (groundAltitude && altNode.textContent !== groundAltitude) {
          altNode.textContent = groundAltitude;
        }
        altNode.dataset.pf24XpdrAltitudeHold = "true";
      }
    }

    const list = document.querySelector<HTMLElement>(SECTOR_LIST);
    if (list) {
      const rows = Array.from(list.children)
        .slice(1)
        .filter((node): node is HTMLElement => node instanceof HTMLElement);

      for (const row of rows) {
        const key = sectorRowCallsign(row);
        const state = key ? stateByCallsign.get(key) : undefined;
        row.dataset.pf24XpdrOff = state?.mode === "OFF" ? "true" : "false";
      }
    }
  }, [stateByCallsign]);

  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24TransponderModes = "true";
    style.textContent = `
      ${LIVE_ROOT} [data-pf24-xpdr-off='true'],
      ${SECTOR_LIST} > [data-pf24-xpdr-off='true'] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("scope-transponder-mode-sync-v1")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flight_plans" },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
    };
  }, [scheduleRefresh]);

  useEffect(() => {
    sync();
    const interval = window.setInterval(sync, 70);

    const observer = new MutationObserver(() => sync());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearInterval(interval);
      observer.disconnect();
    };
  }, [sync]);

  return null;
}
