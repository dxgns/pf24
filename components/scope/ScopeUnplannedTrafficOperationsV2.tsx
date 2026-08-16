"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getGameCallsignFromNotes, normalizeGameCallsign } from "@/lib/flightPlanGameCallsign";
import { supabase } from "@/lib/supabase";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = { initialPlans: ScopeFlightPlan[] };
type StoredConnection = { callsign?: string };
type AssumedMap = Record<string, string>;

const CONNECTION_STORAGE_KEY = "pf24_scope_connection_session_v1";
const UNPLANNED_STORAGE_KEY = "pf24_scope_unplanned_assumed_v2";
const GREEN = "#00e000";
const GREY = "#9b9b9b";

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

function readAssumed(): AssumedMap {
  try {
    const value = JSON.parse(sessionStorage.getItem(UNPLANNED_STORAGE_KEY) ?? "{}") as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? value as AssumedMap : {};
  } catch {
    return {};
  }
}

function saveAssumed(value: AssumedMap) {
  sessionStorage.setItem(UNPLANNED_STORAGE_KEY, JSON.stringify(value));
}

function trafficCallsign(label: HTMLElement) {
  const button = Array.from(label.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => {
    if (candidate.closest("[data-pf24-callsign-menu='true']")) return false;
    return /^[A-Z0-9-]{2,12}$/.test(candidate.textContent?.trim().toUpperCase() ?? "");
  });
  return button?.textContent?.trim().toUpperCase() ?? "";
}

function planKeys(plan: ScopeFlightPlan) {
  const keys = [norm(plan.callsign)];
  const game = norm(getGameCallsignFromNotes(plan.notes));
  if (game) keys.push(game);
  return keys.filter(Boolean);
}

function setImportant(element: HTMLElement | SVGElement | undefined | null, property: string, value: string) {
  element?.style.setProperty(property, value, "important");
}

function paintUnplanned(callsign: string, color: string) {
  const root = document.querySelector<HTMLElement>("[data-pf24-live-traffic='true']");
  if (!root) return;

  const labels = Array.from(root.querySelectorAll<HTMLElement>("[data-pf24-traffic-label='true']"));
  const targets = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-pf24-traffic-select='true']"));
  const groups = Array.from(root.querySelectorAll<SVGGElement>("svg > g"));

  labels.forEach((label, index) => {
    if (norm(trafficCallsign(label)) !== norm(callsign)) return;

    setImportant(label, "color", color);
    label.querySelectorAll<HTMLElement>("span,button,input").forEach((element) => {
      if (!element.closest("[data-pf24-callsign-menu='true']")) setImportant(element, "color", color);
    });

    setImportant(targets[index]?.querySelector<HTMLElement>(":scope > span"), "border-color", color);
    groups[index]?.querySelectorAll<SVGLineElement>("line").forEach((line) => setImportant(line, "stroke", color));
    groups[index]?.querySelectorAll<SVGCircleElement>("circle").forEach((circle) => setImportant(circle, "fill", color));
  });
}

export default function ScopeUnplannedTrafficOperationsV2({ initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const [position, setPosition] = useState("");
  const [assumed, setAssumed] = useState<AssumedMap>({});
  const [blankFplCallsign, setBlankFplCallsign] = useState<string | null>(null);
  const [radarHost, setRadarHost] = useState<HTMLElement | null>(null);

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

  useEffect(() => {
    setPosition(readPosition());
    setAssumed(readAssumed());
    setRadarHost(document.querySelector<HTMLElement>("main.fixed > section"));

    const locate = window.setTimeout(() => setRadarHost(document.querySelector<HTMLElement>("main.fixed > section")), 150);
    const onConnection = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean; callsign?: string }>).detail;
      setPosition(detail?.connected ? (detail.callsign?.trim().toUpperCase() || readPosition()) : "");
    };

    window.addEventListener("pf24-scope-connection-change", onConnection);
    return () => {
      window.clearTimeout(locate);
      window.removeEventListener("pf24-scope-connection-change", onConnection);
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("scope-unplanned-plans-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, () => void loadPlans())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadPlans]);

  const mine = useCallback((callsign: string) => Boolean(position && assumed[norm(callsign)] === position), [assumed, position]);

  const syncVisuals = useCallback(() => {
    const labels = Array.from(document.querySelectorAll<HTMLElement>("[data-pf24-traffic-label='true']"));
    for (const label of labels) {
      const callsign = trafficCallsign(label);
      if (!callsign || plannedKeys.has(norm(callsign))) continue;
      paintUnplanned(callsign, mine(callsign) ? GREEN : GREY);
    }

    const menus = Array.from(document.querySelectorAll<HTMLElement>("[data-pf24-callsign-menu='true']"));
    for (const menu of menus) {
      const label = menu.closest<HTMLElement>("[data-pf24-traffic-label='true']");
      if (!label) continue;
      const callsign = trafficCallsign(label);
      if (!callsign || plannedKeys.has(norm(callsign))) continue;
      const assumeButton = Array.from(menu.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
        ["ASSUME", "TRANSFER"].includes(button.textContent?.trim().toUpperCase() ?? ""),
      );
      if (assumeButton) assumeButton.textContent = mine(callsign) ? "Transfer" : "Assume";
    }
  }, [mine, plannedKeys]);

  useEffect(() => {
    syncVisuals();
    const timer = window.setInterval(syncVisuals, 350);
    return () => window.clearInterval(timer);
  }, [syncVisuals]);

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
      if (!callsign || plannedKeys.has(key)) return;

      // This listener is attached to window capture, before the generic planned-flight
      // handler on document. Unplanned traffic therefore never falls through to the
      // old "no plan associated" error path.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (action === "FPL") {
        setRadarHost(document.querySelector<HTMLElement>("main.fixed > section"));
        setBlankFplCallsign(callsign);
        return;
      }

      if (action === "TRANSFER") return;

      if (action === "ASSUME") {
        if (!position) {
          alert("Debes estar conectado a un sector activo antes de asumir tráfico.");
          return;
        }
        const owner = assumed[key];
        if (owner && owner !== position) {
          alert(`Este tráfico ya está asumido por ${owner}.`);
          return;
        }
        setAssumed((current) => {
          const next = { ...current, [key]: position };
          saveAssumed(next);
          return next;
        });
        paintUnplanned(callsign, GREEN);
        return;
      }

      if (action === "FREE") {
        if (!position || assumed[key] !== position) {
          alert("Solo puedes liberar tráfico asumido por tu mismo sector.");
          return;
        }
        setAssumed((current) => {
          const next = { ...current };
          delete next[key];
          saveAssumed(next);
          return next;
        });
        paintUnplanned(callsign, GREY);
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
  }, [assumed, plannedKeys, position]);

  const fplPortal = radarHost && blankFplCallsign ? createPortal(
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
        <button type="button" onClick={() => setBlankFplCallsign(null)} className="border border-[#888] bg-[#e8e8e8] px-4 py-1">Close</button>
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
