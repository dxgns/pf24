"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getGameCallsignFromNotes, normalizeGameCallsign } from "@/lib/flightPlanGameCallsign";
import { supabase } from "@/lib/supabase";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = { initialPlans: ScopeFlightPlan[] };
type StoredConnection = { callsign?: string };
type UnplannedOwners = Record<string, string>;
type PlannedMeta = { owner: string | null; transponder: string };
type HandoverState = Record<string, { kind: "incoming-transfer" | "incoming-request"; from: string; to: string }>;
type OptimisticOwner = { owner: string | null; previousOwner: string | null; expiresAt: number };

const CONNECTION_STORAGE_KEY = "pf24_scope_connection_session_v1";
const LIVE_ROOT = "[data-pf24-live-traffic='true']";
const OWNERS_EVENT = "pf24-unplanned-ownership-sync";
const OWNERS_REQUEST_EVENT = "pf24-unplanned-ownership-request";
const HANDOVER_EVENT = "pf24-traffic-handover-state";
const OWNERSHIP_EVENT = "pf24-traffic-ownership-change";
const OWNERSHIP_HINT_EVENT = "pf24-traffic-ownership-hint";
const GREEN = "#00e000";
const GREY = "#9b9b9b";
const FREE = "#d8d8d8";

function norm(value: string) { return normalizeGameCallsign(value); }
function readPosition() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CONNECTION_STORAGE_KEY) ?? "null") as StoredConnection | null;
    return parsed?.callsign?.trim().toUpperCase() ?? "";
  } catch { return ""; }
}
function trafficCallsign(label: HTMLElement) {
  const button = Array.from(label.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => {
    if (candidate.closest("[data-pf24-callsign-menu='true']")) return false;
    return /^[A-Z0-9-]{2,12}$/.test(candidate.textContent?.trim().toUpperCase() ?? "");
  });
  return button?.textContent?.trim().toUpperCase() ?? "";
}
function callsignButton(label: HTMLElement) {
  return Array.from(label.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => {
    if (candidate.closest("[data-pf24-callsign-menu='true']")) return false;
    return /^[A-Z0-9-]{2,12}$/.test(candidate.textContent?.trim().toUpperCase() ?? "");
  }) ?? null;
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
    if (element.dataset.pf24MappIndicator === "true") return;
    setImportant(element, "color", color);
  });
}
function paintCallsign(label: HTMLElement, color: string) { setImportant(callsignButton(label), "color", color); }
function syncTransponder(label: HTMLElement, transponder: string) {
  const node = Array.from(label.children).find((child) => child instanceof HTMLElement && /^A\d{4}$/.test(child.textContent?.trim().toUpperCase() ?? ""));
  if (node instanceof HTMLElement) node.textContent = `A${transponder}`;
}
function syncMenuOwnership(label: HTMLElement, owner: string | null, position: string, handover?: HandoverState[string]) {
  const menu = label.querySelector<HTMLElement>("[data-pf24-callsign-menu='true']");
  if (!menu) return;
  const button = Array.from(menu.querySelectorAll<HTMLButtonElement>(":scope > button")).find((candidate) => {
    const text = (candidate.dataset.pf24OwnerActionLabel || candidate.textContent || "").trim().toUpperCase();
    return ["ASSUME", "TRANSFER", "REQ ON FREQ", "ACCEPT"].includes(text) || candidate.dataset.pf24OwnerAction === "true";
  });
  if (!button) return;
  const labelText = handover ? "Accept" : owner ? (position && owner === position ? "Transfer" : "Req on Freq") : "Assume";
  button.dataset.pf24OwnerAction = "true";
  button.dataset.pf24OwnerActionLabel = labelText;
  if (button.textContent?.trim() !== labelText) button.textContent = labelText;
}

