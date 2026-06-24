import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Metadata } from "next";
import {
  adminEndAtcSession,
  adminFinishFlightPlan,
} from "@/app/actions/adminMaintenance";

export const metadata: Metadata = {
  title: "Panel Admin | PF24",
};

export default async function AdminPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (!session.user?.permissions?.canAccessAdmin) {
    redirect("/access-denied");
  }

  const { data: loginLogs } = await supabase
    .from("login_logs")
    .select("*")
    .order("login_at", { ascending: false })
    .limit(10);

  const { data: atcSessions } = await supabase
    .from("atc_sessions")
    .select("*")
    .eq("is_active", true)
    .order("started_at", { ascending: false });

  const { data: activeFlights } = await supabase
    .from("flight_plans")
    .select("*")
    .neq("status", "FINISHED")
    .order("created_at", { ascending: false });

  return (
    <main className="radar-grid min-h-screen bg-[#020617] px-6 py-16 text-white">
      <section className="section-container max-w-7xl">
        <div className="panel rounded-3xl p-8">
          <div className="mb-6 flex items-center justify-between">
            <a
              href="/dashboard"
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
            >
              ← Regresar
            </a>

            <div className="mono text-sm tracking-[0.25em] text-slate-400">
              PF24
            </div>
          </div>

          <h1 className="text-4xl font-extrabold">Panel Admin</h1>

          <p className="mt-3 text-slate-400">
            Mantenimiento operativo, sesiones ATC, vuelos activos y últimos
            accesos.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="panel rounded-3xl p-6">
            <h2 className="text-2xl font-bold text-sky-300">
              ATCs conectados
            </h2>

            <div className="mt-5 grid gap-3">
              {atcSessions?.length ? (
                atcSessions.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-[#020617] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="mono font-bold text-sky-300">
                          {item.position}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          Controlador: {item.controller_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Inicio:{" "}
                          {new Date(item.started_at)
                            .toISOString()
                            .slice(11, 19)}
                          Z
                        </p>
                      </div>

                      <form
                        action={async () => {
                          "use server";
                          await adminEndAtcSession(item.id, item.position);
                        }}
                      >
                        <button className="rounded-xl border border-red-400 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500 hover:text-white">
                          Finalizar sesión
                        </button>
                      </form>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-400">
                  No hay sesiones ATC activas.
                </p>
              )}
            </div>
          </section>

          <section className="panel rounded-3xl p-6">
            <h2 className="text-2xl font-bold text-sky-300">
              Vuelos activos
            </h2>

            <div className="mt-5 grid gap-3">
              {activeFlights?.length ? (
                activeFlights.map((flight) => (
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

                      <form
                        action={async () => {
                          "use server";
                          await adminFinishFlightPlan(flight.id);
                        }}
                      >
                        <button className="rounded-xl border border-red-400 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500 hover:text-white">
                          Finalizar vuelo
                        </button>
                      </form>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-400">No hay vuelos activos.</p>
              )}
            </div>
          </section>
        </div>

        <section className="panel mt-8 rounded-3xl p-6">
          <h2 className="text-2xl font-bold text-sky-300">
            Últimos inicios de sesión
          </h2>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="p-3">Usuario</th>
                  <th className="p-3">Discord ID</th>
                  <th className="p-3">Roles</th>
                  <th className="p-3">Hora UTC</th>
                </tr>
              </thead>

              <tbody>
                {loginLogs?.map((log) => (
                  <tr key={log.id} className="border-t border-white/10">
                    <td className="p-3 font-semibold text-white">
                      {log.display_name ?? log.username}
                    </td>
                    <td className="p-3 mono text-slate-400">
                      {log.discord_id}
                    </td>
                    <td className="p-3 text-slate-400">
                      {(log.roles ?? []).join(", ") || "Sin roles"}
                    </td>
                    <td className="p-3 mono text-slate-400">
                      {new Date(log.login_at).toISOString().replace("T", " ").slice(0, 19)}Z
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}