"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeGameCallsign } from "@/lib/flightPlanGameCallsign";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = { initialPlans: ScopeFlightPlan[] };
type LivePlan = ScopeFlightPlan & { created_at?: string | null; updated_at?: string | null };
type StoredConnection = { callsign?: string };
type LocalPlanControls = {
  c?: boolean;
  nstup?: boolean;
  depRunway?: string;
  arrRunway?: string;
  depProc?: string;
  arrStar?: string;
  arrAppr?: string;
  gate?: string;
};
type ControlMap = Record<string, LocalPlanControls>;
type SharedRecord = {
  controls: LocalPlanControls;
  updatedAt: number;
  owner: string;
};
type SharedRows = Record<string, SharedRecord>;
type PresencePayload = {
  sessionId?: string;
  position?: string;
  rows?: SharedRows;
  onlineAt?: number;
};

type Phase = "dep" | "arr";

const CONNECTION_STORAGE_KEY = "pf24_scope_connection_session_v1";
const SECTOR_CONTROLS_KEY = "pf24_scope_sector_controls_v1";
const SESSION_STORAGE_KEY = "pf24_scope_sector_shared_session_v1";
const PRESENCE_CHANNEL = "scope-sector-list-shared-v1";
const LIST_SELECTOR = "[data-pf24-live-sector-list='true']";
const POLL_MS = 100;

const STATUS_SEQUENCE = ["STUP", "PUSH", "TAXI_DEP", "DEP", "APP", "ARR", "TAXI_IN", "PARKED"] as const;
const STATUS_DISPLAY: Record<string, string> = {
  STUP: "STUP",
  PUSH: "PUSH",
  TAXI_DEP: "TAXI",
  DEP: "DEP",
  APP: "APP",
  ARR: "ARR",
  TAXI_IN: "TXIN",
  TAXI_ARR: "TXIN",
  PARKED: "PARK",
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

function getSessionId() {
  const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;
  const next = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `sector-sync-${Date.now()}-${Math.random()}`;
  sessionStorage.setItem(SESSION_STORAGE_KEY, next);
  return next;
}

function cleanText(value: unknown, maxLength = 24) {
  return typeof value === "string" ? value.toUpperCase().slice(0, maxLength) : undefined;
}

function cleanControls(value: unknown): LocalPlanControls {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const controls: LocalPlanControls = {};
  if (typeof source.c === "boolean") controls.c = source.c;
  if (typeof source.nstup === "boolean") controls.nstup = source.nstup;
  const depRunway = cleanText(source.depRunway, 8); if (depRunway !== undefined) controls.depRunway = depRunway;
  const arrRunway = cleanText(source.arrRunway, 8); if (arrRunway !== undefined) controls.arrRunway = arrRunway;
  const depProc = cleanText(source.depProc); if (depProc !== undefined) controls.depProc = depProc;
  const arrStar = cleanText(source.arrStar); if (arrStar !== undefined) controls.arrStar = arrStar;
  const arrAppr = cleanText(source.arrAppr); if (arrAppr !== undefined) controls.arrAppr = arrAppr;
  const gate = cleanText(source.gate, 8); if (gate !== undefined) controls.gate = gate;
  return controls;
}

function readLocalControls(): ControlMap {
  try {
    const parsed = JSON.parse(localStorage.getItem(SECTOR_CONTROLS_KEY) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([planId, value]) => [planId, cleanControls(value)]),
    );
  } catch {
    return {};
  }
}

function sameControls(a: LocalPlanControls | undefined, b: LocalPlanControls | undefined) {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}

function normalizeStatus(value?: string | null) {
  const status = (value || "").toUpperCase();
  return status === "TAXI_ARR" ? "TAXI_IN" : status;
}

function phaseFor(plan: LivePlan): Phase {
  const status = normalizeStatus(plan.sector_status);
  const index = STATUS_SEQUENCE.indexOf(status as (typeof STATUS_SEQUENCE)[number]);
  return index >= STATUS_SEQUENCE.indexOf("APP") ? "arr" : "dep";
}

function displayStatus(plan: LivePlan, controls: LocalPlanControls) {
  if (controls.nstup) return "";
  const status = normalizeStatus(plan.sector_status);
  if (status !== "STUP") return STATUS_DISPLAY[status] ?? status;

  const created = plan.created_at ? new Date(plan.created_at).getTime() : Number.NaN;
  const updated = plan.updated_at ? new Date(plan.updated_at).getTime() : Number.NaN;
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return "";
  return updated - created > 2500 ? "STUP" : "";
}

