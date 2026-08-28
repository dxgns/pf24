"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getGameCallsignFromNotes,
  normalizeGameCallsign,
  setGameCallsignInNotes,
} from "@/lib/flightPlanGameCallsign";
import { normalizeAirlineCallsign } from "@/lib/scope/airlines";
import { supabase } from "@/lib/supabase";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = { initialPlans: ScopeFlightPlan[] };

type Match = {
  plan: ScopeFlightPlan;
  sourceKey: string;
};

const LIVE_ROOT_SELECTOR = "[data-pf24-live-traffic='true']";
const LIVE_LABEL_SELECTOR = "[data-pf24-traffic-label='true']";

function norm(value: string | null | undefined) {
  return normalizeGameCallsign(String(value ?? ""));
}

function variants(value: string | null | undefined) {
  const raw = String(value ?? "");
  const result = new Set<string>();
  const basic = norm(raw);
  const airline = norm(normalizeAirlineCallsign(raw));
  if (basic) result.add(basic);
  if (airline) result.add(airline);

  // Project Flight can expose LATAM Chile as LANCHILE#### while the filed
  // callsign is normally LAN####.
  const lanChile = basic.match(/^LAN(?:CHILE|CHILEAIRLINES)(\d{1,4}[A-Z]?)$/);
  if (lanChile) result.add(`LAN${lanChile[1]}`);

  return result;
}

function suffix(value: string | null | undefined) {
  return norm(value).match(/(\d{1,4}[A-Z]?)$/)?.[1] ?? "";
}

function planVariants(plan: ScopeFlightPlan) {
  const result = new Set<string>();
  for (const value of [plan.callsign, getGameCallsignFromNotes(plan.notes)]) {
    for (const key of variants(value)) result.add(key);
  }
  return result;
}

function planSuffixes(plan: ScopeFlightPlan) {
  const result = new Set<string>();
  for (const value of [plan.callsign, getGameCallsignFromNotes(plan.notes)]) {
    const valueSuffix = suffix(value);
    if (valueSuffix) result.add(valueSuffix);
  }
  return result;
}

function findPlan(plans: ScopeFlightPlan[], sourceCallsign: string): Match | null {
  const sourceKey = norm(sourceCallsign);
  if (!sourceKey) return null;
  const sourceVariants = variants(sourceCallsign);

  const exact = plans.filter((plan) => {
    const keys = planVariants(plan);
    return Array.from(sourceVariants).some((key) => keys.has(key));
  });
  if (exact.length === 1) return { plan: exact[0], sourceKey };
  if (exact.length > 1) return null;

  const sourceSuffix = suffix(sourceCallsign);
  if (!sourceSuffix) return null;
  const bySuffix = plans.filter((plan) => planSuffixes(plan).has(sourceSuffix));
  return bySuffix.length === 1 ? { plan: bySuffix[0], sourceKey } : null;
}

function callsignButton(label: HTMLElement) {
  return Array.from(label.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
    if (button.closest("[data-pf24-callsign-menu='true']")) return false;
    return /^[A-Z0-9-]{2,12}$/.test(button.textContent?.trim().toUpperCase() ?? "");
  }) ?? null;
}

function setTextIfChanged(element: Element | null | undefined, value: string) {
  if (!(element instanceof HTMLElement)) return;
  if (element.textContent === value) return;
  element.textContent = value;
}

