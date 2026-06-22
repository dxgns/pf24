import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { createFlightPlan } from "@/app/actions/createFlightPlan";
import { supabase } from "@/lib/supabase";
import PilotFlightPlans from "@/components/PilotFlightPlans";
import OnlineATCPanel from "@/components/OnlineATCPanel";

const { data: atcSessions } = await supabase
  .from("atc_sessions")
  .select("*")
  .eq("is_active", true)
  .order("started_at", { ascending: false });

<OnlineATCPanel initialSessions={atcSessions ?? []} />

const AIRCRAFT_TYPES = [
  "A220", "A320", "A330", "A350", "B717", "B727", "B737",
  "B757", "B777", "B778", "MD11", "SW3", "C550",
  "C150", "DH8D", "F100", "HAWK", "EUFI", "TBM9", "BE58", "PA46",
];

const AIRPORTS = [
  "LCLK", "LCPH", "LCRA", "MDAB", "MDCR", "MDST", "MDPC",
  "EFKT", "MTCA", "GCLP", "LEMH", "EGKK", "EGHI",
];

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
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[#050816] px-6 py-24 text-white">
      <section className="section-container max-w-5xl">
        <h1 className="text-4xl font-extrabold">Portal Piloto</h1>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="panel rounded-2xl p-5">
            <p className="mono text-xs text-sky-300/70">PILOTO</p>
            <p className="mono mt-2 text-xl font-bold">{session.user?.name}</p>
          </div>

          <div className="panel rounded-2xl p-5">
            <p className="mono text-xs text-sky-300/70">HORA UTC</p>
            <p className="mono mt-2 text-xl font-bold">{new Date().toISOString().slice(11, 19)}</p>
          </div>

          <div className="panel rounded-2xl p-5">
            <p className="mono text-xs text-sky-300/70">SISTEMA</p>
            <p className="mono mt-2 text-xl font-bold text-green-300">ONLINE</p>
          </div>

          <div className="panel rounded-2xl p-5">
            <p className="mono text-xs text-sky-300/70">MODO</p>
            <p className="mono mt-2 text-xl font-bold">PILOT OPS</p>
          </div>
        </div>

        <div className="panel mt-8 rounded-3xl p-8">
          <h2 className="text-2xl font-bold">Nuevo Plan de Vuelo</h2>

          <form action={createFlightPlan} className="mt-6 grid gap-4">
            <input name="callsign" placeholder="Callsign" className="rounded-xl bg-slate-800 p-3" required />

            <select name="aircraftType" className="rounded-xl bg-slate-800 p-3" required>
              <option value="">Seleccionar aeronave</option>
              {AIRCRAFT_TYPES.map((aircraft) => (
                <option key={aircraft} value={aircraft}>{aircraft}</option>
              ))}
            </select>

            <select name="flightRules" className="rounded-xl bg-slate-800 p-3" required>
              <option value="IFR">IFR</option>
              <option value="VFR">VFR</option>
              <option value="YFR">YFR</option>
              <option value="ZFR">ZFR</option>
            </select>

            <select name="departure" className="rounded-xl bg-slate-800 p-3" required>
              <option value="">Salida</option>
              {AIRPORTS.map((airport) => (
                <option key={airport} value={airport}>{airport}</option>
              ))}
            </select>

            <select name="arrival" className="rounded-xl bg-slate-800 p-3" required>
              <option value="">Llegada</option>
              {AIRPORTS.map((airport) => (
                <option key={airport} value={airport}>{airport}</option>
              ))}
            </select>

            <input name="route" placeholder="Ruta" className="rounded-xl bg-slate-800 p-3" required />
            <input name="flightLevel" placeholder="FL350" className="rounded-xl bg-slate-800 p-3" required />

            <textarea name="notes" placeholder="Notas adicionales" className="rounded-xl bg-slate-800 p-3" />

            <button type="submit" className="rounded-xl bg-sky-500 p-3 font-semibold">
              Crear Plan de Vuelo
            </button>
          </form>
        </div>

        <PilotFlightPlans
          initialPlans={flightPlans ?? []}
          pilotId={pilotId}
        />
      </section>
    </main>
  );
}