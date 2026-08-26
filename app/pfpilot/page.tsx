import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import ContactMeReceiver from "@/components/ContactMeReceiver";
import UtcClock from "@/components/UtcClock";
import PFPilotStateShell from "@/components/PFPilotStateShell";
import PFPilotAltimeterStdToggle from "@/components/PFPilotAltimeterStdToggle";
import PilotFlightPlanReadOnlyGuard from "@/components/PilotFlightPlanReadOnlyGuard";

export const metadata: Metadata = {
  title: "PFPilot Beta | PF24",
};

export default async function PFPilotPage() {
  let session;

  try {
    session = await auth();
  } catch (error) {
    console.error("PF24 PFPilot auth error:", error);
    redirect("/login");
  }

  if (!session) redirect("/login");
  if (!session.user?.permissions?.canAccessPilot) redirect("/access-denied");

  const pilotId = session.user?.email ?? session.user?.name ?? "unknown";
  const pilotName = session.user?.name ?? "Piloto";

  let flightPlans: any[] = [];
  let atcSessions: any[] = [];
  let atisMessages: any[] = [];

  try {
    const result = await supabase
      .from("flight_plans")
      .select("*")
      .eq("created_by", pilotId)
      .neq("status", "FINISHED")
      .order("created_at", { ascending: false });
    if (result.error) console.error("PFPilot flight plan load error:", result.error);
    else flightPlans = result.data ?? [];
  } catch (error) {
    console.error("PFPilot flight plan query exception:", error);
  }

  try {
    const result = await supabase
      .from("atc_sessions")
      .select("*")
      .eq("is_active", true)
      .order("started_at", { ascending: false });
    if (result.error) console.error("PFPilot ATC session load error:", result.error);
    else atcSessions = result.data ?? [];
  } catch (error) {
    console.error("PFPilot ATC session query exception:", error);
  }

  try {
    const result = await supabase
      .from("atis_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40);
    if (result.error) console.error("PFPilot ATIS load error:", result.error);
    else atisMessages = result.data ?? [];
  } catch (error) {
    console.error("PFPilot ATIS query exception:", error);
  }

  return (
    <main className="radar-grid min-h-screen bg-[#020617] px-4 py-12 text-white sm:px-6 sm:py-16">
      <section className="section-container max-w-7xl">
        <ContactMeReceiver pilotId={pilotId} />
        <PFPilotAltimeterStdToggle />
        <PilotFlightPlanReadOnlyGuard />

        <div className="panel rounded-3xl p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/dashboard"
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
            >
              ← Regresar
            </Link>
            <div className="mono text-sm tracking-[0.25em] text-slate-400">PF24 · BETA</div>
          </div>

          <div className="mt-7 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="mono text-xs uppercase tracking-[0.28em] text-sky-300/70">Pilot Flight Assistant</p>
              <h1 className="mt-2 text-4xl font-extrabold sm:text-5xl">PFPilot</h1>
              <p className="mt-3 max-w-3xl text-slate-400">
                Entorno modular de vuelo para pilotos PF24. Las herramientas se abren por apartado para mantener la pantalla limpia durante la operación.
              </p>
            </div>
            <div className="rounded-2xl border border-green-400/20 bg-green-400/5 px-4 py-3">
              <p className="mono text-[10px] text-green-300/70">SYSTEM</p>
              <p className="mono mt-1 text-sm font-bold text-green-300">PROTOTYPE ONLINE</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <InfoCard label="PILOTO" value={pilotName} />
          <InfoCard label="HORA UTC" value={<UtcClock />} />
          <InfoCard label="PLATAFORMA" value="PFPILOT BETA" accent />
        </div>

        <PFPilotStateShell
          pilotId={pilotId}
          pilotName={pilotName}
          initialPlans={flightPlans}
          initialSessions={atcSessions}
          initialAtis={atisMessages}
        />
      </section>
    </main>
  );
}

function InfoCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="panel rounded-2xl p-4 sm:p-5">
      <p className="mono text-[10px] text-sky-300/70">{label}</p>
      <p className={`mono mt-2 text-lg font-bold ${accent ? "text-sky-300" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
