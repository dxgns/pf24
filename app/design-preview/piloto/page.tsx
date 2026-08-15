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

export const metadata: Metadata = { title: "Flight Desk Preview | PF24" };

export default async function PilotPreviewPage() {
  const session = await auth();
  if (!session?.user?.permissions?.canAccessPilot) redirect("/access-denied");
  if (!session) redirect("/login");

  const pilotId = session.user?.email ?? session.user?.name ?? "unknown";
  const { data: flightPlans } = await supabase
    .from("flight_plans").select("*").eq("created_by", pilotId)
    .neq("status", "FINISHED").order("created_at", { ascending: false });
  const { data: atcSessions } = await supabase
    .from("atc_sessions").select("*").eq("is_active", true)
    .order("started_at", { ascending: false });

  const active = flightPlans?.[0];

  return (
    <main className="pilot-deck min-h-screen bg-[#050612] text-white">
      <ContactMeReceiver pilotId={pilotId} />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[86px] flex-col items-center border-r border-white/10 bg-[#060817]/95 py-5 backdrop-blur-2xl lg:flex">
        <a href="/design-preview/dashboard" className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5">
          <Image src="/logo.png" alt="PF24" width={34} height={34} priority />
        </a>
        <nav className="mt-12 flex flex-1 flex-col gap-3">
          <Rail href="#overview" label="OV" icon="◈" />
          <Rail href="#flightplan" label="FP" icon="✈" />
          <Rail href="#network" label="NW" icon="⌁" />
        </nav>
        <a href="/design-preview/dashboard" className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 text-white/55 transition hover:bg-white/5 hover:text-white">←</a>
      </aside>

      <div className="lg:pl-[86px]">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050612]/80 backdrop-blur-2xl">
          <div className="flex h-[72px] items-center justify-between gap-5 px-5 md:px-8 xl:px-10">
            <div className="flex items-center gap-4">
              <div className="lg:hidden"><Image src="/logo.png" alt="PF24" width={34} height={34} /></div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.28em] text-[#8095ff]">PF24 Flight Desk</p>
                <p className="mt-1 text-sm font-semibold text-white/80">{session.user?.name ?? "Piloto"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden rounded-xl border border-white/10 bg-white/[.035] px-4 py-2 sm:block">
                <span className="mr-2 text-[10px] font-bold uppercase tracking-[.18em] text-white/30">UTC</span>
                <span className="font-semibold"><UtcClock /></span>
              </div>
              <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> LIVE
              </span>
            </div>
          </div>
        </header>

        <section id="overview" className="relative overflow-hidden border-b border-white/10 px-5 py-8 md:px-8 xl:px-10 xl:py-10">
          <div className="pointer-events-none absolute inset-0 opacity-25" style={{backgroundImage:"url('https://framerusercontent.com/images/lKs77AFnsbHG3ATgS3hBMy8iCOw.png')",backgroundSize:'cover',backgroundPosition:'center'}} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#050612] via-[#050612]/90 to-[#050612]/55" />
          <div className="relative grid gap-8 xl:grid-cols-[1fr_420px] xl:items-end">
            <div>
              <div className="mb-5 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[.18em] text-white/35">
                <span>Flight workspace</span><span>•</span><span>Realtime sync</span><span>•</span><span>Auto-save</span>
              </div>
              <h1 className="max-w-3xl text-4xl font-black tracking-[-.04em] md:text-6xl">
                {active ? <>Tu vuelo está <span className="text-[#9ba9ff]">en marcha.</span></> : <>Prepara tu próxima <span className="text-[#9ba9ff]">operación.</span></>}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/45">
                Todo lo necesario para presentar, seguir y ajustar tu vuelo sin salir del mismo espacio operacional.
              </p>
            </div>

            <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#0b1023]/85 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-[.22em] text-white/35">Current operation</span>
                <span className="rounded-full bg-[#8095ff]/10 px-2.5 py-1 text-[10px] font-bold text-[#aeb8ff]">{active?.status ?? "READY"}</span>
              </div>
              {active ? (
                <div className="p-5">
                  <div className="flex items-end justify-between gap-4">
                    <div><p className="text-[11px] text-white/35">CALLSIGN</p><p className="mt-1 text-2xl font-black">{active.callsign}</p></div>
                    <div className="text-right"><p className="text-[11px] text-white/35">FLIGHT LEVEL</p><p className="mt-1 text-xl font-bold text-[#aeb8ff]">FL{active.flight_level}</p></div>
                  </div>
                  <div className="mt-6 grid grid-cols-[auto_1fr_auto] items-center gap-4">
                    <Airport code={active.departure_icao} label="ORIGIN" />
                    <div className="relative h-px bg-white/15"><div className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#8095ff]"/><div className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#8095ff]"/><span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0b1023] px-2 text-[#aeb8ff]">✈</span></div>
                    <Airport code={active.arrival_icao} label="DEST" right />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/45">
                    <Chip>{active.aircraft_type}</Chip><Chip>{active.flight_rules}</Chip><Chip>XPDR {active.transponder}</Chip><Chip>{active.sector_status}</Chip>
                  </div>
                </div>
              ) : (
                <div className="p-7"><p className="text-sm text-white/45">No hay un vuelo activo. Completa el plan de vuelo para iniciar tu operación.</p></div>
              )}
            </div>
          </div>
        </section>

        <section className="grid min-h-[calc(100vh-72px)] xl:grid-cols-[minmax(0,1fr)_380px]">
          <div id="flightplan" className="min-w-0 px-5 py-8 md:px-8 xl:px-10 xl:py-10">
            <div className="mb-8 flex items-end justify-between gap-5">
              <div><p className="text-[10px] font-bold uppercase tracking-[.26em] text-[#8095ff]">Flight management</p><h2 className="mt-2 text-3xl font-black tracking-tight">Plan & operación</h2></div>
              <span className="hidden text-xs text-white/30 md:block">Los cambios se guardan automáticamente</span>
            </div>

            <div className="pilot-form-shell"><PilotFlightPlanForm /></div>
            <div className="mt-8 border-t border-white/10 pt-8"><PilotFlightPlans initialPlans={flightPlans ?? []} pilotId={pilotId} /></div>
          </div>

          <aside id="network" className="border-t border-white/10 bg-[#080b18] xl:border-l xl:border-t-0">
            <div className="sticky top-[72px] max-h-[calc(100vh-72px)] overflow-y-auto p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.24em] text-[#8095ff]">Network feed</p><h3 className="mt-1 text-xl font-black">Entorno operacional</h3></div><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.7)]" /></div>
              <div className="network-stack"><OnlineATCPanel initialSessions={atcSessions ?? []} /><LatestAtisPanel showAlerts={true} /></div>
            </div>
          </aside>
        </section>
      </div>

      <style>{`
        .pilot-deck .panel{background:transparent!important;border:0!important;box-shadow:none!important}
        .pilot-deck .pilot-form-shell>.panel{margin-top:0!important;background:linear-gradient(145deg,rgba(15,23,42,.86),rgba(8,11,24,.96))!important;border:1px solid rgba(255,255,255,.09)!important;border-radius:1.6rem!important;padding:1.4rem!important}
        .pilot-deck .pilot-form-shell>.panel>h2{font-size:1.1rem!important;color:white!important}
        .pilot-deck .pilot-form-shell>.panel>p{color:rgba(255,255,255,.38)!important}
        .pilot-deck .pilot-form-shell form{grid-template-columns:repeat(12,minmax(0,1fr))!important;gap:.75rem!important}
        .pilot-deck .pilot-form-shell form>*{grid-column:span 6}
        .pilot-deck .pilot-form-shell form>*:nth-child(1){grid-column:span 4}.pilot-deck .pilot-form-shell form>*:nth-child(2){grid-column:span 4}.pilot-deck .pilot-form-shell form>*:nth-child(3){grid-column:span 4}
        .pilot-deck .pilot-form-shell form>*:nth-child(6),.pilot-deck .pilot-form-shell form>*:nth-child(8){grid-column:span 12}
        .pilot-deck input,.pilot-deck select,.pilot-deck textarea{background:#090d1c!important;border:1px solid rgba(255,255,255,.09)!important;border-radius:.9rem!important;min-height:48px;color:white!important}
        .pilot-deck input:focus,.pilot-deck select:focus,.pilot-deck textarea:focus{border-color:#8095ff!important;outline:none!important;box-shadow:0 0 0 3px rgba(128,149,255,.10)}
        .pilot-deck button{border-radius:.9rem!important}.pilot-deck .pilot-form-shell button[type=submit]{background:#8095ff!important;grid-column:span 12!important;min-height:50px}
        .pilot-deck .network-stack>.panel,.pilot-deck .network-stack>div{background:rgba(15,23,42,.72)!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:1.2rem!important;margin-top:0!important;margin-bottom:1rem!important}
        .pilot-deck .mt-10.grid.gap-6>.panel{background:rgba(11,16,35,.88)!important;border:1px solid rgba(255,255,255,.09)!important;border-radius:1.5rem!important;padding:1.25rem!important}
        .pilot-deck .mono{font-family:inherit!important;letter-spacing:normal!important}
        @media(max-width:700px){.pilot-deck .pilot-form-shell form>*{grid-column:span 12!important}}
      `}</style>
    </main>
  );
}

function Rail({href,label,icon}:{href:string;label:string;icon:string}){return <a href={href} className="group flex w-12 flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-white/35 transition hover:bg-white/5 hover:text-white"><span className="text-lg">{icon}</span><span className="text-[8px] font-bold tracking-[.18em]">{label}</span></a>}
function Airport({code,label,right}:{code:string;label:string;right?:boolean}){return <div className={right?'text-right':''}><p className="text-[9px] font-bold tracking-[.2em] text-white/25">{label}</p><p className="mt-1 text-xl font-black">{code}</p></div>}
function Chip({children}:{children:React.ReactNode}){return <span className="rounded-lg border border-white/8 bg-white/[.035] px-2.5 py-1.5">{children}</span>}
