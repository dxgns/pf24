"use client";

import { useCallback, useEffect, useRef } from "react";
import { getGameCallsignFromNotes, normalizeGameCallsign } from "@/lib/flightPlanGameCallsign";
import { normalizeAirlineCallsign } from "@/lib/scope/airlines";
import { supabase } from "@/lib/supabase";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = { initialPlans: ScopeFlightPlan[] };
type StoredConnection = { callsign?: string };
type ClaimTimes = Record<string, number>;
type OwnershipHintDetail = {
  key?: string;
  owner?: string | null;
  previousOwner?: string | null;
};

const CONNECTION_STORAGE_KEY = "pf24_scope_connection_session_v1";
const CLAIMS_STORAGE_KEY = "pf24_scope_unplanned_claims_v4";
const OWNERSHIP_HINT_EVENT = "pf24-traffic-ownership-hint";
const OWNERSHIP_EVENT = "pf24-traffic-ownership-change";
const CLAIM_PROMOTION_MAX_AGE_MS = 10 * 60 * 1000;

function norm(value: string | null | undefined) {
  return normalizeGameCallsign(String(value ?? ""));
}

function normalizeOwner(value: string | null | undefined) {
  return value?.trim().toUpperCase() || "";
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

  // Project Flight sometimes exposes the airline name instead of the ICAO
  // prefix (for example LANCHILE1900 while the filed plan is LAN1900).
  const lanChile = basic.match(/^LAN(?:CHILE|CHILEAIRLINES)(\d{1,4}[A-Z]?)$/);
  if (lanChile) variants.add(`LAN${lanChile[1]}`);
  return Array.from(variants);
}

function planKeys(plan: ScopeFlightPlan) {
  const keys = new Set<string>();
  for (const value of [plan.callsign, getGameCallsignFromNotes(plan.notes)]) {
    for (const key of callsignVariants(value)) keys.add(key);
  }
  return Array.from(keys);
}

function planSuffixes(plan: ScopeFlightPlan) {
  const suffixes = new Set<string>();
  for (const value of [plan.callsign, getGameCallsignFromNotes(plan.notes)]) {
    const suffix = flightSuffix(value);
    if (suffix) suffixes.add(suffix);
  }
  return suffixes;
}

function planMatchesTrafficKey(plan: ScopeFlightPlan, rawKey: string) {
  const key = norm(rawKey);
  if (!key) return false;
  if (planKeys(plan).includes(key)) return true;
  const suffix = flightSuffix(key);
  return Boolean(suffix && planSuffixes(plan).has(suffix));
}

function matchingPlans(plans: ScopeFlightPlan[], rawKey: string) {
  const key = norm(rawKey);
  if (!key) return [];
  const exact = plans.filter((plan) => planKeys(plan).includes(key));
  if (exact.length > 0) return exact;
  return plans.filter((plan) => planMatchesTrafficKey(plan, key));
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
        .map(([key, value]) => [norm(key), Number(value)] as const)
        .filter(([key, value]) => Boolean(key) && Number.isFinite(value)),
    );
  } catch {
    return {};
  }
}

function hasRecentExplicitClaim(plan: ScopeFlightPlan) {
  const claims = readClaims();
  const now = Date.now();
  const recent = Object.fromEntries(
    Object.entries(claims).filter(([, claimedAt]) =>
      Number.isFinite(claimedAt) && claimedAt <= now && now - claimedAt <= CLAIM_PROMOTION_MAX_AGE_MS,
    ),
  );

  if (planKeys(plan).some((key) => Object.prototype.hasOwnProperty.call(recent, key))) return true;

  const suffixes = planSuffixes(plan);
  if (suffixes.size === 0) return false;
  const suffixMatches = Object.keys(recent).filter((key) => {
    const suffix = flightSuffix(key);
    return Boolean(suffix && suffixes.has(suffix));
  });

  // The fallback is deliberately unique so two flights using the same number
  // can never acquire ownership from one another.
  return suffixMatches.length === 1;
}

