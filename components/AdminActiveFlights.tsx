"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminFinishFlightPlan } from "@/app/actions/adminMaintenance";

type FlightPlan = {
  id: string;
  callsign: string;
  aircraft_type: string;
  departure_icao: string;
  arrival_icao: string;
  status: string;
  assumed_by: string | null;
  created_at: string;
};

export default function AdminActiveFlights({
  initialFlights,
}: {
  initialFlights: FlightPlan[];
}) {
  const [flights, setFlights] = useState(initialFlights);

  async function loadFlights() {
    const { data, error } = await supabase
      .from("flight_plans")
      .select("*")
      .neq("status", "FINISHED")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setFlights(data ?? []);
  }

  useEffect(() => {
    loadFlights();

    const channel = supabase
      .channel("admin-active-flights")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flight_plans" },
        () => {
          loadFlights();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <section className="panel rounded-3xl p-6">
      <h2 className="text-2xl font-bold text-sky-300">
        Vuelos activos
      </h2>

      <div className="mt-5 grid gap-3">
        {flights.length ? (
          flights.map((flight) => (
            <div
              key={flight.id}
              className="rounded-2xl border border-white/10 bg-[#020617] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="mono font-bold text-sky-300">
                    {flight.callsign}
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    {flight.departure_icao} → {flight.arrival_icao} ·{" "}
                    {flight.aircraft_type}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Estado: {flight.status} · Sector:{" "}
                    {flight.assumed_by ?? "Sin asumir"}
                  </p>
                </div>

                <button
                  onClick={async () => {
                    const confirmed = confirm(
                      `¿Finalizar vuelo ${flight.callsign}?`
                    );

                    if (!confirmed) return;

                    await adminFinishFlightPlan(flight.id);
                    await loadFlights();
                  }}
                  className="rounded-xl border border-red-400 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500 hover:text-white"
                >
                  Finalizar vuelo
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-slate-400">No hay vuelos activos.</p>
        )}
      </div>
    </section>
  );
}