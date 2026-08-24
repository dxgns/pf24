"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getGameCallsignFromNotes,
  getTransponderModeFromNotes,
  normalizeGameCallsign,
  type FlightPlanTransponderMode,
} from "@/lib/flightPlanGameCallsign";
import { normalizeAirlineCallsign } from "@/lib/scope/airlines";
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

function flightSuffix(value: string | null | undefined) {
  const compact = norm(value);
  return compact.match(/(\d{1,4}[A-Z]?)$/)?.[1] ?? "";
}

function callsignVariants(value: string | null | undefined) {
  const raw = String(value ?? "");
  const variants = new Set<string>();
  const basic = norm(raw);
  const airline = norm(normalizeAirlineCallsign(raw));
  if (basic) variants.add(basic);
  if (airline) variants.add(airline);

  // Project Flight can expose airline names inside the live callsign while the
  // filed PF24 plan uses the ICAO airline prefix (for example LANCHILE1900 vs
  // LAN1900). Keep an explicit LAN Chile bridge and also expose the flight
  // number as a secondary key. The number fallback is only used when it is
  // unique among active plans, so two airlines using the same flight number do
  // not get cross-linked.
  const lanChile = basic.match(/^LAN(?:CHILE|CHILEAIRLINES)(\d{1,4}[A-Z]?)$/);
  if (lanChile) variants.add(`LAN${lanChile[1]}`);

  const suffix = flightSuffix(basic);
  if (suffix) variants.add(`#${suffix}`);
  return Array.from(variants);
}

function planKeys(plan: ScopeFlightPlan) {
  const keys = new Set<string>();
  for (const value of [plan.callsign, getGameCallsignFromNotes(plan.notes)]) {
    for (const key of callsignVariants(value)) {
      if (!key.startsWith("#")) keys.add(key);
    }
  }
  return Array.from(keys);
}

function planFlightSuffixes(plan: ScopeFlightPlan) {
  const suffixes = new Set<string>();
  for (const value of [plan.callsign, getGameCallsignFromNotes(plan.notes)]) {
    const suffix = flightSuffix(value);
    if (suffix) suffixes.add(suffix);
  }
  return Array.from(suffixes);
}

function normalizeTransponder(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/[^0-7]/g, "").slice(-4);
  return digits ? digits.padStart(4, "0") : "9999";
}

function trafficCallsigns(label: HTMLElement) {
  const button = Array.from(label.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => {
    if (candidate.closest("[data-pf24-callsign-menu='true']")) return false;
    return /^[A-Z0-9-]{2,12}$/.test(candidate.textContent?.trim().toUpperCase() ?? "");
  });
  return callsignVariants(button?.textContent);
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
  const candidates = Array.from(label.querySelectorAll<HTMLElement>>("span"));
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
    const suffixOwners = new Map<string, PlanTransponderState | null>();

    for (const plan of plans) {
      if (plan.status === "FINISHED") continue;
      const state: PlanTransponderState = {
        mode: getTransponderModeFromNotes(plan.notes),
        transponder: normalizeTransponder(plan.transponder),
      };
      for (const key of planKeys(plan)) map.set(key, state);

      for (const suffix of planFlightSuffixes(plan)) {
        if (!suffixOwners.has(suffix)) suffixOwners.set(suffix, state);
        else suffixOwners.set(suffix, null);
      }
    }

    for (const [suffix, state] of suffixOwners) {
      if (state) map.set(`#${suffix}`, state);
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
        const keys = trafficCallsigns(label);
        const matchedKey = keys.find((key) => stateByCallsign.has(key)) ?? "";
        const state = matchedKey ? stateByCallsign.get(matchedKey) : undefined;
        const target = label.parentElement?.querySelector<HTMLElement>(":scope > [data-pf24-traffic-select='true']") ?? null;

        if (!state) {
          delete label.dataset.pf24XpdrOff;
          if (target) delete target.dataset.pf24XpdrOff;
          const oldCodeNode = transponderNode(label);
          if (oldCodeNode) {
            delete oldCodeNode.dataset.pf24XpdrCode;
            delete oldCodeNode.dataset.pf24XpdrMode;
            oldCodeNode.style.removeProperty("--pf24-xpdr-code-color");
          }
          continue;
        }

        const off = state.mode === "OFF";
        label.dataset.pf24XpdrOff = off ? "true" : "false";
        if (target) target.dataset.pf24XpdrOff = off ? "true" : "false";
        if (off) continue;

        const codeNode = transponderNode(label);
        if (codeNode) {
          const desiredText = `A${state.transponder}`;
          codeNode.dataset.pf24XpdrCode = desiredText;
          codeNode.dataset.pf24XpdrMode = state.mode;
          codeNode.style.setProperty(
            "--pf24-xpdr-code-color",
            state.mode === "STBY" ? STBY_COLOR : ACTIVE_COLOR,
          );
          if (codeNode.textContent !== desiredText) codeNode.textContent = desiredText;
          important(codeNode, "color", state.mode === "STBY" ? STBY_COLOR : ACTIVE_COLOR);
        }

        const altNode = altitudeNode(label);
        if (!altNode) continue;

        const liveAltitude = altitudeDigits(altNode);
        if (state.mode === "ALT") {
          delete altNode.dataset.pf24XpdrAltitudeHold;
          continue;
        }

        const altitudeKey = matchedKey || keys[0] || "";
        const stored = groundAltitudeRef.current.get(altitudeKey);
        if (!stored && liveAltitude) {
          groundAltitudeRef.current.set(altitudeKey, liveAltitude);
        } else if (stored && liveAltitude && Number(liveAltitude) < Number(stored)) {
          // Keep the lowest observed altitude as the ground/reference altitude.
          groundAltitudeRef.current.set(altitudeKey, liveAltitude);
        }

        const groundAltitude = groundAltitudeRef.current.get(altitudeKey);
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
      ${LIVE_ROOT} [data-pf24-xpdr-code] {
        font-size: 0 !important;
      }
      ${LIVE_ROOT} [data-pf24-xpdr-code]::before {
        content: attr(data-pf24-xpdr-code);
        display: inline-block;
        font-size: 9px !important;
        line-height: 8px !important;
        color: var(--pf24-xpdr-code-color, #00e000) !important;
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    void loadPlans();
    const poll = window.setInterval(() => void loadPlans(), 1000);

    const channel = supabase
      .channel("scope-transponder-mode-sync-v3")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flight_plans" },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
    };
  }, [loadPlans, scheduleRefresh]);

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
