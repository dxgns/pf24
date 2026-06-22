"use client";

import { assumeFlightPlan, updateFlightPlan } from "@/app/actions/updateFlightPlan";

type FlightPlan = {
  id: string;
  callsign: string;
  aircraft_type: string;
  departure_icao: string;
  arrival_icao: string;
  flight_rules: string;
  flight_level: string;
  transponder: string;
  status: string;
  sector_status: string;
  assumed_by?: string | null;
};

export default function SectorListTable({ flightPlans }: { flightPlans: FlightPlan[] }) {
  return (
    <div className="mt-8 overflow-x-auto rounded-3xl border border-white/10 bg-slate-900">
      <table className="w-full min-w-[1200px] text-left text-sm">
        <thead className="bg-slate-800 text-slate-300">
          <tr>
            <th className="p-4">CALLSIGN</th>
            <th className="p-4">A/C</th>
            <th className="p-4">DEP</th>
            <th className="p-4">ARR</th>
            <th className="p-4">RULES</th>
            <th className="p-4">FL</th>
            <th className="p-4">XPDR</th>
            <th className="p-4">STATUS</th>
            <th className="p-4">SECTOR</th>
            <th className="p-4">ATC</th>
            <th className="p-4">ACCIONES</th>
          </tr>
        </thead>

        <tbody>
          {flightPlans.map((plan) => (
            <tr key={plan.id} className="border-t border-white/10">
              <td className="p-4 font-bold text-sky-400">{plan.callsign}</td>
              <td className="p-4">{plan.aircraft_type}</td>
              <td className="p-4">{plan.departure_icao}</td>
              <td className="p-4">{plan.arrival_icao}</td>
              <td className="p-4">{plan.flight_rules}</td>
              <td className="p-4">{plan.flight_level}</td>

              <td colSpan={5} className="p-4">
                <form
                  action={updateFlightPlan}
                  onSubmit={(event) => {
                    if (!confirm(`¿Guardar cambios para ${plan.callsign}?`)) {
                      event.preventDefault();
                    }
                  }}
                  className="flex flex-wrap items-center gap-3"
                >
                  <input type="hidden" name="id" value={plan.id} />

                  <input
                    name="transponder"
                    defaultValue={plan.transponder}
                    maxLength={4}
                    className="w-20 rounded-lg bg-slate-800 p-2"
                  />

                  <select name="status" defaultValue={plan.status} className="rounded-lg bg-slate-800 p-2">
                    <option value="PENDING">PENDING</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="FINISHED">FINISHED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>

                  <select name="sectorStatus" defaultValue={plan.sector_status} className="rounded-lg bg-slate-800 p-2">
                    <option value="STUP">STUP</option>
                    <option value="PUSH">PUSH</option>
                    <option value="TAXI_DEP">TAXI_DEP</option>
                    <option value="DEP">DEP</option>
                    <option value="APP">APP</option>
                    <option value="ARR">ARR</option>
                    <option value="TAXI_IN">TAXI_IN</option>
                    <option value="PARKED">PARKED</option>
                  </select>

                  <input
                    name="assumedBy"
                    defaultValue={plan.assumed_by ?? ""}
                    placeholder="ATC"
                    className="w-36 rounded-lg bg-slate-800 p-2"
                  />

                  <button type="submit" className="rounded-lg bg-sky-500 px-4 py-2 font-semibold">
                    Guardar
                  </button>
                </form>

                <form action={assumeFlightPlan} className="mt-3">
                  <input type="hidden" name="id" value={plan.id} />
                  <button className="rounded-lg border border-sky-400 px-4 py-2 text-sky-400 hover:bg-sky-400 hover:text-white">
                    Asumir
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}