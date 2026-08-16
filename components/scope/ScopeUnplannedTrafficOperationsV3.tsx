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
type PresencePayload = {
  position?: string;
  sessionId?: string;
  claims?: ClaimTimes;
  onlineAt?: number;
};

type Winner = { owner: string; claimedAt: number; sessionId: string };

const CONNECTION_STORAGE_KEY = "pf24_scope_connection_session_v1";
const OWNERS_EVENT = "pf24-unplanned-ownership-sync";
const OWNERS_REQUEST_EVENT = "pf24-unplanned-ownership-request";
const PRESENCE_CHANNEL = "scope-unplanned-ownership-v3";

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

export default function ScopeUnplannedTrafficOperationsV3({ initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const [position, setPosition] = useState("");
  const [owners, setOwners] = useState<Owners>({});
  const [blankFplOpen, setBlankFplOpen] = useState(false);
  const [radarHost, setRadarHost] = useState<HTMLElement | null>(null);

  const sessionIdRef = useRef("");
  const positionRef = useRef("");
  const claimsRef = useRef<ClaimTimes>({});
  const ownersRef = useRef<Owners>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedRef = useRef(false);

  if (!sessionIdRef.current && typeof crypto !== "undefined") {
    sessionIdRef.current = crypto.randomUUID();
  }

  const plannedKeys = useMemo(() => {
    const keys = new Set<string>();
    plans.forEach((plan) => planKeys(plan).forEach((key) => keys.add(key)));
    return keys;
  }, [plans]);

  const loadPlans = useCallback(async () => {
    const { data, error } = await supabase.from("flight_plans").select("*").neq("status", "FINISHED");
    if (error) {
      console.error("PF24 Scope unplanned traffic plan refresh failed:", error);
      return;
    }
    setPlans((data ?? []) as ScopeFlightPlan[]);
  }, []);

  const trackPresence = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current) return;
    await channel.track({
      position: positionRef.current,
      sessionId: sessionIdRef.current,
      claims: claimsRef.current,
      onlineAt: Date.now(),
    } satisfies PresencePayload);
  }, []);

  const applyOwners = useCallback((nextOwners: Owners) => {
    ownersRef.current = nextOwners;
    setOwners(nextOwners);
    publishOwners(nextOwners);
  }, []);

  const clearLocalClaims = useCallback(() => {
    if (Object.keys(claimsRef.current).length === 0) return;
    claimsRef.current = {};
    void trackPresence();
  }, [trackPresence]);

  useEffect(() => {
    const initial = readPosition();
    positionRef.current = initial;
    setPosition(initial);
    setRadarHost(document.querySelector<HTMLElement>("main.fixed > section"));
    sessionStorage.removeItem("pf24_scope_unplanned_assumed_v2");

    const locate = window.setTimeout(() => setRadarHost(document.querySelector<HTMLElement>("main.fixed > section")), 150);
    const onConnection = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean; callsign?: string }>).detail;
      const next = detail?.connected ? (detail.callsign?.trim().toUpperCase() || readPosition()) : "";
      if (positionRef.current && next !== positionRef.current) {
        claimsRef.current = {};
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
  }, [trackPresence]);

  useEffect(() => {
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: sessionIdRef.current || `scope-${Date.now()}` } },
    });
    channelRef.current = channel;

    const syncPresence = () => {
      const state = channel.presenceState() as unknown as Record<string, PresencePayload[]>;
      const winners: Record<string, Winner> = {};

      for (const entries of Object.values(state)) {
        for (const entry of entries) {
          const owner = entry.position?.trim().toUpperCase() ?? "";
          const sessionId = entry.sessionId ?? "";
          if (!owner || !sessionId || !entry.claims) continue;
          for (const [key, rawTime] of Object.entries(entry.claims)) {
            const claimedAt = Number(rawTime);
            if (!key || !Number.isFinite(claimedAt)) continue;
            const current = winners[key];
            if (
              !current ||
              claimedAt < current.claimedAt ||
              (claimedAt === current.claimedAt && sessionId < current.sessionId)
            ) {
              winners[key] = { owner, claimedAt, sessionId };
            }
          }
        }
      }

      const nextOwners: Owners = {};
      Object.entries(winners).forEach(([key, winner]) => { nextOwners[key] = winner.owner; });
      applyOwners(nextOwners);

      let lostClaim = false;
      const localNext = { ...claimsRef.current };
      for (const key of Object.keys(localNext)) {
        const winner = winners[key];
        if (winner && winner.sessionId !== sessionIdRef.current) {
          delete localNext[key];
          lostClaim = true;
        }
      }
      if (lostClaim) {
        claimsRef.current = localNext;
        void trackPresence();
      }
    };

    channel
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
  }, [applyOwners, trackPresence]);

  useEffect(() => {
    const channel = supabase
      .channel("scope-unplanned-plans-v3")
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, () => void loadPlans())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadPlans]);

  useEffect(() => {
    const nextClaims = { ...claimsRef.current };
    let changed = false;
    for (const key of Object.keys(nextClaims)) {
      if (plannedKeys.has(key)) {
        delete nextClaims[key];
        changed = true;
      }
    }
    if (changed) {
      claimsRef.current = nextClaims;
      void trackPresence();
    }
  }, [plannedKeys, trackPresence]);

  useEffect(() => {
    const syncMenus = () => {
      const menus = Array.from(document.querySelectorAll<HTMLElement>("[data-pf24-callsign-menu='true']"));
      for (const menu of menus) {
        const label = menu.closest<HTMLElement>("[data-pf24-traffic-label='true']");
        if (!label) continue;
        const callsign = trafficCallsign(label);
        const key = norm(callsign);
        if (!key || plannedKeys.has(key)) continue;
        const assumeButton = Array.from(menu.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
          ["ASSUME", "TRANSFER"].includes(button.textContent?.trim().toUpperCase() ?? ""),
        );
        if (assumeButton) assumeButton.textContent = owners[key] === position && position ? "Transfer" : "Assume";
      }
    };

    syncMenus();
    const timer = window.setInterval(syncMenus, 300);
    return () => window.clearInterval(timer);
  }, [owners, plannedKeys, position]);

  useEffect(() => {
    const onMenuClick = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      const menu = button?.closest<HTMLElement>("[data-pf24-callsign-menu='true']");
      const label = menu?.closest<HTMLElement>("[data-pf24-traffic-label='true']");
      if (!button || !menu || !label) return;

      const action = button.textContent?.trim().toUpperCase() ?? "";
      if (!["ASSUME", "TRANSFER", "FPL", "FREE", "HOLD", "XHOLD", "CONTACT ME"].includes(action)) return;

      const callsign = trafficCallsign(label);
      const key = norm(callsign);
      if (!key || plannedKeys.has(key)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (action === "FPL") {
        setRadarHost(document.querySelector<HTMLElement>("main.fixed > section"));
        setBlankFplOpen(true);
        return;
      }
      if (action === "TRANSFER") return;

      if (action === "ASSUME") {
        if (!position) {
          alert("Debes estar conectado a un sector activo antes de asumir tráfico.");
          return;
        }
        const currentOwner = ownersRef.current[key];
        if (currentOwner && currentOwner !== position) {
          alert(`Este tráfico ya está asumido por ${currentOwner}.`);
          return;
        }
        claimsRef.current = { ...claimsRef.current, [key]: Date.now() };
        const optimistic = { ...ownersRef.current, [key]: position };
        applyOwners(optimistic);
        void trackPresence();
        return;
      }

      if (action === "FREE") {
        const currentOwner = ownersRef.current[key];
        if (!position || currentOwner !== position || !(key in claimsRef.current)) {
          alert("Solo puedes liberar tráfico asumido por tu mismo sector.");
          return;
        }
        const nextClaims = { ...claimsRef.current };
        delete nextClaims[key];
        claimsRef.current = nextClaims;
        const optimistic = { ...ownersRef.current };
        delete optimistic[key];
        applyOwners(optimistic);
        void trackPresence();
        return;
      }

      if (action === "CONTACT ME") {
        alert("Contact Me requiere un plan PF24 para identificar al piloto.");
        return;
      }

      if (action === "HOLD" || action === "XHOLD") {
        alert("HOLD para tráficos sin plan todavía no está disponible.");
      }
    };

    window.addEventListener("click", onMenuClick, true);
    return () => window.removeEventListener("click", onMenuClick, true);
  }, [applyOwners, plannedKeys, position, trackPresence]);

  useEffect(() => {
    if (position) return;
    clearLocalClaims();
  }, [clearLocalClaims, position]);

  const fplPortal = radarHost && blankFplOpen ? createPortal(
    <div className="absolute left-1/2 top-1/2 z-[130] w-[900px] max-w-[calc(100%-40px)] -translate-x-1/2 -translate-y-1/2 border border-[#888] bg-[#cecece] p-[10px] font-mono text-[#111] shadow-xl">
      <div className="mb-2 text-[18px]">Flight Plan</div>
      <div className="border border-white p-[10px]">
        <div className="grid grid-cols-2 gap-x-[50px] gap-y-[8px]">
          {["Callsign", "Flight Level", "Departure", "Cruising Speed", "Arrival", "Aircraft", "Alternative", "Fuel Endurance", "Flight Rules", "Acft Registration"].map((label) => <BlankRow key={label} label={label} />)}
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