function rowCallsign(row: HTMLElement) {
  const grid = row.firstElementChild instanceof HTMLElement ? row.firstElementChild : null;
  return grid?.children[0]?.textContent?.trim().toUpperCase() ?? "";
}

function applyRow(row: HTMLElement, plan: LivePlan, controls: LocalPlanControls) {
  const grid = row.firstElementChild instanceof HTMLElement ? row.firstElementChild : null;
  if (!grid || grid.children.length < 11) return;
  const phase = phaseFor(plan);
  const runway = phase === "dep" ? controls.depRunway ?? "" : controls.arrRunway ?? "";
  const procedures = phase === "dep"
    ? controls.depProc ?? ""
    : [controls.arrStar, controls.arrAppr].filter(Boolean).join("-");

  const runwayCell = grid.children[6] as HTMLElement | undefined;
  const proceduresCell = grid.children[7] as HTMLElement | undefined;
  const statusCell = grid.children[9] as HTMLElement | undefined;
  const cCell = grid.children[10] as HTMLElement | undefined;

  if (runwayCell && runwayCell.textContent !== runway) runwayCell.textContent = runway;
  if (proceduresCell && proceduresCell.textContent !== procedures) proceduresCell.textContent = procedures;
  const status = displayStatus(plan, controls);
  if (statusCell && statusCell.textContent !== status) statusCell.textContent = status;

  const cButton = cCell instanceof HTMLButtonElement ? cCell : cCell?.querySelector<HTMLButtonElement>("button");
  if (cButton) cButton.style.backgroundColor = controls.c ? "#00d600" : "transparent";
}

