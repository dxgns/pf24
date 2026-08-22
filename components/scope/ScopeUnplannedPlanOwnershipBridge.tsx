"use client";

import { useEffect, useRef } from "react";
import { getGameCallsignFromNotes, normalizeGameCallsign } from "@/lib/flightPlanGameCallsign";
import { supabase } from "@/lib/supabase";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = { initialPlans: ScopeFlightPlan[] };
type StoredConnection = { callsign?: string };
type ClaimTimes = Record<string, number>;

const CONNECTION_STORAGE_KEY = "pf24_scope_connection_session_v1";
const CLAIMS_STORAGE_KEY = "pf24_scope_unplanned_claims_v4";
const OWNERSHIP_HINT_EVENT = "pf24-traffic-ownership-hint";
const OWNERSHIP_EVENT = "pf24-traffic-ownership-change";

function norm(value: string) {
  return normalizeGameCallsign(value);
}

function readPosition() {
  try {
    const value = JSON.parse(sessionStorage.getItem(CONNECTION_STORAGE_KEY) ?? "null") as StoredConnection | null;
    return value?.callsign?.trim().toUpperCase() ?? "";
  } catch {
    return "";
  }
}

function readClaims(): ClaimTimes {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CLAIMS_STORAGE_KEY) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, value]) => Number.isFinite(Number(value)))
        .map(([key, value]) => [norm(key), Number(value)]),
    );
  } catch {
    return {};
  }
}

function planKeys(plan: ScopeFlightPlan) {
  const keys = new Set<string>();
  const planCallsign = norm(plan.callsign);
  const gameCallsign = norm(getGameCallsignFromNotes(plan.notes));
  if (planCallsign) keys.add(planCallsign);
  if (gameCallsign) keys.add(gameCallsign);
  return Array.from(keys);
}

function publishHint(keys: string[], owner: string) {
  for (const key of keys) {
    window.dispatchEvent(new CustomEvent(OWNERSHIP_HINT_EVENT, {
      detail: { key, owner, previousOwner: owner },
    }));
  }
  window.dispatchEvent(new Event(OWNERSHIP_EVENT));
}

export default function ScopeUnplannedPlanOwnershipBridge({ initialPlans }: Props) {
  const migratingRef = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;

    const migrate = async (plan: ScopeFlightPlan) => {
      if (!plan?.id || plan.status === "FINISHED" || plan.assumed_by?.trim()) return;
      if (migratingRef.current.has(plan.id)) return;

      const owner = readPosition();
      if (!owner) return;

      // The unplanned ownership component removes these claims as soon as it
      // notices that a flight plan now exists. Snapshot them immediately from
      // sessionStorage so the ownership can be promoted to flight_plans first.
      const claims = readClaims();
      const matchingKeys = planKeys(plan).filter((key) => Number.isFinite(claims[key]));
      if (matchingKeys.length === 0) return;

      migratingRef.current.add(plan.id);
      publishHint(matchingKeys, owner);

      const { data, error } = await supabase
        .from("flight_plans")
        .update({ assumed_by: owner })
        .eq("id", plan.id)
        .is("assumed_by", null)
        .select("id,assumed_by")
        .maybeSingle();

      migratingRef.current.delete(plan.id);
      if (cancelled) return;

      if (error) {
        console.error("PF24 Scope unplanned ownership promotion failed:", error);
        return;
      }

      if (data?.assumed_by) {
        publishHint(matchingKeys, data.assumed_by.trim().toUpperCase());
        return;
      }

      // If the conditional update matched no row, another controller may have
      // acquired the plan in the same instant. Read the final owner and publish
      // that value rather than overwriting it.
      const { data: current, error: lookupError } = await supabase
        .from("flight_plans")
        .select("assumed_by")
        .eq("id", plan.id)
        .maybeSingle();

      if (lookupError) {
        console.error("PF24 Scope ownership promotion verification failed:", lookupError);
        return;
      }

      const finalOwner = current?.assumed_by?.trim().toUpperCase() ?? "";
      if (finalOwner) publishHint(matchingKeys, finalOwner);
    };

    // Handles a reload that occurs immediately after the pilot files the plan.
    for (const plan of initialPlans) void migrate(plan);

    const channel = supabase
      .channel("scope-unplanned-plan-ownership-bridge-v1")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "flight_plans" },
        (payload) => void migrate(payload.new as ScopeFlightPlan),
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [initialPlans]);

  return null;
}
