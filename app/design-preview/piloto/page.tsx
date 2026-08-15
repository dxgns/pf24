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

  return (
    <main className="preview-portal relative min-h-screen overflow-hidden bg-[#050612] text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[540px] bg-cover bg-center opacity-25"
        style={{ backgroundImage: "url('https://framerusercontent.com/images/lKs77AFnsbHG3ATgS3hBMy8iCOw.png')" }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[540px] bg-gradient-to-b from-[#050612]/20 via-[#050612]/80 to-[#050612]" />

      <header className="relative z-20 border-b border-white/10 bg-[#050816]/75 backdrop-blur-xl">
        <div className="section-container flex h-[76px] items-center justify-between gap-4">
          <a href="/design-preview/dashboard" className="flex items-center gap-3">
            <Image src="/logo.png" alt="PF24" width={40} height={40} priority />
            <div className="text-xl font-extrabold">PF<span className="text-sky-400">24</span></div>
          </a>
          <div className="flex items-center gap-3">
            <div className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm sm:block">
              <span className="mr-2 text-white/40">UTC</span><span className="font-bold"><UtcClock /></span>
            </div>
            <a href="/design-preview/dashboard" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-[#8095ff]/50 hover:text-white">← Dashboard</a>
          </div>
        </div>
      </header>

      <section className="section-container relative z-10 max-w-7xl pb-20 pt-12">
        <ContactMeReceiver pilotId={pilotId} />

        <div className="mb-8 grid items-end gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#8095ff]/20 bg-[#8095ff]/10 px-3 py-1.5 text-xs font-semibold text-[#b6beff]">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> Operaciones de vuelo
            </div>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight md:text-5xl">Portal Piloto</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-white/55">
              Presenta y administra tu vuelo desde un espacio pensado para mantener lo importante a la vista durante toda la operación.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/65 px-5 py-4 backdrop-blur">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Piloto conectado</p>
            <p className="mt-1 font-bold text-white">{session.user?.name ?? "Usuario"}</p>
          </div>
        </div>

        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-7">
            <section className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-3 shadow-2xl shadow-black/15 backdrop-blur-xl md:p-4">
              <div className="px-3 pb-4 pt-2 md:px-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8095ff]">Plan de vuelo</p>
                <h2 className="mt-2 text-2xl font-extrabold">Preparar operación</h2>
              </div>
              <PilotFlightPlanForm />
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-3 shadow-xl shadow-black/10 backdrop-blur-xl md:p-4">
              <div className="px-3 pb-3 pt-2 md:px-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8095ff]">Tus vuelos</p>
                <h2 className="mt-2 text-2xl font-extrabold">Operaciones activas</h2>
              </div>
              <PilotFlightPlans initialPlans={flightPlans ?? []} pilotId={pilotId} />
            </section>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <OnlineATCPanel initialSessions={atcSessions ?? []} />
            <LatestAtisPanel showAlerts={true} />
          </aside>
        </div>
      </section>

      <style>{`
        .preview-portal .panel { background: rgba(15,23,42,.72) !important; border-color: rgba(255,255,255,.10) !important; box-shadow: 0 18px 50px rgba(0,0,0,.16); }
        .preview-portal .mono { font-family: inherit !important; letter-spacing: normal !important; }
        .preview-portal input, .preview-portal textarea, .preview-portal select { background: rgba(2,6,23,.55) !important; border-color: rgba(255,255,255,.12) !important; border-radius: .85rem !important; }
        .preview-portal input:focus, .preview-portal textarea:focus, .preview-portal select:focus { border-color: rgba(128,149,255,.7) !important; outline: none !important; }
        .preview-portal button { border-radius: .85rem !important; }
      `}</style>
    </main>
  );
}
