"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getGameCallsignFromNotes, normalizeGameCallsign } from "@/lib/flightPlanGameCallsign";
import { supabase } from "@/lib/supabase";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = { initialPlans: ScopeFlightPlan[] };
type StoredConnection = { callsign?: string };
type UnplannedOwners = Record<string, string>;
type PendingKind = "offer" | "request";
type Pending = {
  id: string;
  kind: PendingKind;
  key: string;
  callsign: string;
  from: string;
  to: string;
  planId: string | null;
  createdAt: number;
};
type ResolveMessage = {
  kind: "resolve";
  refId: string;
  key: string;
  from: string;
  to: string;
  accepted: boolean;
};
type HandoverMessage = Pending | ResolveMessage;
type Popup = { key: string; callsign: string; x: number; y: number } | null;
type VisualState = Record<string, { kind: "incoming-transfer" | "incoming-request"; from: string; to: string }>;

type ActiveSession = { position?: string | null; is_active?: boolean | null };

const CONNECTION_KEY = "pf24_scope_connection_session_v1";
const OUTGOING_KEY = "pf24_scope_handover_outgoing_v1";
const CHANNEL_NAME = "scope-traffic-handover-v1";
const OWNERS_EVENT = "pf24-unplanned-ownership-sync";
const VISUAL_EVENT = "pf24-traffic-handover-state";
const UNPLANNED_APPLY_EVENT = "pf24-unplanned-handover-apply";
const MAX_AGE_MS = 10 * 60 * 1000;

function norm(value: string) { return normalizeGameCallsign(value); }
function readPosition() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(CONNECTION_KEY) ?? "null") as StoredConnection | null;
    return stored?.callsign?.trim().toUpperCase() ?? "";
  } catch { return ""; }
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
  const shown = norm(plan.callsign);
  const game = norm(getGameCallsignFromNotes(plan.notes));
  if (shown) keys.add(shown);
  if (game) keys.add(game);
  return Array.from(keys);
}
function readOutgoing(): Record<string, Pending> {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(OUTGOING_KEY) ?? "{}") as Record<string, Pending>;
    const now = Date.now();
    return Object.fromEntries(Object.entries(parsed).filter(([, item]) => item && now - Number(item.createdAt || 0) < MAX_AGE_MS));
  } catch { return {}; }
}
function writeOutgoing(value: Record<string, Pending>) { sessionStorage.setItem(OUTGOING_KEY, JSON.stringify(value)); }
function uid(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }

