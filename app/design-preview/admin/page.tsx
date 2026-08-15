import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import type { Metadata } from "next";
import AdminATCSessions from "@/components/AdminATCSessions";
import AdminActiveFlights from "@/components/AdminActiveFlights";
import AdminActiveAtis from "@/components/AdminActiveAtis";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Panel Admin Preview | PF24" };

export default async function AdminPreviewPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!session.user?.permissions?.canAccessAdmin) redirect("/access-denied");

  const { data: adminLogs } = await supabase.from("admin_logs").select("*").order("created_at", { ascending: false }).limit(30);
  const { data: loginLogs } = await supabase.from("login_logs").select("*").order("login_at", { ascending: false }).limit(50);
  const { data: atcSessions } = await supabase.from("atc_sessions").select("*").eq("is_active", true).order("started_at", { ascending: false });
  const { data: activeFlights } = await supabase.from("flight_plans").select("*").neq("status", "FINISHED").order("created_at", { ascending: false });
  const { data: activeAtis } = await supabase.from("atis_messages").select("*").order("created_at", { ascending: false });

  const sessions = atcSessions ?? [];
  const flights = activeFlights ?? [];
  const atis = activeAtis ?? [];

  return (
    <main className="preview-portal relative min-h-screen overflow-hidden bg-[#050612] text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-cover bg-center opacity-18" style={{ backgroundImage: "url('https://framerusercontent.com/images/lKs77AFnsbHG3ATgS3hBMy8iCOw.png')" }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-gradient-to-b from-[#050612]/20 via-[#050612]/82 to-[#050612]" />

      <header className="relative z-20 border-b border-white/10 bg-[#050816]/80 backdrop-blur-xl">
        <div className="section-container flex h-[76px] items-center justify-between gap-4">
          <a href="/design-preview/dashboard" className="flex items-center gap-3"><Image src="/logo.png" alt="PF24" width={40} height={40} priority /><div><div className="text-xl font-extrabold">PF<span className="text-sky-400">24</span></div><p className="text-[10px] uppercase tracking-[.2em] text-white/35">Administration</p></div></a>
          <a href="/design-preview/dashboard" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-[#8095ff]/50 hover:text-white">Dashboard</a>
        </div>
      </header>

      <section className="section-container relative z-10 max-w-7xl pb-20 pt-10">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#8095ff]/20 bg-[#8095ff]/10 px-3 py-1.5 text-xs font-semibold text-[#b6beff]">Administración PF24</div>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight md:text-5xl">Centro de operaciones</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-white/55">Primero ve el estado de la red; después entra al detalle. La información de auditoría queda separada de la operación diaria para reducir ruido.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-5 py-4"><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-white/35">Administrador</p><p className="mt-1 font-bold">{session.user?.name ?? "Admin"}</p></div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="ATC en línea" value={String(sessions.length)} note="Sesiones activas" />
          <Kpi label="Vuelos activos" value={String(flights.length)} note="Tráfico visible" />
          <Kpi label="ATIS" value={String(atis.length)} note="Mensajes publicados" />
          <Kpi label="Accesos" value={String(loginLogs?.length ?? 0)} note="Últimos registrados" />
        </div>

        <div className="mt-8 grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-7">
            <section>
              <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#8095ff]">Operación en vivo</p><h2 className="mt-1 text-2xl font-extrabold">Estado actual de la red</h2></div>
              <div className="admin-live-grid grid gap-6 lg:grid-cols-2"><AdminActiveFlights initialFlights={flights} /><AdminATCSessions initialSessions={sessions} /></div>
            </section>

            <section>
              <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#8095ff]">Información operacional</p><h2 className="mt-1 text-2xl font-extrabold">ATIS publicados</h2></div>
              <AdminActiveAtis initialAtis={atis} />
            </section>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-[1.7rem] border border-white/10 bg-slate-900/68 p-5 shadow-xl shadow-black/10 backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#8095ff]">Acceso rápido</p>
              <h3 className="mt-2 text-xl font-extrabold">Supervisión</h3>
              <div className="mt-5 grid gap-2">
                <Anchor href="#access-log" label="Inicios de sesión" />
                <Anchor href="#audit-log" label="Auditoría administrativa" />
                <a href="/design-preview/atc" className="rounded-xl border border-white/10 bg-white/[.035] px-4 py-3 text-sm font-semibold text-white/70 transition hover:border-[#8095ff]/40 hover:text-white">Abrir portal ATC →</a>
              </div>
            </section>

            <section className="rounded-[1.7rem] border border-white/10 bg-slate-900/60 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-white/35">Resumen</p>
              <div className="mt-3 space-y-1"><MiniRow label="Red" value="Operativa" ok /><MiniRow label="Realtime" value="Activo" ok /><MiniRow label="Última actividad" value={adminLogs?.length ? "Registrada" : "Sin cambios"} /></div>
            </section>
          </aside>
        </div>

        <section id="access-log" className="mt-10 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/65 shadow-xl shadow-black/10 backdrop-blur-xl">
          <div className="border-b border-white/10 px-6 py-5"><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#8095ff]">Seguridad</p><h2 className="mt-1 text-2xl font-extrabold">Últimos inicios de sesión</h2></div>
          <div className="overflow-x-auto p-4 md:p-5"><table className="w-full min-w-[800px] text-left text-sm"><thead className="text-white/40"><tr><th className="p-3">Usuario</th><th className="p-3">Discord ID</th><th className="p-3">Roles</th><th className="p-3">Hora UTC</th></tr></thead><tbody>{loginLogs?.map((log) => <tr key={log.id} className="border-t border-white/10"><td className="p-3 font-semibold text-white">{log.display_name ?? log.username}</td><td className="p-3 text-white/45">{log.discord_id}</td><td className="p-3 text-white/45">{(log.roles ?? []).join(", ") || "Sin roles"}</td><td className="p-3 text-white/45">{new Date(log.login_at).toISOString().replace("T", " ").slice(0, 19)}Z</td></tr>)}</tbody></table></div>
        </section>

        <section id="audit-log" className="mt-7 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/65 shadow-xl shadow-black/10 backdrop-blur-xl">
          <div className="border-b border-white/10 px-6 py-5"><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#8095ff]">Auditoría</p><h2 className="mt-1 text-2xl font-extrabold">Acciones administrativas</h2></div>
          <div className="overflow-x-auto p-4 md:p-5"><table className="w-full min-w-[800px] text-left text-sm"><thead className="text-white/40"><tr><th className="p-3">Admin</th><th className="p-3">Acción</th><th className="p-3">Objetivo</th><th className="p-3">Hora UTC</th></tr></thead><tbody>{adminLogs?.length ? adminLogs.map((log) => <tr key={log.id} className="border-t border-white/10"><td className="p-3 font-semibold text-white">{log.admin_name ?? "Admin"}</td><td className="p-3 font-semibold text-[#aab5ff]">{log.action}</td><td className="p-3 text-white/45">{log.target_label ?? log.target_id ?? "Sin objetivo"}</td><td className="p-3 text-white/45">{new Date(log.created_at).toISOString().replace("T", " ").slice(0, 19)}Z</td></tr>) : <tr><td colSpan={4} className="p-6 text-center text-white/40">No hay acciones administrativas registradas.</td></tr>}</tbody></table></div>
        </section>
      </section>

      <style>{`
        .preview-portal .panel{background:rgba(15,23,42,.68)!important;border-color:rgba(255,255,255,.10)!important;box-shadow:0 16px 42px rgba(0,0,0,.12)!important}
        .preview-portal .mono{font-family:inherit!important;letter-spacing:normal!important}
        .preview-portal input,.preview-portal textarea,.preview-portal select{background:rgba(2,6,23,.58)!important;border-color:rgba(255,255,255,.12)!important;border-radius:.85rem!important}
        .preview-portal button{border-radius:.85rem!important}
        .preview-portal th{color:rgba(255,255,255,.42)!important;font-size:.72rem!important;text-transform:uppercase;letter-spacing:.05em}
        .preview-portal tbody tr{transition:.15s ease}.preview-portal tbody tr:hover{background:rgba(255,255,255,.025)!important}
        .admin-live-grid>.panel{min-height:100%!important}
      `}</style>
    </main>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) { return <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur"><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-white/35">{label}</p><p className="mt-2 text-3xl font-extrabold">{value}</p><p className="mt-1 text-xs text-white/35">{note}</p></div>; }
function Anchor({ href, label }: { href: string; label: string }) { return <a href={href} className="rounded-xl border border-white/10 bg-white/[.035] px-4 py-3 text-sm font-semibold text-white/70 transition hover:border-[#8095ff]/40 hover:text-white">{label} ↓</a>; }
function MiniRow({ label, value, ok = false }: { label: string; value: string; ok?: boolean }) { return <div className="flex items-center justify-between rounded-xl px-3 py-2.5"><span className="text-sm text-white/40">{label}</span><span className={`text-sm font-semibold ${ok ? "text-green-300" : "text-white/70"}`}>{value}</span></div>; }
