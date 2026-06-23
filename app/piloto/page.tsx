import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PilotFlightPlanForm from "@/components/PilotFlightPlanForm";
import PilotFlightPlans from "@/components/PilotFlightPlans";
import OnlineATCPanel from "@/components/OnlineATCPanel";
import UtcClock from "@/components/UtcClock";
import ContactMeReceiver from "@/components/ContactMeReceiver";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portal Piloto | PF24",
};

export default async function PilotPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

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
    <main className="radar-grid min-h-screen bg-[#020617] px-6 py-24 text-white">
      <section className="section-container max-w-6xl">

        <ContactMeReceiver pilotId={pilotId} />

        <div className="panel rounded-3xl p-8">

          <div className="mb-6 flex items-center justify-between">
            <a
              href="/dashboard"
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
            >
              ← Regresar
            </a>

            <div className="mono text-sm tracking-[0.25em] text-slate-400"> 
              PF24
            </div>
          </div>

          <h1 className="mt-4 text-4xl font-extrabold">
            Portal Piloto
          </h1>

          <p className="mt-4 max-w-3xl text-slate-300">
            Crea y gestiona tu plan de vuelo. Los cambios realizados por ATC se
            sincronizan en tiempo real.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="panel rounded-2xl p-5">
            <p className="mono text-xs text-sky-300/70">PILOTO</p>
            <p className="mono mt-2 text-xl font-bold">
              {session.user?.name ?? "Usuario"}
            </p>
          </div>

          <div className="panel rounded-2xl p-5">
            <p className="mono text-xs text-sky-300/70">HORA UTC</p>
            <p className="mono mt-2 text-xl font-bold">
              <UtcClock />
            </p>
          </div>

          <div className="panel rounded-2xl p-5">
            <p className="mono text-xs text-sky-300/70">SISTEMA</p>
            <p className="mono mt-2 text-xl font-bold text-green-300">
              ONLINE
            </p>
          </div>

        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <div>
            <PilotFlightPlanForm />

            <PilotFlightPlans
              initialPlans={flightPlans ?? []}
              pilotId={pilotId}
            />
          </div>

          <aside>
            <OnlineATCPanel initialSessions={atcSessions ?? []} />
          </aside>
        </div>
      </section>
    </main>
  );
}