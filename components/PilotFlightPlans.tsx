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
  const [plans, setPlans] = useState(
    initialPlans.filter((plan) => plan.status !== "FINISHED")
  );

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

          if (payload.eventType === "INSERT") {
            if (
              newPlan.created_by === pilotId &&
              newPlan.status !== "FINISHED"
            ) {
              setPlans((current) => [newPlan, ...current]);
            }
          }

          if (payload.eventType === "UPDATE") {
            if (newPlan.created_by !== pilotId) return;

            if (newPlan.status === "FINISHED") {
              setPlans((current) =>
                current.filter((plan) => plan.id !== newPlan.id)
              );
              return;
            }

            setPlans((current) => {
              const exists = current.some((plan) => plan.id === newPlan.id);

              if (!exists) {
                return [newPlan, ...current];
              }

              return current.map((plan) =>
                plan.id === newPlan.id ? newPlan : plan
              );
            });
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

  function normalizeField(field: keyof FlightPlan, value: string) {
    if (field === "callsign") {
      return value.toUpperCase().replace(/\s/g, "");
    }

    if (field === "route") {
      return value.toUpperCase();
    }

    if (field === "flight_level") {
      return value.replace(/\D/g, "").slice(0, 3);
    }

    return value;
  }

  function autoSave(id: string, field: keyof FlightPlan, value: string) {
    const cleanValue = normalizeField(field, value);

    setPlans((current) =>
      current.map((plan) =>
        plan.id === id ? { ...plan, [field]: cleanValue } : plan
      )
    );

    setSaving(id);

    clearTimeout(timers.current[`${id}-${field}`]);

    timers.current[`${id}-${field}`] = setTimeout(async () => {
      const { error } = await supabase
        .from("flight_plans")
        .update({
          [field]: cleanValue,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("created_by", pilotId)
        .neq("status", "FINISHED");

      if (error) {
        console.error(error);
      }

      setSaving(null);
    }, 600);
  }

  async function finishFlight(id: string) {
    const confirmed = confirm(
      "¿Finalizar este vuelo y volver al dashboard?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("flight_plans")
      .update({
        status: "FINISHED",
        sector_status: "PARKED",
        assumed_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("created_by", pilotId)
      .neq("status", "FINISHED");

    if (error) {
      console.error(error);
      return;
    }

    setPlans((current) => current.filter((plan) => plan.id !== id));
    window.location.href = "/dashboard";
  }

  if (plans.length === 0) {
    return (
      <div className="panel mt-10 rounded-3xl p-8 text-slate-300">
        No tienes vuelos activos actualmente. Puedes crear un nuevo plan de vuelo.
      </div>
    );
  }

  return (
    <div className="mt-10 grid gap-6">
      {plans.map((plan) => {
        const isFinished = plan.status === "FINISHED";

        return (
          <div key={plan.id} className="panel rounded-3xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <input
                  value={plan.callsign}
                  disabled={isFinished}
                  onChange={(e) =>
                    autoSave(plan.id, "callsign", e.target.value)
                  }
                  className="mono w-full bg-transparent text-2xl font-extrabold text-sky-400 outline-none disabled:opacity-60"
                />

                <p className="mt-1 text-sm text-slate-400">
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
                disabled={isFinished}
                onChange={(e) =>
                  autoSave(plan.id, "aircraft_type", e.target.value)
                }
                className="input-control rounded-xl p-3 disabled:opacity-60"
              >
                {AIRCRAFT_TYPES.map((aircraft) => (
                  <option key={aircraft} value={aircraft}>
                    {aircraft}
                  </option>
                ))}
              </select>

              <select
                value={plan.flight_rules}
                disabled={isFinished}
                onChange={(e) =>
                  autoSave(plan.id, "flight_rules", e.target.value)
                }
                className="input-control rounded-xl p-3 disabled:opacity-60"
              >
                <option value="IFR">IFR</option>
                <option value="VFR">VFR</option>
                <option value="YFR">YFR</option>
                <option value="ZFR">ZFR</option>
              </select>

              <select
                value={plan.departure_icao}
                disabled={isFinished}
                onChange={(e) =>
                  autoSave(plan.id, "departure_icao", e.target.value)
                }
                className="input-control rounded-xl p-3 disabled:opacity-60"
              >
                {AIRPORTS.map((airport) => (
                  <option key={airport} value={airport}>
                    {airport}
                  </option>
                ))}
              </select>

              <select
                value={plan.arrival_icao}
                disabled={isFinished}
                onChange={(e) =>
                  autoSave(plan.id, "arrival_icao", e.target.value)
                }
                className="input-control rounded-xl p-3 disabled:opacity-60"
              >
                {AIRPORTS.map((airport) => (
                  <option key={airport} value={airport}>
                    {airport}
                  </option>
                ))}
              </select>

              <input
                value={plan.route}
                disabled={isFinished}
                onChange={(e) =>
                  autoSave(plan.id, "route", e.target.value)
                }
                className="input-control rounded-xl p-3 disabled:opacity-60"
              />

              <input
                value={plan.flight_level}
                disabled={isFinished}
                inputMode="numeric"
                maxLength={3}
                onChange={(e) =>
                  autoSave(plan.id, "flight_level", e.target.value)
                }
                className="input-control rounded-xl p-3 disabled:opacity-60"
              />
            </div>

            <textarea
              value={plan.notes ?? ""}
              disabled={isFinished}
              onChange={(e) =>
                autoSave(plan.id, "notes", e.target.value)
              }
              placeholder="Notas adicionales"
              className="input-control mt-4 w-full rounded-xl p-3 disabled:opacity-60"
            />

            <div className="mt-4 rounded-2xl border border-white/10 bg-[#020617] p-4 text-sm text-slate-300">
              <p>Sector asignado: {plan.assumed_by ?? "Sin asumir"}</p>
              <p>Estado administrativo: {plan.status}</p>
              <p>Estado operativo: {plan.sector_status}</p>
              <p>Transponder: {plan.transponder}</p>
            </div>

            {!isFinished && (
              <button
                onClick={() => finishFlight(plan.id)}
                className="mt-5 rounded-xl border border-red-400 px-4 py-3 font-semibold text-red-300 hover:bg-red-500 hover:text-white"
              >
                Retroceder y finalizar vuelo
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}