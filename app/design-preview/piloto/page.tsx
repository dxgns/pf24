import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import PilotFlightPlanForm from "@/components/PilotFlightPlanForm";
import PilotFlightPlans from "@/components/PilotFlightPlans";
import OnlineATCPanel from "@/components/OnlineATCPanel";
import UtcClock from "@/components/UtcClock";
import ContactMeReceiver from "@/components/ContactMeReceiver";
import LatestAtisPanel from "@/components/LatestAtisPanel";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portal Piloto Preview | PF24",
};

export default async function PilotPreviewPage() {
  const session = await auth();
  if (!session?.user?.permissions?.canAccessPilot) redirect("/access-denied");
  if (!session) redirect("/login");

  const pilotId = session.user?.email ?? session.user?.name ?? "unknown";

  const { data: flightPlans } = await supabase
    .from("flight_plans")
    .select("*")
    .eq("created_by", pilotId)
    .neq("status", "FINISHED")
    .order("created_at", { ascending: false });

  const { data: atcSessions } = await supabase
    .from("atc_sessions")
    .select("*")
    .eq("is_active", true)
    .order("started_at", { ascending: false });

  const activePlans = flightPlans ?? [];
  const controllers = atcSessions ?? [];

  return (
    <main className="preview-portal relative min-h-screen overflow-hidden bg-[#050612] text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-cover bg-center opacity-25" style={{ backgroundImage: "url('https://framerusercontent.com/images/lKs77AFnsbHG3ATgS3hBMy8iCOw.png')" }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-gradient-to-b from-[#050612]/20 via-[#050612]/78 to-[#050612]" />
      <div className="pointer-events-none absolute left-1/2 top-[-160px] h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-[#8095ff]/10 blur-[130px]" />

      <header className="relative z-20 border-b border-white/10 bg-[#050816]/78 backdrop-blur-xl">
        <div className="section-container flex h-[76px] items-center justify-between gap-4">
          <a href="/design-preview/dashboard" className="flex items-center gap-3">
            <Image src="/logo.png" alt="PF24" width={40} height={40} priority />
            <div><div className="text-xl font-extrabold">PF<span className="text-sky-400">24</span></div><p className="text-[10px] uppercase tracking-[.2em] text-white/35">Pilot</p></div>
          </a>
          <div className="flex items-center gap-2">
            <div className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm sm:block"><span className="mr-2 text-white/40">UTC</span><span className="font-bold"><UtcClock /></span></div>
            <a href="/design-preview/dashboard" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-[#8095ff]/50 hover:text-white">Dashboard</a>
          </div>
        </div>
      </header>

      <section className="section-container relative z-10 max-w-7xl pb-20 pt-10 md:pt-12">
        <ContactMeReceiver pilotId={pilotId} />

        <div className="grid gap-5 md:grid-cols-3">
          <div className="md:col-span-2 rounded-[1.8rem] border border-white/10 bg-slate-900/65 p-7 shadow-2xl shadow-black/15 backdrop-blur-xl md:p-9">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#8095ff]/20 bg-[#8095ff]/10 px-3 py-1.5 text-xs font-semibold text-[#b6beff]"><span className="h-1.5 w-1.5 rounded-full bg-green-400" /> Centro de vuelo</div>
                <h1 className="mt-5 text-4xl font-extrabold tracking-tight md:text-5xl">Tu operación, en un solo lugar.</h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-white/55">Presenta el plan, revisa cobertura ATC y sigue tu operación sin saltar entre pantallas.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-1">
            <Metric label="Vuelos activos" value={String(activePlans.length)} />
            <Metric label="ATC online" value={String(controllers.length)} />
            <Metric label="Piloto" value={session.user?.name ?? "Usuario"} compact />
          </div>
        </div>

        <div className="mt-7 grid gap-7 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="order-2 space-y-5 xl:order-1 xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-[1.7rem] border border-white/10 bg-slate-900/70 p-5 shadow-xl shadow-black/10 backdrop-blur-xl">
              <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#8095ff]">Estado operativo</p>
              <h2 className="mt-2 text-xl font-extrabold">Antes de despegar</h2>
              <div className="mt-5 space-y-2 text-sm">
                <StatusRow label="Sesión" value="Activa" ok />
                <StatusRow label="Sincronización" value="Tiempo real" ok />
                <StatusRow label="Hora" value={<UtcClock />} />
              </div>
            </section>
            <OnlineATCPanel initialSessions={controllers} />
            <LatestAtisPanel showAlerts={true} />
          </aside>

          <div className="order-1 space-y-7 xl:order-2">
            <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/72 shadow-2xl shadow-black/15 backdrop-blur-xl">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 px-6 py-5 md:px-8">
                <div><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#8095ff]">Paso 1</p><h2 className="mt-1 text-2xl font-extrabold">Preparar plan de vuelo</h2></div>
                <p className="max-w-sm text-sm leading-6 text-white/40">Completa los datos esenciales. El resto de la información operacional se mantiene visible a la izquierda.</p>
              </div>
              <div className="pilot-form-shell p-3 md:p-4"><PilotFlightPlanForm /></div>
            </section>

            <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/62 shadow-xl shadow-black/10 backdrop-blur-xl">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 px-6 py-5 md:px-8">
                <div><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#8095ff]">Paso 2</p><h2 className="mt-1 text-2xl font-extrabold">Gestionar operación activa</h2></div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/45">{activePlans.length} visible{activePlans.length === 1 ? "" : "s"}</span>
              </div>
              <div className="pilot-plans-shell p-3 md:p-4"><PilotFlightPlans initialPlans={activePlans} pilotId={pilotId} /></div>
            </section>
          </div>
        </div>
      </section>

      <style>{`
        .preview-portal .panel{background:rgba(15,23,42,.72)!important;border-color:rgba(255,255,255,.10)!important;box-shadow:0 18px 50px rgba(0,0,0,.16)}
        .preview-portal .mono{font-family:inherit!important;letter-spacing:normal!important}
        .preview-portal input,.preview-portal textarea,.preview-portal select{background:rgba(2,6,23,.58)!important;border:1px solid rgba(255,255,255,.12)!important;border-radius:.9rem!important;min-height:46px}
        .preview-portal input:focus,.preview-portal textarea:focus,.preview-portal select:focus{border-color:rgba(128,149,255,.8)!important;box-shadow:0 0 0 3px rgba(128,149,255,.10)!important;outline:none!important}
        .preview-portal button{border-radius:.9rem!important;transition:.18s ease!important}
        .pilot-form-shell .panel,.pilot-plans-shell .panel{background:transparent!important;border:0!important;box-shadow:none!important}
        .pilot-form-shell button[type="submit"]{background:#8095ff!important;color:white!important;border:0!important;font-weight:700!important;padding:.9rem 1.2rem!important}
        .pilot-form-shell button[type="submit"]:hover{background:#6f84ff!important;transform:translateY(-1px)}
        .pilot-plans-shell table{border-collapse:separate!important;border-spacing:0 8px!important}
        .pilot-plans-shell tbody tr{background:rgba(255,255,255,.025)!important}
      `}</style>
    </main>
  );
}

function Metric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-5 py-4 backdrop-blur"><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-white/35">{label}</p><p className={`mt-1 font-extrabold text-white ${compact ? "truncate text-base" : "text-2xl"}`}>{value}</p></div>;
}

function StatusRow({ label, value, ok = false }: { label: string; value: React.ReactNode; ok?: boolean }) {
  return <div className="flex items-center justify-between gap-4 rounded-xl px-3 py-2.5 hover:bg-white/[.03]"><span className="text-white/40">{label}</span><span className={`font-semibold ${ok ? "text-green-300" : "text-white/75"}`}>{value}</span></div>;
}
