import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import ATCSectorList from "@/components/ATCSectorList";
import UtcClock from "@/components/UtcClock";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portal ATC Preview | PF24",
};

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

  return (
    <main className="preview-portal relative min-h-screen overflow-hidden bg-[#050612] text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-cover bg-center opacity-20"
        style={{ backgroundImage: "url('https://framerusercontent.com/images/lKs77AFnsbHG3ATgS3hBMy8iCOw.png')" }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-gradient-to-b from-[#050612]/25 via-[#050612]/80 to-[#050612]" />

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

      <section className="section-container relative z-10 pb-20 pt-12">
        <div className="mb-8 grid items-end gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#8095ff]/20 bg-[#8095ff]/10 px-3 py-1.5 text-xs font-semibold text-[#b6beff]">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> Control de tráfico aéreo
            </div>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight md:text-5xl">Portal ATC</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-white/55">
              Abre una posición, gestiona tráfico y coordina operaciones en tiempo real desde una interfaz más limpia y alineada con PF24.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/65 px-5 py-4 backdrop-blur">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Controlador</p>
            <p className="mt-1 font-bold text-white">{session.user?.name ?? "ATC"}</p>
          </div>
        </div>

        <section className="rounded-[2rem] border border-white/10 bg-slate-900/65 p-3 shadow-2xl shadow-black/15 backdrop-blur-xl md:p-5">
          <ATCSectorList initialPlans={flightPlans ?? []} controllerName={session.user?.name ?? "ATC"} />
        </section>
      </section>

      <style>{`
        .preview-portal .panel { background: rgba(15,23,42,.68) !important; border-color: rgba(255,255,255,.10) !important; box-shadow: 0 16px 42px rgba(0,0,0,.14); }
        .preview-portal .radar-grid { background-image: none !important; }
        .preview-portal .mono { font-family: inherit !important; letter-spacing: normal !important; }
        .preview-portal input, .preview-portal textarea, .preview-portal select { background: rgba(2,6,23,.58) !important; border-color: rgba(255,255,255,.12) !important; border-radius: .75rem !important; }
        .preview-portal input:focus, .preview-portal textarea:focus, .preview-portal select:focus { border-color: rgba(128,149,255,.75) !important; outline: none !important; }
        .preview-portal button { border-radius: .75rem !important; }
        .preview-portal table { border-collapse: separate; border-spacing: 0; }
        .preview-portal th { color: rgba(255,255,255,.42) !important; }
      `}</style>
    </main>
  );
}
