import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Metadata } from "next";
import AdminATCSessions from "@/components/AdminATCSessions";
import AdminActiveFlights from "@/components/AdminActiveFlights";
import AdminActiveAtis from "@/components/AdminActiveAtis";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Panel Admin | PF24",
};

export default async function AdminPage() {
  let session;

  try {
    session = await auth();
  } catch (error) {
    console.error("PF24 Admin auth error:", error);
    redirect("/login");
  }

  if (!session) redirect("/login");

  if (!session.user?.permissions?.canAccessAdmin) {
    redirect("/access-denied");
  }

  let adminLogs;
  let loginLogs;
  let atcSessions;
  let activeFlights;
  let activeAtis;

  try {
    const result = await supabase
      .from("admin_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    if (result.error) {
      console.error("PF24 Admin log load error:", result.error);
    } else {
      adminLogs = result.data;
    }
  } catch (error) {
    console.error("PF24 Admin log query exception:", error);
  }

  try {
    const result = await supabase
      .from("login_logs")
      .select("*")
      .order("login_at", { ascending: false })
      .limit(50);

    if (result.error) {
      console.error("PF24 Admin login log load error:", result.error);
    } else {
      loginLogs = result.data;
    }
  } catch (error) {
    console.error("PF24 Admin login log query exception:", error);
  }

  try {
    const result = await supabase
      .from("atc_sessions")
      .select("*")
      .eq("is_active", true)
      .order("started_at", { ascending: false });

    if (result.error) {
      console.error("PF24 Admin ATC session load error:", result.error);
    } else {
      atcSessions = result.data;
    }
  } catch (error) {
    console.error("PF24 Admin ATC session query exception:", error);
  }

  try {
    const result = await supabase
      .from("flight_plans")
      .select("*")
      .neq("status", "FINISHED")
      .order("created_at", { ascending: false });

    if (result.error) {
      console.error("PF24 Admin flight load error:", result.error);
    } else {
      activeFlights = result.data;
    }
  } catch (error) {
    console.error("PF24 Admin flight query exception:", error);
  }

  try {
    const result = await supabase
      .from("atis_messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (result.error) {
      console.error("PF24 Admin ATIS load error:", result.error);
    } else {
      activeAtis = result.data;
    }
  } catch (error) {
    console.error("PF24 Admin ATIS query exception:", error);
  }

  return (
    <main className="radar-grid min-h-screen bg-[#020617] px-6 py-16 text-white">
      <section className="section-container max-w-7xl">
        <div className="panel rounded-3xl p-8">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/dashboard"
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
            >
              ← Regresar
            </Link>

            <div className="mono text-sm tracking-[0.25em] text-slate-400">
              PF24
            </div>
          </div>

          <h1 className="text-4xl font-extrabold">Panel Admin</h1>

          <p className="mt-3 text-slate-400">
            Mantenimiento operativo, sesiones ATC, vuelos activos y últimos accesos.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <AdminATCSessions initialSessions={atcSessions ?? []} />
          <AdminActiveFlights initialFlights={activeFlights ?? []} />
        </div>

        <AdminActiveAtis initialAtis={activeAtis ?? []} />

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
                {(loginLogs ?? []).map((log) => (
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
                      {new Date(log.login_at)
                        .toISOString()
                        .replace("T", " ")
                        .slice(0, 19)}
                      Z
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel mt-8 rounded-3xl p-6">
          <h2 className="text-2xl font-bold text-sky-300">
            Últimas acciones administrativas
          </h2>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="p-3">Admin</th>
                  <th className="p-3">Acción</th>
                  <th className="p-3">Objetivo</th>
                  <th className="p-3">Hora UTC</th>
                </tr>
              </thead>

              <tbody>
                {adminLogs?.length ? (
                  adminLogs.map((log) => (
                    <tr key={log.id} className="border-t border-white/10">
                      <td className="p-3 font-semibold text-white">
                        {log.admin_name ?? "Admin"}
                      </td>

                      <td className="p-3 mono text-sky-300">
                        {log.action}
                      </td>

                      <td className="p-3 text-slate-400">
                        {log.target_label ?? log.target_id ?? "Sin objetivo"}
                      </td>

                      <td className="p-3 mono text-slate-400">
                        {new Date(log.created_at)
                          .toISOString()
                          .replace("T", " ")
                          .slice(0, 19)}
                        Z
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-400">
                      No hay acciones administrativas registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
