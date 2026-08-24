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
type OwnerMatch = { matched: boolean; owner: string | null };

const CONNECTION_STORAGE_KEY = "pf24_scope_connection_session_v1";
const LIST_SELECTOR = "[data-pf24-live-sector-list='true']";
const OWNERSHIP_HINT_EVENT = "pf24-traffic-ownership-hint";
const OWNERSHIP_EVENT = "pf24-traffic-ownership-change";
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

  const plansByCallsign = useMemo(() => {
    const map = new Map<string, ScopeFlightPlan>();
    for (const plan of plans) for (const key of planKeys(plan)) map.set(key, plan);
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
    const activeOptimistic: Record<string, string | null | undefined> = {};
    for (const [key, value] of Object.entries(optimisticOwners)) {
      if (value.expiresAt > now) activeOptimistic[key] = value.owner;
    }
    const optimistic = ownerMatchForPlan(plan, activeOptimistic);
    return optimistic.matched ? optimistic.owner : normalizeOwner(plan.assumed_by);
  }, [optimisticOwners]);

  const applyRules = useCallback(() => {
    const list = document.querySelector<HTMLElement>(LIST_SELECTOR);
    if (!list) return;
    const rows = Array.from(list.children).slice(1).filter((node): node is HTMLElement => node instanceof HTMLElement);
    const now = Date.now();

    for (const row of rows) {
      const key = norm(rowCallsign(row));
      const plan = key ? plansByCallsign.get(key) : undefined;
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
    const cleanup = window.setInterval(() => {
      setOptimisticOwners((current) => {
        const now = Date.now();
        const next = Object.fromEntries(Object.entries(current).filter(([, value]) => value.expiresAt > now));
        return Object.keys(next).length === Object.keys(current).length ? current : next;
      });
    }, 500);
    return () => window.clearInterval(cleanup);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("scope-sector-list-rules-v5")
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
