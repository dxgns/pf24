import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import ATCSectorList from "@/components/ATCSectorList";
import UtcClock from "@/components/UtcClock";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "ATC Workspace Preview | PF24" };

export default async function ATCPreviewPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!session.user?.permissions?.canAccessATC) redirect("/access-denied");

  const { data: flightPlans, error } = await supabase
    .from("flight_plans").select("*").neq("status", "FINISHED")
    .order("created_at", { ascending: false });
  if (error) console.error(error);

  const total = flightPlans?.length ?? 0;
  const pending = flightPlans?.filter((p) => p.status === "PENDING").length ?? 0;
  const active = flightPlans?.filter((p) => p.status === "ACTIVE").length ?? 0;
  const emergencies = flightPlans?.filter((p) => p.transponder === "7600" || p.transponder === "7700").length ?? 0;

  return (
    <main className="atc-workspace min-h-screen bg-[#03050d] text-white">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[230px] border-r border-white/10 bg-[#070a16] xl:flex xl:flex-col">
        <div className="flex h-[78px] items-center gap-3 border-b border-white/10 px-5">
          <Image src="/logo.png" alt="PF24" width={38} height={38} priority />
          <div><div className="text-lg font-black">PF<span className="text-[#8095ff]">24</span></div><p className="text-[9px] font-bold uppercase tracking-[.25em] text-white/30">ATC Network</p></div>
        </div>
        <div className="px-4 py-5">
          <p className="px-3 text-[9px] font-bold uppercase tracking-[.22em] text-white/25">Workspace</p>
          <nav className="mt-3 space-y-1">
            <SideNav href="#traffic" label="Traffic board" icon="◎" active />
            <SideNav href="#sector" label="Sector control" icon="⌁" />
            <SideNav href="#atis" label="ATIS & network" icon="≋" />
          </nav>
        </div>
        <div className="mt-auto border-t border-white/10 p-4">
          <div className="rounded-2xl border border-white/8 bg-white/[.03] p-4">
            <p className="text-[9px] font-bold uppercase tracking-[.2em] text-white/25">Controller</p>
            <p className="mt-2 truncate text-sm font-semibold">{session.user?.name ?? "ATC"}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/>Network online</div>
          </div>
          <a href="/design-preview/dashboard" className="mt-3 flex items-center justify-center rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-white/50 transition hover:bg-white/5 hover:text-white">← Exit workspace</a>
        </div>
      </aside>

      <div className="xl:pl-[230px]">
        <header className="sticky top-0 z-40 flex h-[78px] items-center justify-between border-b border-white/10 bg-[#03050d]/85 px-5 backdrop-blur-2xl md:px-8">
          <div><p className="text-[10px] font-bold uppercase tracking-[.24em] text-[#8095ff]">Live airspace</p><h1 className="mt-1 text-lg font-black">Traffic Control Workspace</h1></div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[.03] px-4 py-2"><span className="mr-2 text-[9px] font-bold uppercase tracking-[.2em] text-white/25">UTC</span><span className="text-sm font-bold"><UtcClock /></span></div>
            <span className="hidden rounded-xl border border-emerald-400/15 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300 sm:inline-flex">LIVE</span>
          </div>
        </header>

        <section id="traffic" className="border-b border-white/10 bg-[#070a16] px-5 py-6 md:px-8">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Visible traffic" value={String(total)} hint="Current board" />
            <Stat label="Pending" value={String(pending)} hint="Awaiting action" />
            <Stat label="Active" value={String(active)} hint="In operation" />
            <Stat label="Emergencies" value={String(emergencies)} hint={emergencies ? "Attention required" : "No alerts"} danger={emergencies > 0} />
          </div>
        </section>

        <section id="sector" className="relative px-4 py-5 md:px-6 md:py-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-80 opacity-[.08]" style={{backgroundImage:"url('https://framerusercontent.com/images/lKs77AFnsbHG3ATgS3hBMy8iCOw.png')",backgroundSize:'cover',backgroundPosition:'center'}} />
          <div className="relative">
            <ATCSectorList initialPlans={flightPlans ?? []} controllerName={session.user?.name ?? "ATC"} />
          </div>
        </section>
      </div>

      <style>{`
        .atc-workspace .panel{background:#090d1a!important;border:1px solid rgba(255,255,255,.08)!important;box-shadow:none!important}
        .atc-workspace .panel:first-child{background:linear-gradient(120deg,#0a0f21,#080b17)!important;border-radius:1rem!important;padding:1.15rem 1.25rem!important}
        .atc-workspace .panel:first-child h1{font-size:1.35rem!important}.atc-workspace .panel:first-child p{font-size:.8rem!important;color:rgba(255,255,255,.4)!important}
        .atc-workspace .mono{font-family:inherit!important;letter-spacing:normal!important}
        .atc-workspace input,.atc-workspace select,.atc-workspace textarea{background:#050816!important;border:1px solid rgba(255,255,255,.09)!important;color:white!important;border-radius:.65rem!important}
        .atc-workspace input:focus,.atc-workspace select:focus,.atc-workspace textarea:focus{border-color:#8095ff!important;outline:none!important;box-shadow:0 0 0 3px rgba(128,149,255,.08)}
        .atc-workspace button{border-radius:.65rem!important}
        .atc-workspace table{border-collapse:separate!important;border-spacing:0 4px!important}
        .atc-workspace thead{background:transparent!important}.atc-workspace thead tr{background:transparent!important}
        .atc-workspace th{font-size:9px!important;text-transform:uppercase!important;letter-spacing:.16em!important;color:rgba(255,255,255,.28)!important;border:0!important}
        .atc-workspace tbody>tr:not(:has(td[colspan])){background:#080c18!important}
        .atc-workspace tbody>tr>td{border-top:1px solid rgba(255,255,255,.06)!important;border-bottom:1px solid rgba(255,255,255,.06)!important}
        .atc-workspace tbody>tr>td:first-child{border-left:1px solid rgba(255,255,255,.06)!important;border-radius:.8rem 0 0 .8rem}.atc-workspace tbody>tr>td:last-child{border-right:1px solid rgba(255,255,255,.06)!important;border-radius:0 .8rem .8rem 0}
        .atc-workspace tbody>tr:hover{background:#0d1325!important}
        .atc-workspace .rounded-3xl.border.border-sky-500\/20{max-width:none!important;margin-top:1rem!important;background:#080c18!important;border-color:rgba(128,149,255,.18)!important;display:grid!important;grid-template-columns:320px minmax(0,1fr)!important;gap:1rem!important}
        .atc-workspace .rounded-3xl.border.border-sky-500\/20>h2,.atc-workspace .rounded-3xl.border.border-sky-500\/20>p,.atc-workspace .rounded-3xl.border.border-sky-500\/20>input,.atc-workspace .rounded-3xl.border.border-sky-500\/20>.mt-3{grid-column:1}
        .atc-workspace .rounded-3xl.border.border-sky-500\/20>.mt-6.max-h-\[400px\]{grid-column:2;grid-row:1 / span 5;margin-top:0!important;max-height:520px!important}
        .atc-workspace .grid.gap-6.xl\:grid-cols-\[minmax\(0\,1fr\)_340px\]{grid-template-columns:minmax(0,1fr) 320px!important}
        .atc-workspace .md\:grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))!important}
        .atc-workspace .md\:col-span-4 button{background:rgba(248,113,113,.08)!important}
        @media(max-width:1100px){.atc-workspace .rounded-3xl.border.border-sky-500\/20{display:block!important}.atc-workspace .rounded-3xl.border.border-sky-500\/20>.mt-6.max-h-\[400px\]{margin-top:1rem!important}.atc-workspace .grid.gap-6.xl\:grid-cols-\[minmax\(0\,1fr\)_340px\]{grid-template-columns:1fr!important}}
      `}</style>
    </main>
  );
}

function SideNav({href,label,icon,active}:{href:string;label:string;icon:string;active?:boolean}){return <a href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active?'bg-[#8095ff]/12 text-[#b6beff]':'text-white/40 hover:bg-white/5 hover:text-white'}`}><span className="w-5 text-center text-base">{icon}</span>{label}</a>}
function Stat({label,value,hint,danger}:{label:string;value:string;hint:string;danger?:boolean}){return <div className={`rounded-2xl border p-4 ${danger?'border-red-400/20 bg-red-400/[.06]':'border-white/8 bg-white/[.025]'}`}><p className="text-[9px] font-bold uppercase tracking-[.2em] text-white/25">{label}</p><div className="mt-2 flex items-end justify-between gap-3"><p className={`text-3xl font-black ${danger?'text-red-300':'text-white'}`}>{value}</p><p className="pb-1 text-[10px] text-white/25">{hint}</p></div></div>}
