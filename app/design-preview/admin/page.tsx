import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import type { Metadata } from "next";
import AdminATCSessions from "@/components/AdminATCSessions";
import AdminActiveFlights from "@/components/AdminActiveFlights";
import AdminActiveAtis from "@/components/AdminActiveAtis";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Network Operations Preview | PF24" };

export default async function AdminPreviewPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!session.user?.permissions?.canAccessAdmin) redirect("/access-denied");

  const { data: adminLogs } = await supabase.from("admin_logs").select("*").order("created_at", { ascending: false }).limit(30);
  const { data: loginLogs } = await supabase.from("login_logs").select("*").order("login_at", { ascending: false }).limit(50);
  const { data: atcSessions } = await supabase.from("atc_sessions").select("*").eq("is_active", true).order("started_at", { ascending: false });
  const { data: activeFlights } = await supabase.from("flight_plans").select("*").neq("status", "FINISHED").order("created_at", { ascending: false });
  const { data: activeAtis } = await supabase.from("atis_messages").select("*").order("created_at", { ascending: false });

  const atcCount = atcSessions?.length ?? 0;
  const flightCount = activeFlights?.length ?? 0;
  const atisCount = activeAtis?.length ?? 0;
  const loginCount = loginLogs?.length ?? 0;

  return (
    <main className="admin-noc min-h-screen bg-[#050612] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050612]/85 backdrop-blur-2xl">
        <div className="flex h-[76px] items-center justify-between gap-5 px-5 md:px-8 xl:px-10">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="PF24" width={38} height={38} priority />
            <div><p className="text-lg font-black">PF<span className="text-[#8095ff]">24</span></p><p className="text-[9px] font-bold uppercase tracking-[.24em] text-white/25">Network Operations</p></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden rounded-xl border border-white/10 bg-white/[.03] px-4 py-2 text-xs sm:block"><span className="mr-2 text-white/25">ADMIN</span><span className="font-semibold">{session.user?.name ?? "Admin"}</span></div>
            <a href="/design-preview/dashboard" className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/55 transition hover:bg-white/5 hover:text-white">Exit NOC</a>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/10 px-5 py-9 md:px-8 xl:px-10">
        <div className="pointer-events-none absolute inset-0 opacity-[.16]" style={{backgroundImage:"url('https://framerusercontent.com/images/lKs77AFnsbHG3ATgS3hBMy8iCOw.png')",backgroundSize:'cover',backgroundPosition:'center'}} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#050612] via-[#050612]/90 to-[#050612]/65" />
        <div className="relative grid gap-8 xl:grid-cols-[1fr_520px] xl:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.28em] text-[#8095ff]">System overview</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-[-.045em] md:text-6xl">Todo PF24, en una sola <span className="text-[#9ba9ff]">vista operacional.</span></h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/45">Supervisión de red, tráfico, ATC, ATIS y actividad administrativa en tiempo real.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="ATC ONLINE" value={String(atcCount)} sub="Active positions" />
            <Kpi label="ACTIVE FLIGHTS" value={String(flightCount)} sub="Network traffic" />
            <Kpi label="ATIS" value={String(atisCount)} sub="Published messages" />
            <Kpi label="RECENT LOGINS" value={String(loginCount)} sub="Audit window" />
          </div>
        </div>
      </section>

      <div className="grid xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/10 bg-[#070a16] xl:block">
          <div className="sticky top-[76px] p-4">
            <p className="px-3 text-[9px] font-bold uppercase tracking-[.22em] text-white/25">Navigation</p>
            <nav className="mt-3 space-y-1">
              <Nav href="#live" label="Live operations" />
              <Nav href="#atis" label="ATIS network" />
              <Nav href="#access" label="Access activity" />
              <Nav href="#audit" label="Admin audit" />
            </nav>
            <div className="mt-8 rounded-2xl border border-emerald-400/12 bg-emerald-400/[.05] p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/>Systems nominal</div>
              <p className="mt-2 text-[11px] leading-5 text-white/30">Servicios principales disponibles y sincronización activa.</p>
            </div>
          </div>
        </aside>

        <section className="min-w-0 px-5 py-7 md:px-8 xl:px-10 xl:py-9">
          <section id="live">
            <SectionTitle eyebrow="Realtime" title="Live operations" text="Lo que está ocurriendo ahora mismo en la red." />
            <div className="mt-5 grid gap-5 2xl:grid-cols-2">
              <div className="noc-card"><AdminATCSessions initialSessions={atcSessions ?? []} /></div>
              <div className="noc-card"><AdminActiveFlights initialFlights={activeFlights ?? []} /></div>
            </div>
          </section>

          <section id="atis" className="mt-10">
            <SectionTitle eyebrow="Information service" title="ATIS network" text="Mensajes operacionales publicados actualmente." />
            <div className="noc-card mt-5"><AdminActiveAtis initialAtis={activeAtis ?? []} /></div>
          </section>

          <section id="access" className="mt-10">
            <div className="grid gap-5 2xl:grid-cols-[.72fr_1.28fr]">
              <div>
                <SectionTitle eyebrow="Identity" title="Access activity" text="Últimos accesos registrados en PF24." />
                <div className="mt-5 space-y-2">
                  {(loginLogs ?? []).slice(0,8).map((log) => (
                    <div key={log.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-[#090d1b] px-4 py-3">
                      <div className="min-w-0"><p className="truncate text-sm font-semibold">{log.display_name ?? log.username}</p><p className="mt-1 truncate text-[10px] text-white/25">{(log.roles ?? []).join(", ") || "Sin roles"}</p></div>
                      <div className="text-right"><p className="text-[10px] font-semibold text-white/35">{new Date(log.login_at).toISOString().slice(11,19)}Z</p><p className="mt-1 text-[9px] text-white/20">{log.discord_id}</p></div>
                    </div>
                  ))}
                </div>
              </div>

              <div id="audit">
                <SectionTitle eyebrow="Audit trail" title="Administrative activity" text="Cambios recientes ejecutados por administradores." />
                <div className="mt-5 overflow-hidden rounded-[1.4rem] border border-white/8 bg-[#090d1b]">
                  <div className="grid grid-cols-[160px_180px_minmax(180px,1fr)_150px] border-b border-white/8 px-4 py-3 text-[9px] font-bold uppercase tracking-[.16em] text-white/25">
                    <span>Admin</span><span>Action</span><span>Target</span><span>UTC</span>
                  </div>
                  {(adminLogs ?? []).slice(0,12).map((log) => (
                    <div key={log.id} className="grid grid-cols-[160px_180px_minmax(180px,1fr)_150px] items-center border-b border-white/[.055] px-4 py-3 text-xs last:border-b-0 hover:bg-white/[.02]">
                      <span className="font-semibold">{log.admin_name ?? "Admin"}</span>
                      <span className="font-semibold text-[#aeb8ff]">{log.action}</span>
                      <span className="truncate text-white/40">{log.target_label ?? log.target_id ?? "Sin objetivo"}</span>
                      <span className="text-white/25">{new Date(log.created_at).toISOString().slice(11,19)}Z</span>
                    </div>
                  ))}
                  {!adminLogs?.length && <div className="p-8 text-center text-sm text-white/30">No hay acciones administrativas registradas.</div>}
                </div>
              </div>
            </div>
          </section>
        </section>
      </div>

      <style>{`
        .admin-noc .noc-card{overflow:hidden;border:1px solid rgba(255,255,255,.08);border-radius:1.4rem;background:#090d1b}
        .admin-noc .noc-card>.panel,.admin-noc .noc-card>div{margin:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
        .admin-noc .panel{background:#090d1b!important;border-color:rgba(255,255,255,.08)!important;box-shadow:none!important}
        .admin-noc .mono{font-family:inherit!important;letter-spacing:normal!important}
        .admin-noc table{border-collapse:separate!important;border-spacing:0!important}.admin-noc th{font-size:9px!important;text-transform:uppercase!important;letter-spacing:.14em!important;color:rgba(255,255,255,.25)!important}.admin-noc td{color:rgba(255,255,255,.48)!important}
        .admin-noc input,.admin-noc select,.admin-noc textarea{background:#050816!important;border:1px solid rgba(255,255,255,.09)!important;border-radius:.7rem!important}
        .admin-noc button{border-radius:.7rem!important}
      `}</style>
    </main>
  );
}

function Kpi({label,value,sub}:{label:string;value:string;sub:string}){return <div className="rounded-2xl border border-white/10 bg-[#0a0f21]/85 p-4 backdrop-blur"><p className="text-[9px] font-bold tracking-[.2em] text-white/25">{label}</p><div className="mt-2 flex items-end justify-between gap-3"><p className="text-3xl font-black">{value}</p><p className="pb-1 text-[9px] text-white/25">{sub}</p></div></div>}
function Nav({href,label}:{href:string;label:string}){return <a href={href} className="block rounded-xl px-3 py-2.5 text-sm font-medium text-white/38 transition hover:bg-white/5 hover:text-white">{label}</a>}
function SectionTitle({eyebrow,title,text}:{eyebrow:string;title:string;text:string}){return <div><p className="text-[9px] font-bold uppercase tracking-[.24em] text-[#8095ff]">{eyebrow}</p><h2 className="mt-2 text-2xl font-black tracking-tight">{title}</h2><p className="mt-2 text-sm text-white/35">{text}</p></div>}
