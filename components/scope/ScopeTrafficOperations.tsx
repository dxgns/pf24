"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ATC_FREQUENCIES } from "@/lib/atcFrequencies";
import { getVisibleFlightPlanNotes, normalizeGameCallsign } from "@/lib/flightPlanGameCallsign";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = {
  initialPlans: ScopeFlightPlan[];
};

type StoredConnection = {
  callsign?: string;
};

const CONNECTION_STORAGE_KEY = "pf24_scope_connection_session_v1";
const HOLD_STORAGE_KEY = "pf24_scope_hold_traffic_v1";
const GREEN = "#00e000";
const GREY = "#9b9b9b";

function normalized(value: string) {
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

function readHeldIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HOLD_STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function findScopeWindow(title: string) {
  const normalizedTitle = title.toUpperCase();
  return Array.from(document.querySelectorAll<HTMLElement>("main.fixed > section > div.absolute.z-30"))
    .find((element) => element.firstElementChild?.textContent?.toUpperCase().includes(normalizedTitle)) ?? null;
}

function findRadarHost() {
  return document.querySelector<HTMLElement>("main.fixed > section");
}

function callsignFromTrafficLabel(label: HTMLElement) {
  const buttons = Array.from(label.querySelectorAll<HTMLButtonElement>("button"));
  const callsignButton = buttons.find((button) => {
    if (button.closest("[data-pf24-callsign-menu='true']")) return false;
    return /^[A-Z0-9-]{2,12}$/.test(button.textContent?.trim().toUpperCase() ?? "");
  });
  return callsignButton?.textContent?.trim().toUpperCase() ?? "";
}

function planForDisplayedCallsign(plans: ScopeFlightPlan[], callsign: string) {
  const key = normalized(callsign);
  return plans.find((plan) => normalized(plan.callsign) === key) ?? null;
}

function setTreeColor(root: HTMLElement, color: string) {
  root.style.color = color;
  root.querySelectorAll<HTMLElement>("span,button,input").forEach((element) => {
    if (element.closest("[data-pf24-callsign-menu='true']")) return;
    element.style.color = color;
  });
}

export default function ScopeTrafficOperations({ initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const [position, setPosition] = useState("");
  const [heldIds, setHeldIds] = useState<string[]>([]);
  const [fplPlanId, setFplPlanId] = useState<string | null>(null);
  const [holdWindow, setHoldWindow] = useState<HTMLElement | null>(null);
  const [radarHost, setRadarHost] = useState<HTMLElement | null>(null);

  const planByCallsign = useMemo(() => {
    const map = new Map<string, ScopeFlightPlan>();
    for (const plan of plans) map.set(normalized(plan.callsign), plan);
    return map;
  }, [plans]);

  const heldPlans = useMemo(
    () => heldIds.map((id) => plans.find((plan) => plan.id === id)).filter((plan): plan is ScopeFlightPlan => Boolean(plan)),
    [heldIds, plans],
  );

  const fplPlan = fplPlanId ? plans.find((plan) => plan.id === fplPlanId) ?? null : null;

  const loadPlans = useCallback(async () => {
    const { data, error } = await supabase
      .from("flight_plans")
      .select("*")
      .neq("status", "FINISHED")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("PF24 Scope traffic operations plan load failed:", error);
      return;
    }
    setPlans((data ?? []) as ScopeFlightPlan[]);
  }, []);

  const syncHosts = useCallback(() => {
    setHoldWindow(findScopeWindow("HOLD LIST"));
    setRadarHost(findRadarHost());
  }, []);

  useEffect(() => {
    setPosition(readPosition());
    setHeldIds(readHeldIds());
    syncHosts();

    const first = window.setTimeout(syncHosts, 80);
    const second = window.setTimeout(syncHosts, 280);
    const onConnection = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean; callsign?: string }>).detail;
      setPosition(detail?.connected ? (detail.callsign?.trim().toUpperCase() || readPosition()) : "");
    };
    const onUiClick = () => window.setTimeout(syncHosts, 0);

    window.addEventListener("pf24-scope-connection-change", onConnection);
    document.addEventListener("click", onUiClick, true);
    window.addEventListener("resize", syncHosts);

    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
      window.removeEventListener("pf24-scope-connection-change", onConnection);
      document.removeEventListener("click", onUiClick, true);
      window.removeEventListener("resize", syncHosts);
    };
  }, [syncHosts]);

  useEffect(() => {
    const channel = supabase
      .channel("scope-traffic-operations-flight-plans")
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, () => void loadPlans())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadPlans]);

  useEffect(() => {
    const valid = new Set(plans.map((plan) => plan.id));
    setHeldIds((current) => {
      const next = current.filter((id) => valid.has(id));
      if (next.length !== current.length) localStorage.setItem(HOLD_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [plans]);

  const syncVisualState = useCallback(() => {
    const labels = Array.from(document.querySelectorAll<HTMLElement>("[data-pf24-traffic-label='true']"));
    for (const label of labels) {
      const displayed = callsignFromTrafficLabel(label);
      const plan = planByCallsign.get(normalized(displayed));
      const controlledByMe = Boolean(plan && position && plan.assumed_by === position);
      setTreeColor(label, controlledByMe ? GREEN : GREY);
    }

    const sector = document.querySelector<HTMLElement>("[data-pf24-live-sector-list='true']");
    if (sector) {
      const rows = Array.from(sector.children).slice(1).filter((element): element is HTMLElement => element instanceof HTMLElement);
      for (const wrapper of rows) {
        const row = wrapper.firstElementChild instanceof HTMLElement ? wrapper.firstElementChild : wrapper;
        const callsign = row.firstElementChild?.textContent?.trim().toUpperCase() ?? "";
        const plan = planByCallsign.get(normalized(callsign));
        const color = plan && position && plan.assumed_by === position ? GREEN : GREY;
        setTreeColor(row, color);
      }
    }

    const menus = Array.from(document.querySelectorAll<HTMLElement>("[data-pf24-callsign-menu='true']"));
    for (const menu of menus) {
      const label = menu.closest<HTMLElement>("[data-pf24-traffic-label='true']");
      if (!label) continue;
      const displayed = callsignFromTrafficLabel(label);
      const plan = planByCallsign.get(normalized(displayed));
      const buttons = Array.from(menu.querySelectorAll<HTMLButtonElement>("button"));
      const assume = buttons.find((button) => ["ASSUME", "TRANSFER"].includes(button.textContent?.trim().toUpperCase() ?? ""));
      const hold = buttons.find((button) => ["HOLD", "XHOLD"].includes(button.textContent?.trim().toUpperCase() ?? ""));
      if (assume) assume.textContent = plan && position && plan.assumed_by === position ? "Transfer" : "Assume";
      if (hold && plan) hold.textContent = heldIds.includes(plan.id) ? "XHOLD" : "HOLD";
    }
  }, [heldIds, planByCallsign, position]);

  useEffect(() => {
    syncVisualState();
    const timer = window.setInterval(syncVisualState, 500);
    return () => window.clearInterval(timer);
  }, [syncVisualState]);

  useEffect(() => {
    if (!holdWindow) return;
    const header = holdWindow.firstElementChild;
    const legacyBody = Array.from(holdWindow.children).find((child) => child !== header && !(child instanceof HTMLElement && child.dataset.pf24LiveHoldList === "true"));
    if (!(legacyBody instanceof HTMLElement)) return;
    const previous = legacyBody.style.display;
    legacyBody.style.display = "none";
    return () => {
      legacyBody.style.display = previous;
    };
  }, [holdWindow]);

  const toggleHold = (plan: ScopeFlightPlan) => {
    setHeldIds((current) => {
      const next = current.includes(plan.id) ? current.filter((id) => id !== plan.id) : [...current, plan.id];
      localStorage.setItem(HOLD_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const assume = async (plan: ScopeFlightPlan) => {
    if (!position) {
      alert("Debes estar conectado a un sector activo antes de asumir tráfico.");
      return;
    }
    if (plan.assumed_by === position) return;
    if (plan.assumed_by && plan.assumed_by !== position) {
      alert(`Este tráfico ya está asumido por ${plan.assumed_by}.`);
      return;
    }

    setPlans((current) => current.map((item) => item.id === plan.id ? { ...item, assumed_by: position } : item));
    const { data, error } = await supabase
      .from("flight_plans")
      .update({ assumed_by: position, updated_at: new Date().toISOString() })
      .eq("id", plan.id)
      .is("assumed_by", null)
      .select("id,assumed_by")
      .maybeSingle();

    if (error || !data || data.assumed_by !== position) {
      console.error("PF24 Scope assume failed:", error);
      await loadPlans();
      alert("No se pudo asumir el tráfico. Puede que otro sector lo haya asumido primero.");
    }
  };

  const free = async (plan: ScopeFlightPlan) => {
    if (!position || plan.assumed_by !== position) {
      alert("Solo puedes liberar tráfico asumido por tu mismo sector.");
      return;
    }

    setPlans((current) => current.map((item) => item.id === plan.id ? { ...item, assumed_by: null } : item));
    const { error } = await supabase
      .from("flight_plans")
      .update({ assumed_by: null, updated_at: new Date().toISOString() })
      .eq("id", plan.id)
      .eq("assumed_by", position);

    if (error) {
      console.error("PF24 Scope free traffic failed:", error);
      await loadPlans();
      alert("No se pudo liberar el tráfico.");
    }
  };

  const contactMe = async (plan: ScopeFlightPlan) => {
    if (!position || plan.assumed_by !== position) {
      alert("Debes asumir este tráfico antes de enviar Contact Me.");
      return;
    }
    if (!plan.created_by) {
      alert("Este plan no tiene un piloto asociado para recibir Contact Me.");
      return;
    }
    const frequency = ATC_FREQUENCIES[position];
    if (!frequency) {
      alert(`No hay frecuencia configurada para ${position}.`);
      return;
    }
    const message = `Contacte ${position} en ${frequency}`;
    const { error } = await supabase.from("contact_messages").insert({
      flight_plan_id: plan.id,
      callsign: plan.callsign,
      pilot_id: plan.created_by,
      controller_position: position,
      frequency,
      message,
    });
    if (error) {
      console.error("PF24 Scope Contact Me failed:", error);
      alert("No se pudo enviar el Contact Me.");
      return;
    }
    alert(`Mensaje enviado: ${message}`);
  };

  useEffect(() => {
    const onMenuClick = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      const menu = button?.closest<HTMLElement>("[data-pf24-callsign-menu='true']");
      const label = menu?.closest<HTMLElement>("[data-pf24-traffic-label='true']");
      if (!button || !menu || !label) return;

      const action = button.textContent?.trim().toUpperCase() ?? "";
      if (!["ASSUME", "TRANSFER", "FPL", "HOLD", "XHOLD", "FREE", "CONTACT ME"].includes(action)) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const callsign = callsignFromTrafficLabel(label);
      const plan = planForDisplayedCallsign(plans, callsign);
      if (!plan) {
        alert(`No hay un plan PF24 asociado a ${callsign || "este tráfico"}.`);
        return;
      }

      if (action === "FPL") setFplPlanId(plan.id);
      else if (action === "HOLD" || action === "XHOLD") toggleHold(plan);
      else if (action === "ASSUME") void assume(plan);
      else if (action === "TRANSFER") return;
      else if (action === "FREE") void free(plan);
      else if (action === "CONTACT ME") void contactMe(plan);

      window.setTimeout(syncVisualState, 0);
    };

    document.addEventListener("click", onMenuClick, true);
    return () => document.removeEventListener("click", onMenuClick, true);
  }, [plans, position, syncVisualState]);

  const holdPortal = holdWindow ? createPortal(
    <div data-pf24-live-hold-list="true" className="border-x-2 border-b-2 border-[#ededed] bg-[#555c61] font-mono text-[10px] leading-[15px] text-[#e8e8e8]">
      <div className="grid grid-cols-[28px_1fr_45px_45px] border-b border-[#ededed]">
        <span className="border-r border-[#ededed]" />
        <span className="text-center text-[12px]">CALLSIGN</span>
        <span className="text-center text-[12px]">FL</span>
        <span className="text-center text-[12px]">AFL</span>
      </div>
      <div className="min-h-[78px]">
        {heldPlans.map((plan) => (
          <div key={plan.id} className="grid grid-cols-[28px_1fr_45px_45px]">
            <span className="border-r border-[#ededed]" />
            <span className="truncate px-[3px]">{plan.callsign}</span>
            <span className="text-center">{plan.flight_level || "---"}</span>
            <span className="text-center">{plan.flight_level || "---"}</span>
          </div>
        ))}
      </div>
    </div>,
    holdWindow,
  ) : null;

  const fplPortal = radarHost && fplPlan ? createPortal(
    <div className="absolute left-1/2 top-1/2 z-[120] w-[900px] max-w-[calc(100%-40px)] -translate-x-1/2 -translate-y-1/2 border border-[#888] bg-[#cfcfcf] p-[12px] font-mono text-[16px] text-[#101010] shadow-[0_4px_18px_rgba(0,0,0,.55)]">
      <div className="mb-[8px] text-[17px]">Flight Plan</div>
      <div className="border-2 border-[#ededed] px-[8px] pb-[12px] pt-[14px]">
        <div className="grid grid-cols-2 gap-x-[48px] gap-y-[8px]">
          <FplField label="Callsign" value={fplPlan.callsign} />
          <FplField label="Flight Level" value={fplPlan.flight_level} />
          <FplField label="Departure" value={fplPlan.departure_icao} />
          <FplField label="Cruising Speed" value="" />
          <FplField label="Arrival" value={fplPlan.arrival_icao} />
          <FplField label="Aircraft" value={fplPlan.aircraft_type} />
          <FplField label="Alternative" value="" />
          <FplField label="Fuel Endurance" value="" />
          <FplField label="Flight Rules" value={fplPlan.flight_rules} />
          <FplField label="Acft Registration" value="" />
        </div>
        <div className="mt-[12px] grid grid-cols-2 gap-[20px]">
          <FplArea label="Route" value={fplPlan.route} />
          <FplArea label="Remarks" value={getVisibleFlightPlanNotes(fplPlan.notes)} />
        </div>
      </div>
      <div className="mt-[10px] flex justify-end">
        <button type="button" onClick={() => setFplPlanId(null)} className="border border-[#999] bg-[#e9e9e9] px-[22px] py-[4px] text-[13px] shadow-[inset_1px_1px_#fff] hover:bg-white">Close</button>
      </div>
    </div>,
    radarHost,
  ) : null;

  return <>{holdPortal}{fplPortal}</>;
}

function FplField({ label, value }: { label: string; value: string }) {
  return <label className="grid grid-cols-[170px_1fr] items-center gap-[8px]">
    <span className="text-right text-[14px]">{label}</span>
    <div className="h-[29px] border border-[#ddd] bg-[#ededed] px-[7px] leading-[27px]">{value}</div>
  </label>;
}

function FplArea({ label, value }: { label: string; value: string }) {
  return <label className="block">
    <span className="mb-[5px] block text-[14px]">{label}</span>
    <div className="h-[150px] overflow-auto border border-[#ddd] bg-[#ededed] p-[7px] whitespace-pre-wrap">{value}</div>
  </label>;
}
