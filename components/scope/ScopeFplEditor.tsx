"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getFlightPlanExtraFieldsFromNotes,
  getGameCallsignFromNotes,
  getVisibleFlightPlanNotes,
  normalizeAircraftRegistration,
  normalizeAirportIcao,
  normalizeCruiseSpeed,
  normalizeFuelDuration,
  normalizeGameCallsign,
  setFlightPlanExtraFieldsInNotes,
  setVisibleFlightPlanNotes,
} from "@/lib/flightPlanGameCallsign";
import { normalizeAirlineCallsign } from "@/lib/scope/airlines";
import { supabase } from "@/lib/supabase";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = { initialPlans: ScopeFlightPlan[] };

type Draft = {
  callsign: string;
  flightLevel: string;
  departure: string;
  cruiseSpeed: string;
  arrival: string;
  aircraft: string;
  alternate: string;
  fuelDuration: string;
  flightRules: string;
  registration: string;
  route: string;
  remarks: string;
};

const FLIGHT_RULES = ["IFR", "VFR", "YFR", "ZFR"];

function norm(value: string | null | undefined) {
  return normalizeGameCallsign(String(value ?? ""));
}

function callsignVariants(value: string | null | undefined) {
  const variants = new Set<string>();
  const raw = String(value ?? "");
  const basic = norm(raw);
  const airline = norm(normalizeAirlineCallsign(raw));
  if (basic) variants.add(basic);
  if (airline) variants.add(airline);
  return variants;
}

function flightSuffix(value: string | null | undefined) {
  return norm(value).match(/(\d{1,4}[A-Z]?)$/)?.[1] ?? "";
}

function planVariants(plan: ScopeFlightPlan) {
  const variants = new Set<string>();
  for (const value of [plan.callsign, getGameCallsignFromNotes(plan.notes)]) {
    for (const variant of callsignVariants(value)) variants.add(variant);
  }
  return variants;
}

function planForTraffic(plans: ScopeFlightPlan[], displayedCallsign: string) {
  const trafficVariants = callsignVariants(displayedCallsign);
  const exact = plans.filter((plan) => {
    const variants = planVariants(plan);
    return Array.from(trafficVariants).some((key) => variants.has(key));
  });
  if (exact.length === 1) return exact[0];

  const suffix = flightSuffix(displayedCallsign);
  if (!suffix) return exact[0] ?? null;
  const suffixMatches = plans.filter((plan) =>
    [plan.callsign, getGameCallsignFromNotes(plan.notes)].some((value) => flightSuffix(value) === suffix),
  );
  return suffixMatches.length === 1 ? suffixMatches[0] : exact[0] ?? null;
}

function callsignFromLabel(label: HTMLElement) {
  const button = Array.from(label.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => {
    if (candidate.closest("[data-pf24-callsign-menu='true']")) return false;
    return /^[A-Z0-9-]{2,20}$/.test(candidate.textContent?.trim().toUpperCase() ?? "");
  });
  return button?.textContent?.trim().toUpperCase() ?? "";
}

function draftFromPlan(plan: ScopeFlightPlan): Draft {
  const extra = getFlightPlanExtraFieldsFromNotes(plan.notes);
  return {
    callsign: plan.callsign ?? "",
    flightLevel: plan.flight_level ?? "",
    departure: plan.departure_icao ?? "",
    cruiseSpeed: extra.cruiseSpeed,
    arrival: plan.arrival_icao ?? "",
    aircraft: plan.aircraft_type ?? "",
    alternate: extra.alternate,
    fuelDuration: extra.fuelDuration,
    flightRules: plan.flight_rules ?? "IFR",
    registration: extra.registration,
    route: plan.route ?? "",
    remarks: getVisibleFlightPlanNotes(plan.notes),
  };
}

function findRadarHost() {
  return document.querySelector<HTMLElement>("main.fixed > section");
}

