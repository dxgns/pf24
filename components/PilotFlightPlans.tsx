"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const AIRCRAFT_TYPES = [
  "A220", "A320", "A330", "A350", "B717", "B727", "B737",
  "B757", "B777", "B778", "MD11", "SW3", "C550",
  "C150", "DH8D", "F100", "HAWK", "EUFI", "TBM9", "BE58", "PA46",
];

const AIRPORTS = [
  "LCLK", "LCPH", "LCRA", "MDAB", "MDCR", "MDST", "MDPC",
  "EFKT", "MTCA", "GCLP", "LEMH", "EGKK", "EGHI",
];

type FlightPlan = {
  id: string;
  callsign: string;
  aircraft_type: string;
  flight_rules: string;
  departure_icao: string;
  arrival_icao: string;
  route: string;
  flight_level: string;
  transponder: string;
  status: string;
  sector_status: string;
  notes: string | null;
  assumed_by: string | null;
  created_by: string | null;
};

export default function PilotFlightPlans({
  initialPlans,
  pilotId,
}: {
  initialPlans: FlightPlan[];
  pilotId: string;
}) {
  const [plans, setPlans] = useState(initialPlans);
  const [saving, setSaving] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const channel = supabase
      .channel("pilot-flight-plans")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flight_plans" },
        (payload) => {
          const newPlan = payload.new as FlightPlan;
          const oldPlan = payload.old as FlightPlan;

          if (payload.eventType === "INSERT" && newPlan.created_by === pilotId) {
            setPlans((current) => [newPlan, ...current]);
          }

          if (payload.eventType === "UPDATE" && newPlan.created_by === pilotId) {
            setPlans((current) =>
              current.map((plan) => (plan.id === newPlan.id ? newPlan : plan))
            );
          }

          if (payload.eventType === "DELETE") {
            setPlans((current) =>
              current.filter((plan) => plan.id !== oldPlan.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pilotId]);

  function autoSave(id: string, field: keyof FlightPlan, value: string) {
    setPlans((current) =>
      current.map((plan) =>
        plan.id === id ? { ...plan, [field]: value } : plan
      )
    );

    setSaving(id);

    clearTimeout(timers.current[`${id}-${field}`]);

    timers.current[`${id}-${field}`] = setTimeout(async () => {
      const { error } = await supabase
        .from("flight_plans")
        .update({
          [field]: value,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("created_by", pilotId);

      if (error) {
        console.error(error);
      }

      setSaving(null);
    }, 600);
  }

  if (plans.length === 0) {
    return (
      <div className="mt-10 rounded-3xl border border-white/10 bg-slate-900 p-8 text-slate-300">
        Todavía no has creado planes de vuelo.
      </div>
    );
  }

  return (
    <div className="mt-10 grid gap-6">
      {plans.map((plan) => (
        <div
          key={plan.id}
          className="rounded-3xl border border-white/10 bg-slate-900 p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-sky-400">
                {plan.callsign}
              </h2>
              <p className="text-sm text-slate-400">
                XPDR {plan.transponder} · {plan.status} · {plan.sector_status}
              </p>
            </div>

            <div className="text-sm text-slate-400">
              {saving === plan.id ? "Guardando..." : "Guardado automático"}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <select
              value={plan.aircraft_type}
              onChange={(e) => autoSave(plan.id, "aircraft_type", e.target.value)}
              className="rounded-xl bg-slate-800 p-3"
            >
              {AIRCRAFT_TYPES.map((aircraft) => (
                <option key={aircraft} value={aircraft}>
                  {aircraft}
                </option>
              ))}
            </select>

            <select
              value={plan.flight_rules}
              onChange={(e) => autoSave(plan.id, "flight_rules", e.target.value)}
              className="rounded-xl bg-slate-800 p-3"
            >
              <option value="IFR">IFR</option>
              <option value="VFR">VFR</option>
              <option value="YFR">YFR</option>
              <option value="ZFR">ZFR</option>
            </select>

            <select
              value={plan.departure_icao}
              onChange={(e) => autoSave(plan.id, "departure_icao", e.target.value)}
              className="rounded-xl bg-slate-800 p-3"
            >
              {AIRPORTS.map((airport) => (
                <option key={airport} value={airport}>
                  {airport}
                </option>
              ))}
            </select>

            <select
              value={plan.arrival_icao}
              onChange={(e) => autoSave(plan.id, "arrival_icao", e.target.value)}
              className="rounded-xl bg-slate-800 p-3"
            >
              {AIRPORTS.map((airport) => (
                <option key={airport} value={airport}>
                  {airport}
                </option>
              ))}
            </select>

            <input
              value={plan.route}
              onChange={(e) => autoSave(plan.id, "route", e.target.value.toUpperCase())}
              className="rounded-xl bg-slate-800 p-3"
            />

            <input
              value={plan.flight_level}
              onChange={(e) => autoSave(plan.id, "flight_level", e.target.value.toUpperCase())}
              className="rounded-xl bg-slate-800 p-3"
            />
          </div>

          <textarea
            value={plan.notes ?? ""}
            onChange={(e) => autoSave(plan.id, "notes", e.target.value)}
            placeholder="Notas adicionales"
            className="mt-4 w-full rounded-xl bg-slate-800 p-3"
          />

          <div className="mt-4 rounded-2xl border border-white/10 bg-[#050816] p-4 text-sm text-slate-300">
            <p>ATC asignado: {plan.assumed_by ?? "Sin asumir"}</p>
            <p>Estado administrativo: {plan.status}</p>
            <p>Estado operativo: {plan.sector_status}</p>
          </div>
        </div>
      ))}
    </div>
  );
}