"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getGameCallsignFromNotes, normalizeGameCallsign } from "@/lib/flightPlanGameCallsign";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = { initialPlans: ScopeFlightPlan[] };
type StoredConnection = { callsign?: string };
type UnplannedOwners = Record<string, string>;
type OptimisticOwner = { owner: string | null; expiresAt: number };
type PlannedMeta = { owner: string | null; transponder: string };

const CONNECTION_STORAGE_KEY = "pf24_scope_connection_session_v1";
const GREEN = "#00e000";
const GREY = "#9b9b9b";
const FREE = "#d8d8d8";
const LIVE_ROOT = "[data-pf24-live-traffic='true']";
const OWNERS_EVENT = "pf24-unplanned-ownership-sync";
const OWNERS_REQUEST_EVENT = "pf24-unplanned-ownership-request";

function norm(value: string) {
  return normalizeGameCallsign(value);
}

function readPosition() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CONNECTION_STORAGE_KEY) ?? "null") as StoredConnection | null;
    return parsed?.callsign?.trim().toUpperCase() ?? "";
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

function normalizeTransponder(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(-4);
  return digits ? digits.padStart(4, "0") : "9999";
}

function setImportant(element: HTMLElement | SVGElement | null | undefined, property: string, value: string) {
  element?.style.setProperty(property, value, "important");
}

function paintLabel(label: HTMLElement, color: string) {
  setImportant(label, "color", color);
  label.querySelectorAll<HTMLElement>("span,button,input").forEach((element) => {
    if (element.closest("[data-pf24-callsign-menu='true']")) return;
    setImportant(element, "color", color);
  });
}

function syncTransponder(label: HTMLElement, transponder: string) {
  const node = Array.from(label.children).find((child) =>
    child instanceof HTMLElement && /^A\d{4}$/.test(child.textContent?.trim().toUpperCase() ?? ""),
  );
  if (node instanceof HTMLElement) node.textContent = `A${transponder}`;
}

function syncMenuOwnership(label: HTMLElement, owner: string | null, position: string) {
  const menu = label.querySelector<HTMLElement>("[data-pf24-callsign-menu='true']");
  if (!menu) return;
  const button = Array.from(menu.querySelectorAll<HTMLButtonElement>(":scope > button")).find((candidate) => {
    const text = candidate.textContent?.trim().toUpperCase() ?? "";
    return ["ASSUME", "TRANSFER", "REQ ON FREQ"].includes(text) || candidate.dataset.pf24OwnerAction === "true";
  });
  if (!button) return;

  const labelText = owner ? (position && owner === position ? "Transfer" : "Req on Freq") : "Assume";
  button.dataset.pf24OwnerAction = "true";
  button.dataset.pf24OwnerActionLabel = labelText;
  if (button.textContent?.trim() !== labelText) button.textContent = labelText;
}

