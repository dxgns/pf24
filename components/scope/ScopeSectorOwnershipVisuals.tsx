"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getGameCallsignFromNotes, normalizeGameCallsign } from "@/lib/flightPlanGameCallsign";
import { normalizeAirlineCallsign } from "@/lib/scope/airlines";
import { supabase } from "@/lib/supabase";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = { initialPlans: ScopeFlightPlan[] };
type StoredConnection = { callsign?: string };
type OwnershipHintDetail = { key?: string; owner?: string | null };
type OptimisticOwner = { owner: string | null; expiresAt: number };
type UnplannedOwners = Record<string, string>;

const CONNECTION_STORAGE_KEY = "pf24_scope_connection_session_v1";
const LIST_SELECTOR = "[data-pf24-live-sector-list='true']";
const OWNERS_EVENT = "pf24-unplanned-ownership-sync";
const OWNERS_REQUEST_EVENT = "pf24-unplanned-ownership-request";
const OPTIMISTIC_TTL_MS = 5000;

function norm(value: string) {
  return normalizeGameCallsign(value);
}

function normalizeOwner(value: string | null | undefined) {
  return value?.trim().toUpperCase() || null;
}

function flightSuffix(value: string | null | undefined) {
  const compact = norm(String(value ?? ""));
  return compact.match(/(\d{1,4}[A-Z]?)$/)?.[1] ?? "";
}

function callsignVariants(value: string | null | undefined) {
  const raw = String(value ?? "");
  const variants = new Set<string>();
  const basic = norm(raw);
  const airline = norm(normalizeAirlineCallsign(raw));
  if (basic) variants.add(basic);
  if (airline) variants.add(airline);

  const lanChile = basic.match(/^LAN(?:CHILE|CHILEAIRLINES)(\d{1,4}[A-Z]?)$/);
  if (lanChile) variants.add(`LAN${lanChile[1]}`);
  return Array.from(variants);
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
  for (const value of [plan.callsign, getGameCallsignFromNotes(plan.notes)]) {
    for (const key of callsignVariants(value)) keys.add(key);
  }
  return keys;
}

function planSuffixes(plan: ScopeFlightPlan) {
  const suffixes = new Set<string>();
  for (const value of [plan.callsign, getGameCallsignFromNotes(plan.notes)]) {
    const suffix = flightSuffix(value);
    if (suffix) suffixes.add(suffix);
  }
  return suffixes;
}

function rowCallsign(wrapper: HTMLElement) {
  const row = wrapper.firstElementChild instanceof HTMLElement ? wrapper.firstElementChild : wrapper;
  return row.firstElementChild?.textContent?.trim().toUpperCase() ?? "";
}

function mutationTouchesSectorList(mutations: MutationRecord[]) {
  return mutations.some((mutation) => {
    const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
    if (target?.closest(LIST_SELECTOR)) return true;
    return Array.from(mutation.addedNodes).some((node) => {
      if (!(node instanceof Element)) return false;
      return node.matches(LIST_SELECTOR) || Boolean(node.querySelector(LIST_SELECTOR));
    });
  });
}

function ownerFromMapForPlan(plan: ScopeFlightPlan, owners: Record<string, string | null | undefined>) {
  const exactOwners = new Set<string>();
  for (const key of planKeys(plan)) {
    const owner = normalizeOwner(owners[key]);
    if (owner) exactOwners.add(owner);
  }
  if (exactOwners.size === 1) return Array.from(exactOwners)[0];
  if (exactOwners.size > 1) return null;

  const suffixes = planSuffixes(plan);
  if (suffixes.size === 0) return null;
  const matchingKeys = Object.keys(owners).filter((key) => {
    const suffix = flightSuffix(key);
    return Boolean(suffix && suffixes.has(suffix) && normalizeOwner(owners[key]));
  });
  if (matchingKeys.length !== 1) return null;
  return normalizeOwner(owners[matchingKeys[0]]);
}

