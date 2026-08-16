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
  planId: string | null;
  accepted: boolean;
};
type HandoverMessage = Pending | ResolveMessage;
type Popup = { key: string; callsign: string; x: number; y: number } | null;
type VisualState = Record<string, { kind: "incoming-transfer" | "incoming-request"; from: string; to: string }>;
type ActiveSession = { position?: string | null; is_active?: boolean | null };

const CONNECTION_KEY = "pf24_scope_connection_session_v1";
const OUTGOING_KEY = "pf24_scope_handover_outgoing_v2";
const CHANNEL_NAME = "scope-traffic-handover-v3";
const OWNERS_EVENT = "pf24-unplanned-ownership-sync";
const VISUAL_EVENT = "pf24-traffic-handover-state";
const UNPLANNED_APPLY_EVENT = "pf24-unplanned-handover-apply";
const OWNERSHIP_EVENT = "pf24-traffic-ownership-change";
const OWNERSHIP_HINT_EVENT = "pf24-traffic-ownership-hint";
const MAX_AGE_MS = 5 * 60 * 1000;
const RESEND_MS = 1500;

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
function ownershipHint(key: string, owner: string | null) {
  window.dispatchEvent(new CustomEvent(OWNERSHIP_HINT_EVENT, { detail: { key, owner } }));
  window.dispatchEvent(new Event(OWNERSHIP_EVENT));
}
function removePending(current: Record<string, Pending>, id: string) {
  if (!current[id]) return current;
  const next = { ...current };
  delete next[id];
  return next;
}

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
  const resolvingRef = useRef(new Set<string>());
  const suppressClickRef = useRef<{ element: HTMLButtonElement; until: number } | null>(null);
  const incomingRef = useRef<Record<string, Pending>>({});
  const outgoingRef = useRef<Record<string, Pending>>({});
  const positionRef = useRef("");

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
    setActiveSectors(Array.from(new Set(((data ?? []) as ActiveSession[])
      .map((row) => row.position?.trim().toUpperCase() || "")
      .filter(Boolean))).sort());
  }, []);

  const sendMessage = useCallback(async (message: HandoverMessage) => {
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current) return false;
    try {
      const result = await channel.send({ type: "broadcast", event: "handover", payload: message });
      return result === "ok";
    } catch (error) {
      console.error("PF24 Scope handover broadcast failed:", error);
      return false;
    }
  }, []);

  const publishVisualState = useCallback((nextIncoming = incomingRef.current, nextPosition = positionRef.current) => {
    const visuals: VisualState = {};
    for (const item of Object.values(nextIncoming)) {
      if (item.to !== nextPosition) continue;
      visuals[item.key] = { kind: item.kind === "offer" ? "incoming-transfer" : "incoming-request", from: item.from, to: item.to };
    }
    window.dispatchEvent(new CustomEvent(VISUAL_EVENT, { detail: { states: visuals } }));
  }, []);

  const updateIncoming = useCallback((updater: (current: Record<string, Pending>) => Record<string, Pending>) => {
    setIncoming((current) => {
      const next = updater(current);
      incomingRef.current = next;
      window.setTimeout(() => publishVisualState(next, positionRef.current), 0);
      return next;
    });
  }, [publishVisualState]);

  const updateOutgoing = useCallback((updater: (current: Record<string, Pending>) => Record<string, Pending>) => {
    setOutgoing((current) => {
      const next = updater(current);
      outgoingRef.current = next;
      writeOutgoing(next);
      return next;
    });
  }, []);

  useEffect(() => {
    incomingRef.current = incoming;
    outgoingRef.current = outgoing;
    positionRef.current = position;
  }, [incoming, outgoing, position]);

  useEffect(() => {
    const initial = readPosition();
    positionRef.current = initial;
    setPosition(initial);
    outgoingRef.current = readOutgoing();
    setOutgoing(outgoingRef.current);
    setRadar(document.querySelector<HTMLElement>("main.fixed > section"));
    void loadActiveSectors();

    const onConnection = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean; callsign?: string }>).detail;
      const next = detail?.connected ? (detail.callsign?.trim().toUpperCase() || readPosition()) : "";
      positionRef.current = next;
      setPosition(next);
      if (!next) {
        setPopup(null);
        updateIncoming(() => ({}));
        setSelectedTargets({});
      }
    };
    const onOwners = (event: Event) => setUnplannedOwners((event as CustomEvent<{ owners?: UnplannedOwners }>).detail?.owners ?? {});
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
  }, [loadActiveSectors, updateIncoming]);

  useEffect(() => {
    publishVisualState(incoming, position);
  }, [incoming, position, publishVisualState]);

  useEffect(() => {
    const flightChannel = supabase.channel("scope-handover-plans-v3")
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, () => void loadPlans())
      .subscribe();
    const atcChannel = supabase.channel("scope-handover-atc-sessions-v3")
      .on("postgres_changes", { event: "*", schema: "public", table: "atc_sessions" }, () => void loadActiveSectors())
      .subscribe();
    return () => { void supabase.removeChannel(flightChannel); void supabase.removeChannel(atcChannel); };
  }, [loadActiveSectors, loadPlans]);

  useEffect(() => {
    const channel = supabase.channel(CHANNEL_NAME, { config: { broadcast: { self: true } } });
    channelRef.current = channel;
    channel.on("broadcast", { event: "handover" }, ({ payload }) => {
      const message = payload as HandoverMessage;
      if (!message || typeof message !== "object") return;

      if (message.kind === "resolve") {
        updateOutgoing((current) => removePending(current, message.refId));
        updateIncoming((current) => removePending(current, message.refId));
        if (message.accepted) {
          ownershipHint(message.key, message.to);
          if (message.planId === null) {
            window.dispatchEvent(new CustomEvent(UNPLANNED_APPLY_EVENT, {
              detail: { refId: message.refId, key: message.key, from: message.from, to: message.to },
            }));
          }
        } else {
          window.dispatchEvent(new Event(OWNERSHIP_EVENT));
        }
        return;
      }

      const here = positionRef.current || readPosition();
      if (message.to === here && message.from !== here) {
        updateIncoming((current) => ({ ...current, [message.id]: message }));
      }
    }).subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      subscribedRef.current = true;
      Object.values(outgoingRef.current).forEach((item) => void sendMessage(item));
    });

    return () => {
      subscribedRef.current = false;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [sendMessage, updateIncoming, updateOutgoing]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      updateOutgoing((current) => {
        const next = Object.fromEntries(Object.entries(current).filter(([, item]) => now - item.createdAt < MAX_AGE_MS));
        Object.values(next).forEach((item) => void sendMessage(item));
        return next;
      });
      updateIncoming((current) => Object.fromEntries(Object.entries(current).filter(([, item]) => now - item.createdAt < MAX_AGE_MS)));
    }, RESEND_MS);
    return () => window.clearInterval(timer);
  }, [sendMessage, updateIncoming, updateOutgoing]);

  useEffect(() => {
    const cancelInvalid = () => {
      const active = new Set(activeSectors);
      const invalidOutgoing = Object.values(outgoingRef.current).filter((item) => {
        const owner = ownerForKey(item.key);
        const expectedOwner = item.kind === "offer" ? item.from : item.to;
        if (owner !== expectedOwner) return true;
        if (item.kind === "offer" && !active.has(item.to)) return true;
        return false;
      });
      if (invalidOutgoing.length) {
        updateOutgoing((current) => {
          const next = { ...current };
          for (const item of invalidOutgoing) delete next[item.id];
          return next;
        });
        for (const item of invalidOutgoing) {
          void sendMessage({ kind: "resolve", refId: item.id, key: item.key, from: item.from, to: item.to, planId: item.planId, accepted: false });
        }
      }

      const invalidIncoming = Object.values(incomingRef.current).filter((item) => {
        const owner = ownerForKey(item.key);
        const expectedOwner = item.kind === "offer" ? item.from : item.to;
        return owner !== expectedOwner;
      });
      if (invalidIncoming.length) {
        updateIncoming((current) => {
          const next = { ...current };
          for (const item of invalidIncoming) delete next[item.id];
          return next;
        });
      }
    };
    cancelInvalid();
  }, [activeSectors, ownerForKey, plans, unplannedOwners, sendMessage, updateIncoming, updateOutgoing]);

  const resolveTransfer = useCallback(async (pending: Pending, accepted: boolean) => {
    if (resolvingRef.current.has(pending.id)) return;
    resolvingRef.current.add(pending.id);

    // Remove the pending visual immediately so Accept/Decline feels deterministic.
    const previousIncoming = incomingRef.current[pending.id];
    updateIncoming((current) => removePending(current, pending.id));

    let finalAccepted = accepted;
    try {
      if (accepted) {
        ownershipHint(pending.key, pending.to);

        if (pending.planId) {
          const { data, error } = await supabase.from("flight_plans")
            .update({ assumed_by: pending.to, updated_at: new Date().toISOString() })
            .eq("id", pending.planId)
            .eq("assumed_by", pending.from)
            .select("id,assumed_by")
            .maybeSingle();

          if (error || !data || String(data.assumed_by || "").trim().toUpperCase() !== pending.to) {
            console.error("PF24 Scope handover ownership update failed:", error);
            finalAccepted = false;
            if (previousIncoming) updateIncoming((current) => ({ ...current, [pending.id]: previousIncoming }));
            await loadPlans();
            window.dispatchEvent(new Event(OWNERSHIP_EVENT));
          } else {
            await loadPlans();
          }
        } else {
          window.dispatchEvent(new CustomEvent(UNPLANNED_APPLY_EVENT, {
            detail: { refId: pending.id, key: pending.key, from: pending.from, to: pending.to },
          }));
        }
      }

      const message: ResolveMessage = {
        kind: "resolve",
        refId: pending.id,
        key: pending.key,
        from: pending.from,
        to: pending.to,
        planId: pending.planId,
        accepted: finalAccepted,
      };
      await sendMessage(message);

      updateOutgoing((current) => removePending(current, pending.id));
      if (!finalAccepted) updateIncoming((current) => removePending(current, pending.id));
      window.dispatchEvent(new Event(OWNERSHIP_EVENT));

      if (accepted && !finalAccepted) {
        alert("No se pudo completar la transferencia porque el propietario del tráfico cambió.");
      }
    } finally {
      resolvingRef.current.delete(pending.id);
    }
  }, [loadPlans, sendMessage, updateIncoming, updateOutgoing]);

  const handleOwnerAction = useCallback((button: HTMLButtonElement, label: HTMLElement) => {
    const callsign = trafficCallsign(label);
    const key = norm(callsign);
    if (!key) return false;

    const action = (button.dataset.pf24OwnerActionLabel || button.textContent || "").trim().toUpperCase();
    const decline = button.dataset.pf24HandoverDecline === "true";
    if (!["TRANSFER", "REQ ON FREQ", "ACCEPT"].includes(action) && !decline) return false;

    const here = positionRef.current || position;
    const owner = ownerForKey(key);
    const plan = planByKey.get(key) ?? null;
    const incomingForKey = Object.values(incomingRef.current).filter((item) => item.key === key && item.to === here);
    const offer = incomingForKey.find((item) => item.kind === "offer");
    const request = incomingForKey.find((item) => item.kind === "request");

    if (decline) {
      if (request) void resolveTransfer(request, false);
      return true;
    }

    if (action === "TRANSFER") {
      if (!here || owner !== here) return true;
      const destination = selectedTargets[key];
      if (!destination || destination === here) {
        if (!destination) alert("Selecciona primero el sector de destino haciendo click en -- de la etiqueta completa.");
        return true;
      }
      if (!activeSectors.includes(destination)) {
        setSelectedTargets((current) => { const next = { ...current }; delete next[key]; return next; });
        alert("Ese sector ya no está conectado.");
        return true;
      }
      const duplicate = Object.values(outgoingRef.current).some((item) => item.kind === "offer" && item.key === key);
      if (duplicate) return true;

      const pending: Pending = {
        id: uid("offer"), kind: "offer", key, callsign, from: here, to: destination,
        planId: plan?.id ?? null, createdAt: Date.now(),
      };
      updateOutgoing((current) => ({ ...current, [pending.id]: pending }));
      setSelectedTargets((current) => { const next = { ...current }; delete next[key]; return next; });
      void sendMessage(pending);
      return true;
    }

    if (action === "REQ ON FREQ") {
      if (!here || !owner || owner === here) return true;
      const duplicate = Object.values(outgoingRef.current).some((item) => item.kind === "request" && item.key === key && item.from === here && item.to === owner);
      if (duplicate) return true;

      const pending: Pending = {
        id: uid("request"), kind: "request", key, callsign, from: here, to: owner,
        planId: plan?.id ?? null, createdAt: Date.now(),
      };
      updateOutgoing((current) => ({ ...current, [pending.id]: pending }));
      void sendMessage(pending);
      return true;
    }

    if (action === "ACCEPT") {
      if (offer) {
        void resolveTransfer({ ...offer, to: here }, true);
      } else if (request) {
        // Request semantics: owner accepts handing the traffic to the requester.
        void resolveTransfer({ ...request, from: here, to: request.from }, true);
      }
      return true;
    }

    return false;
  }, [activeSectors, ownerForKey, planByKey, position, resolveTransfer, selectedTargets, sendMessage, updateOutgoing]);

  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24HandoverFixes = "v3";
    style.textContent = `
      [data-pf24-transfer-separator='true']{
        display:block!important;
        min-width:12px!important;
        width:12px!important;
        white-space:nowrap!important;
        overflow:visible!important;
        word-break:keep-all!important;
        letter-spacing:-1px!important;
        text-align:center!important;
      }
      [data-pf24-traffic-label='true'] .grid:has(> [data-pf24-transfer-separator='true']){
        grid-template-columns:54px 12px 36px!important;
      }
    `;
    document.head.appendChild(style);

    const markSeparators = () => {
      document.querySelectorAll<HTMLElement>("[data-pf24-traffic-label='true']").forEach((label) => {
        Array.from(label.querySelectorAll<HTMLElement>("span")).forEach((span) => {
          if (span.textContent?.trim() === "--") span.dataset.pf24TransferSeparator = "true";
        });
      });
    };
    markSeparators();
    const markerTimer = window.setInterval(markSeparators, 120);

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const separator = target.closest<HTMLElement>("[data-pf24-transfer-separator='true']");
      const separatorLabel = separator?.closest<HTMLElement>("[data-pf24-traffic-label='true']");
      if (separator && separatorLabel) {
        const callsign = trafficCallsign(separatorLabel);
        const key = norm(callsign);
        const here = positionRef.current || position;
        if (!key || !here || ownerForKey(key) !== here) return;
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
      if (!handleOwnerAction(button, label)) return;

      suppressClickRef.current = { element: button, until: Date.now() + 900 };
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    };

    const onClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      const suppressed = suppressClickRef.current;
      if (button && suppressed?.element === button && suppressed.until > Date.now()) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        suppressClickRef.current = null;
      }
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("click", onClick, true);
    return () => {
      style.remove();
      window.clearInterval(markerTimer);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("click", onClick, true);
    };
  }, [handleOwnerAction, ownerForKey, position, radar]);

  useEffect(() => {
    const syncMenus = () => {
      document.querySelectorAll<HTMLElement>("[data-pf24-callsign-menu='true']").forEach((menu) => {
        const label = menu.closest<HTMLElement>("[data-pf24-traffic-label='true']");
        if (!label) return;
        const key = norm(trafficCallsign(label));
        if (!key) return;

        const request = Object.values(incomingRef.current)
          .find((item) => item.key === key && item.kind === "request" && item.to === positionRef.current);
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
    const timer = window.setInterval(syncMenus, 120);
    return () => window.clearInterval(timer);
  }, []);

  const availableTargets = activeSectors.filter((sector) => sector !== position);
  const popupPortal = radar && popup ? createPortal(
    <div
      data-pf24-transfer-sector-popup="true"
      className="pointer-events-auto absolute z-[140] min-w-[150px] border border-[#ededed] bg-[#555c60] font-mono text-[10px] text-[#ededed] shadow-[0_2px_8px_rgba(0,0,0,.45)]"
      style={{ left: popup.x, top: popup.y }}
      onMouseLeave={() => setPopup(null)}
    >
      <div className="border-b border-[#ededed] px-[6px] py-[4px] text-center text-[#00e000]">Transfer {popup.callsign}</div>
      {availableTargets.length === 0
        ? <div className="px-[7px] py-[5px] text-[#c8c8c8]">No active sectors</div>
        : availableTargets.map((sector) => (
          <button
            key={sector}
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setSelectedTargets((current) => ({ ...current, [popup.key]: sector }));
              setPopup(null);
            }}
            className="block w-full border-t border-[#777] px-[7px] py-[4px] text-left hover:bg-[#646b70]"
          >{sector}</button>
        ))}
    </div>,
    radar,
  ) : null;

  return <>{popupPortal}</>;
}