export default function ScopeTrafficOwnershipVisuals({ initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const [position, setPosition] = useState("");
  const [unplannedOwners, setUnplannedOwners] = useState<UnplannedOwners>({});
  const [optimisticOwners, setOptimisticOwners] = useState<Record<string, OptimisticOwner>>({});

  const plannedMeta = useMemo(() => {
    const map = new Map<string, PlannedMeta>();
    for (const plan of plans) {
      const meta: PlannedMeta = {
        owner: plan.assumed_by?.trim().toUpperCase() || null,
        transponder: normalizeTransponder(plan.transponder),
      };
      for (const key of planKeys(plan)) map.set(key, meta);
    }
    return map;
  }, [plans]);

  const loadPlans = useCallback(async () => {
    const { data, error } = await supabase
      .from("flight_plans")
      .select("*")
      .neq("status", "FINISHED");
    if (error) {
      console.error("PF24 Scope ownership refresh failed:", error);
      return;
    }
    setPlans((data ?? []) as ScopeFlightPlan[]);
  }, []);

  useEffect(() => {
    setPosition(readPosition());
    const onConnection = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean; callsign?: string }>).detail;
      setPosition(detail?.connected ? (detail.callsign?.trim().toUpperCase() || readPosition()) : "");
      if (!detail?.connected) setOptimisticOwners({});
    };
    const onUnplannedOwners = (event: Event) => {
      const detail = (event as CustomEvent<{ owners?: UnplannedOwners }>).detail;
      setUnplannedOwners(detail?.owners ?? {});
    };

    window.addEventListener("pf24-scope-connection-change", onConnection);
    window.addEventListener(OWNERS_EVENT, onUnplannedOwners);
    window.dispatchEvent(new Event(OWNERS_REQUEST_EVENT));
    return () => {
      window.removeEventListener("pf24-scope-connection-change", onConnection);
      window.removeEventListener(OWNERS_EVENT, onUnplannedOwners);
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("scope-traffic-ownership-visuals")
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, () => void loadPlans())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadPlans]);

  useEffect(() => {
    setOptimisticOwners((current) => {
      const now = Date.now();
      const next = { ...current };
      let changed = false;
      for (const [key, optimistic] of Object.entries(current)) {
        const actual = plannedMeta.get(key)?.owner ?? null;
        if (optimistic.expiresAt <= now || (plannedMeta.has(key) && actual === optimistic.owner)) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [plannedMeta]);

  const sync = useCallback(() => {
    const root = document.querySelector<HTMLElement>(LIVE_ROOT);
    if (!root) return;

    const labels = Array.from(root.querySelectorAll<HTMLElement>("[data-pf24-traffic-label='true']"));
    const targets = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-pf24-traffic-select='true']"));
    const groups = Array.from(root.querySelectorAll<SVGGElement>("svg > g"));
    const now = Date.now();

    labels.forEach((label, index) => {
      const callsign = trafficCallsign(label);
      const key = norm(callsign);
      if (!key) return;

      const meta = plannedMeta.get(key);
      const optimistic = optimisticOwners[key];
      const owner = optimistic && optimistic.expiresAt > now
        ? optimistic.owner
        : meta
          ? meta.owner
          : unplannedOwners[key]?.trim().toUpperCase() || null;
      const ownedByMe = Boolean(position && owner === position);
      const color = ownedByMe ? GREEN : owner ? GREY : FREE;

      label.dataset.pf24Ownership = ownedByMe ? "mine" : owner ? "other" : "free";
      paintLabel(label, color);
      syncTransponder(label, meta?.transponder ?? "9999");
      syncMenuOwnership(label, owner, position);

      const target = targets[index];
      const group = groups[index];
      setImportant(target?.querySelector<HTMLElement>(":scope > span"), "border-color", color);
      group?.querySelectorAll<SVGLineElement>("line").forEach((line) => setImportant(line, "stroke", color));
      group?.querySelectorAll<SVGCircleElement>("circle").forEach((circle) => setImportant(circle, "fill", color));
    });
  }, [optimisticOwners, plannedMeta, position, unplannedOwners]);

  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24TrafficOwnershipBaseline = "true";
    style.textContent = `
      ${LIVE_ROOT} [data-pf24-traffic-label='true'][data-pf24-ownership='free'],
      ${LIVE_ROOT} [data-pf24-traffic-label='true'][data-pf24-ownership='free'] span,
      ${LIVE_ROOT} [data-pf24-traffic-label='true'][data-pf24-ownership='free'] button,
      ${LIVE_ROOT} [data-pf24-traffic-label='true'][data-pf24-ownership='free'] input { color:${FREE} !important; }
      ${LIVE_ROOT} [data-pf24-traffic-label='true'][data-pf24-ownership='other'],
      ${LIVE_ROOT} [data-pf24-traffic-label='true'][data-pf24-ownership='other'] span,
      ${LIVE_ROOT} [data-pf24-traffic-label='true'][data-pf24-ownership='other'] button,
      ${LIVE_ROOT} [data-pf24-traffic-label='true'][data-pf24-ownership='other'] input { color:${GREY} !important; }
      ${LIVE_ROOT} [data-pf24-traffic-label='true'][data-pf24-ownership='mine'],
      ${LIVE_ROOT} [data-pf24-traffic-label='true'][data-pf24-ownership='mine'] span,
      ${LIVE_ROOT} [data-pf24-traffic-label='true'][data-pf24-ownership='mine'] button,
      ${LIVE_ROOT} [data-pf24-traffic-label='true'][data-pf24-ownership='mine'] input { color:${GREEN} !important; }
      ${LIVE_ROOT} [data-pf24-traffic-label='true'] [data-pf24-callsign-menu='true'],
      ${LIVE_ROOT} [data-pf24-traffic-label='true'] [data-pf24-callsign-menu='true'] button,
      ${LIVE_ROOT} [data-pf24-traffic-label='true'] [data-pf24-callsign-menu='true'] span { color:#ededed !important; }
      ${LIVE_ROOT} [data-pf24-traffic-label='true'] [data-pf24-callsign-menu='true'] > div:first-child { color:#22e000 !important; }
      ${LIVE_ROOT} button[data-pf24-owner-action='true'] { font-size:0 !important; }
      ${LIVE_ROOT} button[data-pf24-owner-action='true']::after { content:attr(data-pf24-owner-action-label); font-size:13px; }
    `;
    document.head.appendChild(style);

    sync();
    const timer = window.setInterval(sync, 120);
    const schedule = () => window.requestAnimationFrame(sync);

    const onActionCapture = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      const menu = button?.closest<HTMLElement>("[data-pf24-callsign-menu='true']");
      const label = menu?.closest<HTMLElement>("[data-pf24-traffic-label='true']");
      if (!button || !menu || !label) return;

      if (button.dataset.pf24OwnerActionLabel === "Req on Freq") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }

      const action = button.textContent?.trim().toUpperCase() ?? "";
      if (action !== "ASSUME" && action !== "FREE") return;
      const key = norm(trafficCallsign(label));
      const meta = plannedMeta.get(key);
      if (!key || !meta) return;

      const currentOwner = meta.owner;
      if (action === "ASSUME" && (!currentOwner || currentOwner === position) && position) {
        setOptimisticOwners((current) => ({ ...current, [key]: { owner: position, expiresAt: Date.now() + 2500 } }));
        window.setTimeout(() => void loadPlans(), 300);
      }
      if (action === "FREE" && currentOwner === position) {
        setOptimisticOwners((current) => ({ ...current, [key]: { owner: null, expiresAt: Date.now() + 2500 } }));
        window.setTimeout(() => void loadPlans(), 300);
      }
    };

    document.addEventListener("click", schedule, true);
    window.addEventListener("click", onActionCapture, true);
    window.addEventListener("pf24-scope-connection-change", schedule);
    window.addEventListener("pf24-traffic-ownership-change", schedule);
    window.addEventListener(OWNERS_EVENT, schedule);

    return () => {
      style.remove();
      window.clearInterval(timer);
      document.removeEventListener("click", schedule, true);
      window.removeEventListener("click", onActionCapture, true);
      window.removeEventListener("pf24-scope-connection-change", schedule);
      window.removeEventListener("pf24-traffic-ownership-change", schedule);
      window.removeEventListener(OWNERS_EVENT, schedule);
    };
  }, [loadPlans, plannedMeta, position, sync]);

  return null;
}
