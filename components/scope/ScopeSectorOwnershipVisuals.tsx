"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getGameCallsignFromNotes, normalizeGameCallsign } from "@/lib/flightPlanGameCallsign";
import { supabase } from "@/lib/supabase";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = { initialPlans: ScopeFlightPlan[] };
type StoredConnection = { callsign?: string };
type OwnershipHintDetail = { key?: string; owner?: string | null };
type OptimisticOwner = { owner: string | null; expiresAt: number };

const CONNECTION_STORAGE_KEY = "pf24_scope_connection_session_v1";
const LIST_SELECTOR = "[data-pf24-live-sector-list='true']";
const LIVE_ROOT = "[data-pf24-live-traffic='true']";
const OPTIMISTIC_TTL_MS = 5000;

function norm(value: string) {
  return normalizeGameCallsign(value);
}

function normalizeOwner(value: string | null | undefined) {
  return value?.trim().toUpperCase() || null;
}

function readPosition() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CONNECTION_STORAGE_KEY) ?? "null") as StoredConnection | null;
    return parsed?.callsign?.trim().toUpperCase() ?? "";
  } catch {
    return "";
  }
}

function planKeys(plan: ScopeFlightPlan) {
  const keys = new Set<string>();
  const displayed = norm(plan.callsign);
  const game = norm(getGameCallsignFromNotes(plan.notes));
  if (displayed) keys.add(displayed);
  if (game) keys.add(game);
  return keys;
}

function rowCallsign(wrapper: HTMLElement) {
  const row = wrapper.firstElementChild instanceof HTMLElement ? wrapper.firstElementChild : wrapper;
  return row.firstElementChild?.textContent?.trim().toUpperCase() ?? "";
}

function trafficCallsign(label: HTMLElement) {
  const button = Array.from(label.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => {
    if (candidate.closest("[data-pf24-callsign-menu='true']")) return false;
    return /^[A-Z0-9-]{2,12}$/.test(candidate.textContent?.trim().toUpperCase() ?? "");
  });
  return button?.textContent?.trim().toUpperCase() ?? "";
}

export default function ScopeSectorOwnershipVisuals({ initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const [position, setPosition] = useState("");
  const [optimisticOwners, setOptimisticOwners] = useState<Record<string, OptimisticOwner>>({});

  const planByKey = useMemo(() => {
    const map = new Map<string, ScopeFlightPlan>();
    for (const plan of plans) {
      for (const key of planKeys(plan)) map.set(key, plan);
    }
    return map;
  }, [plans]);

  const loadPlans = useCallback(async () => {
    const { data, error } = await supabase
      .from("flight_plans")
      .select("*")
      .neq("status", "FINISHED")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("PF24 Scope sector ownership refresh failed:", error);
      return;
    }
    setPlans((data ?? []) as ScopeFlightPlan[]);
  }, []);

  const sync = useCallback(() => {
    const list = document.querySelector<HTMLElement>(LIST_SELECTOR);
    if (!list) return;

    const radarOwnership = new Map<string, "mine" | "other" | "free">();
    document.querySelectorAll<HTMLElement>(`${LIVE_ROOT} [data-pf24-traffic-label='true']`).forEach((label) => {
      const key = norm(trafficCallsign(label));
      const ownership = label.dataset.pf24Ownership;
      if (!key || (ownership !== "mine" && ownership !== "other" && ownership !== "free")) return;
      radarOwnership.set(key, ownership);
    });

    const now = Date.now();
    const rows = Array.from(list.children)
      .slice(1)
      .filter((node): node is HTMLElement => node instanceof HTMLElement);

    for (const wrapper of rows) {
      const key = norm(rowCallsign(wrapper));
      if (!key) continue;

      const radar = radarOwnership.get(key);
      if (radar) {
        wrapper.dataset.pf24SectorOwnership = radar;
        continue;
      }

      const plan = planByKey.get(key);
      if (!plan) continue;
      const optimistic = optimisticOwners[key];
      const owner = optimistic && optimistic.expiresAt > now
        ? optimistic.owner
        : normalizeOwner(plan.assumed_by);
      const state = position && owner === position ? "mine" : owner ? "other" : "free";
      wrapper.dataset.pf24SectorOwnership = state;
    }
  }, [optimisticOwners, planByKey, position]);

  useEffect(() => {
    setPosition(readPosition());
    const onConnection = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean; callsign?: string }>).detail;
      setPosition(detail?.connected ? (detail.callsign?.trim().toUpperCase() || readPosition()) : "");
      if (!detail?.connected) setOptimisticOwners({});
    };
    const onHint = (event: Event) => {
      const detail = (event as CustomEvent<OwnershipHintDetail>).detail;
      const key = norm(detail?.key ?? "");
      if (!key) return;
      setOptimisticOwners((current) => ({
        ...current,
        [key]: { owner: normalizeOwner(detail?.owner), expiresAt: Date.now() + OPTIMISTIC_TTL_MS },
      }));
      window.requestAnimationFrame(sync);
    };
    const onOwnershipChange = () => {
      window.requestAnimationFrame(sync);
      void loadPlans();
    };

    window.addEventListener("pf24-scope-connection-change", onConnection);
    window.addEventListener("pf24-traffic-ownership-hint", onHint);
    window.addEventListener("pf24-traffic-ownership-change", onOwnershipChange);
    return () => {
      window.removeEventListener("pf24-scope-connection-change", onConnection);
      window.removeEventListener("pf24-traffic-ownership-hint", onHint);
      window.removeEventListener("pf24-traffic-ownership-change", onOwnershipChange);
    };
  }, [loadPlans, sync]);

  useEffect(() => {
    const channel = supabase
      .channel("scope-sector-ownership-visuals-v1")
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, () => void loadPlans())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadPlans]);

  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24SectorOwnershipVisuals = "v1";
    style.textContent = `
      ${LIST_SELECTOR} > [data-pf24-sector-ownership='mine'] > div:first-child,
      ${LIST_SELECTOR} > [data-pf24-sector-ownership='mine'] > div:first-child span,
      ${LIST_SELECTOR} > [data-pf24-sector-ownership='mine'] > div:first-child button,
      ${LIST_SELECTOR} > [data-pf24-sector-ownership='mine'] > div:first-child input { color:#00e000 !important; }

      ${LIST_SELECTOR} > [data-pf24-sector-ownership='other'] > div:first-child,
      ${LIST_SELECTOR} > [data-pf24-sector-ownership='other'] > div:first-child span,
      ${LIST_SELECTOR} > [data-pf24-sector-ownership='other'] > div:first-child button,
      ${LIST_SELECTOR} > [data-pf24-sector-ownership='other'] > div:first-child input { color:#9b9b9b !important; }

      ${LIST_SELECTOR} > [data-pf24-sector-ownership='free'] > div:first-child,
      ${LIST_SELECTOR} > [data-pf24-sector-ownership='free'] > div:first-child span,
      ${LIST_SELECTOR} > [data-pf24-sector-ownership='free'] > div:first-child button,
      ${LIST_SELECTOR} > [data-pf24-sector-ownership='free'] > div:first-child input { color:#d8d8d8 !important; }
    `;
    document.head.appendChild(style);

    sync();
    const timer = window.setInterval(sync, 80);
    return () => {
      style.remove();
      window.clearInterval(timer);
    };
  }, [sync]);

  return null;
}
