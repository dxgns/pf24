"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getGameCallsignFromNotes, normalizeGameCallsign } from "@/lib/flightPlanGameCallsign";
import { supabase } from "@/lib/supabase";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = { initialPlans: ScopeFlightPlan[] };
type SeenPlan = { lastSeen: number; callsign: string };

const LIVE_ROOT = "[data-pf24-live-traffic='true']";
const CONNECTION_STORAGE_KEY = "pf24_scope_connection_session_v1";
const DISCONNECT_CONFIRM_MS = 20_000;
const POLL_MS = 500;

function norm(value: string) {
  return normalizeGameCallsign(value);
}

function scopeConnected() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(CONNECTION_STORAGE_KEY) ?? "null") as { callsign?: string } | null;
    if (stored?.callsign?.trim()) return true;
  } catch {}

  const row = document.querySelector<HTMLElement>("main.fixed header > div:first-child");
  return Array.from(row?.querySelectorAll<HTMLButtonElement>(":scope > button") ?? []).some(
    (button) => button.textContent?.trim().toUpperCase() === "DISCONNECT",
  );
}

function planKeys(plan: ScopeFlightPlan) {
  const keys = new Set<string>();
  const displayed = norm(plan.callsign);
  const game = norm(getGameCallsignFromNotes(plan.notes));
  if (displayed) keys.add(displayed);
  if (game) keys.add(game);
  return keys;
}

function trafficCallsign(label: HTMLElement) {
  const button = Array.from(label.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => {
    if (candidate.closest("[data-pf24-callsign-menu='true']")) return false;
    return /^[A-Z0-9-]{2,12}$/.test(candidate.textContent?.trim().toUpperCase() ?? "");
  });
  return norm(button?.textContent?.trim() ?? "");
}

export default function ScopeDisconnectedFlightPlanCleanup({ initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const connectedRef = useRef(false);
  const seenRef = useRef(new Map<string, SeenPlan>());
  const deletingRef = useRef(new Set<string>());

  const planByKey = useMemo(() => {
    const map = new Map<string, ScopeFlightPlan>();
    for (const plan of plans) {
      if (plan.status === "FINISHED") continue;
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
      console.error("PF24 disconnected traffic plan refresh failed:", error);
      return;
    }
    setPlans((data ?? []) as ScopeFlightPlan[]);
  }, []);

  useEffect(() => {
    connectedRef.current = scopeConnected();

    const onConnection = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean }>).detail;
      connectedRef.current = Boolean(detail?.connected);
      // A controller disconnect/reconnect is not a pilot disconnect. Require every
      // traffic to be observed again before it can become eligible for cleanup.
      seenRef.current.clear();
      deletingRef.current.clear();
    };

    window.addEventListener("pf24-scope-connection-change", onConnection);
    return () => window.removeEventListener("pf24-scope-connection-change", onConnection);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("scope-disconnected-flight-plan-cleanup-v1")
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, () => void loadPlans())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadPlans]);

  useEffect(() => {
    const validIds = new Set(plans.filter((plan) => plan.status !== "FINISHED").map((plan) => plan.id));
    for (const id of Array.from(seenRef.current.keys())) {
      if (!validIds.has(id)) seenRef.current.delete(id);
    }
    for (const id of Array.from(deletingRef.current)) {
      if (!validIds.has(id)) deletingRef.current.delete(id);
    }
  }, [plans]);

  useEffect(() => {
    const removePlan = async (planId: string, callsign: string) => {
      if (deletingRef.current.has(planId)) return;
      deletingRef.current.add(planId);

      try {
        const response = await fetch("/api/scope/disconnected-flight-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId, callsign }),
        });
        const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
        if (!response.ok || !payload?.ok) {
          console.error("PF24 disconnected traffic plan cleanup rejected:", payload?.error ?? response.statusText);
          deletingRef.current.delete(planId);
          return;
        }

        seenRef.current.delete(planId);
        setPlans((current) => current.filter((plan) => plan.id !== planId));

        try {
          const raw = JSON.parse(localStorage.getItem("pf24_scope_sector_controls_v1") ?? "{}") as Record<string, unknown>;
          if (raw && typeof raw === "object" && planId in raw) {
            delete raw[planId];
            localStorage.setItem("pf24_scope_sector_controls_v1", JSON.stringify(raw));
          }
        } catch {}
      } catch (error) {
        console.error("PF24 disconnected traffic plan cleanup failed:", error);
        deletingRef.current.delete(planId);
      }
    };

    const tick = () => {
      if (!connectedRef.current) return;
      const root = document.querySelector<HTMLElement>(LIVE_ROOT);
      if (!root) return;

      const now = Date.now();
      const presentPlanIds = new Set<string>();
      const labels = Array.from(root.querySelectorAll<HTMLElement>("[data-pf24-traffic-label='true']"));

      for (const label of labels) {
        const key = trafficCallsign(label);
        if (!key) continue;
        const plan = planByKey.get(key);
        if (!plan) continue;
        presentPlanIds.add(plan.id);
        seenRef.current.set(plan.id, { lastSeen: now, callsign: key });
        deletingRef.current.delete(plan.id);
      }

      for (const [planId, seen] of seenRef.current) {
        if (presentPlanIds.has(planId)) continue;
        if (now - seen.lastSeen < DISCONNECT_CONFIRM_MS) continue;
        void removePlan(planId, seen.callsign);
      }
    };

    tick();
    const timer = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(timer);
  }, [planByKey]);

  return null;
}
