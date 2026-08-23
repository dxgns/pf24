import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PilotFlightPlanForm from "@/components/PilotFlightPlanForm";
import PilotFlightPlans from "@/components/PilotFlightPlans";
import OnlineATCPanel from "@/components/OnlineATCPanel";
import UtcClock from "@/components/UtcClock";
import ContactMeReceiver from "@/components/ContactMeReceiver";
import LatestAtisPanel from "@/components/LatestAtisPanel";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portal Piloto | PF24",
};

export default async function PilotPage() {
  let session;

  try {
    session = await auth();
  } catch (error) {
    console.error("PF24 Pilot auth error:", error);
    redirect("/login");
  }

  if (!session) {
    redirect("/login");
  }

  if (!session.user?.permissions?.canAccessPilot) {
    redirect("/access-denied");
  }

  const pilotId = session.user?.email ?? session.user?.name ?? "unknown";

  let flightPlans;
  let atcSessions;
  let atisMessages;

  try {
    const result = await supabase
      .from("flight_plans")
      .select("*")
      .eq("created_by", pilotId)
      .neq("status", "FINISHED")
      .order("created_at", { ascending: false });

    if (result.error) {
      console.error("PF24 Pilot flight plan load error:", result.error);
    } else {
      flightPlans = result.data;
    }
  } catch (error) {
    console.error("PF24 Pilot flight plan query exception:", error);
  }

  try {
    const result = await supabase
      .from("atc_sessions")
      .select("*")
      .eq("is_active", true)
      .order("started_at", { ascending: false });

    if (result.error) {
      console.error("PF24 Pilot ATC session load error:", result.error);
    } else {
      atcSessions = result.data;
    }
  } catch (error) {
    console.error("PF24 Pilot ATC session query exception:", error);
  }

  try {
    const result = await supabase
      .from("atis_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (result.error) {
      console.error("PF24 Pilot ATIS load error:", result.error);
    } else {
      atisMessages = result.data;
    }
  } catch (error) {
    console.error("PF24 Pilot ATIS query exception:", error);
  }

  const latestAtisByAirport = Object.values(
    (atisMessages ?? []).reduce<Record<string, any>>((acc, atis) => {
      if (!acc[atis.airport_icao]) {
        acc[atis.airport_icao] = atis;
      }

      return acc;
    }, {})
  );

  return (
    <main className="radar-grid min-h-screen bg-[#020617] px-6 py-24 text-white">
      <section className="section-container max-w-6xl">
        <ContactMeReceiver pilotId={pilotId} />

        <div className="panel rounded-3xl p-8">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/dashboard"
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
            >
              ← Regresar
            </Link>

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
            <LatestAtisPanel showAlerts={true} />
          </aside>
        </div>
      </section>
    </main>
  );
}