function paintImmediatePlanData(label: HTMLElement, plan: ScopeFlightPlan) {
  const callsign = plan.callsign.toUpperCase();
  const button = callsignButton(label);
  setTextIfChanged(button, callsign);

  const menu = label.querySelector<HTMLElement>("[data-pf24-callsign-menu='true']");
  setTextIfChanged(menu?.firstElementChild, callsign);

  const arrival = plan.arrival_icao?.trim().toUpperCase();
  if (!arrival) return;

  const directChildren = Array.from(label.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
  const grids = directChildren.filter((child) => child.tagName === "DIV" && child.className.includes("grid"));

  // Detailed label: third direct grid contains AFL / RFL / DEST.
  if (grids.length >= 3) {
    setTextIfChanged(grids[2].lastElementChild, arrival);
    return;
  }

  // Simple label: the final direct non-drag span is DEST.
  const spans = directChildren.filter((child) => child.tagName === "SPAN" && !child.dataset.pf24TrafficDragEdge);
  setTextIfChanged(spans.at(-1), arrival);
}

function mutationAddsLiveRoot(records: MutationRecord[]) {
  return records.some((record) => Array.from(record.addedNodes).some((node) =>
    node instanceof Element && (
      node.matches(LIVE_ROOT_SELECTOR) ||
      Boolean(node.querySelector(LIVE_ROOT_SELECTOR))
    ),
  ));
}

export default function ScopeFlightPlanTrafficLink({ initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const linkingRef = useRef(new Set<string>());

  const activePlans = useMemo(
    () => plans.filter((plan) => plan.status !== "FINISHED"),
    [plans],
  );

  const loadPlans = useCallback(async () => {
    const { data, error } = await supabase
      .from("flight_plans")
      .select("*")
      .neq("status", "FINISHED")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("PF24 traffic/plan link refresh failed:", error);
      return;
    }
    setPlans((data ?? []) as ScopeFlightPlan[]);
  }, []);

  const persistGameCallsign = useCallback(async (match: Match) => {
    const { plan, sourceKey } = match;
    const currentGame = getGameCallsignFromNotes(plan.notes);
    const currentVariants = variants(currentGame || plan.callsign);
    if (currentVariants.has(sourceKey)) return;

    // Do not overwrite an explicitly different game callsign. The suffix
    // fallback is only allowed to repair another representation of the same
    // flight number.
    const currentGameSuffix = suffix(currentGame);
    const sourceSuffix = suffix(sourceKey);
    if (currentGame && currentGameSuffix && sourceSuffix && currentGameSuffix !== sourceSuffix) return;

    if (linkingRef.current.has(plan.id)) return;
    linkingRef.current.add(plan.id);

    try {
      const notes = setGameCallsignInNotes(plan.notes, sourceKey);
      const { error } = await supabase
        .from("flight_plans")
        .update({ notes, updated_at: new Date().toISOString() })
        .eq("id", plan.id)
        .neq("status", "FINISHED");

      if (error) {
        console.error("PF24 traffic/plan callsign link failed:", error);
        return;
      }

      setPlans((current) => current.map((item) => item.id === plan.id ? { ...item, notes } : item));
    } finally {
      linkingRef.current.delete(plan.id);
    }
  }, []);

  const sync = useCallback(() => {
    const root = document.querySelector<HTMLElement>(LIVE_ROOT_SELECTOR);
    if (!root) return;

    const labels = Array.from(root.querySelectorAll<HTMLElement>(LIVE_LABEL_SELECTOR));
    for (const label of labels) {
      const button = callsignButton(label);
      if (!button) continue;

      const original = label.dataset.pf24TrafficSourceCallsign || button.textContent?.trim().toUpperCase() || "";
      if (!original) continue;
      if (!label.dataset.pf24TrafficSourceCallsign) label.dataset.pf24TrafficSourceCallsign = original;

      const match = findPlan(activePlans, original);
      if (!match) {
        delete label.dataset.pf24LinkedPlanId;
        continue;
      }

      label.dataset.pf24LinkedPlanId = match.plan.id;
      paintImmediatePlanData(label, match.plan);
      void persistGameCallsign(match);
    }
  }, [activePlans, persistGameCallsign]);

  useEffect(() => {
    const channel = supabase
      .channel("scope-flight-plan-traffic-link-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, () => void loadPlans())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadPlans]);

  useEffect(() => {
    let frame: number | null = null;
    let root: HTMLElement | null = null;
    let rootObserver: MutationObserver | null = null;

    const queueSync = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        sync();
      });
    };

    const bindRoot = () => {
      const next = document.querySelector<HTMLElement>(LIVE_ROOT_SELECTOR);
      if (next === root) return;

      rootObserver?.disconnect();
      rootObserver = null;
      root = next;
      if (!next) return;

      rootObserver = new MutationObserver(queueSync);
      rootObserver.observe(next, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      queueSync();
    };

    bindRoot();
    const main = document.querySelector<HTMLElement>("main.fixed");
    const hostObserver = main ? new MutationObserver((records) => {
      if (!root?.isConnected || mutationAddsLiveRoot(records)) bindRoot();
    }) : null;
    hostObserver?.observe(main!, { childList: true, subtree: true });
    queueSync();

    return () => {
      rootObserver?.disconnect();
      hostObserver?.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [sync]);

  return null;
}
