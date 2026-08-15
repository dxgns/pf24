import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import ATCSectorList from "@/components/ATCSectorList";
import UtcClock from "@/components/UtcClock";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Portal ATC Preview | PF24" };

export default async function ATCPreviewPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!session.user?.permissions?.canAccessATC) redirect("/access-denied");

  const { data: flightPlans, error } = await supabase
    .from("flight_plans")
    .select("*")
    .neq("status", "FINISHED")
    .order("created_at", { ascending: false });

  if (error) console.error(error);

  const plans = flightPlans ?? [];
  const pending = plans.filter((p) => p.status === "PENDING").length;
  const emergency = plans.filter((p) => p.transponder === "7600" || p.transponder === "7700").length;

  return (
    <main className="preview-portal relative min-h-screen overflow-hidden bg-[#050612] text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-cover bg-center opacity-22" style={{ backgroundImage: "url('https://framerusercontent.com/images/lKs77AFnsbHG3ATgS3hBMy8iCOw.png')" }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-[#050612]/20 via-[#050612]/80 to-[#050612]" />

      <header className="relative z-20 border-b border-white/10 bg-[#050816]/80 backdrop-blur-xl">
        <div className="section-container flex h-[76px] items-center justify-between gap-4">
          <a href="/design-preview/dashboard" className="flex items-center gap-3">
            <Image src="/logo.png" alt="PF24" width={40} height={40} priority />
            <div><div className="text-xl font-extrabold">PF<span className="text-sky-400">24</span></div><p className="text-[10px] uppercase tracking-[.2em] text-white/35">ATC Operations</p></div>
          </a>
          <div className="flex items-center gap-2">
            <div className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm sm:block"><span className="mr-2 text-white/40">UTC</span><span className="font-bold"><UtcClock /></span></div>
            <a href="/design-preview/dashboard" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-[#8095ff]/50 hover:text-white">Dashboard</a>
          </div>
        </div>
      </header>

      <section className="section-container relative z-10 pb-20 pt-10">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#8095ff]/20 bg-[#8095ff]/10 px-3 py-1.5 text-xs font-semibold text-[#b6beff]"><span className="h-1.5 w-1.5 rounded-full bg-green-400" /> Red ATC disponible</div>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight md:text-5xl">Centro de control</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-white/55">Primero abre tu posición. Después, todo el tráfico y las herramientas de coordinación quedan concentradas en un único workspace.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Tráfico" value={String(plans.length)} />
            <Metric label="Pendiente" value={String(pending)} />
            <Metric label="Emerg." value={String(emergency)} alert={emergency > 0} />
          </div>
        </div>

        <div className="mt-8 rounded-[2rem] border border-white/10 bg-slate-900/68 p-3 shadow-2xl shadow-black/15 backdrop-blur-xl md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-2 md:px-3">
            <div><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#8095ff]">Workspace operativo</p><h2 className="mt-1 text-2xl font-extrabold">Sector List & coordinación</h2></div>
            <div className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-2 text-sm"><span className="text-white/35">Controlador </span><span className="font-semibold">{session.user?.name ?? "ATC"}</span></div>
          </div>
          <div className="atc-workspace"><ATCSectorList initialPlans={plans} controllerName={session.user?.name ?? "ATC"} /></div>
        </div>
      </section>

      <style>{`
        .preview-portal .panel{background:rgba(15,23,42,.70)!important;border-color:rgba(255,255,255,.10)!important;box-shadow:none!important}
        .preview-portal .mono{font-family:inherit!important;letter-spacing:normal!important}
        .atc-workspace>.panel:first-child{display:none!important}
        .atc-workspace>div.mt-8{margin-top:0!important}
        .atc-workspace>div.mx-auto{margin-top:1rem!important;max-width:880px!important;background:rgba(2,6,23,.40)!important;border:1px solid rgba(128,149,255,.18)!important;box-shadow:0 25px 80px rgba(0,0,0,.22)!important}
        .atc-workspace>div.mx-auto h2{font-size:1.8rem!important}
        .preview-portal input,.preview-portal textarea,.preview-portal select{background:rgba(2,6,23,.62)!important;border:1px solid rgba(255,255,255,.12)!important;border-radius:.85rem!important;min-height:44px}
        .preview-portal input:focus,.preview-portal textarea:focus,.preview-portal select:focus{border-color:rgba(128,149,255,.85)!important;box-shadow:0 0 0 3px rgba(128,149,255,.10)!important;outline:none!important}
        .preview-portal button{border-radius:.85rem!important;transition:.18s ease!important}
        .atc-workspace table{border-collapse:separate!important;border-spacing:0 7px!important}
        .atc-workspace thead{background:transparent!important}
        .atc-workspace thead tr{background:rgba(255,255,255,.035)!important}
        .atc-workspace tbody>tr:not(:has(td[colspan])){background:rgba(255,255,255,.025)!important}
        .atc-workspace th{color:rgba(255,255,255,.40)!important;font-size:.72rem!important;letter-spacing:.05em}
        .atc-workspace td{border-top:0!important}
        .atc-workspace .grid.md\\:grid-cols-4{background:rgba(2,6,23,.40)!important;border-color:rgba(255,255,255,.08)!important}
        .atc-workspace .grid.md\\:grid-cols-4>div{background:rgba(255,255,255,.025)!important}
        .atc-workspace aside button:first-of-type{background:#8095ff!important;border-color:#8095ff!important;color:white!important;order:1}
        .atc-workspace aside button:nth-of-type(5){order:2}
        .atc-workspace aside button:nth-of-type(3){order:3}
        .atc-workspace aside button:nth-of-type(2){order:4}
        .atc-workspace aside button:nth-of-type(4){order:5}
        .atc-workspace aside .grid{display:flex!important;flex-direction:column!important}
        .atc-workspace .xl\\:grid-cols-\\[minmax\\(0\\,1fr\\)_340px\\]{grid-template-columns:minmax(0,1fr) 380px!important}
        @media(max-width:1279px){.atc-workspace .xl\\:grid-cols-\\[minmax\\(0\\,1fr\\)_340px\\]{display:grid!important;grid-template-columns:1fr!important}}
      `}</style>
    </main>
  );
}

function Metric({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return <div className={`min-w-[88px] rounded-2xl border px-4 py-3 backdrop-blur ${alert ? "border-red-400/25 bg-red-400/10" : "border-white/10 bg-slate-900/60"}`}><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-white/35">{label}</p><p className={`mt-1 text-xl font-extrabold ${alert ? "text-red-300" : "text-white"}`}>{value}</p></div>;
}