export default function ScopeSectorOwnershipVisuals({ initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const [position, setPosition] = useState("");
  const [optimisticOwners, setOptimisticOwners] = useState<Record<string, OptimisticOwner>>({});
  const [unplannedOwners, setUnplannedOwners] = useState<UnplannedOwners>({});

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

  const effectiveOwner = useCallback((plan: ScopeFlightPlan) => {
    return normalizeOwner(plan.assumed_by) ?? ownerFromMapForPlan(plan, unplannedOwners);
  }, [unplannedOwners]);

  const optimisticOwnerForPlan = useCallback((plan: ScopeFlightPlan, now: number) => {
    const active: Record<string, string | null | undefined> = {};
    for (const [key, value] of Object.entries(optimisticOwners)) {
      if (value.expiresAt > now) active[key] = value.owner;
    }
    return ownerFromMapForPlan(plan, active);
  }, [optimisticOwners]);

  const sync = useCallback(() => {
    const list = document.querySelector<HTMLElement>(LIST_SELECTOR);
    if (!list) return;

    const now = Date.now();
    const rows = Array.from(list.children)
      .slice(1)
      .filter((node): node is HTMLElement => node instanceof HTMLElement);

    for (const wrapper of rows) {
      const key = norm(rowCallsign(wrapper));
      if (!key) continue;
      const plan = planByKey.get(key);
      if (!plan) continue;

      const optimisticOwner = optimisticOwnerForPlan(plan, now);
      const owner = optimisticOwner ?? effectiveOwner(plan);
      const state = position && owner === position ? "mine" : owner ? "other" : "free";
      wrapper.dataset.pf24SectorOwnership = state;
    }
  }, [effectiveOwner, optimisticOwnerForPlan, planByKey, position]);

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
        [key]: {
          owner: normalizeOwner(detail?.owner),
          expiresAt: Date.now() + OPTIMISTIC_TTL_MS,
        },
      }));
    };

    const onUnplannedOwners = (event: Event) => {
      const owners = (event as CustomEvent<{ owners?: UnplannedOwners }>).detail?.owners ?? {};
      setUnplannedOwners(Object.fromEntries(
        Object.entries(owners)
          .map(([key, owner]) => [norm(key), normalizeOwner(owner) ?? ""] as const)
          .filter(([key, owner]) => Boolean(key && owner)),
      ));
    };

    const onOwnershipChange = () => {
      void loadPlans();
      window.setTimeout(() => void loadPlans(), 160);
    };

    window.addEventListener("pf24-scope-connection-change", onConnection);
    window.addEventListener("pf24-traffic-ownership-hint", onHint);
    window.addEventListener("pf24-traffic-ownership-change", onOwnershipChange);
    window.addEventListener(OWNERS_EVENT, onUnplannedOwners);
    window.dispatchEvent(new Event(OWNERS_REQUEST_EVENT));

    return () => {
      window.removeEventListener("pf24-scope-connection-change", onConnection);
      window.removeEventListener("pf24-traffic-ownership-hint", onHint);
      window.removeEventListener("pf24-traffic-ownership-change", onOwnershipChange);
      window.removeEventListener(OWNERS_EVENT, onUnplannedOwners);
    };
  }, [loadPlans]);

  useEffect(() => {
    setOptimisticOwners((current) => {
      const now = Date.now();
      const next = { ...current };
      let changed = false;
      for (const [key, optimistic] of Object.entries(current)) {
        if (optimistic.expiresAt <= now) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [plans, unplannedOwners]);

  useEffect(() => {
    const channel = supabase
      .channel("scope-sector-ownership-visuals-v4")
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, () => void loadPlans())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadPlans]);

  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24SectorOwnershipVisuals = "v4";
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
    const timer = window.setInterval(sync, 100);
    const observer = new MutationObserver((mutations) => {
      if (mutationTouchesSectorList(mutations)) sync();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      style.remove();
      window.clearInterval(timer);
      observer.disconnect();
    };
  }, [sync]);

  return null;
}
