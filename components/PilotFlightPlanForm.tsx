"use client";

import { createFlightPlan } from "@/app/actions/createFlightPlan";

const AIRCRAFT_TYPES = [
  "A220", "A320", "A330", "A350", "B717", "B727", "B737",
  "B757", "B777", "B778", "MD11", "SW3", "C550",
  "C150", "DH8D", "F100", "HAWK", "EUFI", "TBM9", "BE58", "PA46",
];

const AIRPORTS = [
  "LCLK", "LCPH", "LCRA", "MDAB", "MDCR", "MDST", "MDPC",
  "EFKT", "MTCA", "GCLP", "LEMH", "EGKK", "EGHI",
];

export default function PilotFlightPlanForm() {
  return (
    <div className="panel mt-8 rounded-3xl p-8">
      <h2 className="text-2xl font-bold text-sky-300">
        Nuevo Plan de Vuelo
      </h2>

      <p className="mt-2 text-sm text-slate-400">
        Solo puedes tener un vuelo activo a la vez. Finaliza tu vuelo actual
        antes de crear uno nuevo.
      </p>

      <form action={createFlightPlan} className="mt-6 grid gap-4">
        <input
          name="callsign"
          placeholder="Callsign"
          onChange={(e) => {
            e.target.value = e.target.value.toUpperCase();
          }}
          className="input-control rounded-xl p-3"
          required
        />

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
          className="rounded-xl bg-sky-500 p-3 font-semibold hover:bg-sky-400"
        >
          Crear Plan de Vuelo
        </button>
      </form>
    </div>
  );
}