"use client";

import { useCallback, useEffect, useRef } from "react";
import { getGameCallsignFromNotes, normalizeGameCallsign } from "@/lib/flightPlanGameCallsign";
import { normalizeAirlineCallsign } from "@/lib/scope/airlines";
import { supabase } from "@/lib/supabase";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = { initialPlans: ScopeFlightPlan[] };
type StoredConnection = { callsign?: string };
type ClaimTimes = Record<string, number>;
type Owners = Record<string, string>;
type OwnershipHintDetail = { key?: string; owner?: string | null };
type RecentOwner = { owner: string; expiresAt: number };

const CONNECTION_STORAGE_KEY = "pf24_scope_connection_session_v1";
const CLAIMS_STORAGE_KEY = "pf24_scope_unplanned_claims_v4";
const OWNERS_EVENT = "pf24-unplanned-ownership-sync";
const OWNERS_REQUEST_EVENT = "pf24-unplanned-ownership-request";
const OWNERSHIP_HINT_EVENT = "pf24-traffic-ownership-hint";
const OWNERSHIP_EVENT = "pf24-traffic-ownership-change";
const OWNER_GRACE_MS = 5000;
const RELEASE_GUARD_MS = 12_000;

function norm(value: string) {
  return normalizeGameCallsign(value);
}

