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
type OwnerMatch = { matched: boolean; owner: string | null };

const CONNECTION_STORAGE_KEY = "pf24_scope_connection_session_v1";
const LIST_SELECTOR = "[data-pf24-live-sector-list='true']";
const OWNERSHIP_HINT_EVENT = "pf24-traffic-ownership-hint";
const OWNERSHIP_EVENT = "pf24-traffic-ownership-change";
const OPTIMISTIC_TTL_MS = 5000;

function norm(value: string | null | undefined) {
  return normalizeGameCallsign(String(value ?? ""));
}

function normalizeOwner(value: string | null | undefined) {
  return value?.trim().toUpperCase() || null;
}

function flightSuffix(value: string | null | undefined) {
  return norm(value).match(/(\d{1,4}[A-Z]?)$/)?.[1] ?? "";
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

function ownerMatchForPlan(plan: ScopeFlightPlan, owners: Record<string, string | null | undefined>): OwnerMatch {
  const exact: Array<string | null> = [];
  for (const key of planKeys(plan)) {
    if (Object.prototype.hasOwnProperty.call(owners, key)) exact.push(normalizeOwner(owners[key]));
  }
  if (exact.length > 0) {
    const unique = new Set(exact.map((owner) => owner ?? "__FREE__"));
    return unique.size === 1 ? { matched: true, owner: exact[0] } : { matched: false, owner: null };
  }

  const suffixes = planSuffixes(plan);
  const matches = Object.keys(owners).filter((key) => {
    const suffix = flightSuffix(key);
    return Boolean(suffix && suffixes.has(suffix));
  });
  if (matches.length !== 1) return { matched: false, owner: null };
  return { matched: true, owner: normalizeOwner(owners[matches[0]]) };
}

function readPosition() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CONNECTION_STORAGE_KEY) ?? "null") as StoredConnection | null;
    return parsed?.callsign?.trim().toUpperCase() ?? "";
  } catch {
    return "";
  }
}

function rowCallsign(wrapper: HTMLElement) {
  const row = wrapper.firstElementChild instanceof HTMLElement ? wrapper.firstElementChild : wrapper;
  return row.firstElementChild?.textContent?.trim().toUpperCase() ?? "";
}

export default function ScopeSectorOwnershipVisuals({ initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const [position, setPosition] = useState("");
  const [optimisticOwners, setOptimisticOwners] = useState<Record<string, OptimisticOwner>>({});

  const planByKey = useMemo(() => {
    const map = new Map<string, ScopeFlightPlan>();
    for (const plan of plans) for (const key of planKeys(plan)) map.set(key, plan);
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

  const optimisticOwnerForPlan = useCallback((plan: ScopeFlightPlan, now: number) => {
    const active: Record<string, string | null | undefined> = {};
    for (const [key, value] of Object.entries(optimisticOwners)) {
      if (value.expiresAt > now) active[key] = value.owner;
    }
    return ownerMatchForPlan(plan, active);
  }, [optimisticOwners]);

  const sync = useCallback(() => {
    const list = document.querySelector<HTMLElement>(LIST_SELECTOR);
    if (!list) return;

    const now = Date.now();
    const rows = Array.from(list.children).slice(1).filter((node): node is HTMLElement => node instanceof HTMLElement);
    for (const wrapper of rows) {
      const key = norm(rowCallsign(wrapper));
      const plan = key ? planByKey.get(key) : undefined;
      if (!plan) continue;

      const optimistic = optimisticOwnerForPlan(plan, now);
      const owner = optimistic.matched ? optimistic.owner : normalizeOwner(plan.assumed_by);
      const ownership = position && owner === position ? "mine" : owner ? "other" : "free";
      if (wrapper.dataset.pf24SectorOwnership !== ownership) wrapper.dataset.pf24SectorOwnership = ownership;
    }
  }, [optimisticOwnerForPlan, planByKey, position]);

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
    };

    const onOwnershipChange = () => {
      void loadPlans();
      window.setTimeout(() => void loadPlans(), 160);
    };

    window.addEventListener("pf24-scope-connection-change", onConnection);
    window.addEventListener(OWNERSHIP_HINT_EVENT, onHint);
    window.addEventListener(OWNERSHIP_EVENT, onOwnershipChange);
    return () => {
      window.removeEventListener("pf24-scope-connection-change", onConnection);
      window.removeEventListener(OWNERSHIP_HINT_EVENT, onHint);
      window.removeEventListener(OWNERSHIP_EVENT, onOwnershipChange);
    };
  }, [loadPlans]);

  useEffect(() => {
    const expiries = Object.values(optimisticOwners).map((value) => value.expiresAt);
    if (expiries.length === 0) return;

    const delay = Math.max(0, Math.min(...expiries) - Date.now() + 20);
    const cleanup = window.setTimeout(() => {
      setOptimisticOwners((current) => {
        const now = Date.now();
        const next = Object.fromEntries(Object.entries(current).filter(([, value]) => value.expiresAt > now));
        return Object.keys(next).length === Object.keys(current).length ? current : next;
      });
    }, delay);
    return () => window.clearTimeout(cleanup);
  }, [optimisticOwners]);

  useEffect(() => {
    const channel = supabase
      .channel("scope-sector-ownership-visuals-v6")
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, () => void loadPlans())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadPlans]);

  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24SectorOwnershipVisuals = "v6";
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

    let frame = 0;
    let list: HTMLElement | null = null;
    let listObserver: MutationObserver | null = null;

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        sync();
      });
    };

    const bindList = () => {
      const next = document.querySelector<HTMLElement>(LIST_SELECTOR);
      if (next === list) return;

      listObserver?.disconnect();
      listObserver = null;
      list = next;
      if (!next) return;

      listObserver = new MutationObserver(schedule);
      listObserver.observe(next, { childList: true, subtree: true, characterData: true });
      schedule();
    };

    bindList();
    const main = document.querySelector<HTMLElement>("main.fixed");
    const hostObserver = main ? new MutationObserver(bindList) : null;
    hostObserver?.observe(main!, { childList: true, subtree: true });
    schedule();

    return () => {
      style.remove();
      if (frame) window.cancelAnimationFrame(frame);
      hostObserver?.disconnect();
      listObserver?.disconnect();
    };
  }, [sync]);

  return null;
}
