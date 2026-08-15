import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import type { Metadata } from "next";
import AdminATCSessions from "@/components/AdminATCSessions";
import AdminActiveFlights from "@/components/AdminActiveFlights";
import AdminActiveAtis from "@/components/AdminActiveAtis";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Panel Admin Preview | PF24",
};

export default async function AdminPreviewPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!session.user?.permissions?.canAccessAdmin) redirect("/access-denied");

  const { data: adminLogs } = await supabase
    .from("admin_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: loginLogs } = await supabase
    .from("login_logs")
    .select("*")
    .order("login_at", { ascending: false })
    .limit(50);

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

  const { data: activeAtis } = await supabase
    .from("atis_messages")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main className="preview-portal relative min-h-screen overflow-hidden bg-[#050612] text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-cover bg-center opacity-18"
        style={{ backgroundImage: "url('https://framerusercontent.com/images/lKs77AFnsbHG3ATgS3hBMy8iCOw.png')" }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-gradient-to-b from-[#050612]/25 via-[#050612]/85 to-[#050612]" />

      <header className="relative z-20 border-b border-white/10 bg-[#050816]/75 backdrop-blur-xl">
        <div className="section-container flex h-[76px] items-center justify-between gap-4">
          <a href="/design-preview/dashboard" className="flex items-center gap-3">
            <Image src="/logo.png" alt="PF24" width={40} height={40} priority />
            <div className="text-xl font-extrabold">PF<span className="text-sky-400">24</span></div>
          </a>
          <a href="/design-preview/dashboard" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-[#8095ff]/50 hover:text-white">← Dashboard</a>
        </div>
      </header>

      <section className="section-container relative z-10 max-w-7xl pb-20 pt-12">
        <div className="mb-9 grid items-end gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#8095ff]/20 bg-[#8095ff]/10 px-3 py-1.5 text-xs font-semibold text-[#b6beff]">
              Administración PF24
            </div>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight md:text-5xl">Centro de administración</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-white/55">
              Supervisa la operación, revisa sesiones activas y consulta la actividad administrativa desde una vista más clara y ordenada.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/65 px-5 py-4 backdrop-blur">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Administrador</p>
            <p className="mt-1 font-bold text-white">{session.user?.name ?? "Admin"}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <AdminATCSessions initialSessions={atcSessions ?? []} />
          <AdminActiveFlights initialFlights={activeFlights ?? []} />
        </div>

        <div className="mt-6">
          <AdminActiveAtis initialAtis={activeAtis ?? []} />
        </div>

        <section className="mt-7 rounded-[2rem] border border-white/10 bg-slate-900/65 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8095ff]">Actividad</p>
            <h2 className="mt-2 text-2xl font-extrabold">Últimos inicios de sesión</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="text-white/40">
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
                    <td className="p-3 font-semibold text-white">{log.display_name ?? log.username}</td>
                    <td className="p-3 text-white/45">{log.discord_id}</td>
                    <td className="p-3 text-white/45">{(log.roles ?? []).join(", ") || "Sin roles"}</td>
                    <td className="p-3 text-white/45">{new Date(log.login_at).toISOString().replace("T", " ").slice(0, 19)}Z</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-7 rounded-[2rem] border border-white/10 bg-slate-900/65 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8095ff]">Auditoría</p>
            <h2 className="mt-2 text-2xl font-extrabold">Acciones administrativas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="text-white/40">
                <tr>
                  <th className="p-3">Admin</th>
                  <th className="p-3">Acción</th>
                  <th className="p-3">Objetivo</th>
                  <th className="p-3">Hora UTC</th>
                </tr>
              </thead>
              <tbody>
                {adminLogs?.length ? adminLogs.map((log) => (
                  <tr key={log.id} className="border-t border-white/10">
                    <td className="p-3 font-semibold text-white">{log.admin_name ?? "Admin"}</td>
                    <td className="p-3 font-semibold text-[#aab5ff]">{log.action}</td>
                    <td className="p-3 text-white/45">{log.target_label ?? log.target_id ?? "Sin objetivo"}</td>
                    <td className="p-3 text-white/45">{new Date(log.created_at).toISOString().replace("T", " ").slice(0, 19)}Z</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="p-6 text-center text-white/40">No hay acciones administrativas registradas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <style>{`
        .preview-portal .panel { background: rgba(15,23,42,.68) !important; border-color: rgba(255,255,255,.10) !important; box-shadow: 0 16px 42px rgba(0,0,0,.14); }
        .preview-portal .mono { font-family: inherit !important; letter-spacing: normal !important; }
        .preview-portal input, .preview-portal textarea, .preview-portal select { background: rgba(2,6,23,.58) !important; border-color: rgba(255,255,255,.12) !important; border-radius: .75rem !important; }
        .preview-portal button { border-radius: .75rem !important; }
        .preview-portal th { color: rgba(255,255,255,.42) !important; }
      `}</style>
    </main>
  );
}