export default function ScopeUnplannedPlanOwnershipBridge(_props: Props) {
  const assumingRef = useRef(new Set<string>());
  const releasingRef = useRef(new Set<string>());

  const loadActivePlans = useCallback(async () => {
    const { data, error } = await supabase
      .from("flight_plans")
      .select("*")
      .neq("status", "FINISHED");
    if (error) return { plans: [] as ScopeFlightPlan[], error };
    return { plans: (data ?? []) as ScopeFlightPlan[], error: null };
  }, []);

  const persistAssumeForTrafficKey = useCallback(async (rawKey: string, rawOwner: string) => {
    const key = norm(rawKey);
    const owner = normalizeOwner(rawOwner);
    if (!key || !owner || assumingRef.current.has(key)) return;

    assumingRef.current.add(key);
    try {
      const { plans, error } = await loadActivePlans();
      if (error) {
        console.error("PF24 Scope explicit ASSUME lookup failed:", error);
        return;
      }

      const candidates = matchingPlans(plans, key);
      if (candidates.length !== 1) return;
      const plan = candidates[0];
      const currentOwner = normalizeOwner(plan.assumed_by);
      if (currentOwner === owner || (currentOwner && currentOwner !== owner)) return;

      const { data, error: assumeError } = await supabase
        .from("flight_plans")
        .update({ assumed_by: owner, updated_at: new Date().toISOString() })
        .eq("id", plan.id)
        .is("assumed_by", null)
        .select("id,assumed_by")
        .maybeSingle();

      if (assumeError) {
        console.error("PF24 Scope explicit aliased ASSUME failed:", assumeError);
        return;
      }

      if (normalizeOwner(data?.assumed_by) === owner) {
        window.dispatchEvent(new Event(OWNERSHIP_EVENT));
      }
    } finally {
      assumingRef.current.delete(key);
    }
  }, [loadActivePlans]);

  const persistReleaseForTrafficKey = useCallback(async (rawKey: string, rawPreviousOwner: string) => {
    const key = norm(rawKey);
    const previousOwner = normalizeOwner(rawPreviousOwner);
    if (!key || !previousOwner || releasingRef.current.has(key)) return;

    releasingRef.current.add(key);
    try {
      const { plans, error } = await loadActivePlans();
      if (error) {
        console.error("PF24 Scope explicit FREE lookup failed:", error);
        return;
      }

      const candidates = matchingPlans(plans, key);
      if (candidates.length !== 1) return;
      const plan = candidates[0];
      if (normalizeOwner(plan.assumed_by) !== previousOwner) return;

      const { data, error: releaseError } = await supabase
        .from("flight_plans")
        .update({ assumed_by: null, updated_at: new Date().toISOString() })
        .eq("id", plan.id)
        .eq("assumed_by", previousOwner)
        .select("id,assumed_by")
        .maybeSingle();

      if (releaseError) {
        console.error("PF24 Scope explicit aliased FREE failed:", releaseError);
        return;
      }

      if (data && data.assumed_by === null) {
        window.dispatchEvent(new Event(OWNERSHIP_EVENT));
      }
    } finally {
      releasingRef.current.delete(key);
    }
  }, [loadActivePlans]);

  const promoteInsertedPlan = useCallback(async (plan: ScopeFlightPlan) => {
    if (!plan?.id || plan.status === "FINISHED" || normalizeOwner(plan.assumed_by)) return;

    // A newly created plan inherits an unplanned ASSUME only from this tab's
    // recent explicit ASSUME claim. Presence snapshots by themselves are never
    // enough to write assumed_by.
    const owner = readPosition();
    if (!owner || !hasRecentExplicitClaim(plan)) return;

    const { data, error } = await supabase
      .from("flight_plans")
      .update({ assumed_by: owner, updated_at: new Date().toISOString() })
      .eq("id", plan.id)
      .is("assumed_by", null)
      .select("id,assumed_by")
      .maybeSingle();

    if (error) {
      console.error("PF24 Scope new-plan ownership promotion failed:", error);
      return;
    }

    if (normalizeOwner(data?.assumed_by) === owner) {
      window.dispatchEvent(new Event(OWNERSHIP_EVENT));
    }
  }, []);

  useEffect(() => {
    const onHint = (event: Event) => {
      const detail = (event as CustomEvent<OwnershipHintDetail>).detail;
      const key = norm(detail?.key ?? "");
      if (!key || !detail) return;

      const owner = normalizeOwner(detail.owner);
      const hasPreviousOwner = Object.prototype.hasOwnProperty.call(detail, "previousOwner");
      const previousOwner = normalizeOwner(detail.previousOwner);

      if (!owner) {
        // FREE must identify the controller that owned the traffic. A generic
        // visual "free" hint can therefore never mutate persistent ownership.
        if (hasPreviousOwner && previousOwner) {
          void persistReleaseForTrafficKey(key, previousOwner);
        }
        return;
      }

      // Only a real free -> owned transition produced by an explicit ASSUME is
      // allowed to persist an aliased plan. Replayed Presence/visual hints and
      // bridge refreshes do not satisfy this condition.
      const here = readPosition();
      if (hasPreviousOwner && !previousOwner && here && owner === here) {
        void persistAssumeForTrafficKey(key, owner);
      }
    };

    window.addEventListener(OWNERSHIP_HINT_EVENT, onHint);

    const channel = supabase
      .channel("scope-unplanned-plan-ownership-bridge-v7")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "flight_plans" },
        (payload) => {
          const next = payload.new as ScopeFlightPlan | undefined;
          if (next?.id) void promoteInsertedPlan(next);
        },
      )
      .subscribe();

    return () => {
      window.removeEventListener(OWNERSHIP_HINT_EVENT, onHint);
      void supabase.removeChannel(channel);
    };
  }, [persistAssumeForTrafficKey, persistReleaseForTrafficKey, promoteInsertedPlan]);

  return null;
}