function normalizeOwner(value: string | null | undefined) {
  return value?.trim().toUpperCase() || "";
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

function suffixMatches(plan: ScopeFlightPlan, candidateKeys: string[]) {
  const suffixes = planSuffixes(plan);
  if (suffixes.size === 0) return [];
  return candidateKeys.filter((key) => {
    const suffix = flightSuffix(key);
    return Boolean(suffix && suffixes.has(suffix));
  });
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
  const ownersRef = useRef<Owners>({});
  const recentOwnersRef = useRef(new Map<string, RecentOwner>());
  const releasedKeysRef = useRef(new Map<string, number>());
  const releasedSuffixesRef = useRef(new Map<string, number>());

  const pruneReleaseGuards = useCallback(() => {
    const now = Date.now();
    for (const [key, expiresAt] of releasedKeysRef.current) {
      if (expiresAt <= now) releasedKeysRef.current.delete(key);
    }
    for (const [suffix, expiresAt] of releasedSuffixesRef.current) {
      if (expiresAt <= now) releasedSuffixesRef.current.delete(suffix);
    }
  }, []);

  const guardRelease = useCallback((key: string) => {
    if (!key) return;
    const expiresAt = Date.now() + RELEASE_GUARD_MS;
    releasedKeysRef.current.set(key, expiresAt);
    const suffix = flightSuffix(key);
    if (suffix) releasedSuffixesRef.current.set(suffix, expiresAt);

    recentOwnersRef.current.delete(key);
    for (const recentKey of Array.from(recentOwnersRef.current.keys())) {
      if (suffix && flightSuffix(recentKey) === suffix) recentOwnersRef.current.delete(recentKey);
    }
  }, []);

  const clearReleaseGuard = useCallback((key: string) => {
    if (!key) return;
    releasedKeysRef.current.delete(key);
    const suffix = flightSuffix(key);
    if (suffix) releasedSuffixesRef.current.delete(suffix);
  }, []);

  const planIsReleaseGuarded = useCallback((plan: ScopeFlightPlan) => {
    pruneReleaseGuards();
    const now = Date.now();
    if (planKeys(plan).some((key) => (releasedKeysRef.current.get(key) ?? 0) > now)) return true;
    return Array.from(planSuffixes(plan)).some((suffix) => (releasedSuffixesRef.current.get(suffix) ?? 0) > now);
  }, [pruneReleaseGuards]);

  const rememberOwners = useCallback((owners: Owners) => {
    const now = Date.now();
    pruneReleaseGuards();
    ownersRef.current = Object.fromEntries(
      Object.entries(owners)
        .map(([key, owner]) => [norm(key), normalizeOwner(owner)] as const)
        .filter(([key, owner]) => Boolean(key && owner)),
    );

    for (const [key, owner] of Object.entries(ownersRef.current)) {
      const suffix = flightSuffix(key);
      const keyGuarded = (releasedKeysRef.current.get(key) ?? 0) > now;
      const suffixGuarded = Boolean(suffix && (releasedSuffixesRef.current.get(suffix) ?? 0) > now);
      if (keyGuarded || suffixGuarded) continue;
      recentOwnersRef.current.set(key, { owner, expiresAt: now + OWNER_GRACE_MS });
    }
    for (const [key, recent] of recentOwnersRef.current) {
      if (recent.expiresAt <= now) recentOwnersRef.current.delete(key);
    }
  }, [pruneReleaseGuards]);

  const ownerForPlan = useCallback((plan: ScopeFlightPlan) => {
    if (planIsReleaseGuarded(plan)) return "";

    const keys = planKeys(plan);
    const owners = new Set<string>();
    const now = Date.now();

    for (const key of keys) {
      const liveOwner = normalizeOwner(ownersRef.current[key]);
      if (liveOwner) owners.add(liveOwner);
      const recent = recentOwnersRef.current.get(key);
      if (recent && recent.expiresAt > now) owners.add(recent.owner);
    }

    // Project Flight may expose an airline-name callsign (LANCHILE1900) while
    // the filed plan uses LAN1900. Only use the suffix when the match is unique.
    if (owners.size === 0) {
      const liveMatches = suffixMatches(plan, Object.keys(ownersRef.current));
      if (liveMatches.length === 1) {
        const owner = normalizeOwner(ownersRef.current[liveMatches[0]]);
        if (owner) owners.add(owner);
      }

      const recentKeys = Array.from(recentOwnersRef.current.entries())
        .filter(([, recent]) => recent.expiresAt > now)
        .map(([key]) => key);
      const recentMatches = suffixMatches(plan, recentKeys);
      if (recentMatches.length === 1) {
        const owner = recentOwnersRef.current.get(recentMatches[0])?.owner ?? "";
        if (owner) owners.add(owner);
      }
    }

    // Local storage covers the exact instant in which an unplanned claim is
    // converted into a newly filed plan.
    const localOwner = readPosition();
    if (localOwner) {
      const claims = readClaims();
      if (keys.some((key) => Number.isFinite(claims[key]))) {
        owners.add(localOwner);
      } else if (owners.size === 0) {
        const claimMatches = suffixMatches(plan, Object.keys(claims));
        if (claimMatches.length === 1 && Number.isFinite(claims[claimMatches[0]])) owners.add(localOwner);
      }
    }

    return owners.size === 1 ? Array.from(owners)[0] : "";
  }, [planIsReleaseGuarded]);

  const migrate = useCallback(async (plan: ScopeFlightPlan) => {
    if (!plan?.id || plan.status === "FINISHED" || plan.assumed_by?.trim()) return;
    if (migratingRef.current.has(plan.id) || planIsReleaseGuarded(plan)) return;

    const keys = planKeys(plan);
    if (keys.length === 0) return;
    const owner = ownerForPlan(plan);
    if (!owner) return;

    migratingRef.current.add(plan.id);
    publishHint(keys, owner);

    const { data, error } = await supabase
      .from("flight_plans")
      .update({ assumed_by: owner, updated_at: new Date().toISOString() })
      .eq("id", plan.id)
      .is("assumed_by", null)
      .select("id,assumed_by")
      .maybeSingle();

    migratingRef.current.delete(plan.id);

    if (error) {
      console.error("PF24 Scope unplanned ownership promotion failed:", error);
      return;
    }

    if (data?.assumed_by) {
      publishHint(keys, normalizeOwner(data.assumed_by));
      return;
    }

    const { data: current, error: lookupError } = await supabase
      .from("flight_plans")
      .select("assumed_by")
      .eq("id", plan.id)
      .maybeSingle();

    if (lookupError) {
      console.error("PF24 Scope ownership promotion verification failed:", lookupError);
      return;
    }

    const finalOwner = normalizeOwner(current?.assumed_by);
    if (finalOwner) publishHint(keys, finalOwner);
  }, [ownerForPlan, planIsReleaseGuarded]);

  const reconcilePlans = useCallback(async () => {
    const { data, error } = await supabase
      .from("flight_plans")
      .select("*")
      .neq("status", "FINISHED")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("PF24 Scope ownership bridge refresh failed:", error);
      return;
    }

    for (const plan of (data ?? []) as ScopeFlightPlan[]) void migrate(plan);
  }, [migrate]);

  useEffect(() => {
    let cancelled = false;

    const onOwners = (event: Event) => {
      const owners = (event as CustomEvent<{ owners?: Owners }>).detail?.owners ?? {};
      rememberOwners(owners);
      if (!cancelled) void reconcilePlans();
    };

    const onHint = (event: Event) => {
      const detail = (event as CustomEvent<OwnershipHintDetail>).detail;
      const key = norm(detail?.key ?? "");
      if (!key) return;
      const owner = normalizeOwner(detail?.owner);
      if (!owner) {
        guardRelease(key);
        return;
      }
      clearReleaseGuard(key);
      recentOwnersRef.current.set(key, { owner, expiresAt: Date.now() + OWNER_GRACE_MS });
    };

    window.addEventListener(OWNERS_EVENT, onOwners);
    window.addEventListener(OWNERSHIP_HINT_EVENT, onHint);

    window.dispatchEvent(new Event(OWNERS_REQUEST_EVENT));
    for (const plan of initialPlans) void migrate(plan);
    const first = window.setTimeout(() => void reconcilePlans(), 80);
    const second = window.setTimeout(() => {
      window.dispatchEvent(new Event(OWNERS_REQUEST_EVENT));
      void reconcilePlans();
    }, 350);

    const channel = supabase
      .channel("scope-unplanned-plan-ownership-bridge-v4")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flight_plans" },
        (payload) => {
          const next = payload.new as ScopeFlightPlan | undefined;
          if (next?.id) void migrate(next);
          window.setTimeout(() => void reconcilePlans(), 50);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearTimeout(second);
      window.removeEventListener(OWNERS_EVENT, onOwners);
      window.removeEventListener(OWNERSHIP_HINT_EVENT, onHint);
      void supabase.removeChannel(channel);
    };
  }, [clearReleaseGuard, guardRelease, initialPlans, migrate, reconcilePlans, rememberOwners]);

  return null;
}
