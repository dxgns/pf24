"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getGameCallsignFromNotes, normalizeGameCallsign } from "@/lib/flightPlanGameCallsign";
import { supabase } from "@/lib/supabase";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = { initialPlans: ScopeFlightPlan[] };
type StoredConnection = { callsign?: string };
type ClaimTimes = Record<string, number>;
type Owners = Record<string, string>;
type PresencePayload = { position?: string; sessionId?: string; claims?: ClaimTimes; onlineAt?: number };
type Winner = { owner: string; claimedAt: number; sessionId: string };
type HandoverDetail = { refId?: string; key?: string; from?: string; to?: string };
type ReleasedOwner = { owner: string; releasedAt: number; expiresAt: number };
type OwnershipControl = { kind: "release"; key: string; owner: string; releasedAt: number };

const CONNECTION_STORAGE_KEY = "pf24_scope_connection_session_v1";
const CLAIMS_STORAGE_KEY = "pf24_scope_unplanned_claims_v4";
const SESSION_STORAGE_KEY = "pf24_scope_unplanned_presence_session_v4";
const OWNERS_EVENT = "pf24-unplanned-ownership-sync";
const OWNERS_REQUEST_EVENT = "pf24-unplanned-ownership-request";
const OWNERSHIP_HINT_EVENT = "pf24-traffic-ownership-hint";
const HANDOVER_APPLY_EVENT = "pf24-unplanned-handover-apply";
const PRESENCE_CHANNEL = "scope-unplanned-ownership-v5";
const HANDOVER_PROTECTION_MS = 3500;
const RELEASE_SUPPRESSION_MS = 5 * 60 * 1000;

