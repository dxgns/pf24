"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeGameCallsign } from "@/lib/flightPlanGameCallsign";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type StoredConnection = { callsign?: string };
type Props = { initialPlans: ScopeFlightPlan[] };

const CONNECTION_STORAGE_KEY = "pf24_scope_connection_session_v1";
const LIST_SELECTOR = "[data-pf24-live-sector-list='true']";

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

  const plansByCallsign = useMemo(() => {
    const map = new Map<string, ScopeFlightPlan>();
    for (const plan of plans) map.set(norm(plan.callsign), plan);
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

  const applyRules = useCallback(() => {
    const list = document.querySelector<HTMLElement>(LIST_SELECTOR);
    if (!list) return;
    const rows = Array.from(list.children).slice(1).filter((node): node is HTMLElement => node instanceof HTMLElement);

    for (const row of rows) {
      const callsign = rowCallsign(row);
      const plan = plansByCallsign.get(norm(callsign));
      const visible = Boolean(plan && visibleToPosition(plan, position));
      row.style.display = visible ? "" : "none";
      if (!plan || !visible) continue;

      const mine = Boolean(position && plan.assumed_by?.trim().toUpperCase() === position);
      row.dataset.pf24Editable = mine ? "true" : "false";
      row.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
        button.disabled = !mine;
        button.setAttribute("aria-disabled", mine ? "false" : "true");
        button.style.cursor = mine ? "pointer" : "default";
      });
    }
  }, [plansByCallsign, position]);

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
      .channel("scope-sector-list-rules")
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, () => void loadPlans())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadPlans]);

  useEffect(() => {
    applyRules();
    const timer = window.setInterval(applyRules, 250);
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
