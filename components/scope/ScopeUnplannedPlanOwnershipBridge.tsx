"use client";

import { useCallback, useEffect, useRef } from "react";
import { getGameCallsignFromNotes, normalizeGameCallsign } from "@/lib/flightPlanGameCallsign";
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

function norm(value: string) {
  return normalizeGameCallsign(value);
}

function normalizeOwner(value: string | null | undefined) {
  return value?.trim().toUpperCase() || "";
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
  const ownersRef = useRef<Owners>({});
  const recentOwnersRef = useRef(new Map<string, RecentOwner>());

  const rememberOwners = useCallback((owners: Owners) => {
    const now = Date.now();
    ownersRef.current = Object.fromEntries(
      Object.entries(owners)
        .map(([key, owner]) => [norm(key), normalizeOwner(owner)] as const)
        .filter(([key, owner]) => Boolean(key && owner)),
    );

    for (const [key, owner] of Object.entries(ownersRef.current)) {
      recentOwnersRef.current.set(key, { owner, expiresAt: now + OWNER_GRACE_MS });
    }
    for (const [key, recent] of recentOwnersRef.current) {
      if (recent.expiresAt <= now) recentOwnersRef.current.delete(key);
    }
  }, []);

  const ownerForPlan = useCallback((plan: ScopeFlightPlan) => {
    const keys = planKeys(plan);
    const owners = new Set<string>();
    const now = Date.now();

    for (const key of keys) {
      const liveOwner = normalizeOwner(ownersRef.current[key]);
      if (liveOwner) owners.add(liveOwner);
      const recent = recentOwnersRef.current.get(key);
      if (recent && recent.expiresAt > now) owners.add(recent.owner);
    }

    // Local sessionStorage is the final fallback for the exact instant in which
    // the unplanned component removes a claim because a plan has just appeared.
    const localOwner = readPosition();
    if (localOwner) {
      const claims = readClaims();
      if (keys.some((key) => Number.isFinite(claims[key]))) owners.add(localOwner);
    }

    // Never guess when two sources disagree about the current controller.
    return owners.size === 1 ? Array.from(owners)[0] : "";
  }, []);

  const migrate = useCallback(async (plan: ScopeFlightPlan) => {
    if (!plan?.id || plan.status === "FINISHED" || plan.assumed_by?.trim()) return;
    if (migratingRef.current.has(plan.id)) return;

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
  }, [ownerForPlan]);

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

    for (const plan of (data ?? []) as ScopeFlightPlan[]) {
      void migrate(plan);
    }
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
        recentOwnersRef.current.delete(key);
        return;
      }
      recentOwnersRef.current.set(key, { owner, expiresAt: Date.now() + OWNER_GRACE_MS });
    };

    window.addEventListener(OWNERS_EVENT, onOwners);
    window.addEventListener(OWNERSHIP_HINT_EVENT, onHint);

    // Covers reloads and the plan-creation race: request the current Presence
    // snapshot before the unplanned claim is discarded, then reconcile again.
    window.dispatchEvent(new Event(OWNERS_REQUEST_EVENT));
    for (const plan of initialPlans) void migrate(plan);
    const first = window.setTimeout(() => void reconcilePlans(), 80);
    const second = window.setTimeout(() => {
      window.dispatchEvent(new Event(OWNERS_REQUEST_EVENT));
      void reconcilePlans();
    }, 350);

    const channel = supabase
      .channel("scope-unplanned-plan-ownership-bridge-v2")
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
  }, [initialPlans, migrate, reconcilePlans, rememberOwners]);

  return null;
}