function norm(value: string) { return normalizeGameCallsign(value); }
function readPosition() {
  try {
    const value = JSON.parse(sessionStorage.getItem(CONNECTION_STORAGE_KEY) ?? "null") as StoredConnection | null;
    return value?.callsign?.trim().toUpperCase() ?? "";
  } catch { return ""; }
}
function readClaims(): ClaimTimes {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CLAIMS_STORAGE_KEY) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, value]) => Number.isFinite(Number(value)))
        .map(([key, value]) => [key, Number(value)]),
    );
  } catch { return {}; }
}
function writeClaims(claims: ClaimTimes) { sessionStorage.setItem(CLAIMS_STORAGE_KEY, JSON.stringify(claims)); }
function clearClaimsStorage() { sessionStorage.removeItem(CLAIMS_STORAGE_KEY); }
function getSessionId() {
  const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;
  const next = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `scope-${Date.now()}-${Math.random()}`;
  sessionStorage.setItem(SESSION_STORAGE_KEY, next);
  return next;
}
function trafficCallsign(label: HTMLElement) {
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
function publishOwners(owners: Owners) {
  window.dispatchEvent(new CustomEvent(OWNERS_EVENT, { detail: { owners } }));
}
function hintOwnership(key: string, owner: string | null, previousOwner?: string | null) {
  window.dispatchEvent(new CustomEvent(OWNERSHIP_HINT_EVENT, { detail: { key, owner, previousOwner } }));
}

export default function ScopeUnplannedTrafficOperationsV4({ initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const [position, setPosition] = useState("");
  const [blankFplOpen, setBlankFplOpen] = useState(false);
  const [radarHost, setRadarHost] = useState<HTMLElement | null>(null);

  const sessionIdRef = useRef("");
  const positionRef = useRef("");
  const claimsRef = useRef<ClaimTimes>({});
  const ownersRef = useRef<Owners>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedRef = useRef(false);
  const protectedClaimsRef = useRef(new Map<string, number>());
  const releasedOwnersRef = useRef(new Map<string, ReleasedOwner>());
  const processedHandoverRef = useRef(new Set<string>());

  if (!sessionIdRef.current && typeof window !== "undefined") sessionIdRef.current = getSessionId();

  const plannedKeys = useMemo(() => {
    const keys = new Set<string>();
    plans.forEach((plan) => planKeys(plan).forEach((key) => keys.add(key)));
    return keys;
  }, [plans]);

  const loadPlans = useCallback(async () => {
    const { data, error } = await supabase.from("flight_plans").select("*").neq("status", "FINISHED");
    if (error) { console.error("PF24 Scope unplanned plan refresh failed:", error); return; }
    setPlans((data ?? []) as ScopeFlightPlan[]);
  }, []);

  const trackPresence = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current) return;
    try {
      await channel.track({
        position: positionRef.current,
        sessionId: sessionIdRef.current,
        claims: claimsRef.current,
        onlineAt: Date.now(),
      } satisfies PresencePayload);
    } catch (error) {
      console.error("PF24 Scope unplanned presence track failed:", error);
    }
  }, []);

  const setLocalClaims = useCallback((claims: ClaimTimes, persist = true) => {
    claimsRef.current = claims;
    if (persist) writeClaims(claims);
    void trackPresence();
  }, [trackPresence]);

  const applyOwners = useCallback((next: Owners) => {
    ownersRef.current = next;
    publishOwners(next);
  }, []);

  const suppressReleasedOwner = useCallback((key: string, owner: string, releasedAt = Date.now()) => {
    if (!key || !owner || !Number.isFinite(releasedAt)) return;
    const existing = releasedOwnersRef.current.get(key);
    if (existing && existing.releasedAt > releasedAt) return;
    releasedOwnersRef.current.set(key, {
      owner,
      releasedAt,
      expiresAt: releasedAt + RELEASE_SUPPRESSION_MS,
    });
  }, []);

  const broadcastRelease = useCallback((key: string, owner: string, releasedAt: number) => {
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current || !key || !owner) return;
    void channel.send({
      type: "broadcast",
      event: "ownership-control",
      payload: { kind: "release", key, owner, releasedAt } satisfies OwnershipControl,
    });
  }, []);

  useEffect(() => {
    const initial = readPosition();
    positionRef.current = initial;
    setPosition(initial);
    claimsRef.current = initial ? readClaims() : {};
    setRadarHost(document.querySelector<HTMLElement>("main.fixed > section"));
    const locate = window.setTimeout(() => setRadarHost(document.querySelector<HTMLElement>("main.fixed > section")), 150);

    const onConnection = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean; callsign?: string }>).detail;
      const previous = positionRef.current;
      const next = detail?.connected ? (detail.callsign?.trim().toUpperCase() || readPosition()) : "";

      if (!next || (previous && next !== previous)) {
        const releasedKeys = Object.keys(claimsRef.current);
        const releasedAt = Date.now();
        const optimisticOwners = { ...ownersRef.current };
        for (const key of releasedKeys) {
          suppressReleasedOwner(key, previous, releasedAt);
          broadcastRelease(key, previous, releasedAt);
          if (optimisticOwners[key] === previous) delete optimisticOwners[key];
          hintOwnership(key, null, previous || null);
        }
        if (releasedKeys.length) applyOwners(optimisticOwners);

        claimsRef.current = {};
        protectedClaimsRef.current.clear();
        clearClaimsStorage();
      } else if (!previous && next && Object.keys(claimsRef.current).length === 0) {
        claimsRef.current = readClaims();
      }

      positionRef.current = next;
      setPosition(next);
      void trackPresence();
    };
    const onRequest = () => publishOwners(ownersRef.current);
    window.addEventListener("pf24-scope-connection-change", onConnection);
    window.addEventListener(OWNERS_REQUEST_EVENT, onRequest);
    return () => {
      window.clearTimeout(locate);
      window.removeEventListener("pf24-scope-connection-change", onConnection);
      window.removeEventListener(OWNERS_REQUEST_EVENT, onRequest);
    };
  }, [applyOwners, broadcastRelease, suppressReleasedOwner, trackPresence]);

  useEffect(() => {
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: sessionIdRef.current }, broadcast: { self: false } },
    });
    channelRef.current = channel;

    const applyReleaseControl = (raw: unknown) => {
      const payload = raw as Partial<OwnershipControl> | null;
      const key = norm(payload?.key ?? "");
      const owner = payload?.owner?.trim().toUpperCase() ?? "";
      const releasedAt = Number(payload?.releasedAt);
      if (payload?.kind !== "release" || !key || !owner || !Number.isFinite(releasedAt)) return;

      suppressReleasedOwner(key, owner, releasedAt);

      const localClaimAt = Number(claimsRef.current[key]);
      const localNewerClaim = positionRef.current === owner && Number.isFinite(localClaimAt) && localClaimAt > releasedAt;
      if (positionRef.current === owner && Number.isFinite(localClaimAt) && localClaimAt <= releasedAt) {
        const next = { ...claimsRef.current };
        delete next[key];
        setLocalClaims(next);
      }

      if (!localNewerClaim) {
        const optimistic = { ...ownersRef.current };
        if (optimistic[key] === owner) delete optimistic[key];
        applyOwners(optimistic);
        hintOwnership(key, null, owner);
      }
    };

    const syncPresence = () => {
      const state = channel.presenceState() as unknown as Record<string, PresencePayload[]>;
      const winners: Record<string, Winner> = {};
      const now = Date.now();

      for (const [key, released] of releasedOwnersRef.current) {
        if (released.expiresAt <= now) releasedOwnersRef.current.delete(key);
      }

      for (const entries of Object.values(state)) {
        for (const entry of entries) {
          const owner = entry.position?.trim().toUpperCase() ?? "";
          const sessionId = entry.sessionId ?? "";
          if (!owner || !sessionId || !entry.claims) continue;
          for (const [key, rawTime] of Object.entries(entry.claims)) {
            const claimedAt = Number(rawTime);
            if (!key || !Number.isFinite(claimedAt)) continue;

            const released = releasedOwnersRef.current.get(key);
            if (
              released &&
              released.expiresAt > now &&
              released.owner === owner &&
              claimedAt <= released.releasedAt
            ) continue;

            const current = winners[key];
            if (!current || claimedAt < current.claimedAt || (claimedAt === current.claimedAt && sessionId < current.sessionId)) {
              winners[key] = { owner, claimedAt, sessionId };
            }
          }
        }
      }

      for (const [key, released] of releasedOwnersRef.current) {
        const winner = winners[key];
        if (winner && winner.owner === released.owner && winner.claimedAt > released.releasedAt) {
          releasedOwnersRef.current.delete(key);
        }
      }

      const nextOwners: Owners = {};
      Object.entries(winners).forEach(([key, winner]) => { nextOwners[key] = winner.owner; });
      applyOwners(nextOwners);

      for (const [key, expiresAt] of protectedClaimsRef.current) {
        if (expiresAt <= now) protectedClaimsRef.current.delete(key);
      }

      const local = { ...claimsRef.current };
      let changed = false;
      for (const key of Object.keys(local)) {
        const released = releasedOwnersRef.current.get(key);
        const localClaimAt = Number(local[key]);
        if (
          released &&
          released.expiresAt > now &&
          released.owner === positionRef.current &&
          Number.isFinite(localClaimAt) &&
          localClaimAt <= released.releasedAt
        ) {
          delete local[key];
          changed = true;
          continue;
        }
        const winner = winners[key];
        const protectedUntil = protectedClaimsRef.current.get(key) ?? 0;
        if (winner && winner.sessionId !== sessionIdRef.current && protectedUntil <= now) {
          delete local[key];
          changed = true;
        }
      }
      if (changed) setLocalClaims(local);
    };

    channel
      .on("broadcast", { event: "ownership-control" }, ({ payload }) => applyReleaseControl(payload))
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence)
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        subscribedRef.current = true;
        void trackPresence();
      });

    return () => {
      subscribedRef.current = false;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [applyOwners, setLocalClaims, suppressReleasedOwner, trackPresence]);

  useEffect(() => {
    const channel = supabase.channel("scope-unplanned-plans-v6")
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, () => void loadPlans())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadPlans]);

  useEffect(() => {
    const next = { ...claimsRef.current };
    let changed = false;
    for (const key of Object.keys(next)) {
      if (!plannedKeys.has(key)) continue;
      delete next[key];
      protectedClaimsRef.current.delete(key);
      releasedOwnersRef.current.delete(key);
      changed = true;
    }
    if (changed) setLocalClaims(next);
  }, [plannedKeys, setLocalClaims]);

  useEffect(() => {
    const onHandoverApply = (event: Event) => {
      const detail = (event as CustomEvent<HandoverDetail>).detail;
      const refId = String(detail?.refId ?? "").trim();
      const key = norm(detail?.key ?? "");
      const from = detail?.from?.trim().toUpperCase() ?? "";
      const to = detail?.to?.trim().toUpperCase() ?? "";
      const here = positionRef.current;
      if (!key || !from || !to || !here || plannedKeys.has(key)) return;

      const dedupeKey = refId || `${key}:${from}:${to}`;
      if (processedHandoverRef.current.has(dedupeKey)) return;
      processedHandoverRef.current.add(dedupeKey);
      window.setTimeout(() => processedHandoverRef.current.delete(dedupeKey), 10_000);

      if (here === from) {
        const releasedAt = Date.now();
        protectedClaimsRef.current.delete(key);
        suppressReleasedOwner(key, from, releasedAt);
        broadcastRelease(key, from, releasedAt);
        if (key in claimsRef.current) {
          const next = { ...claimsRef.current };
          delete next[key];
          setLocalClaims(next);
        } else {
          void trackPresence();
        }
        const optimistic = { ...ownersRef.current };
        delete optimistic[key];
        applyOwners(optimistic);
        hintOwnership(key, null, from);
      }

      if (here === to) {
        const now = Date.now();
        protectedClaimsRef.current.set(key, now + HANDOVER_PROTECTION_MS);
        const next = { ...claimsRef.current, [key]: now };
        setLocalClaims(next);
        applyOwners({ ...ownersRef.current, [key]: to });
        hintOwnership(key, to, from);

        window.setTimeout(() => {
          if (plannedKeys.has(key) || !(key in claimsRef.current)) return;
          void trackPresence();
        }, 250);
        window.setTimeout(() => {
          if (plannedKeys.has(key) || !(key in claimsRef.current)) return;
          void trackPresence();
        }, 1000);
      }
    };

    window.addEventListener(HANDOVER_APPLY_EVENT, onHandoverApply);
    return () => window.removeEventListener(HANDOVER_APPLY_EVENT, onHandoverApply);
  }, [applyOwners, broadcastRelease, plannedKeys, setLocalClaims, suppressReleasedOwner, trackPresence]);

  useEffect(() => {
    const onMenuClick = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      const menu = button?.closest<HTMLElement>("[data-pf24-callsign-menu='true']");
      const label = menu?.closest<HTMLElement>("[data-pf24-traffic-label='true']");
      if (!button || !menu || !label) return;

      const action = (button.dataset.pf24OwnerActionLabel || button.textContent || "").trim().toUpperCase();
      if (["TRANSFER", "REQ ON FREQ", "ACCEPT", "DECLINE"].includes(action) || button.dataset.pf24HandoverDecline === "true") return;
      if (!["ASSUME", "FPL", "FREE", "CONTACT ME"].includes(action)) return;

      const key = norm(trafficCallsign(label));
      if (!key || plannedKeys.has(key)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (action === "FPL") {
        setRadarHost(document.querySelector<HTMLElement>("main.fixed > section"));
        setBlankFplOpen(true);
        return;
      }

      if (action === "ASSUME") {
        const here = positionRef.current || position;
        if (!here) {
          alert("Debes estar conectado a un sector activo antes de asumir tráfico.");
          return;
        }
        const currentOwner = ownersRef.current[key];
        if (currentOwner && currentOwner !== here) return;
        const claimedAt = Date.now();
        const next = { ...claimsRef.current, [key]: claimedAt };
        setLocalClaims(next);
        applyOwners({ ...ownersRef.current, [key]: here });
        hintOwnership(key, here, currentOwner || null);
        return;
      }

      if (action === "FREE") {
        const here = positionRef.current || position;
        const currentOwner = ownersRef.current[key];
        const hasLocalClaim = key in claimsRef.current;
        if (!here || (currentOwner && currentOwner !== here) || (!currentOwner && !hasLocalClaim)) {
          alert("Solo puedes liberar tráfico asumido por tu mismo sector.");
          return;
        }

        const releasedAt = Date.now();
        protectedClaimsRef.current.delete(key);
        suppressReleasedOwner(key, currentOwner || here, releasedAt);
        broadcastRelease(key, currentOwner || here, releasedAt);
        const next = { ...claimsRef.current };
        delete next[key];
        setLocalClaims(next);

        const optimistic = { ...ownersRef.current };
        delete optimistic[key];
        applyOwners(optimistic);
        hintOwnership(key, null, currentOwner || here);

        window.setTimeout(() => void trackPresence(), 80);
        window.setTimeout(() => void trackPresence(), 250);
        window.setTimeout(() => void trackPresence(), 750);
        window.setTimeout(() => void trackPresence(), 1500);
        return;
      }

      if (action === "CONTACT ME") {
        alert("Contact Me requiere un plan PF24 para identificar al piloto.");
      }
    };

    window.addEventListener("click", onMenuClick, true);
    return () => window.removeEventListener("click", onMenuClick, true);
  }, [applyOwners, broadcastRelease, plannedKeys, position, setLocalClaims, suppressReleasedOwner, trackPresence]);

  const fplPortal = radarHost && blankFplOpen ? createPortal(
    <div className="absolute left-1/2 top-1/2 z-[130] w-[900px] max-w-[calc(100%-40px)] -translate-x-1/2 -translate-y-1/2 border border-[#888] bg-[#cecece] p-[10px] font-mono text-[#111] shadow-xl">
      <div className="mb-2 text-[18px]">Flight Plan</div>
      <div className="border border-white p-[10px]">
        <div className="grid grid-cols-2 gap-x-[50px] gap-y-[8px]">
          {["Callsign", "Flight Level", "Departure", "Cruising Speed", "Arrival", "Aircraft", "Alternative", "Fuel Endurance", "Flight Rules", "Acft Registration"]
            .map((label) => <BlankRow key={label} label={label} />)}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-5">
          <BlankArea label="Route" />
          <BlankArea label="Remarks" />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button type="button" onClick={() => setBlankFplOpen(false)} className="border border-[#888] bg-[#e8e8e8] px-4 py-1">Close</button>
      </div>
    </div>,
    radarHost,
  ) : null;

  return <>{fplPortal}</>;
}

function BlankRow({ label }: { label: string }) {
  return <div className="grid grid-cols-[170px_1fr] items-center">
    <span className="pr-2 text-right text-[18px]">{label}</span>
    <div className="h-[28px] bg-[#ececec]" />
  </div>;
}
function BlankArea({ label }: { label: string }) {
  return <div>
    <div className="mb-1 text-[18px]">{label}</div>
    <div className="h-[150px] bg-[#ececec]" />
  </div>;
}
