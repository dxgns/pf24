"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getGameCallsignFromNotes, normalizeGameCallsign } from "@/lib/flightPlanGameCallsign";
import { normalizeAirlineCallsign } from "@/lib/scope/airlines";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type StoredConnection = { callsign?: string };
type Props = { initialPlans: ScopeFlightPlan[] };
type OwnershipHintDetail = { key?: string; owner?: string | null };
type OptimisticOwner = { owner: string | null; expiresAt: number };
type UnplannedOwners = Record<string, string>;

const CONNECTION_STORAGE_KEY = "pf24_scope_connection_session_v1";
const LIST_SELECTOR = "[data-pf24-live-sector-list='true']";
const OWNERS_EVENT = "pf24-unplanned-ownership-sync";
const OWNERS_REQUEST_EVENT = "pf24-unplanned-ownership-request";
const OPTIMISTIC_TTL_MS = 5000;

const FIR_AIRPORTS: Record<string, string[]> = {
  MDCS: ["MDPC", "MDST", "MDCR", "MDAB"],
  GCCC: ["GCLP"],
  LECB: ["LEMH"],
  LCCC: ["LCLK", "LCPH", "LCRA"],
  EGTT: ["EGKK", "EGHI"],
  EFIN: ["EFKT"],
  MTCA: ["MTCA"],
};

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
  const matches = Object.keys(owners).filter((key) => {
    const suffix = flightSuffix(key);
    return Boolean(suffix && suffixes.has(suffix) && normalizeOwner(owners[key]));
  });
  if (matches.length !== 1) return null;
  return normalizeOwner(owners[matches[0]]);
}

function readPosition() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(CONNECTION_STORAGE_KEY) ?? "null") as StoredConnection | null;
    return stored?.callsign?.trim().toUpperCase() ?? "";
  } catch {
    return "";
  }
}

function positionFir(position: string) {
  const upper = position.toUpperCase();
  const airport = upper.slice(0, 4);
  const isApproach = /(?:^|_)APP$/.test(upper) || upper.includes("_APP");
  const isCenter = /(?:^|_)CTR$/.test(upper) || upper.includes("_CTR");
  if (!isApproach && !isCenter) return null;

  if (isApproach) {
    return Object.entries(FIR_AIRPORTS).find(([, airports]) => airports.includes(airport))?.[0] ?? null;
  }

  return Object.keys(FIR_AIRPORTS).find((fir) => upper.startsWith(fir)) ?? null;
}

function visibleToPosition(plan: ScopeFlightPlan, position: string) {
  if (!position) return false;
  const fir = positionFir(position);
  if (fir) {
    const airports = FIR_AIRPORTS[fir] ?? [];
    return airports.includes(plan.departure_icao?.toUpperCase()) || airports.includes(plan.arrival_icao?.toUpperCase());
  }

  const airport = position.slice(0, 4).toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(airport)) return false;
  return plan.departure_icao?.toUpperCase() === airport || plan.arrival_icao?.toUpperCase() === airport;
}

function rowCallsign(row: HTMLElement) {
  const grid = row.firstElementChild instanceof HTMLElement ? row.firstElementChild : row;
  return grid.firstElementChild?.textContent?.trim().toUpperCase() ?? "";
}

export default function ScopeSectorListRules({ initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const [position, setPosition] = useState("");
  const [optimisticOwners, setOptimisticOwners] = useState<Record<string, OptimisticOwner>>({});
  const [unplannedOwners, setUnplannedOwners] = useState<UnplannedOwners>({});

  const plansByCallsign = useMemo(() => {
    const map = new Map<string, ScopeFlightPlan>();
    for (const plan of plans) {
      for (const key of planKeys(plan)) map.set(key, plan);
    }
    return map;
  }, [plans]);

  const loadPlans = useCallback(async () => {
    const { data, error } = await supabase.from("flight_plans").select("*").neq("status", "FINISHED");
    if (error) {
      console.error("PF24 Scope sector visibility refresh failed:", error);
      return;
    }
    setPlans((data ?? []) as ScopeFlightPlan[]);
  }, []);

  const effectiveOwner = useCallback((plan: ScopeFlightPlan, now: number) => {
    const persisted = normalizeOwner(plan.assumed_by);
    if (persisted) return persisted;

    const activeOptimistic: Record<string, string | null | undefined> = {};
    for (const [key, value] of Object.entries(optimisticOwners)) {
      if (value.expiresAt > now) activeOptimistic[key] = value.owner;
    }
    const optimistic = ownerFromMapForPlan(plan, activeOptimistic);
    if (optimistic) return optimistic;

    return ownerFromMapForPlan(plan, unplannedOwners);
  }, [optimisticOwners, unplannedOwners]);

  const applyRules = useCallback(() => {
    const list = document.querySelector<HTMLElement>(LIST_SELECTOR);
    if (!list) return;
    const rows = Array.from(list.children).slice(1).filter((node): node is HTMLElement => node instanceof HTMLElement);
    const now = Date.now();

    for (const row of rows) {
      const key = norm(rowCallsign(row));
      const plan = plansByCallsign.get(key);
      const visible = Boolean(plan && visibleToPosition(plan, position));
      row.style.display = visible ? "" : "none";
      if (!plan || !visible) continue;

      const owner = effectiveOwner(plan, now);
      const mine = Boolean(position && owner === position);

      row.dataset.pf24Editable = mine ? "true" : "false";
      row.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
        button.disabled = !mine;
        button.setAttribute("aria-disabled", mine ? "false" : "true");
        button.style.cursor = mine ? "pointer" : "default";
      });
    }
  }, [effectiveOwner, plansByCallsign, position]);

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
      .channel("scope-sector-list-rules-v3")
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, () => void loadPlans())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadPlans]);

  useEffect(() => {
    applyRules();
    const timer = window.setInterval(applyRules, 100);
    const onClickCapture = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>(`${LIST_SELECTOR} button`) : null;
      const row = button?.closest<HTMLElement>(`${LIST_SELECTOR} > div.relative`);
      if (!button || !row || row.dataset.pf24Editable === "true") return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    window.addEventListener("click", onClickCapture, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("click", onClickCapture, true);
    };
  }, [applyRules]);

  return null;
}