export default function ScopeTrafficHandover({ initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const [position, setPosition] = useState("");
  const [activeSectors, setActiveSectors] = useState<string[]>([]);
  const [unplannedOwners, setUnplannedOwners] = useState<UnplannedOwners>({});
  const [outgoing, setOutgoing] = useState<Record<string, Pending>>(() => typeof window === "undefined" ? {} : readOutgoing());
  const [incoming, setIncoming] = useState<Record<string, Pending>>({});
  const [selectedTargets, setSelectedTargets] = useState<Record<string, string>>({});
  const [popup, setPopup] = useState<Popup>(null);
  const [radar, setRadar] = useState<HTMLElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedRef = useRef(false);

  const planByKey = useMemo(() => {
    const map = new Map<string, ScopeFlightPlan>();
    for (const plan of plans) for (const key of planKeys(plan)) map.set(key, plan);
    return map;
  }, [plans]);

  const ownerForKey = useCallback((key: string) => {
    const plan = planByKey.get(key);
    if (plan) return plan.assumed_by?.trim().toUpperCase() || "";
    return unplannedOwners[key]?.trim().toUpperCase() || "";
  }, [planByKey, unplannedOwners]);

  const loadPlans = useCallback(async () => {
    const { data, error } = await supabase.from("flight_plans").select("*").neq("status", "FINISHED");
    if (error) { console.error("PF24 Scope handover plan refresh failed:", error); return; }
    setPlans((data ?? []) as ScopeFlightPlan[]);
  }, []);

  const loadActiveSectors = useCallback(async () => {
    const { data, error } = await supabase.from("atc_sessions").select("position,is_active").eq("is_active", true);
    if (error) { console.error("PF24 Scope active sector refresh failed:", error); return; }
    const unique = Array.from(new Set(((data ?? []) as ActiveSession[]).map((row) => row.position?.trim().toUpperCase() || "").filter(Boolean))).sort();
    setActiveSectors(unique);
  }, []);

  const sendMessage = useCallback(async (message: HandoverMessage) => {
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current) return;
    await channel.send({ type: "broadcast", event: "handover", payload: message });
  }, []);

  const publishVisualState = useCallback((nextIncoming = incoming, nextPosition = position) => {
    const visuals: VisualState = {};
    for (const item of Object.values(nextIncoming)) {
      if (item.to !== nextPosition) continue;
      visuals[item.key] = { kind: item.kind === "offer" ? "incoming-transfer" : "incoming-request", from: item.from, to: item.to };
    }
    window.dispatchEvent(new CustomEvent(VISUAL_EVENT, { detail: { states: visuals } }));
  }, [incoming, position]);

  useEffect(() => { writeOutgoing(outgoing); }, [outgoing]);
  useEffect(() => { publishVisualState(); }, [incoming, position, publishVisualState]);

  useEffect(() => {
    setPosition(readPosition());
    setRadar(document.querySelector<HTMLElement>("main.fixed > section"));
    void loadActiveSectors();

    const onConnection = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean; callsign?: string }>).detail;
      const next = detail?.connected ? (detail.callsign?.trim().toUpperCase() || readPosition()) : "";
      setPosition(next);
      if (!next) {
        setPopup(null);
        setIncoming({});
        setSelectedTargets({});
      }
    };
    const onOwners = (event: Event) => {
      const detail = (event as CustomEvent<{ owners?: UnplannedOwners }>).detail;
      setUnplannedOwners(detail?.owners ?? {});
    };
    const onResize = () => setRadar(document.querySelector<HTMLElement>("main.fixed > section"));
    window.addEventListener("pf24-scope-connection-change", onConnection);
    window.addEventListener(OWNERS_EVENT, onOwners);
    window.addEventListener("resize", onResize);
    window.dispatchEvent(new Event("pf24-unplanned-ownership-request"));
    return () => {
      window.removeEventListener("pf24-scope-connection-change", onConnection);
      window.removeEventListener(OWNERS_EVENT, onOwners);
      window.removeEventListener("resize", onResize);
    };
  }, [loadActiveSectors]);

  useEffect(() => {
    const flightChannel = supabase.channel("scope-handover-plans").on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, () => void loadPlans()).subscribe();
    const atcChannel = supabase.channel("scope-handover-atc-sessions").on("postgres_changes", { event: "*", schema: "public", table: "atc_sessions" }, () => void loadActiveSectors()).subscribe();
    return () => { void supabase.removeChannel(flightChannel); void supabase.removeChannel(atcChannel); };
  }, [loadActiveSectors, loadPlans]);

  useEffect(() => {
    const channel = supabase.channel(CHANNEL_NAME, { config: { broadcast: { self: true } } });
    channelRef.current = channel;
    channel.on("broadcast", { event: "handover" }, ({ payload }) => {
      const message = payload as HandoverMessage;
      if (!message || typeof message !== "object") return;
      if (message.kind === "resolve") {
        setOutgoing((current) => {
          if (!current[message.refId]) return current;
          const next = { ...current }; delete next[message.refId]; return next;
        });
        setIncoming((current) => {
          if (!current[message.refId]) return current;
          const next = { ...current }; delete next[message.refId]; return next;
        });
        if (message.accepted) window.dispatchEvent(new CustomEvent(UNPLANNED_APPLY_EVENT, { detail: { key: message.key, from: message.from, to: message.to } }));
        window.dispatchEvent(new Event("pf24-traffic-ownership-change"));
        return;
      }
      if (message.to === readPosition() && message.from !== readPosition()) {
        setIncoming((current) => ({ ...current, [message.id]: message }));
      }
    }).subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      subscribedRef.current = true;
      Object.values(readOutgoing()).forEach((item) => void sendMessage(item));
    });
    return () => {
      subscribedRef.current = false;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [sendMessage]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setOutgoing((current) => {
        const next = Object.fromEntries(Object.entries(current).filter(([, item]) => now - item.createdAt < MAX_AGE_MS));
        Object.values(next).forEach((item) => void sendMessage(item));
        return next;
      });
      setIncoming((current) => Object.fromEntries(Object.entries(current).filter(([, item]) => now - item.createdAt < MAX_AGE_MS)));
    }, 2500);
    return () => window.clearInterval(timer);
  }, [sendMessage]);

  const resolveTransfer = useCallback(async (pending: Pending, accepted: boolean) => {
    if (accepted) {
      if (pending.planId) {
        const { data, error } = await supabase.from("flight_plans")
          .update({ assumed_by: pending.to, updated_at: new Date().toISOString() })
          .eq("id", pending.planId)
          .eq("assumed_by", pending.from)
          .select("id,assumed_by")
          .maybeSingle();
        if (error || !data || String(data.assumed_by || "").toUpperCase() !== pending.to) {
          console.error("PF24 Scope handover ownership update failed:", error);
          alert("No se pudo completar la transferencia. El propietario del tráfico cambió.");
          await loadPlans();
          return;
        }
        await loadPlans();
      } else {
        window.dispatchEvent(new CustomEvent(UNPLANNED_APPLY_EVENT, { detail: { key: pending.key, from: pending.from, to: pending.to } }));
      }
    }
    const message: ResolveMessage = { kind: "resolve", refId: pending.id, key: pending.key, from: pending.from, to: pending.to, accepted };
    await sendMessage(message);
    setIncoming((current) => { const next = { ...current }; delete next[pending.id]; return next; });
    setOutgoing((current) => { const next = { ...current }; delete next[pending.id]; return next; });
    window.dispatchEvent(new Event("pf24-traffic-ownership-change"));
  }, [loadPlans, sendMessage]);

  useEffect(() => {
    const onClickCapture = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const separator = target.closest<HTMLElement>("span");
      const separatorLabel = separator?.closest<HTMLElement>("[data-pf24-traffic-label='true']");
      if (separator && separatorLabel && separator.textContent?.trim() === "--") {
        const callsign = trafficCallsign(separatorLabel);
        const key = norm(callsign);
        if (!key || !position || ownerForKey(key) !== position) return;
        const rect = radar?.getBoundingClientRect();
        if (!rect) return;
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        setPopup({ key, callsign, x: event.clientX - rect.left, y: event.clientY - rect.top });
        return;
      }

      const button = target.closest<HTMLButtonElement>("button");
      const menu = button?.closest<HTMLElement>("[data-pf24-callsign-menu='true']");
      const label = menu?.closest<HTMLElement>("[data-pf24-traffic-label='true']");
      if (!button || !menu || !label) return;
      const callsign = trafficCallsign(label);
      const key = norm(callsign);
      if (!key) return;
      const action = (button.dataset.pf24OwnerActionLabel || button.textContent || "").trim().toUpperCase();
      const decline = button.dataset.pf24HandoverDecline === "true";
      if (!["TRANSFER", "REQ ON FREQ", "ACCEPT"].includes(action) && !decline) return;

      const owner = ownerForKey(key);
      const plan = planByKey.get(key) ?? null;
      const incomingForKey = Object.values(incoming).filter((item) => item.key === key && item.to === position);
      const offer = incomingForKey.find((item) => item.kind === "offer");
      const request = incomingForKey.find((item) => item.kind === "request");

      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();

      if (decline) {
        if (request) void resolveTransfer(request, false);
        return;
      }
      if (action === "TRANSFER") {
        if (!position || owner !== position) return;
        const destination = selectedTargets[key];
        if (!destination) { alert("Selecciona primero el sector de destino haciendo click en -- de la etiqueta completa."); return; }
        if (destination === position) return;
        const pending: Pending = { id: uid("offer"), kind: "offer", key, callsign, from: position, to: destination, planId: plan?.id ?? null, createdAt: Date.now() };
        setOutgoing((current) => ({ ...current, [pending.id]: pending }));
        void sendMessage(pending);
        return;
      }
      if (action === "REQ ON FREQ") {
        if (!position || !owner || owner === position) return;
        const already = Object.values(outgoing).some((item) => item.kind === "request" && item.key === key && item.from === position && item.to === owner);
        if (already) return;
        const pending: Pending = { id: uid("request"), kind: "request", key, callsign, from: position, to: owner, planId: plan?.id ?? null, createdAt: Date.now() };
        setOutgoing((current) => ({ ...current, [pending.id]: pending }));
        void sendMessage(pending);
        return;
      }
      if (action === "ACCEPT") {
        if (offer) void resolveTransfer({ ...offer, to: position }, true);
        else if (request) void resolveTransfer({ ...request, from: position, to: request.from }, true);
      }
    };

    window.addEventListener("click", onClickCapture, true);
    return () => window.removeEventListener("click", onClickCapture, true);
  }, [incoming, outgoing, ownerForKey, planByKey, position, radar, resolveTransfer, selectedTargets, sendMessage]);

  useEffect(() => {
    const syncMenus = () => {
      document.querySelectorAll<HTMLElement>("[data-pf24-callsign-menu='true']").forEach((menu) => {
        const label = menu.closest<HTMLElement>("[data-pf24-traffic-label='true']");
        if (!label) return;
        const key = norm(trafficCallsign(label));
        if (!key) return;
        const request = Object.values(incoming).find((item) => item.key === key && item.kind === "request" && item.to === position);
        let decline = menu.querySelector<HTMLButtonElement>("button[data-pf24-handover-decline='true']");
        if (request) {
          if (!decline) {
            decline = document.createElement("button");
            decline.type = "button";
            decline.dataset.pf24HandoverDecline = "true";
            decline.textContent = "Decline";
            decline.className = "block w-full border-t border-[#ededed] bg-transparent text-center text-[10px] leading-[18px] text-[#ededed]";
            menu.appendChild(decline);
          }
        } else if (decline) {
          decline.remove();
        }
      });
    };
    syncMenus();
    const timer = window.setInterval(syncMenus, 180);
    return () => window.clearInterval(timer);
  }, [incoming, position]);

  const popupPortal = radar && popup ? createPortal(
    <div data-pf24-transfer-sector-popup="true" className="pointer-events-auto absolute z-[140] min-w-[150px] border border-[#ededed] bg-[#555c60] font-mono text-[10px] text-[#ededed] shadow-[0_2px_8px_rgba(0,0,0,.45)]" style={{ left: popup.x, top: popup.y }}>
      <div className="border-b border-[#ededed] px-[6px] py-[4px] text-center text-[#00e000]">Transfer {popup.callsign}</div>
      {activeSectors.filter((sector) => sector !== position).length === 0 ? <div className="px-[7px] py-[5px] text-[#c8c8c8]">No active sectors</div> : activeSectors.filter((sector) => sector !== position).map((sector) => <button key={sector} type="button" onClick={() => { setSelectedTargets((current) => ({ ...current, [popup.key]: sector })); setPopup(null); }} className="block w-full border-t border-[#777] px-[7px] py-[4px] text-left hover:bg-[#646b70]">{sector}</button>)}
    </div>, radar) : null;

  return <>{popupPortal}</>;
}