export default function ScopeSectorListRealtimeSync({ initialPlans }: Props) {
  const [plans, setPlans] = useState<LivePlan[]>(initialPlans as LivePlan[]);
  const [sharedRows, setSharedRows] = useState<SharedRows>({});

  const plansRef = useRef<LivePlan[]>(initialPlans as LivePlan[]);
  const sharedRowsRef = useRef<SharedRows>({});
  const publishedRowsRef = useRef<SharedRows>({});
  const positionRef = useRef("");
  const sessionIdRef = useRef("");
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedRef = useRef(false);

  if (!sessionIdRef.current && typeof window !== "undefined") sessionIdRef.current = getSessionId();

  useEffect(() => {
    plansRef.current = plans;
  }, [plans]);

  useEffect(() => {
    sharedRowsRef.current = sharedRows;
  }, [sharedRows]);

  const loadPlans = useCallback(async () => {
    const { data, error } = await supabase
      .from("flight_plans")
      .select("*")
      .neq("status", "FINISHED")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("PF24 Scope shared sector-list plan refresh failed:", error);
      return;
    }
    setPlans((data ?? []) as LivePlan[]);
  }, []);

  const trackPresence = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current) return;
    try {
      await channel.track({
        sessionId: sessionIdRef.current,
        position: positionRef.current,
        rows: publishedRowsRef.current,
        onlineAt: Date.now(),
      } satisfies PresencePayload);
    } catch (error) {
      console.error("PF24 Scope shared sector-list presence failed:", error);
    }
  }, []);

  useEffect(() => {
    const initialPosition = readPosition();
    positionRef.current = initialPosition;

    const onConnection = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean; callsign?: string }>).detail;
      positionRef.current = detail?.connected
        ? (detail.callsign?.trim().toUpperCase() || readPosition())
        : "";
      publishedRowsRef.current = {};
      void trackPresence();
    };

    window.addEventListener("pf24-scope-connection-change", onConnection);
    return () => window.removeEventListener("pf24-scope-connection-change", onConnection);
  }, [trackPresence]);

  useEffect(() => {
    void loadPlans();
    const plansChannel = supabase
      .channel("scope-sector-list-shared-plans-v1")
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, () => void loadPlans())
      .subscribe();
    return () => { void supabase.removeChannel(plansChannel); };
  }, [loadPlans]);

  useEffect(() => {
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: sessionIdRef.current } },
    });
    channelRef.current = channel;

    const syncPresence = () => {
      const state = channel.presenceState() as unknown as Record<string, PresencePayload[]>;
      const candidates = new Map<string, SharedRecord[]>();

      for (const entries of Object.values(state)) {
        for (const entry of entries) {
          const fallbackOwner = entry.position?.trim().toUpperCase() ?? "";
          if (!entry.rows || typeof entry.rows !== "object") continue;
          for (const [planId, rawRecord] of Object.entries(entry.rows)) {
            const record = rawRecord as Partial<SharedRecord> | null;
            const updatedAt = Number(record?.updatedAt);
            const owner = record?.owner?.trim().toUpperCase() || fallbackOwner;
            if (!planId || !owner || !Number.isFinite(updatedAt)) continue;
            const clean: SharedRecord = {
              controls: cleanControls(record?.controls),
              updatedAt,
              owner,
            };
            const list = candidates.get(planId) ?? [];
            list.push(clean);
            candidates.set(planId, list);
          }
        }
      }

      const next: SharedRows = { ...sharedRowsRef.current };
      for (const plan of plansRef.current) {
        const options = candidates.get(plan.id) ?? [];
        if (options.length === 0) continue;
        const currentOwner = plan.assumed_by?.trim().toUpperCase() ?? "";
        const ownerOptions = currentOwner ? options.filter((record) => record.owner === currentOwner) : [];
        const pool = ownerOptions.length > 0 ? ownerOptions : options;
        const chosen = [...pool].sort((a, b) => b.updatedAt - a.updatedAt || a.owner.localeCompare(b.owner))[0];
        if (chosen) next[plan.id] = chosen;
      }

      sharedRowsRef.current = next;
      setSharedRows(next);
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
  }, [trackPresence]);

  useEffect(() => {
    const publishOwnedRows = () => {
      if (!subscribedRef.current) return;
      const position = positionRef.current || readPosition();
      if (!position) {
        if (Object.keys(publishedRowsRef.current).length > 0) {
          publishedRowsRef.current = {};
          void trackPresence();
        }
        return;
      }

      const localControls = readLocalControls();
      const next: SharedRows = {};
      let changed = false;

      for (const plan of plansRef.current) {
        if (plan.assumed_by?.trim().toUpperCase() !== position) continue;
        const local = localControls[plan.id] ?? {};
        const inherited = sharedRowsRef.current[plan.id]?.controls ?? {};
        const merged = { ...inherited, ...local };
        const previous = publishedRowsRef.current[plan.id];
        const controlsChanged = !sameControls(previous?.controls, merged);
        next[plan.id] = {
          controls: merged,
          updatedAt: controlsChanged || !previous ? Date.now() : previous.updatedAt,
          owner: position,
        };
        if (controlsChanged || !previous || previous.owner !== position) changed = true;
      }

      const previousIds = Object.keys(publishedRowsRef.current).sort().join(",");
      const nextIds = Object.keys(next).sort().join(",");
      if (previousIds !== nextIds) changed = true;
      if (!changed) return;

      publishedRowsRef.current = next;
      void trackPresence();
    };

    publishOwnedRows();
    const timer = window.setInterval(publishOwnedRows, POLL_MS);
    return () => window.clearInterval(timer);
  }, [trackPresence]);

  useEffect(() => {
    const applySharedRows = () => {
      const list = document.querySelector<HTMLElement>(LIST_SELECTOR);
      if (!list) return;
      const localControls = readLocalControls();
      const position = positionRef.current || readPosition();
      const planByCallsign = new Map<string, LivePlan>();
      for (const plan of plansRef.current) planByCallsign.set(norm(plan.callsign), plan);

      const rows = Array.from(list.children)
        .slice(1)
        .filter((node): node is HTMLElement => node instanceof HTMLElement);

      for (const row of rows) {
        const plan = planByCallsign.get(norm(rowCallsign(row)));
        if (!plan) continue;
        const shared = sharedRowsRef.current[plan.id];
        if (!shared) continue;

        const mine = Boolean(position && plan.assumed_by?.trim().toUpperCase() === position);
        const effective = mine
          ? { ...shared.controls, ...(localControls[plan.id] ?? {}) }
          : shared.controls;
        applyRow(row, plan, effective);
      }
    };

    applySharedRows();
    const timer = window.setInterval(applySharedRows, POLL_MS);
    return () => window.clearInterval(timer);
  }, [plans, sharedRows]);

  return null;
}
