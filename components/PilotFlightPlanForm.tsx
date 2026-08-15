"use client";

import { useState } from "react";
import { createFlightPlan } from "@/app/actions/createFlightPlan";
import { normalizeGameCallsign } from "@/lib/flightPlanGameCallsign";

const AIRCRAFT_TYPES = [
  "A220", "A320", "A330", "A350", "B717", "B727", "B737",
  "B757", "B777", "B787", "MD11", "SW3", "C550",
  "C150", "DH8D", "F100", "HAWK", "EUFI", "TBM9", "BE58", "PA46",
];

const AIRPORTS = [
  "LCLK", "LCPH", "LCRA", "MDAB", "MDCR", "MDST", "MDPC",
  "EFKT", "MTCA", "GCLP", "LEMH", "EGKK", "EGHI",
];

export default function PilotFlightPlanForm() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [callsign, setCallsign] = useState("");
  const [gameCallsign, setGameCallsign] = useState("");
  const [gameCallsignEdited, setGameCallsignEdited] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const result = await createFlightPlan(formData);

    setIsSubmitting(false);

    if (!result.ok) {
      const message = result.error ?? "Ocurrió un error al crear el plan.";
      setError(message);
      return;
    }

    setSuccess("Plan de vuelo creado correctamente.");
    form.reset();
    setCallsign("");
    setGameCallsign("");
    setGameCallsignEdited(false);
  }

  return (
    <div className="panel mt-8 rounded-3xl p-8">
      <h2 className="text-2xl font-bold text-sky-300">
        Nuevo Plan de Vuelo
      </h2>

      <p className="mt-2 text-sm text-slate-400">
        Solo puedes tener un vuelo activo a la vez. Finaliza tu vuelo actual
        antes de crear uno nuevo.
      </p>

      {error && (
        <div className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-5 rounded-xl border border-green-400/30 bg-green-400/10 p-4 text-sm text-green-300">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
        <input
          name="callsign"
          placeholder="Callsign"
          value={callsign}
          maxLength={12}
          onChange={(e) => {
            const value = normalizeGameCallsign(e.target.value);
            setCallsign(value);
            if (!gameCallsignEdited) setGameCallsign(value);
          }}
          className="input-control rounded-xl p-3"
          required
        />

        <div>
          <input
            name="gameCallsign"
            placeholder="Callsign en el juego"
            value={gameCallsign}
            maxLength={12}
            onChange={(e) => {
              setGameCallsignEdited(true);
              setGameCallsign(normalizeGameCallsign(e.target.value));
            }}
            className="input-control w-full rounded-xl p-3"
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            Debe coincidir con el callsign que aparece en Project Flight. Si es el mismo que el plan, no necesitas cambiarlo.
          </p>
        </div>

        <select
          name="aircraftType"
          className="input-control rounded-xl p-3"
          required
        >
          <option value="">Seleccionar aeronave</option>
          {AIRCRAFT_TYPES.map((aircraft) => (
            <option key={aircraft} value={aircraft}>
              {aircraft}
            </option>
          ))}
        </select>

        <select
          name="flightRules"
          className="input-control rounded-xl p-3"
          required
        >
          <option value="IFR">IFR</option>
          <option value="VFR">VFR</option>
          <option value="YFR">YFR</option>
          <option value="ZFR">ZFR</option>
        </select>

        <select
          name="departure"
          className="input-control rounded-xl p-3"
          required
        >
          <option value="">Salida</option>
          {AIRPORTS.map((airport) => (
            <option key={airport} value={airport}>
              {airport}
            </option>
          ))}
        </select>

        <select
          name="arrival"
          className="input-control rounded-xl p-3"
          required
        >
          <option value="">Llegada</option>
          {AIRPORTS.map((airport) => (
            <option key={airport} value={airport}>
              {airport}
            </option>
          ))}
        </select>

        <input
          name="route"
          placeholder="Ruta"
          onChange={(e) => {
            e.target.value = e.target.value.toUpperCase();
          }}
          className="input-control rounded-xl p-3"
          required
        />

        <input
          name="flightLevel"
          placeholder="FL"
          inputMode="numeric"
          maxLength={3}
          pattern="[0-9]{1,3}"
          onChange={(e) => {
            e.target.value = e.target.value.replace(/\D/g, "").slice(0, 3);
          }}
          className="input-control rounded-xl p-3"
          required
        />

        <textarea
          name="notes"
          placeholder="Notas adicionales"
          className="input-control rounded-xl p-3"
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-sky-500 p-3 font-semibold hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creando..." : "Crear Plan de Vuelo"}
        </button>
      </form>
    </div>
  );
}
