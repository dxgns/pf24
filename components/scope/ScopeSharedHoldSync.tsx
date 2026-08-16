"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

type HoldEntry = { held: boolean; version: number };
type HoldState = Record<string, HoldEntry>;
type HoldOp = { planId?: string; held?: boolean; version?: number };
type HoldSnapshot = { state?: HoldState };

const HOLD_STORAGE_KEY = "pf24_scope_hold_traffic_v1";
const HOLD_STATE_KEY = "pf24_scope_hold_state_v1";
const LOCAL_EVENT = "pf24-hold-local-change";
const SYNC_EVENT = "pf24-hold-sync";
const CHANNEL_NAME = "scope-shared-hold-v1";

function readLegacyHeldIds() {
  try {
    const value = JSON.parse(localStorage.getItem(HOLD_STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function readState(): HoldState {
  try {
    const parsed = JSON.parse(localStorage.getItem(HOLD_STATE_KEY) ?? "null") as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as HoldState;
  } catch {}

  const migrated: HoldState = {};
  readLegacyHeldIds().forEach((id) => { migrated[id] = { held: true, version: 1 }; });
  return migrated;
}

function persist(state: HoldState) {
  localStorage.setItem(HOLD_STATE_KEY, JSON.stringify(state));
  const heldIds = Object.entries(state).filter(([, entry]) => entry.held).map(([id]) => id);
  localStorage.setItem(HOLD_STORAGE_KEY, JSON.stringify(heldIds));
  window.dispatchEvent(new Event(SYNC_EVENT));
}

function mergeState(current: HoldState, incoming: HoldState) {
  const next = { ...current };
  let changed = false;
  for (const [id, entry] of Object.entries(incoming)) {
    const existing = next[id];
    if (!existing || entry.version > existing.version) {
      next[id] = entry;
      changed = true;
    }
  }
  return changed ? next : current;
}

export default function ScopeSharedHoldSync() {
  const stateRef = useRef<HoldState>({});

  useEffect(() => {
    stateRef.current = readState();
    persist(stateRef.current);

    const channel = supabase.channel(CHANNEL_NAME, {
      config: { broadcast: { self: false } },
    });

    const sendSnapshot = () => {
      void channel.send({
        type: "broadcast",
        event: "hold-snapshot",
        payload: { state: stateRef.current } satisfies HoldSnapshot,
      });
    };

    channel
      .on("broadcast", { event: "hold-op" }, ({ payload }) => {
        const op = payload as HoldOp;
        if (!op.planId || typeof op.held !== "boolean" || !Number.isFinite(op.version)) return;
        const current = stateRef.current[op.planId];
        if (current && current.version >= Number(op.version)) return;
        stateRef.current = {
          ...stateRef.current,
          [op.planId]: { held: op.held, version: Number(op.version) },
        };
        persist(stateRef.current);
      })
      .on("broadcast", { event: "hold-request" }, () => sendSnapshot())
      .on("broadcast", { event: "hold-snapshot" }, ({ payload }) => {
        const incoming = (payload as HoldSnapshot)?.state;
        if (!incoming || typeof incoming !== "object") return;
        const merged = mergeState(stateRef.current, incoming);
        if (merged === stateRef.current) return;
        stateRef.current = merged;
        persist(stateRef.current);
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        void channel.send({ type: "broadcast", event: "hold-request", payload: {} });
      });

    const onLocalChange = (event: Event) => {
      const detail = (event as CustomEvent<{ planId?: string; held?: boolean }>).detail;
      if (!detail?.planId || typeof detail.held !== "boolean") return;
      const previousVersion = stateRef.current[detail.planId]?.version ?? 0;
      const version = Math.max(Date.now(), previousVersion + 1);
      stateRef.current = {
        ...stateRef.current,
        [detail.planId]: { held: detail.held, version },
      };
      persist(stateRef.current);
      void channel.send({
        type: "broadcast",
        event: "hold-op",
        payload: { planId: detail.planId, held: detail.held, version } satisfies HoldOp,
      });
    };

    window.addEventListener(LOCAL_EVENT, onLocalChange);
    return () => {
      window.removeEventListener(LOCAL_EVENT, onLocalChange);
      void supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