export default function ScopeTrafficOwnershipVisuals({ initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const [position, setPosition] = useState("");
  const [unplannedOwners, setUnplannedOwners] = useState<UnplannedOwners>({});
  const [handoverStates, setHandoverStates] = useState<HandoverState>({});
  const [optimisticOwners, setOptimisticOwners] = useState<Record<string, OptimisticOwner>>({});
  const refreshTimerRef = useRef<number | null>(null);

  const plannedMeta = useMemo(() => {
    const map = new Map<string, PlannedMeta>();
    for (const plan of plans) {
      const meta = { owner: plan.assumed_by?.trim().toUpperCase() || null, transponder: normalizeTransponder(plan.transponder) };
      for (const key of planKeys(plan)) map.set(key, meta);
    }
    return map;
  }, [plans]);

  const loadPlans = useCallback(async () => {
    const { data, error } = await supabase.from("flight_plans").select("*").neq("status", "FINISHED");
    if (error) { console.error("PF24 Scope ownership refresh failed:", error); return; }
    setPlans((data ?? []) as ScopeFlightPlan[]);
  }, []);

  const scheduleRefresh = useCallback((delay = 80) => {
    if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => { refreshTimerRef.current = null; void loadPlans(); }, delay);
  }, [loadPlans]);

  useEffect(() => {
    setPosition(readPosition());
    const onConnection = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean; callsign?: string }>).detail;
      setPosition(detail?.connected ? (detail.callsign?.trim().toUpperCase() || readPosition()) : "");
      if (!detail?.connected) { setOptimisticOwners({}); setHandoverStates({}); }
    };
    const onUnplannedOwners = (event: Event) => setUnplannedOwners((event as CustomEvent<{ owners?: UnplannedOwners }>).detail?.owners ?? {});
    const onHandover = (event: Event) => setHandoverStates((event as CustomEvent<{ states?: HandoverState }>).detail?.states ?? {});
    const onHint = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string; owner?: string | null }>).detail;
      const key = norm(detail?.key ?? "");
      if (!key) return;
      const owner = detail?.owner?.trim().toUpperCase() || null;
      const previousOwner = plannedMeta.get(key)?.owner ?? (unplannedOwners[key]?.trim().toUpperCase() || null);
      setOptimisticOwners((current) => ({ ...current, [key]: { owner, previousOwner, expiresAt: Date.now() + 4000 } }));
      scheduleRefresh(120);
    };
    const onOwnershipChange = () => scheduleRefresh(40);
    window.addEventListener("pf24-scope-connection-change", onConnection);
    window.addEventListener(OWNERS_EVENT, onUnplannedOwners);
    window.addEventListener(HANDOVER_EVENT, onHandover);
    window.addEventListener(OWNERSHIP_HINT_EVENT, onHint);
    window.addEventListener(OWNERSHIP_EVENT, onOwnershipChange);
    window.dispatchEvent(new Event(OWNERS_REQUEST_EVENT));
    return () => {
      window.removeEventListener("pf24-scope-connection-change", onConnection);
      window.removeEventListener(OWNERS_EVENT, onUnplannedOwners);
      window.removeEventListener(HANDOVER_EVENT, onHandover);
      window.removeEventListener(OWNERSHIP_HINT_EVENT, onHint);
      window.removeEventListener(OWNERSHIP_EVENT, onOwnershipChange);
    };
  }, [plannedMeta, scheduleRefresh, unplannedOwners]);

  useEffect(() => {
    const channel = supabase.channel("scope-traffic-ownership-visuals-v4")
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
        const meta = plannedMeta.get(key);
        const actual = meta ? meta.owner : (unplannedOwners[key]?.trim().toUpperCase() || null);
        if (optimistic.expiresAt <= now || actual === optimistic.owner || actual !== optimistic.previousOwner) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [plannedMeta, unplannedOwners]);

  const sync = useCallback(() => {
    const root = document.querySelector<HTMLElement>(LIVE_ROOT);
    if (!root) return;
    const labels = Array.from(root.querySelectorAll<HTMLElement>("[data-pf24-traffic-label='true']"));
    const targets = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-pf24-traffic-select='true']"));
    const groups = Array.from(root.querySelectorAll<SVGGElement>("svg > g"));
    const now = Date.now();

    labels.forEach((label, index) => {
      const key = norm(trafficCallsign(label));
      if (!key) return;
      const meta = plannedMeta.get(key);
      const optimistic = optimisticOwners[key];
      const owner = optimistic && optimistic.expiresAt > now
        ? optimistic.owner
        : meta ? meta.owner : (unplannedOwners[key]?.trim().toUpperCase() || null);
      const mine = Boolean(position && owner === position);
      const handover = handoverStates[key];
      let color = mine ? GREEN : owner ? GREY : FREE;
      let callsignColor: string | null = null;
      if (handover?.kind === "incoming-transfer") { color = FREE; callsignColor = GREEN; }
      if (handover?.kind === "incoming-request") { color = GREEN; callsignColor = FREE; }

      const ownership = handover?.kind ?? (mine ? "mine" : owner ? "other" : "free");
      label.dataset.pf24Ownership = ownership;
      paintLabel(label, color);
      if (callsignColor) paintCallsign(label, callsignColor);
      syncTransponder(label, meta?.transponder ?? "9999");
      syncMenuOwnership(label, owner, position, handover);

      const target = targets[index];
      const group = groups[index];
      if (target) target.dataset.pf24Ownership = ownership;
      if (group) group.dataset.pf24Ownership = ownership;
      setImportant(target?.querySelector<HTMLElement>(":scope > span"), "border-color", color);
      group?.querySelectorAll<SVGLineElement>("line").forEach((line) => setImportant(line, "stroke", color));
      group?.querySelectorAll<SVGCircleElement>("circle").forEach((circle) => setImportant(circle, "fill", color));
    });
  }, [handoverStates, optimisticOwners, plannedMeta, position, unplannedOwners]);

  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24TrafficOwnershipBaseline = "v4";
    style.textContent = `
      /* New React traffic nodes start as FREE until the ownership authority paints them.
         Inline !important ownership colors applied by sync() override this baseline. */
      ${LIVE_ROOT} [data-pf24-traffic-label='true']:not([data-pf24-ownership]) { color:${FREE} !important; }
      ${LIVE_ROOT} [data-pf24-traffic-label='true']:not([data-pf24-ownership]) span:not([data-pf24-mapp-indicator='true']),
      ${LIVE_ROOT} [data-pf24-traffic-label='true']:not([data-pf24-ownership]) button,
      ${LIVE_ROOT} [data-pf24-traffic-label='true']:not([data-pf24-ownership]) input { color:${FREE} !important; }
      ${LIVE_ROOT} [data-pf24-traffic-select='true']:not([data-pf24-ownership]) > span { border-color:${FREE} !important; }
      ${LIVE_ROOT} svg > g:not([data-pf24-ownership]) line { stroke:${FREE} !important; }
      ${LIVE_ROOT} svg > g:not([data-pf24-ownership]) circle { fill:${FREE} !important; }

      ${LIVE_ROOT} [data-pf24-traffic-label='true'] [data-pf24-callsign-menu='true'],
      ${LIVE_ROOT} [data-pf24-traffic-label='true'] [data-pf24-callsign-menu='true'] button,
      ${LIVE_ROOT} [data-pf24-traffic-label='true'] [data-pf24-callsign-menu='true'] span { color:#ededed !important; }
      ${LIVE_ROOT} [data-pf24-traffic-label='true'] [data-pf24-callsign-menu='true'] > div:first-child { color:#22e000 !important; }
      ${LIVE_ROOT} button[data-pf24-owner-action='true'] { font-size:0 !important; }
      ${LIVE_ROOT} button[data-pf24-owner-action='true']::after { content:attr(data-pf24-owner-action-label); font-size:13px; }
    `;
    document.head.appendChild(style);

    const onAction = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      const menu = button?.closest<HTMLElement>("[data-pf24-callsign-menu='true']");
      const label = menu?.closest<HTMLElement>("[data-pf24-traffic-label='true']");
      if (!button || !menu || !label) return;
      const action = (button.dataset.pf24OwnerActionLabel || button.textContent || "").trim().toUpperCase();
      if (action !== "ASSUME" && action !== "FREE") return;
      const key = norm(trafficCallsign(label));
      if (!key) return;
      const previousOwner = plannedMeta.get(key)?.owner ?? (unplannedOwners[key]?.trim().toUpperCase() || null);
      if (action === "ASSUME" && position) {
        setOptimisticOwners((current) => ({ ...current, [key]: { owner: position, previousOwner, expiresAt: Date.now() + 4000 } }));
        scheduleRefresh(200);
      }
      if (action === "FREE") {
        setOptimisticOwners((current) => ({ ...current, [key]: { owner: null, previousOwner, expiresAt: Date.now() + 4000 } }));
        scheduleRefresh(200);
      }
    };

    sync();
    const timer = window.setInterval(sync, 80);
    const onStateChange = () => window.requestAnimationFrame(sync);
    document.addEventListener("click", onAction, true);
    window.addEventListener(OWNERSHIP_EVENT, onStateChange);
    window.addEventListener(OWNERS_EVENT, onStateChange);
    window.addEventListener(HANDOVER_EVENT, onStateChange);

    return () => {
      style.remove();
      window.clearInterval(timer);
      document.removeEventListener("click", onAction, true);
      window.removeEventListener(OWNERSHIP_EVENT, onStateChange);
      window.removeEventListener(OWNERS_EVENT, onStateChange);
      window.removeEventListener(HANDOVER_EVENT, onStateChange);
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
    };
  }, [plannedMeta, position, scheduleRefresh, sync, unplannedOwners]);

  return null;
}
