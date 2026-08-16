"use client";

import { useEffect, useMemo, useState } from "react";
import { getGameCallsignFromNotes, normalizeGameCallsign } from "@/lib/flightPlanGameCallsign";
import { supabase } from "@/lib/supabase";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = { initialPlans: ScopeFlightPlan[] };
type HoldEntry = { held?: boolean; version?: number };
type HoldState = Record<string, HoldEntry>;

const HOLD_STATE_KEY = "pf24_scope_hold_state_v1";
const HOLD_SYNC_EVENT = "pf24-hold-sync";
const HOLD_LOCAL_EVENT = "pf24-hold-local-change";
const PREFIX = "traffic:";

function norm(value: string) { return normalizeGameCallsign(value); }
function readState(): HoldState {
  try {
    const parsed = JSON.parse(localStorage.getItem(HOLD_STATE_KEY) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as HoldState : {};
  } catch { return {}; }
}
function labelCallsign(label: HTMLElement) {
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

export default function ScopeUnplannedHold({ initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const plannedKeys = useMemo(() => {
    const set = new Set<string>();
    plans.forEach((plan) => planKeys(plan).forEach((key) => set.add(key)));
    return set;
  }, [plans]);

  useEffect(() => {
    const channel = supabase.channel("scope-unplanned-hold-plans").on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, async () => {
      const { data } = await supabase.from("flight_plans").select("*").neq("status", "FINISHED");
      if (data) setPlans(data as ScopeFlightPlan[]);
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const sync = () => {
      const state = readState();
      const labels = Array.from(document.querySelectorAll<HTMLElement>("[data-pf24-traffic-label='true']"));
      const liveByKey = new Map<string, string>();
      labels.forEach((label) => {
        const callsign = labelCallsign(label);
        const key = norm(callsign);
        if (key) liveByKey.set(key, callsign);
      });

      document.querySelectorAll<HTMLElement>("[data-pf24-callsign-menu='true']").forEach((menu) => {
        const label = menu.closest<HTMLElement>("[data-pf24-traffic-label='true']");
        if (!label) return;
        const key = norm(labelCallsign(label));
        if (!key || plannedKeys.has(key)) return;
        const button = Array.from(menu.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => ["HOLD", "XHOLD"].includes(candidate.textContent?.trim().toUpperCase() ?? ""));
        if (button) button.textContent = state[`${PREFIX}${key}`]?.held ? "XHOLD" : "HOLD";
      });

      const hold = document.querySelector<HTMLElement>("[data-pf24-live-hold-list='true']");
      const body = hold ? Array.from(hold.children).find((child) => child instanceof HTMLElement && child.classList.contains("min-h-[78px]")) as HTMLElement | undefined : undefined;
      if (!body) return;
      body.querySelectorAll("[data-pf24-unplanned-hold-row='true']").forEach((row) => row.remove());
      Object.entries(state).forEach(([id, entry]) => {
        if (!id.startsWith(PREFIX) || !entry?.held) return;
        const key = id.slice(PREFIX.length);
        if (plannedKeys.has(key)) return;
        const callsign = liveByKey.get(key) ?? key;
        const row = document.createElement("div");
        row.dataset.pf24UnplannedHoldRow = "true";
        row.className = "grid w-full min-w-0 grid-cols-[28px_minmax(0,1fr)_34px_34px] box-border";
        row.innerHTML = `<span class="min-w-0 border-r border-[#ededed]"></span><span class="min-w-0 truncate px-[3px]">${callsign}</span><span class="min-w-0 truncate text-center">---</span><span class="min-w-0 truncate text-center">000</span>`;
        body.appendChild(row);
      });
    };

    const onClick = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      const menu = button?.closest<HTMLElement>("[data-pf24-callsign-menu='true']");
      const label = menu?.closest<HTMLElement>("[data-pf24-traffic-label='true']");
      if (!button || !menu || !label) return;
      const action = button.textContent?.trim().toUpperCase() ?? "";
      if (action !== "HOLD" && action !== "XHOLD") return;
      const key = norm(labelCallsign(label));
      if (!key || plannedKeys.has(key)) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent(HOLD_LOCAL_EVENT, { detail: { planId: `${PREFIX}${key}`, held: action === "HOLD" } }));
      window.setTimeout(sync, 0);
    };

    sync();
    const timer = window.setInterval(sync, 250);
    window.addEventListener(HOLD_SYNC_EVENT, sync);
    document.addEventListener("click", onClick, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(HOLD_SYNC_EVENT, sync);
      document.removeEventListener("click", onClick, true);
    };
  }, [plannedKeys]);

  return null;
}