export default function ScopeFplEditor({ initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const [planId, setPlanId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [radarHost, setRadarHost] = useState<HTMLElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const activePlan = useMemo(
    () => planId ? plans.find((plan) => plan.id === planId) ?? null : null,
    [planId, plans],
  );

  const loadPlans = useCallback(async () => {
    const { data, error } = await supabase
      .from("flight_plans")
      .select("*")
      .neq("status", "FINISHED")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("PF24 Scope FPL editor refresh failed:", error);
      return;
    }
    setPlans((data ?? []) as ScopeFlightPlan[]);
  }, []);

  useEffect(() => {
    const locate = () => setRadarHost(findRadarHost());
    locate();
    const timer = window.setInterval(locate, 500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("scope-fpl-editor-flight-plans-v1")
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, () => void loadPlans())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadPlans]);

  useEffect(() => {
    if (!activePlan || !planId) return;
    if (saving) return;
    setDraft((current) => current ?? draftFromPlan(activePlan));
  }, [activePlan, planId, saving]);

  useEffect(() => {
    const onFplClick = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      const menu = button?.closest<HTMLElement>("[data-pf24-callsign-menu='true']");
      const label = menu?.closest<HTMLElement>("[data-pf24-traffic-label='true']");
      if (!button || !menu || !label) return;
      if ((button.textContent?.trim().toUpperCase() ?? "") !== "FPL") return;

      const callsign = callsignFromLabel(label);
      const plan = planForTraffic(plans, callsign);
      if (!plan) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setPlanId(plan.id);
      setDraft(draftFromPlan(plan));
      setMessage("");
    };

    document.addEventListener("click", onFplClick, true);
    return () => document.removeEventListener("click", onFplClick, true);
  }, [plans]);

  const close = () => {
    setPlanId(null);
    setDraft(null);
    setMessage("");
  };

  const patch = (field: keyof Draft, value: string) => {
    setDraft((current) => current ? { ...current, [field]: value } : current);
    setMessage("");
  };

  const save = async () => {
    if (!activePlan || !draft || saving) return;

    const callsign = normalizeGameCallsign(draft.callsign);
    const flightLevel = draft.flightLevel.replace(/\D/g, "").slice(0, 3);
    const departure = normalizeAirportIcao(draft.departure);
    const arrival = normalizeAirportIcao(draft.arrival);
    const alternate = normalizeAirportIcao(draft.alternate);
    const cruiseSpeed = normalizeCruiseSpeed(draft.cruiseSpeed);
    const fuelDuration = normalizeFuelDuration(draft.fuelDuration);
    const registration = normalizeAircraftRegistration(draft.registration);
    const aircraft = draft.aircraft.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    const flightRules = draft.flightRules.toUpperCase();
    const route = draft.route.toUpperCase().replace(/\s+/g, " ").trim();

    if (callsign.length < 2 || callsign.length > 12) {
      setMessage("Callsign inválido.");
      return;
    }
    if (!/^\d{1,3}$/.test(flightLevel)) {
      setMessage("Flight Level inválido.");
      return;
    }
    if (!/^[A-Z0-9]{4}$/.test(departure) || !/^[A-Z0-9]{4}$/.test(arrival) || !/^[A-Z0-9]{4}$/.test(alternate)) {
      setMessage("Los aeropuertos deben usar ICAO de 4 caracteres.");
      return;
    }
    if (!/^\d{1,3}$/.test(cruiseSpeed)) {
      setMessage("Cruising Speed inválido.");
      return;
    }
    if (fuelDuration && !/^\d{2}\.\d{2}$/.test(fuelDuration)) {
      setMessage("Fuel Endurance debe usar 99.99.");
      return;
    }
    if (!aircraft || !FLIGHT_RULES.includes(flightRules) || !route) {
      setMessage("Faltan datos obligatorios.");
      return;
    }
    if (plans.some((plan) => plan.id !== activePlan.id && norm(plan.callsign) === callsign)) {
      setMessage("Ese callsign ya está en uso.");
      return;
    }

    let notes = setFlightPlanExtraFieldsInNotes(activePlan.notes, {
      alternate,
      cruiseSpeed,
      fuelDuration,
      registration,
    });
    notes = setVisibleFlightPlanNotes(notes, draft.remarks);

    setSaving(true);
    setMessage("Guardando...");
    const update = {
      callsign,
      flight_level: flightLevel,
      departure_icao: departure,
      arrival_icao: arrival,
      aircraft_type: aircraft,
      flight_rules: flightRules,
      route,
      notes,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("flight_plans")
      .update(update)
      .eq("id", activePlan.id)
      .neq("status", "FINISHED")
      .select("*")
      .maybeSingle();

    setSaving(false);
    if (error || !data) {
      console.error("PF24 Scope FPL editor save failed:", error);
      setMessage("No se pudo guardar el FPL.");
      return;
    }

    const saved = data as ScopeFlightPlan;
    setPlans((current) => current.map((plan) => plan.id === saved.id ? saved : plan));
    setDraft(draftFromPlan(saved));
    setMessage("Guardado");
    window.dispatchEvent(new CustomEvent("pf24-traffic-ownership-change"));
  };

  if (!radarHost || !activePlan || !draft) return null;

  return createPortal(
    <div data-pf24-atc-fpl-editor="true" className="absolute left-1/2 top-1/2 z-[190] w-[900px] max-w-[calc(100%-40px)] -translate-x-1/2 -translate-y-1/2 border border-[#888] bg-[#cfcfcf] p-[12px] font-mono text-[16px] text-[#101010] shadow-[0_4px_18px_rgba(0,0,0,.55)]">
      <div className="mb-[8px] flex items-center justify-between text-[17px]">
        <span>Flight Plan</span>
        <span className="text-[11px]">ATC EDIT</span>
      </div>
      <div className="border-2 border-[#ededed] px-[8px] pb-[12px] pt-[14px]">
        <div className="grid grid-cols-2 gap-x-[48px] gap-y-[8px]">
          <FplField label="Callsign" value={draft.callsign} onChange={(value) => patch("callsign", normalizeGameCallsign(value))} maxLength={12} />
          <FplField label="Flight Level" value={draft.flightLevel} onChange={(value) => patch("flightLevel", value.replace(/\D/g, "").slice(0, 3))} maxLength={3} />
          <FplField label="Departure" value={draft.departure} onChange={(value) => patch("departure", normalizeAirportIcao(value))} maxLength={4} />
          <FplField label="Cruising Speed" value={draft.cruiseSpeed} onChange={(value) => patch("cruiseSpeed", normalizeCruiseSpeed(value))} maxLength={3} />
          <FplField label="Arrival" value={draft.arrival} onChange={(value) => patch("arrival", normalizeAirportIcao(value))} maxLength={4} />
          <FplField label="Aircraft" value={draft.aircraft} onChange={(value) => patch("aircraft", value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))} maxLength={8} />
          <FplField label="Alternative" value={draft.alternate} onChange={(value) => patch("alternate", normalizeAirportIcao(value))} maxLength={4} />
          <FplField label="Fuel Endurance" value={draft.fuelDuration} onChange={(value) => patch("fuelDuration", normalizeFuelDuration(value))} maxLength={5} />
          <label className="grid grid-cols-[170px_1fr] items-center gap-[8px]">
            <span className="text-right text-[14px]">Flight Rules</span>
            <select value={draft.flightRules} onChange={(event) => patch("flightRules", event.target.value)} className="h-[29px] border border-[#aaa] bg-[#ededed] px-[7px] text-[14px] outline-none">
              {FLIGHT_RULES.map((rule) => <option key={rule} value={rule}>{rule}</option>)}
            </select>
          </label>
          <FplField label="Acft Registration" value={draft.registration} onChange={(value) => patch("registration", normalizeAircraftRegistration(value))} maxLength={10} />
        </div>
        <div className="mt-[12px] grid grid-cols-2 gap-[20px]">
          <FplArea label="Route" value={draft.route} onChange={(value) => patch("route", value.toUpperCase())} />
          <FplArea label="Remarks" value={draft.remarks} onChange={(value) => patch("remarks", value)} />
        </div>
      </div>
      <div className="mt-[10px] flex items-center justify-between gap-3">
        <span className={`text-[11px] ${message.includes("inválido") || message.includes("debe") || message.includes("Faltan") || message.includes("No se pudo") || message.includes("uso") ? "text-[#b00020]" : "text-[#222]"}`}>{message}</span>
        <div className="flex gap-2">
          <button type="button" disabled={saving} onClick={() => void save()} className="border border-[#777] bg-[#e9e9e9] px-[22px] py-[4px] text-[13px] shadow-[inset_1px_1px_#fff] hover:bg-white disabled:opacity-50">Save</button>
          <button type="button" disabled={saving} onClick={close} className="border border-[#999] bg-[#e9e9e9] px-[22px] py-[4px] text-[13px] shadow-[inset_1px_1px_#fff] hover:bg-white disabled:opacity-50">Close</button>
        </div>
      </div>
    </div>,
    radarHost,
  );
}

function FplField({ label, value, onChange, maxLength }: { label: string; value: string; onChange: (value: string) => void; maxLength?: number }) {
  return <label className="grid grid-cols-[170px_1fr] items-center gap-[8px]">
    <span className="text-right text-[14px]">{label}</span>
    <input value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} className="h-[29px] border border-[#aaa] bg-[#ededed] px-[7px] text-[14px] outline-none focus:border-[#333]" />
  </label>;
}

function FplArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block">
    <span className="mb-[5px] block text-[14px]">{label}</span>
    <textarea value={value} onChange={(event) => onChange(event.target.value)} className="h-[150px] w-full resize-none overflow-auto border border-[#aaa] bg-[#ededed] p-[7px] text-[14px] outline-none focus:border-[#333]" />
  </label>;
}
