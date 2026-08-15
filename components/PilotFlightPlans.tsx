"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getDefaultTransponder } from "@/lib/flightRules";
import {
  getGameCallsignFromNotes,
  getVisibleFlightPlanNotes,
  normalizeGameCallsign,
  setGameCallsignInNotes,
  setVisibleFlightPlanNotes,
} from "@/lib/flightPlanGameCallsign";

const AIRCRAFT_TYPES = [
  "A220", "A320", "A330", "A350", "B717", "B727", "B737",
  "B757", "B777", "B787", "MD11", "SW3", "C550",
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

type EditableField = keyof FlightPlan | "game_callsign" | "visible_notes";

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
  const [error, setError] = useState("");
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
            if (newPlan.created_by === pilotId && newPlan.status !== "FINISHED") {
              setPlans((current) => [newPlan, ...current]);
            }
          }

          if (payload.eventType === "UPDATE") {
            if (newPlan.created_by !== pilotId) return;

            if (
              isEmergencyTransponder(newPlan.transponder) &&
              newPlan.transponder !== oldPlan.transponder
            ) {
              playEmergencyAlarm();
            }

            if (newPlan.status === "FINISHED") {
              setPlans((current) => current.filter((plan) => plan.id !== newPlan.id));
              return;
            }

            setPlans((current) => {
              const exists = current.some((plan) => plan.id === newPlan.id);
              if (!exists) return [newPlan, ...current];
              return current.map((plan) => plan.id === newPlan.id ? newPlan : plan);
            });
          }

          if (payload.eventType === "DELETE") {
            setPlans((current) => current.filter((plan) => plan.id !== oldPlan.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pilotId]);

  function isEmergencyTransponder(code: string) {
    return code === "7600" || code === "7700";
  }

  function emergencyClass(code: string) {
    return isEmergencyTransponder(code)
      ? "border border-red-400 bg-red-500/20 text-red-300 animate-pulse"
      : "";
  }

  function playEmergencyAlarm() {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextClass) return;

      const audio = new AudioContextClass();
      const startTime = audio.currentTime;
      const duration = 5;
      const beepLength = 0.22;
      const gap = 0.38;

      for (let t = 0; t < duration; t += gap) {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(880, startTime + t);
        gain.gain.setValueAtTime(0.0001, startTime + t);
        gain.gain.exponentialRampToValueAtTime(0.08, startTime + t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + t + beepLength);
        oscillator.start(startTime + t);
        oscillator.stop(startTime + t + beepLength);
      }
    } catch {
      // El sonido no es crítico.
    }
  }

  function normalizeField(field: EditableField, value: string) {
    if (field === "callsign" || field === "game_callsign") {
      return normalizeGameCallsign(value);
    }
    if (field === "route") return value.toUpperCase();
    if (field === "flight_level") return value.replace(/\D/g, "").slice(0, 3);
    if (field === "transponder") return value.replace(/[^0-7]/g, "").slice(0, 4);
    return value;
  }

  function autoSave(id: string, field: EditableField, value: string) {
    const cleanValue = normalizeField(field, value);

    if (field === "transponder" && cleanValue === "7500") {
      setError("El código 7500 no está disponible.");
      return;
    }

    if (field === "game_callsign" && cleanValue.length < 2) {
      setError("El callsign del juego debe tener al menos 2 caracteres.");
      return;
    }

    setError("");
    setSaving(id);
    clearTimeout(timers.current[`${id}-${field}`]);

    setPlans((current) => current.map((plan) => {
      if (plan.id !== id) return plan;
      if (field === "game_callsign") {
        return { ...plan, notes: setGameCallsignInNotes(plan.notes, cleanValue) };
      }
      if (field === "visible_notes") {
        return { ...plan, notes: setVisibleFlightPlanNotes(plan.notes, cleanValue) };
      }
      return { ...plan, [field]: cleanValue };
    }));

    timers.current[`${id}-${field}`] = setTimeout(async () => {
      const currentPlan = plans.find((plan) => plan.id === id);
      let updatePayload: Record<string, string>;

      if (field === "game_callsign") {
        const currentNotes = currentPlan?.notes ?? "";
        updatePayload = { notes: setGameCallsignInNotes(currentNotes, cleanValue) };
      } else if (field === "visible_notes") {
        const currentNotes = currentPlan?.notes ?? "";
        updatePayload = { notes: setVisibleFlightPlanNotes(currentNotes, cleanValue) };
      } else {
        updatePayload = { [field]: cleanValue };
      }

      const { error } = await supabase
        .from("flight_plans")
        .update({ ...updatePayload, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("created_by", pilotId)
        .neq("status", "FINISHED");

      if (error) {
        console.error(error);
        setError("No se pudo guardar el cambio.");
      }

      setSaving(null);
    }, 600);
  }

  async function finishFlight(id: string) {
    const confirmed = confirm("¿Finalizar este vuelo y volver al dashboard?");
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
      setError("No se pudo finalizar el vuelo.");
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
      {error && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {plans.map((plan) => {
        const isFinished = plan.status === "FINISHED";
        const gameCallsign = getGameCallsignFromNotes(plan.notes) || plan.callsign;

        return (
          <div key={plan.id} className="panel rounded-3xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <input
                  value={plan.callsign}
                  disabled={isFinished}
                  maxLength={12}
                  onChange={(e) => autoSave(plan.id, "callsign", e.target.value)}
                  className="mono w-full bg-transparent text-2xl font-extrabold text-sky-400 outline-none disabled:opacity-60"
                />

                <p className="mt-1 text-sm text-slate-400">
                  <span className={`rounded-lg px-2 py-1 ${emergencyClass(plan.transponder)}`}>
                    XPDR {plan.transponder}
                  </span>{" "}
                  · {plan.status} · {plan.sector_status}
                </p>
              </div>

              <div className="text-sm text-slate-400">
                {saving === plan.id ? "Guardando..." : "Guardado automático"}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <input
                  value={gameCallsign}
                  disabled={isFinished}
                  maxLength={12}
                  onChange={(e) => autoSave(plan.id, "game_callsign", e.target.value)}
                  className="input-control w-full rounded-xl p-3 disabled:opacity-60"
                  placeholder="Callsign en el juego"
                />
                <p className="mt-1 text-xs text-slate-500">Usado solo para vincular el avión de Project Flight con este plan.</p>
              </div>

              <select
                value={plan.aircraft_type}
                disabled={isFinished}
                onChange={(e) => autoSave(plan.id, "aircraft_type", e.target.value)}
                className="input-control rounded-xl p-3 disabled:opacity-60"
              >
                {AIRCRAFT_TYPES.map((aircraft) => <option key={aircraft} value={aircraft}>{aircraft}</option>)}
              </select>

              <select
                value={plan.flight_rules}
                disabled={isFinished}
                onChange={(e) => {
                  const newRules = e.target.value;
                  autoSave(plan.id, "flight_rules", newRules);
                  autoSave(plan.id, "transponder", getDefaultTransponder(newRules));
                }}
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
                onChange={(e) => autoSave(plan.id, "departure_icao", e.target.value)}
                className="input-control rounded-xl p-3 disabled:opacity-60"
              >
                {AIRPORTS.map((airport) => <option key={airport} value={airport}>{airport}</option>)}
              </select>

              <select
                value={plan.arrival_icao}
                disabled={isFinished}
                onChange={(e) => autoSave(plan.id, "arrival_icao", e.target.value)}
                className="input-control rounded-xl p-3 disabled:opacity-60"
              >
                {AIRPORTS.map((airport) => <option key={airport} value={airport}>{airport}</option>)}
              </select>

              <input
                value={plan.route}
                disabled={isFinished}
                onChange={(e) => autoSave(plan.id, "route", e.target.value)}
                className="input-control rounded-xl p-3 disabled:opacity-60"
              />

              <input
                value={plan.flight_level}
                disabled={isFinished}
                inputMode="numeric"
                maxLength={3}
                placeholder="FL"
                onChange={(e) => autoSave(plan.id, "flight_level", e.target.value)}
                className="input-control rounded-xl p-3 disabled:opacity-60"
              />

              <input
                value={plan.transponder}
                disabled={isFinished}
                inputMode="numeric"
                maxLength={4}
                placeholder="XPDR"
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-7]/g, "").slice(0, 4);
                  setPlans((current) => current.map((p) => p.id === plan.id ? { ...p, transponder: value } : p));
                  if (value === "7500") {
                    setError("El código 7500 no está disponible.");
                    return;
                  }
                  if (value.length === 4) autoSave(plan.id, "transponder", value);
                }}
                className={`input-control rounded-xl p-3 disabled:opacity-60 ${emergencyClass(plan.transponder)}`}
              />
            </div>

            <textarea
              value={getVisibleFlightPlanNotes(plan.notes)}
              disabled={isFinished}
              onChange={(e) => autoSave(plan.id, "visible_notes", e.target.value)}
              placeholder="Notas adicionales"
              className="input-control mt-4 w-full rounded-xl p-3 disabled:opacity-60"
            />

            <div className="mt-4 rounded-2xl border border-white/10 bg-[#020617] p-4 text-sm text-slate-300">
              <p>Callsign en juego: {gameCallsign}</p>
              <p>Sector asignado: {plan.assumed_by ?? "Sin asumir"}</p>
              <p>Estado de plan de vuelo: {plan.status}</p>
              <p>Estado operativo: {plan.sector_status}</p>
              <p>Transponder: <span className={`rounded-lg px-2 py-1 ${emergencyClass(plan.transponder)}`}>{plan.transponder}</span></p>
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
